import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// scripts/ is the single source of truth for hook bodies (shipped in the npm package).
const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const HOOK_NAMES = ['post-merge', 'post-rewrite', 'post-checkout'];

const HOOKS = HOOK_NAMES.map(name => {
  const fullContent = fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf-8').replace(/\r\n/g, '\n');
  // When chained into a user's existing hook, run in a subshell so our cd/exit can't affect theirs
  const body = fullContent.split('# BRIEFED_HOOK\n')[1].replace(/\nexit 0\n?$/, '');
  return { name, fullContent, bodyContent: `(\n${body}\n)` };
});

function findGitPaths(cwd: string): { gitDir: string; projectRoot: string } {
  let dir = path.resolve(cwd);
  while (true) {
    const gitPath = path.join(dir, '.git');
    if (fs.existsSync(gitPath)) {
      const stat = fs.statSync(gitPath);
      if (stat.isFile()) {
        const content = fs.readFileSync(gitPath, 'utf-8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/);
        if (match) {
          return {
            gitDir: path.resolve(dir, match[1]),
            projectRoot: dir
          };
        }
      }
      return {
        gitDir: gitPath,
        projectRoot: dir
      };
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
 * Installs Briefed post-merge, post-rewrite and post-checkout Git hooks.
 * Targets `.husky/` directory if it exists, otherwise defaults to `.git/hooks/`.
 * Hooks written by an older Briefed are upgraded in place, so re-running `init` after
 * an update picks up the current templates instead of skipping them.
 */
export function install(cwd?: string): { installed: string[], upgraded: string[], skipped: string[], warnings: string[] } {
  const actualCwd = cwd || process.cwd();
  const { gitDir, projectRoot } = findGitPaths(actualCwd);

  const huskyDir = path.join(projectRoot, '.husky');
  const hasHusky = fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory();

  const hooksDir = hasHusky ? huskyDir : path.join(gitDir, 'hooks');

  const installed: string[] = [];
  const upgraded: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const hook of HOOKS) {
    const hookPath = path.join(hooksDir, hook.name);
    const exists = fs.existsSync(hookPath);
    const content = exists ? fs.readFileSync(hookPath, 'utf-8').replace(/\r\n/g, '\n') : '';
    const block = `# BRIEFED_HOOK_APPENDED_START\n${hook.bodyContent}\n# BRIEFED_HOOK_APPENDED_END\n`;

    let next: string;
    let ours = true;
    if (content.includes('# BRIEFED_HOOK_APPENDED_START')) {
      // Chained into a user hook: refresh only our block
      next = content.replace(/# BRIEFED_HOOK_APPENDED_START[\s\S]*?# BRIEFED_HOOK_APPENDED_END\n?/, block);
    } else if (content.includes('# BRIEFED_HOOK')) {
      next = hook.fullContent;
    } else if (exists) {
      next = `${content}${content.endsWith('\n') ? '' : '\n'}${block}`;
      warnings.push(`Appended to existing hook: ${hook.name}`);
      ours = false;
    } else {
      next = hook.fullContent;
      ours = false;
    }

    if (next === content) {
      skipped.push(hook.name);
      continue;
    }

    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.writeFileSync(hookPath, next);
    // On non-Windows: ensure executable bit is set
    if (process.platform !== 'win32') {
      fs.chmodSync(hookPath, 0o755);
    }
    (ours ? upgraded : installed).push(hook.name);
  }

  return { installed, upgraded, skipped, warnings };
}

/**
 * Uninstalls Briefed Git hooks from `.husky/` and `.git/hooks/` directories.
 */
export function uninstall(cwd?: string): void {
  const actualCwd = cwd || process.cwd();
  const { gitDir, projectRoot } = findGitPaths(actualCwd);

  const dirsToCheck: string[] = [];

  const huskyDir = path.join(projectRoot, '.husky');
  if (fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory()) {
    dirsToCheck.push(huskyDir);
  }

  const gitHooksDir = path.join(gitDir, 'hooks');
  if (fs.existsSync(gitHooksDir) && fs.statSync(gitHooksDir).isDirectory()) {
    dirsToCheck.push(gitHooksDir);
  }

  for (const dir of dirsToCheck) {
    for (const name of HOOK_NAMES) {
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
