#!/usr/bin/env node

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { parseArgs, ParseArgsConfig } from 'util';
import { createRequire } from 'module';
import { getConfig, linkContextFile, CONTEXT_FILE, DEFAULT_MODELS } from './config.js';
import { getDiff } from './git.js';
import { summarize } from './summarize.js';
import { writeEntry, getLastEntry } from './writer.js';
import { install, uninstall } from './hook.js';
import { BriefedConfig } from './types.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: string) => (text: string): string => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const c = {
  bold: paint('1'),
  title: paint('1;35'),
  heading: paint('1;36'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  cyan: paint('36'),
  gray: paint('90'),
};

const VALID_BACKENDS: BriefedConfig['backend'][] = ['ollama', 'anthropic', 'gemini', 'none'];
const RULE = c.title('================================================================================');

const guide = `
${RULE}
${c.title('                          BRIEFED -- QUICK SETUP                               ')}
${RULE}

${c.bold('How it works:')}
  Briefed installs Git hooks into any repo. After a ${c.yellow('git pull')}, ${c.yellow('merge')}, ${c.yellow('rebase')} or
  branch switch, the hook runs in the background (git never waits). It summarizes
  what changed into ${c.cyan(CONTEXT_FILE)} (gitignored, so no dirty tree and no merge
  conflicts), which ${c.cyan('CLAUDE.md')} / ${c.cyan('AGENTS.md')} / ${c.cyan('copilot-instructions.md')} reference.

${c.heading('STEP 1 -- Install globally (once)')}
  ${c.gray('$')} ${c.green('npm install -g briefed-cli')}      ${c.gray('# or skip and use: npx briefed-cli init')}

${c.heading('STEP 2 -- Set up each repo you want to track (run inside the repo root)')}
  ${c.gray('$')} ${c.green('briefed init')}
  Installs post-merge, post-rewrite and post-checkout hooks into ${c.yellow('.git/hooks/')}
  (or ${c.yellow('.husky/')} if present) and links ${CONTEXT_FILE} from your agent files.

${c.heading('STEP 3 -- Test it right now')}
  ${c.gray('$')} ${c.green('briefed run')}       ${c.gray('# add --verbose to see what it does')}

${c.heading('STEP 4 -- From now on, it is automatic')}
  Hook output from the last run is in ${c.yellow('.git/briefed.log')}.

${RULE}
${c.bold('Configure your LLM backend:')}
${RULE}

  ${c.heading('No API key (default):')} summaries come from commit messages. Free and offline.
  ${c.heading('Gemini:')}     ${c.green('export GEMINI_API_KEY="your-key"')}     ${c.gray('# auto-selected when set')}
  ${c.heading('Anthropic:')}  ${c.green('export ANTHROPIC_API_KEY="your-key"')}  ${c.gray('# auto-selected when set')}
  ${c.heading('Ollama:')}     ${c.gray('"backend": "ollama", "model": "llama3"')}

  Global config  ->  ~/.briefed.json   (applies to every repo on this machine)
  Per-repo config -> .briefed.json     (keep apiKey out of it; use env vars)

  ${c.gray('{ "backend": "gemini", "window": { "entries": 10 }, "ignored": ["*.lock", "dist/"] }')}

${c.heading('Optional -- CI/CD (GitHub Actions):')}
  Only for teams that merge PRs in the GitHub UI and want one committed context file.
  See: ${c.cyan('https://thechaitanyaanand.github.io/Briefed/ci-cd.html')}
${RULE}
`;

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

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

async function interactiveSetup(): Promise<void> {
  const localPath = path.resolve(process.cwd(), '.briefed.json');
  const globalPath = path.join(os.homedir(), '.briefed.json');
  const localJson = readJson(localPath);
  const globalJson = readJson(globalPath);

  const defaultTarget = localJson.target || globalJson.target || 'auto';
  const defaultBackend = localJson.backend || globalJson.backend || 'none';

  const target = (await askQuestion(`Preferred context file path [default: ${defaultTarget}]: `)) || defaultTarget;

  let backend = (await askQuestion(`Preferred LLM backend (${VALID_BACKENDS.join(', ')}) [default: ${defaultBackend}]: `)) || defaultBackend;
  if (!VALID_BACKENDS.includes(backend)) {
    console.log(c.yellow(`Warning: Invalid backend "${backend}". Defaulting to "${defaultBackend}".`));
    backend = defaultBackend;
  }

  let apiKey: string | undefined = undefined;
  let saveLocation: 'global' | 'local' = 'global';

  if (backend === 'gemini' || backend === 'anthropic') {
    const currentApiKey = localJson.apiKey || globalJson.apiKey;
    const apiKeyPrompt = currentApiKey
      ? `Enter API key (leave empty to keep existing key starting with ${currentApiKey.substring(0, 4)}...): `
      : `Enter API key (leave empty to skip / use env variable): `;
    apiKey = (await askQuestion(apiKeyPrompt)) || currentApiKey;

    if (apiKey) {
      const choice = (await askQuestion(`Save API key to global (~/.briefed.json) or local (.briefed.json) configuration? (global/local) [default: global]: `)).toLowerCase();
      saveLocation = (choice === 'local' || choice === 'project') ? 'local' : 'global';
    }
  }

  const newLocalConfig = { ...localJson, target, backend };

  if (apiKey) {
    if (saveLocation === 'local') {
      newLocalConfig.apiKey = apiKey;
      if (globalJson.apiKey) {
        delete globalJson.apiKey;
        fs.writeFileSync(globalPath, JSON.stringify(globalJson, null, 2), 'utf-8');
      }
    } else {
      globalJson.apiKey = apiKey;
      fs.writeFileSync(globalPath, JSON.stringify(globalJson, null, 2), 'utf-8');
      console.log(c.green(`✓ API key saved globally to ~/.briefed.json`));
      delete newLocalConfig.apiKey;
    }
  }

  fs.writeFileSync(localPath, JSON.stringify(newLocalConfig, null, 2), 'utf-8');
  console.log(c.green(`✓ Config saved to .briefed.json`));
}

