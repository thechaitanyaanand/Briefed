import { execFileSync } from 'child_process';
import * as path from 'path';
import { DiffResult } from './types.js';

/**
 * Runs a git command synchronously using execFileSync to avoid shell injection.
 * Arguments are passed as an array directly to the git binary.
 */
function runGit(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, PAGER: 'cat' },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Checks if the given directory is inside a Git repository.
 * Returns true if `git rev-parse --is-inside-work-tree` succeeds.
 */
function isGitRepository(cwd?: string): boolean {
  try {
    const result = runGit(['rev-parse', '--is-inside-work-tree'], cwd);
    return result === 'true';
  } catch {
    return false;
  }
}

/**
 * Parses the file path from git diff --numstat, resolving any rename patterns.
 * E.g., "src/{auth => security}/login.ts" -> "src/security/login.ts"
 * E.g., "old.ts => new.ts" -> "new.ts"
 */
function parseGitPath(path: string): string {
  // Handle case: "src/{auth => security}/login.ts"
  const braceRegex = /^(.*)\{(.*)\s*=>\s*(.*)\}(.*)$/;
  const match = path.match(braceRegex);
  if (match) {
    const before = match[1] || '';
    const newPart = match[3] || '';
    const after = match[4] || '';
    return `${before}${newPart}${after}`.replace(/\/+/g, '/');
  }

  // Handle case: "old.ts => new.ts"
  const arrowRegex = /^(.*)\s*=>\s*(.*)$/;
  const matchArrow = path.match(arrowRegex);
  if (matchArrow) {
    return (matchArrow[2] || '').trim();
  }

  return path;
}

/**
 * Converts .gitignore-style patterns into git exclude pathspecs so git itself
 * drops ignored files from numstat, the raw diff, and the stat output alike.
 * "*.lock" and "dist/" match at any depth; patterns containing "/" are root-anchored.
 */
export function toExcludePathspecs(ignored: string[] = []): string[] {
  const specs: string[] = [];
  for (const raw of ignored) {
    const pattern = raw.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!pattern) continue;
    const base = pattern.includes('/') ? pattern : `**/${pattern}`;
    specs.push(`:(exclude,glob)${base}`, `:(exclude,glob)${base}/**`);
  }
  return specs;
}

const EMPTY_TREE = '4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc';
const MAX_DIFF_CHARS = 8000;

/**
 * Keeps the diff under MAX_DIFF_CHARS by giving every file an equal slice,
 * so a single huge file can't push the rest of the change out of the prompt.
 */
function budgetDiff(rawDiff: string, diffStat: string): string {
  if (rawDiff.length <= MAX_DIFF_CHARS) {
    return rawDiff;
  }
  const sections = rawDiff.split(/^(?=diff --git )/m);
  // ponytail: equal split wastes budget left over by small files; redistribute if summaries miss detail
  const perFile = Math.floor(MAX_DIFF_CHARS / sections.length);
  const body = sections
    .map(section => section.length > perFile ? `${section.slice(0, perFile)}\n[... truncated]\n` : section)
    .join('');
  return `${diffStat}\n\n${body}`;
}

/**
 * Gets the diff result between a base ref and HEAD.
 * Base is merge-base(since, HEAD) when `since` is given (post-checkout), otherwise
 * ORIG_HEAD -> HEAD~1 -> empty tree. Returns an empty DiffResult on any error.
 */
