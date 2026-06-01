import * as fs from 'fs';
import * as path from 'path';
import { BriefedConfig } from './types.js';

export const DEFAULT_CONFIG: BriefedConfig = {
  target: 'auto',
  backend: 'ollama',
  model: 'llama3',
  apiUrl: 'http://localhost:11434',
  window: { days: 7, entries: 10 },
  ignored: ['*.lock', 'dist/', '*.map', '*.min.js', '*.min.css'],
  minDiffLines: 10
};

/**
 * Checks presence of files in order: CLAUDE.md -> AGENTS.md -> .github/copilot-instructions.md in the given cwd.
 * Returns the absolute path of the first found file.
 * If none exist, creates an empty CLAUDE.md with a default header and returns its absolute path.
 */
export function resolveTargetFile(cwd: string): string {
  const candidates = [
    'CLAUDE.md',
    'AGENTS.md',
    path.join('.github', 'copilot-instructions.md')
  ];

  for (const candidate of candidates) {
    const fullPath = path.resolve(cwd, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // If none exist, create an empty CLAUDE.md in cwd
  const claudePath = path.resolve(cwd, 'CLAUDE.md');
  const dir = path.dirname(claudePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(claudePath, '# AI Context\n\nManaged by Briefed.');
  return claudePath;
}

/**
 * Deep merges target and source objects recursively, without modifying the originals.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key as keyof T] = deepMerge(result[key], val);
        } else {
          result[key as keyof T] = deepMerge({} as any, val) as any;
        }
      } else {
        result[key as keyof T] = val;
      }
    }
  }
  return result;
}

/**
 * Load .briefed.json from cwd (default process.cwd()).
 * If not found or invalid, merge defaults.
 * Performs a DEEP MERGE with the DEFAULT_CONFIG.
 * If target is 'auto', call resolveTargetFile. Otherwise, resolve target path to absolute path.
 * Resolve apiKey in order: user config field -> process.env.BRIEFED_API_KEY -> process.env.ANTHROPIC_API_KEY -> undefined.
 */
export function getConfig(cwd?: string): BriefedConfig {
  const actualCwd = cwd || process.cwd();
  const configPath = path.resolve(actualCwd, '.briefed.json');

  let userConfig: any = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      userConfig = JSON.parse(content);
    } catch (e) {
      // If invalid/malformed JSON, fallback to default config merge
      userConfig = {};
    }
  }

  // Perform deep merge
  const merged: BriefedConfig = deepMerge(
    JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    userConfig
  );

  // Target path resolution
  if (merged.target === 'auto') {
    merged.target = resolveTargetFile(actualCwd);
  } else {
    merged.target = path.resolve(actualCwd, merged.target);
  }

  // API Key resolution
  merged.apiKey = merged.apiKey || process.env.BRIEFED_API_KEY || process.env.ANTHROPIC_API_KEY || undefined;

  return merged;
}