async function runInit(values: Record<string, any>): Promise<void> {
  if (values.interactive) {
    await interactiveSetup();
  }

  const result = install();
  const cfg = getConfig();

  if (result.installed.length > 0) {
    console.log(c.green(`✓ Hooks installed: ${result.installed.join(', ')}`));
  }
  if (result.skipped.length > 0) {
    console.log(c.gray(`· Hooks already present (skipped): ${result.skipped.join(', ')}`));
  }
  for (const warning of result.warnings) {
    console.log(c.yellow(`  ⚠ ${warning}`));
  }
  console.log(c.green(`✓ Target context file: ${cfg.target}`));

  const usesDefaultTarget = cfg.target === path.resolve(process.cwd(), CONTEXT_FILE);
  const linked = usesDefaultTarget ? linkContextFile(process.cwd()) : [];
  for (const file of linked) {
    console.log(c.green(`✓ Linked .briefed/context.md from ${path.relative(process.cwd(), file)}`));
  }

  // UX-01: Next steps guide
  console.log('');
  console.log(c.heading('Next Steps:'));
  if (linked.length > 0) {
    console.log(`  1. Commit the link: ${c.gray(`git add ${linked.map(f => path.relative(process.cwd(), f)).join(' ')}`)}`);
  } else {
    console.log(`  1. Commit your context file: ${c.gray(`git add ${path.relative(process.cwd(), cfg.target)}`)}`);
  }
  console.log(`  2. Run ${c.yellow('briefed run')} to trigger a sync now.`);
  console.log(`  3. Pull, merge or switch branches -- Briefed updates in the background.`);
  console.log(`  4. Teammates: run ${c.yellow('npx briefed-cli init')} once per clone (git hooks aren't shared).`);
}

const MODEL_PREFIXES: Record<string, string[]> = {
  ollama: ['llama', 'mistral', 'codellama', 'deepseek', 'phi', 'gemma', 'qwen'],
  anthropic: ['claude'],
  gemini: ['gemini'],
};

async function runSync(values: Record<string, any>): Promise<void> {
  const startTime = Date.now();
  const cfg = getConfig();

  if (values.backend) {
    // NEW-10: Validate backend value
    if (!VALID_BACKENDS.includes(values.backend)) {
      throw new Error(`Invalid backend "${values.backend}". Valid options: ${VALID_BACKENDS.join(', ')}`);
    }
    cfg.backend = values.backend;

    // UX-08: Smart model mismatch auto-resolution on backend override
    if (!values.model && cfg.backend !== 'none') {
      const currentModel = cfg.model.toLowerCase();
      const belongsToOverride = MODEL_PREFIXES[cfg.backend]?.some(prefix => currentModel.startsWith(prefix));
      if (!belongsToOverride) {
        const resolved = DEFAULT_MODELS[cfg.backend];
        console.log(c.yellow(`Warning: Model "${cfg.model}" does not match backend "${cfg.backend}". Auto-resolving to "${resolved}".`));
        cfg.model = resolved;
      }
    }
  }
  if (values.model) {
    cfg.model = values.model;
  }
  if (values.target) {
    cfg.target = path.resolve(process.cwd(), values.target);
  }

  const diff = getDiff(undefined, cfg.ignored, values.verbose, cfg.target, values.since);

  if (diff.isEmpty) {
    console.log(c.gray('· No new commits or changes detected.'));
    return;
  }

  // Spinner only on a real terminal; hooks write to a log file
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let idx = 0;
  const spinnerInterval = process.stdout.isTTY
    ? setInterval(() => {
        process.stdout.write(`\r${frames[idx]} Summarizing changes...`);
        idx = (idx + 1) % frames.length;
      }, 80)
    : undefined;

  let summarizeOutput;
  try {
    summarizeOutput = await summarize({ diff, config: cfg });
  } finally {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      process.stdout.write('\r\x1b[K');
    }
  }

  writeEntry(summarizeOutput.entry, cfg);
  console.log(c.green(`✓ Context file updated: ${diff.commitHash} → ${cfg.target}`));

  if (values.verbose) {
    console.log(`Diff stats: ${diff.additions} insertions, ${diff.deletions} deletions, ${diff.files.length} changed files`);
    console.log(`Summarizer used: ${summarizeOutput.backendUsed} (Skipped LLM: ${summarizeOutput.skippedLLM})`);
    console.log(`Process elapsed: ${Date.now() - startTime} ms`);
  }
}

