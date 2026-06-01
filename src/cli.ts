#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { Command } from 'commander';
import { getConfig } from './config.js';
import { getDiff } from './git.js';
import { summarize } from './summarize.js';
import { writeEntry, getLastEntry } from './writer.js';
import { install } from './hook.js';
import { BriefedConfig, ContextEntry, DiffResult } from './types.js';

const program = new Command();

program
  .name('briefed')
  .description('AI-powered git summary and project context synchronizer')
  .version('0.1.0');

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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
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
      console.log(chalk.green('✓ Hooks installed successfully'));
      console.log(chalk.green(`✓ Target context file resolved: ${cfg.target}`));
      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`Warning: ${warning}`));
        }
      }
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
      if (options.backend) {
        cfg.backend = options.backend;
        if (options.backend === 'gemini' && (!options.model && cfg.model === 'llama3')) {
          cfg.model = 'gemini-2.5-flash';
        }
      }
      if (options.model) {
        cfg.model = options.model;
      }
      if (options.target) {
        cfg.target = path.resolve(process.cwd(), options.target);
      }
      if (options.backend) {
        if (cfg.backend === 'gemini') {
          cfg.apiKey = cfg.apiKey || process.env.GEMINI_API_KEY || process.env.BRIEFED_API_KEY || process.env.ANTHROPIC_API_KEY || undefined;
        } else {
          cfg.apiKey = cfg.apiKey || process.env.BRIEFED_API_KEY || process.env.ANTHROPIC_API_KEY || undefined;
        }
      }

      const diff = getDiff(undefined, cfg.ignored);

      if (diff.isEmpty) {
        console.log(chalk.gray('· No new commits or changes detected.'));
        process.exit(0);
      }

      const summarizeOutput = await summarize({ diff, config: cfg });
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
  .command('config')
  .description('Print the resolved BriefedConfig configuration')
  .action(() => {
    try {
      const cfg = getConfig();
      console.log(JSON.stringify(cfg, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error?.message || error}`));
      process.exit(1);
    }
  });

program.parse(process.argv);

