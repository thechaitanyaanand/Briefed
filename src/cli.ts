#!/usr/bin/env node

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

program
  .command('init')
  .description('Install Git hooks and resolve target context file')
  .action(() => {
    try {
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
  .action(async () => {
    try {
      const cfg = getConfig();
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
