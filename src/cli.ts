#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createRequire } from 'module';
import chalk from 'chalk';
import { Command } from 'commander';
import { getConfig } from './config.js';
import { getDiff } from './git.js';
import { summarize } from './summarize.js';
import { writeEntry, getLastEntry } from './writer.js';
import { install, uninstall } from './hook.js';
import { BriefedConfig, ContextEntry, DiffResult } from './types.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const program = new Command();

program
  .name('briefed')
  .description('AI-powered git summary and project context synchronizer')
  .version(pkg.version);

// Beautiful custom Help formatting & Configuration Guide
const helpText = `
${chalk.bold.magenta('================================================================================')}
${chalk.bold.magenta('                       HELP & CONFIGURATION GUIDE                               ')}
${chalk.bold.magenta('================================================================================')}

${chalk.bold.cyan('Environment Keys:')}
  To authenticate cloud LLM backends, set one of the following environment variables:
  - ${chalk.yellow('BRIEFED_API_KEY')}    : Unified key for Anthropic or Gemini.
  - ${chalk.yellow('ANTHROPIC_API_KEY')}  : Key specifically for the Anthropic Claude API.
  - ${chalk.yellow('GEMINI_API_KEY')}     : Key specifically for the Google Gemini API.

${chalk.bold.cyan('Fallback Mechanics:')}
  If a selected LLM backend fails (e.g. network timeout, missing API keys) or if
  the diff is very small, Briefed automatically falls back to the zero-config ${chalk.yellow('none')}
  backend. The ${chalk.yellow('none')} backend provides a fast, mechanical summary containing
  directory groupings and line insertions/deletions statistics without hitting any API.

${chalk.bold.cyan('Config File Blueprint:')}
  You can customize Briefed by creating a ${chalk.yellow('.briefed.json')} file in your project
  root directory. Here is an example configuration blueprint:

  ${chalk.gray('{')}
    ${chalk.cyan('"target"')}: ${chalk.green('"auto"')},
    ${chalk.cyan('"backend"')}: ${chalk.green('"ollama"')},
    ${chalk.cyan('"model"')}: ${chalk.green('"llama3"')},
    ${chalk.cyan('"apiUrl"')}: ${chalk.green('"http://localhost:11434"')},
    ${chalk.cyan('"window"')}: ${chalk.gray('{')}
      ${chalk.cyan('"days"')}: ${chalk.yellow('7')},
      ${chalk.cyan('"entries"')}: ${chalk.yellow('10')}
    ${chalk.gray('}')},
    ${chalk.cyan('"ignored"')}: ${chalk.gray('[')}${chalk.green('"*.lock"')}, ${chalk.green('"dist/"')}${chalk.gray(']')},
    ${chalk.cyan('"minDiffLines"')}: ${chalk.yellow('10')}
  ${chalk.gray('}')}

${chalk.bold.magenta('================================================================================')}
`;

program.addHelpText('after', helpText);

function askQuestion(query: string): Promise<string> {
  // NEW-04: Guard against non-TTY stdin (CI, piped input, redirected stdin)
  if (!process.stdin.isTTY) {
    return Promise.resolve('');
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on('close', () => {
      resolve('');
    });
  });
}

