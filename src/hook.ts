import * as fs from 'fs';
import * as path from 'path';

const POST_MERGE_CONTENT = `#!/bin/sh
# BRIEFED_HOOK
cd "$(git rev-parse --show-toplevel)" || exit 0
if command -v briefed >/dev/null 2>&1; then
  briefed run
elif [ -x "./node_modules/.bin/briefed" ]; then
  ./node_modules/.bin/briefed run
else
  npx --yes briefed run 2>/dev/null
fi
exit 0
`;

const POST_REWRITE_CONTENT = `#!/bin/sh
# BRIEFED_HOOK
[ "$1" = "rebase" ] || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
if command -v briefed >/dev/null 2>&1; then
  briefed run
elif [ -x "./node_modules/.bin/briefed" ]; then
  ./node_modules/.bin/briefed run
else
  npx --yes briefed run 2>/dev/null
fi
exit 0
`;

const HOOKS = [
  {
    name: 'post-merge',
    fullContent: POST_MERGE_CONTENT,
    bodyContent: `cd "$(git rev-parse --show-toplevel)" || exit 0
if command -v briefed >/dev/null 2>&1; then
  briefed run
elif [ -x "./node_modules/.bin/briefed" ]; then
  ./node_modules/.bin/briefed run
else
  npx --yes briefed run 2>/dev/null
fi`
  },
  {
    name: 'post-rewrite',
    fullContent: POST_REWRITE_CONTENT,
    bodyContent: `[ "$1" = "rebase" ] || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
if command -v briefed >/dev/null 2>&1; then
  briefed run
elif [ -x "./node_modules/.bin/briefed" ]; then
  ./node_modules/.bin/briefed run
else
  npx --yes briefed run 2>/dev/null
fi`
  }
];

function findGitDir(cwd: string): string {
  let dir = path.resolve(cwd);
  while (true) {
    const gitPath = path.join(dir, '.git');
    if (fs.existsSync(gitPath)) {
      return gitPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Git repository not found');
}

/**
 * Installs Briefed post-merge and post-rewrite Git hooks.
 * Targets `.husky/` directory if it exists, otherwise defaults to `.git/hooks/`.
 */
export function install(cwd?: string): { installed: string[], skipped: string[], warnings: string[] } {
  const actualCwd = cwd || process.cwd();
  const gitDir = findGitDir(actualCwd);
  const projectRoot = path.dirname(gitDir);

  const huskyDir = path.join(projectRoot, '.husky');
  const hasHusky = fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory();

  const hooksDir = hasHusky ? huskyDir : path.join(gitDir, 'hooks');

  const installed: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const hook of HOOKS) {
    const hookPath = path.join(hooksDir, hook.name);

    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8');

      // Check if either standalone or chained sentinel already exists
      if (content.includes('# BRIEFED_HOOK') || content.includes('# BRIEFED_HOOK_APPENDED_START')) {
        skipped.push(hook.name);
        continue;
      }

      // Append hook body invocation to existing user hook
      let toAppend = '';
      if (!content.endsWith('\n')) {
        toAppend += '\n';
      }
      toAppend += `# BRIEFED_HOOK_APPENDED_START\n${hook.bodyContent}\n# BRIEFED_HOOK_APPENDED_END\n`;

      fs.writeFileSync(hookPath, content + toAppend);
      warnings.push(`Appended to existing hook: ${hook.name}`);
      installed.push(hook.name);

      // On non-Windows: ensure executable bit is set
      if (process.platform !== 'win32') {
        fs.chmodSync(hookPath, 0o755);
      }
    } else {
      // Create new standalone hook
      fs.mkdirSync(path.dirname(hookPath), { recursive: true });
      fs.writeFileSync(hookPath, hook.fullContent);
      installed.push(hook.name);

      // On non-Windows: ensure executable bit is set
      if (process.platform !== 'win32') {
        fs.chmodSync(hookPath, 0o755);
      }
    }
  }

  return { installed, skipped, warnings };
}

/**
 * Uninstalls Briefed Git hooks from `.husky/` and `.git/hooks/` directories.
 */
export function uninstall(cwd?: string): void {
  const actualCwd = cwd || process.cwd();
  const gitDir = findGitDir(actualCwd);
  const projectRoot = path.dirname(gitDir);

  const dirsToCheck: string[] = [];

  const huskyDir = path.join(projectRoot, '.husky');
  if (fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory()) {
    dirsToCheck.push(huskyDir);
  }

  const gitHooksDir = path.join(gitDir, 'hooks');
  if (fs.existsSync(gitHooksDir) && fs.statSync(gitHooksDir).isDirectory()) {
    dirsToCheck.push(gitHooksDir);
  }

  const hookNames = ['post-merge', 'post-rewrite'];

  for (const dir of dirsToCheck) {
    for (const name of hookNames) {
      const hookPath = path.join(dir, name);
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');

        if (content.includes('# BRIEFED_HOOK_APPENDED_START')) {
          // Restoring chained files: Slice out the Briefed section
          const regex = /# BRIEFED_HOOK_APPENDED_START[\s\S]*?# BRIEFED_HOOK_APPENDED_END\r?\n?/g;
          const remaining = content.replace(regex, '');
          fs.writeFileSync(hookPath, remaining);
        } else if (content.includes('# BRIEFED_HOOK')) {
          // Standalone hook file: Delete it
          fs.unlinkSync(hookPath);
        }
      }
    }
  }
}
