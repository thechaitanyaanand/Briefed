import { execSync } from 'child_process';
import { minimatch } from 'minimatch';
import { DiffResult } from './types.js';

/**
 * Runs a git command synchronously, handling potential errors and setting the environment.
 */
function runGit(args: string[], cwd?: string): string {
  const cmd = `git ${args.join(' ')}`;
  return execSync(cmd, {
    cwd,
    env: { ...process.env, PAGER: 'cat' },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr as well, don't inherit it
  }).trim();
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
 * Checks if a file path matches any of the ignored glob patterns.
 */
function isIgnored(filePath: string, ignored: string[] = []): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const pattern of ignored) {
    const normalizedPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

    // Check if it's a direct match or matches subdirectories
    if (minimatch(normalizedPath, pattern, { dot: true, matchBase: true })) {
      return true;
    }
    if (minimatch(normalizedPath, normalizedPattern, { dot: true, matchBase: true })) {
      return true;
    }
    // Check if the pattern is a directory prefix
    if (normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern + '/')) {
      return true;
    }
    // Check if pattern is a directory name in nested segments
    if (!normalizedPattern.includes('/')) {
      const pathSegments = normalizedPath.split('/');
      if (pathSegments.includes(normalizedPattern)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gets the diff result between ORIG_HEAD and HEAD.
 * Returns an empty DiffResult if ORIG_HEAD is missing or any error occurs.
 */
export function getDiff(cwd?: string, ignored?: string[], verbose?: boolean): DiffResult {
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
    // If not a git repository or no commit has been made yet
    return fallbackResult;
  }

  let baseRef = 'ORIG_HEAD';
  let numstatOutput = '';
  try {
    numstatOutput = runGit(['diff', 'ORIG_HEAD', 'HEAD', '--numstat'], cwd);
    baseRef = 'ORIG_HEAD';
  } catch (error) {
    try {
      numstatOutput = runGit(['diff', 'HEAD~1', 'HEAD', '--numstat'], cwd);
      baseRef = 'HEAD~1';
    } catch (err2) {
      try {
        numstatOutput = runGit(['diff', '4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc', 'HEAD', '--numstat'], cwd);
        baseRef = '4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc';
      } catch (err3) {
        return fallbackResult;
      }
    }
  }

  if (verbose || process.argv.includes('-v') || process.argv.includes('--verbose')) {
    console.log(`[Briefed Git] Resolved base ref: ${baseRef}`);
  }

  let rawDiffOutput = '';
  try {
    rawDiffOutput = runGit(['diff', baseRef, 'HEAD'], cwd);
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

      if (isIgnored(parsedPath, ignored)) {
        continue;
      }

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
    const mergeRegex = /merge\s+([^\s:]+)/i;
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

  // Smart Diff Truncation
  let rawDiff = rawDiffOutput;
  if (rawDiffOutput.length > 8000) {
    try {
      const diffStat = runGit(['diff', baseRef, 'HEAD', '--stat'], cwd);
      const allDiffLines = rawDiffOutput.split(/\r?\n/);
      const totalLinesCount = allDiffLines.length;
      const first200Lines = allDiffLines.slice(0, 200).join('\n');
      const linesOmitted = Math.max(0, totalLinesCount - 200);
      rawDiff = `${diffStat}\n\n${first200Lines}\n[... truncated, ${linesOmitted} lines omitted]`;
    } catch (e) {
      // Fallback in case stat diff fails
    }
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