program
  .command('init')
  .description('Install Git hooks and resolve target context file')
  .option('-i, --interactive', 'Run interactive setup to configure target path and LLM backend')
  .action(async (options) => {
    try {
      if (options.interactive) {
        let currentJson: any = {};
        const configPath = path.resolve(process.cwd(), '.briefed.json');
        if (fs.existsSync(configPath)) {
          try {
            currentJson = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          } catch (e) {
            currentJson = {};
          }
        }

        const defaultTarget = currentJson.target || 'auto';
        const defaultBackend = currentJson.backend || 'ollama';

        const targetInput = await askQuestion(`Preferred context file path [default: ${defaultTarget}]: `);
        const target = targetInput || defaultTarget;

        const backendInput = await askQuestion(`Preferred LLM backend (ollama, anthropic, gemini, none) [default: ${defaultBackend}]: `);
        let backend = backendInput || defaultBackend;

        const validBackends = ['ollama', 'anthropic', 'gemini', 'none'];
        if (!validBackends.includes(backend)) {
          console.log(chalk.yellow(`Warning: Invalid backend "${backend}". Defaulting to "${defaultBackend}".`));
          backend = defaultBackend;
        }

        const newConfig = {
          ...currentJson,
          target,
          backend
        };
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
        console.log(chalk.green(`✓ Config saved to .briefed.json`));
      }

      const result = install();
      const cfg = getConfig();

      // Show detailed hook installation results
      if (result.installed.length > 0) {
        console.log(chalk.green(`✓ Hooks installed: ${result.installed.join(', ')}`));
      }
      if (result.skipped.length > 0) {
        console.log(chalk.gray(`· Hooks already present (skipped): ${result.skipped.join(', ')}`));
      }
      console.log(chalk.green(`✓ Target context file: ${cfg.target}`));

      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  ⚠ ${warning}`));
        }
      }

      // UX-01: Next steps guide
      console.log('');
      console.log(chalk.bold.cyan('Next Steps:'));
      console.log(chalk.white(`  1. Add ${chalk.yellow(path.basename(cfg.target))} to version control:`));
      console.log(chalk.gray(`     git add ${path.basename(cfg.target)} .briefed.json`));
      console.log(chalk.white(`  2. Run ${chalk.yellow('briefed run')} to manually trigger a context sync.`));
      console.log(chalk.white(`  3. Pull or merge changes — Briefed updates automatically via hooks.`));
      console.log(chalk.white(`  4. Run ${chalk.yellow('briefed config')} to inspect your resolved configuration.`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run git diff and update target context file with summary')
  .option('-b, --backend <backend>', "Override backend ('ollama', 'anthropic', 'gemini', 'none')")
  .option('-m, --model <model>', 'Override model')
  .option('-t, --target <path>', 'Override target file path')
  .option('-v, --verbose', 'Enable verbose debugging output')
  .action(async (options) => {
    const startTime = Date.now();
    try {
      const cfg = getConfig();
      // UX-08: Smart model mismatch auto-resolution on backend override
      const DEFAULT_MODELS: Record<string, string> = {
        ollama: 'llama3',
        anthropic: 'claude-sonnet-4-20250514',
        gemini: 'gemini-2.5-flash',
        none: 'none',
      };
      const MODEL_PREFIXES: Record<string, string[]> = {
        ollama: ['llama', 'mistral', 'codellama', 'deepseek', 'phi', 'gemma', 'qwen'],
        anthropic: ['claude'],
        gemini: ['gemini'],
      };

      // NEW-10: Validate backend value
      const VALID_BACKENDS = ['ollama', 'anthropic', 'gemini', 'none'];
      if (options.backend) {
        if (!VALID_BACKENDS.includes(options.backend)) {
          console.error(chalk.red(`Error: Invalid backend "${options.backend}". Valid options: ${VALID_BACKENDS.join(', ')}`));
          process.exit(1);
        }
        cfg.backend = options.backend;

        if (!options.model && cfg.backend !== 'none') {
          // Check if the current model belongs to a different backend
          const currentModel = cfg.model.toLowerCase();
          const belongsToOverride = MODEL_PREFIXES[cfg.backend]?.some(
            (prefix) => currentModel.startsWith(prefix)
          );

          if (!belongsToOverride) {
            const resolved = DEFAULT_MODELS[cfg.backend] || cfg.model;
            console.log(
              chalk.yellow(
                `Warning: Model "${cfg.model}" does not match backend "${cfg.backend}". Auto-resolving to "${resolved}".`
              )
            );
            cfg.model = resolved;
          }
        }
      }
      if (options.model) {
        cfg.model = options.model;
      }
      if (options.target) {
        cfg.target = path.resolve(process.cwd(), options.target);
      }

      const diff = getDiff(undefined, cfg.ignored, options.verbose, cfg.target);

      if (diff.isEmpty) {
        console.log(chalk.gray('· No new commits or changes detected.'));
        process.exit(0);
      }

      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let idx = 0;
      const spinnerInterval = setInterval(() => {
        process.stdout.write(`\r${frames[idx]} Summarizing changes...`);
        idx = (idx + 1) % frames.length;
      }, 80);

      let summarizeOutput;
      try {
        summarizeOutput = await summarize({ diff, config: cfg });
      } finally {
        clearInterval(spinnerInterval);
        process.stdout.write('\r\x1b[K');
      }

      writeEntry(summarizeOutput.entry, cfg);

      console.log(
        chalk.green(`✓ Context file updated: ${diff.commitHash} → ${cfg.target}`)
      );

      if (options.verbose) {
        console.log(
          `Diff stats: ${diff.additions} insertions, ${diff.deletions} deletions, ${diff.files.length} changed files`
        );
        console.log(
          `Summarizer used: ${summarizeOutput.backendUsed} (Skipped LLM: ${summarizeOutput.skippedLLM})`
        );
        console.log(
          `Process elapsed: ${Date.now() - startTime} ms`
        );
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      // Exit with 0 in git hooks so we never block git operations (e.g. pull/merge)
      const isHook = Object.keys(process.env).some(key => key.startsWith('GIT_'));
      process.exit(isHook ? 0 : 1);
    }
  });

program
  .command('status')
  .description('Show the latest context entry status')
  .action(() => {
    try {
      const cfg = getConfig();
      const lastEntry = getLastEntry(cfg);
      if (lastEntry) {
        console.log(chalk.bold('Target File: ') + chalk.cyan(cfg.target));
        console.log(chalk.bold('Date:        ') + chalk.cyan(lastEntry.date));
        console.log(chalk.bold('Commit:      ') + chalk.cyan(lastEntry.commitHash));
        if (lastEntry.sourceBranch) {
          console.log(chalk.bold('Branch:      ') + chalk.cyan(lastEntry.sourceBranch));
        }
        console.log(chalk.bold('\nSummary:'));
        console.log(chalk.white(lastEntry.summary));
      } else {
        console.log(chalk.yellow(`No context entries found in ${cfg.target}.`));
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Uninstall Git hooks')
  .action(() => {
    try {
      uninstall();
      console.log(chalk.green('✓ Git hooks uninstalled successfully'));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Print the resolved BriefedConfig configuration')
  .action(() => {
    try {
      const cfg = getConfig();
      const cloned = { ...cfg };
      if (cloned.apiKey) {
        cloned.apiKey = '[REDACTED]';
      }
      console.log(JSON.stringify(cloned, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