export function getDiff(cwd?: string, ignored?: string[], verbose?: boolean, targetFile?: string, since?: string): DiffResult {
  // UX-03: Explicit check — throw clear error if not in a Git repository
  if (!isGitRepository(cwd)) {
    throw new Error(
      'Not a Git repository. Run this command from inside a Git project, or run "git init" first.'
    );
  }

  const fallbackResult: DiffResult = {
    files: [],
    filesByDir: {},
    additions: 0,
    deletions: 0,
    rawDiff: '',
    commitHash: '',
    isEmpty: true,
  };

  let commitHash = '';
  try {
    commitHash = runGit(['rev-parse', 'HEAD'], cwd);
  } catch (error) {
    // No commits yet in this repository
    return fallbackResult;
  }

  const relativeTarget = targetFile
    ? path.relative(cwd || process.cwd(), targetFile).replace(/\\/g, '/')
    : '';
  const excludeArgs = [
    '--', '.',
    ...toExcludePathspecs(ignored),
    ...(relativeTarget ? [`:(exclude)${relativeTarget}`] : []),
  ];

  let candidates = ['ORIG_HEAD', 'HEAD~1', EMPTY_TREE];
  if (since) {
    try {
      candidates = [runGit(['merge-base', since, 'HEAD'], cwd)];
    } catch {
      // Unrelated history or a null ref (e.g. new worktree): nothing meaningful to diff
      return fallbackResult;
    }
  }

  let baseRef = '';
  let numstatOutput = '';
  for (const candidate of candidates) {
    try {
      numstatOutput = runGit(['diff', candidate, 'HEAD', '--numstat', ...excludeArgs], cwd);
      baseRef = candidate;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!baseRef) {
    return fallbackResult;
  }

  if (verbose || process.argv.includes('-v') || process.argv.includes('--verbose')) {
    console.log(`[Briefed Git] Resolved base ref: ${baseRef}`);
  }

  let rawDiffOutput = '';
  try {
    rawDiffOutput = runGit(['diff', baseRef, 'HEAD', ...excludeArgs], cwd);
  } catch (error) {
    return fallbackResult;
  }

  // Parse numstat lines
  const numstatLines = numstatOutput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let additions = 0;
  let deletions = 0;
  const files: string[] = [];

  for (const line of numstatLines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const addVal = parts[0];
      const delVal = parts[1];
      const rawPath = parts.slice(2).join(' ');
      const parsedPath = parseGitPath(rawPath);

      files.push(parsedPath);
      if (addVal !== '-') {
        additions += parseInt(addVal, 10) || 0;
      }
      if (delVal !== '-') {
        deletions += parseInt(delVal, 10) || 0;
      }
    }
  }

  // Group by directory
  const filesByDir: Record<string, string[]> = {};
  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    const parts = normalizedFile.split('/');
    const dirKey = parts.length > 1 ? parts[0] : '.';
    if (!filesByDir[dirKey]) {
      filesByDir[dirKey] = [];
    }
    filesByDir[dirKey].push(file);
  }

  // Extract source branch
  let sourceBranch: string | undefined = undefined;

  // 1. Try reflog
  try {
    const reflogMsg = runGit(['reflog', '-1', '--format=%gs'], cwd);
    // Anchored: reflog reads "merge <branch>: ..."; unanchored, a pull's "Merge made by" yielded "made"
    const mergeRegex = /^merge\s+([^\s:]+)/i;
    const mergeMatch = reflogMsg.match(mergeRegex);
    if (mergeMatch) {
      sourceBranch = mergeMatch[1];
    } else {
      const checkoutRegex = /moving\s+from\s+([^\s]+)\s+to/i;
      const checkoutMatch = reflogMsg.match(checkoutRegex);
      if (checkoutMatch) {
        sourceBranch = checkoutMatch[1];
      }
    }
  } catch (e) {
    // Ignore errors
  }

  // 2. Try log message if still not found
  if (!sourceBranch) {
    try {
      const logMsg = runGit(['log', '-1', '--format=%B'], cwd);
      const prRegex = /Merge pull request #\d+ from [^\s\/]+\/([^\s\n]+)/i;
      const prMatch = logMsg.match(prRegex);
      if (prMatch) {
        sourceBranch = prMatch[1];
      } else {
        const branchRegex = /Merge branch '([^']+)'/i;
        const branchMatch = logMsg.match(branchRegex);
        if (branchMatch) {
          sourceBranch = branchMatch[1];
        } else {
          const branchOfRegex = /Merge branch\s+([^\s']+)\s+of/i;
          const branchOfMatch = logMsg.match(branchOfRegex);
          if (branchOfMatch) {
            sourceBranch = branchOfMatch[1];
          } else {
            const branchIntoRegex = /Merge branch\s+([^\s']+)\s+into/i;
            const branchIntoMatch = logMsg.match(branchIntoRegex);
            if (branchIntoMatch) {
              sourceBranch = branchIntoMatch[1];
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  let rawDiff = rawDiffOutput;
  if (rawDiffOutput.length > MAX_DIFF_CHARS) {
    let diffStat = '';
    try {
      diffStat = runGit(['diff', baseRef, 'HEAD', '--stat', ...excludeArgs], cwd);
    } catch {
      // stat is a nice-to-have
    }
    rawDiff = budgetDiff(rawDiffOutput, diffStat);
  }

  // Commit subjects carry the author's intent for free; they feed both the LLM and the no-LLM summary
  let commits: string[] = [];
  try {
    const range = baseRef === EMPTY_TREE ? ['HEAD'] : [`${baseRef}..HEAD`];
    commits = runGit(['log', '--no-merges', '-n', '30', '--format=%s', ...range], cwd)
      .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  } catch {
    // Ignore errors
  }

  const isEmpty = files.length === 0;

  return {
    files,
    filesByDir,
    additions,
    deletions,
    rawDiff,
    commitHash,
    sourceBranch,
    commits,
    isEmpty,
  };
}

/**
 * Runs git rev-parse HEAD and returns the hash.
 * Returns an empty string if it fails.
 */
export function getCurrentHash(cwd?: string): string {
  try {
    return runGit(['rev-parse', 'HEAD'], cwd);
  } catch (error) {
    return '';
  }
}