function runStatus(): void {
  const cfg = getConfig();
  const lastEntry = getLastEntry(cfg);
  if (!lastEntry) {
    console.log(c.yellow(`No context entries found in ${cfg.target}.`));
    return;
  }
  console.log(c.bold('Target File: ') + c.cyan(cfg.target));
  console.log(c.bold('Date:        ') + c.cyan(lastEntry.date));
  console.log(c.bold('Commit:      ') + c.cyan(lastEntry.commitHash));
  if (lastEntry.sourceBranch) {
    console.log(c.bold('Branch:      ') + c.cyan(lastEntry.sourceBranch));
  }
  console.log(c.bold('\nSummary:'));
  console.log(lastEntry.summary);
}

function runConfig(): void {
  const cfg = { ...getConfig() };
  if (cfg.apiKey) {
    cfg.apiKey = '[REDACTED]';
  }
  console.log(JSON.stringify(cfg, null, 2));
}

interface CommandSpec {
  description: string;
  options: NonNullable<ParseArgsConfig['options']>;
  optionHelp: string[];
  action: (values: Record<string, any>) => void | Promise<void>;
}

const COMMANDS: Record<string, CommandSpec> = {
  init: {
    description: 'Install Git hooks and link the context file from your agent files',
    options: { interactive: { type: 'boolean', short: 'i' } },
    optionHelp: ['-i, --interactive        Run interactive setup to configure target path and LLM backend'],
    action: runInit,
  },
  run: {
    description: 'Summarize recent git changes into the context file',
    options: {
      backend: { type: 'string', short: 'b' },
      model: { type: 'string', short: 'm' },
      target: { type: 'string', short: 't' },
      since: { type: 'string' },
      verbose: { type: 'boolean', short: 'v' },
    },
    optionHelp: [
      `-b, --backend <backend>  Override backend (${VALID_BACKENDS.join(', ')})`,
      '-m, --model <model>      Override model',
      '-t, --target <path>      Override target file path',
      '    --since <ref>        Diff from merge-base(<ref>, HEAD) instead of ORIG_HEAD',
      '-v, --verbose            Enable verbose debugging output',
    ],
    action: runSync,
  },
  status: { description: 'Show the latest context entry', options: {}, optionHelp: [], action: runStatus },
  uninstall: {
    description: 'Uninstall Git hooks',
    options: {},
    optionHelp: [],
    action: () => {
      uninstall();
      console.log(c.green('✓ Git hooks uninstalled successfully'));
    },
  },
  config: { description: 'Print the resolved configuration', options: {}, optionHelp: [], action: runConfig },
};

function printHelp(name?: string): void {
  const spec = name ? COMMANDS[name] : undefined;
  if (name && spec) {
    console.log(`Usage: briefed ${name}${spec.optionHelp.length ? ' [options]' : ''}\n\n${spec.description}\n`);
    console.log(['Options:', ...spec.optionHelp, '-h, --help               Display help for command'].join('\n  '));
    return;
  }
  console.log(`Usage: briefed <command> [options]\n\nAI-powered git context synchronizer\n\nCommands:`);
  for (const [cmd, s] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(12)}${s.description}`);
  }
  console.log(`\nOptions:\n  -V, --version  Output the version number\n  -h, --help     Display help`);
  console.log(guide);
}

async function main(): Promise<void> {
  const [name, ...rest] = process.argv.slice(2);

  if (!name || name === '-h' || name === '--help' || name === 'help') {
    printHelp(rest[0]);
    return;
  }
  if (name === '-V' || name === '--version') {
    console.log(pkg.version);
    return;
  }

  const spec = COMMANDS[name];
  if (!spec) {
    console.error(c.red(`Error: Unknown command "${name}". Run "briefed --help".`));
    process.exit(1);
  }
  if (rest.includes('-h') || rest.includes('--help')) {
    printHelp(name);
    return;
  }

  try {
    const { values } = parseArgs({ args: rest, options: spec.options, strict: true });
    await spec.action(values);
  } catch (error: any) {
    console.error(c.red(`Error: ${error?.message || error}`));
    // Safe in hooks: the hook scripts background this process and always exit 0
    process.exit(1);
  }
}

main();
