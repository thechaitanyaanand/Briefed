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
import { MetricsCollector } from './metrics.js';
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
${chalk.bold.magenta('                          BRIEFED -- QUICK SETUP                               ')}
${chalk.bold.magenta('================================================================================')}

${chalk.bold.white('How it works:')}
  Briefed installs Git hooks into any repo. After a ${chalk.yellow('git pull')} or ${chalk.yellow('git merge')},
  the hook runs automatically -- diffs what changed, summarizes it with an LLM
  (or mechanical fallback), and appends a structured entry to your context file
  (${chalk.cyan('CLAUDE.md')}, ${chalk.cyan('AGENTS.md')}, or ${chalk.cyan('.github/copilot-instructions.md')}).
  Your AI coding tool reads that file and stays in sync -- no manual context dumps.

${chalk.bold.cyan('STEP 1 -- Install globally (once)')}
  ${chalk.gray('$')} ${chalk.green('npm install -g briefed-cli')}

${chalk.bold.cyan('STEP 2 -- Set up each repo you want to track (run inside the repo root)')}
  ${chalk.gray('$')} ${chalk.green('briefed init')}
  This installs the post-merge and post-rewrite hooks into ${chalk.yellow('.git/hooks/')}.
  If you use Husky, it appends to ${chalk.yellow('.husky/')} instead.
  Run ${chalk.green('briefed init --interactive')} to configure backend and target file.

${chalk.bold.cyan('STEP 3 -- Test it right now')}
  ${chalk.gray('$')} ${chalk.green('briefed run')}
  Manually trigger a diff against the last commit and write an entry.
  Use ${chalk.yellow('--verbose')} to see exactly what it is doing.

${chalk.bold.cyan('STEP 4 -- From now on, it is automatic')}
  Every ${chalk.yellow('git pull')} / ${chalk.yellow('git merge')} / ${chalk.yellow('git rebase')} fires the hook silently in the background.
  Your context file updates itself. Open Cursor or Claude -- already in sync.

${chalk.bold.magenta('================================================================================')}
${chalk.bold.white('Configure your LLM backend:')}
${chalk.bold.magenta('================================================================================')}

${chalk.bold.cyan('No LLM (default -- no setup needed):')}
  Works out of the box. Uses directory groupings and line stats. Fast and free.
  ${chalk.gray('"backend": "none"')}

${chalk.bold.cyan('Google Gemini (recommended cloud backend):')}
  ${chalk.gray('$')} ${chalk.green('export GEMINI_API_KEY="your-key"')}   ${chalk.gray('# or add to ~/.briefed.json')}
  ${chalk.gray('"backend": "gemini", "model": "gemini-2.5-flash"')}

${chalk.bold.cyan('Anthropic Claude:')}
  ${chalk.gray('$')} ${chalk.green('export ANTHROPIC_API_KEY="your-key"')}
  ${chalk.gray('"backend": "anthropic", "model": "claude-3-5-sonnet-20241022"')}

${chalk.bold.cyan('Ollama (local, fully offline):')}
  ${chalk.gray('$')} ${chalk.green('ollama pull llama3')}
  ${chalk.gray('"backend": "ollama", "model": "llama3"')}

${chalk.bold.magenta('================================================================================')}
${chalk.bold.white('Global config  ->  ~/.briefed.json   (applies to all repos on your machine)')}
${chalk.bold.white('Per-repo config -> .briefed.json    (add to .gitignore if it has an apiKey)')}
${chalk.bold.magenta('================================================================================')}

  ${chalk.gray('{')}
    ${chalk.cyan('"backend"')}: ${chalk.green('"gemini"')},
    ${chalk.cyan('"model"')}: ${chalk.green('"gemini-2.5-flash"')},
    ${chalk.cyan('"apiKey"')}: ${chalk.green('"your-api-key"')},          ${chalk.gray('# store in ~/.briefed.json, not in repo')}
    ${chalk.cyan('"window"')}: ${chalk.gray('{')} ${chalk.cyan('"days"')}: ${chalk.yellow('7')}, ${chalk.cyan('"entries"')}: ${chalk.yellow('10')} ${chalk.gray('}')},
    ${chalk.cyan('"ignored"')}: ${chalk.gray('[')}${chalk.green('"*.lock"')}, ${chalk.green('"dist/"')}${chalk.gray(']')},
    ${chalk.cyan('"minDiffLines"')}: ${chalk.yellow('10')}
  ${chalk.gray('}')}

${chalk.bold.yellow('Optional -- CI/CD (GitHub Actions):')}
  Only needed if your team merges PRs via GitHub web UI and wants the context
  file committed back to the repo centrally.
  See: ${chalk.cyan('https://thechaitanyaanand.github.io/Briefed/ci-cd.html')}
  For most developers using local Briefed installs, CI is not needed.

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
    const metrics = new MetricsCollector();

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
      metrics.recordDiffSize(diff.additions, diff.deletions, diff.files.length);

      if (diff.isEmpty) {
        console.log(chalk.gray('· No new commits or changes detected.'));
        await metrics.saveMetrics();
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
        const summarizeStart = Date.now();
        summarizeOutput = await summarize({ diff, config: cfg });
        metrics.recordDuration('summarize', Date.now() - summarizeStart);
      } finally {
        clearInterval(spinnerInterval);
        process.stdout.write('\r\x1b[K');
      }

      writeEntry(summarizeOutput.entry, cfg);
      metrics.recordBackendUsed(summarizeOutput.backendUsed);
      metrics.recordOutcome(true);
      metrics.recordDuration('run', Date.now() - startTime);

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
      metrics.recordOutcome(false, error?.message || String(error));
      await metrics.saveMetrics();
      console.error(chalk.red(`Error: ${error?.message || error}`));
      // Exit with 0 in git hooks so we never block git operations (e.g. pull/merge)
      const isHook = Object.keys(process.env).some(key => key.startsWith('GIT_'));
      process.exit(isHook ? 0 : 1);
    }

    await metrics.saveMetrics();
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

