import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDiff, getCurrentHash } from '../git.js';
import * as child_process from 'child_process';

// Mock child_process
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof child_process>('child_process');
  return {
    ...actual,
    execFileSync: vi.fn(),
  };
});

const mockExecFileSync = vi.mocked(child_process.execFileSync);

describe('git.ts', () => {
  let mockGitResponses: Record<string, string | Error> = {};

  beforeEach(() => {
    vi.resetAllMocks();
    mockGitResponses = {};

    mockExecFileSync.mockImplementation((_cmd, args) => {
      // Reconstruct key from args array for pattern matching
      const argsStr = (args as string[]).join(' ');
      // Sort patterns by length descending so longer, more specific patterns match first
      const sortedPatterns = Object.keys(mockGitResponses).sort((a, b) => b.length - a.length);
      for (const pattern of sortedPatterns) {
        if (argsStr.includes(pattern)) {
          const response = mockGitResponses[pattern];
          if (response instanceof Error) {
            throw response;
          }
          return response;
        }
      }
      throw new Error(`Unhandled command in mockExecFileSync: git ${argsStr}`);
    });
  });

  describe('getCurrentHash', () => {
    it('should return the commit hash on success', () => {
      mockGitResponses = {
        'rev-parse HEAD': 'abcdef1234567890\n',
      };
      const hash = getCurrentHash();
      expect(hash).toBe('abcdef1234567890');
      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], expect.any(Object));
    });

    it('should return an empty string if git command fails', () => {
      mockGitResponses = {
        'rev-parse HEAD': new Error('Git command failed'),
      };
      const hash = getCurrentHash();
      expect(hash).toBe('');
    });
  });

  describe('getDiff', () => {
    it('should throw an error when not in a Git repository', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': new Error('Not a git repository'),
      };

      expect(() => getDiff()).toThrow('Not a Git repository');
    });

    it('should return the fallback empty DiffResult if rev-parse HEAD fails (no commits)', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': new Error('unknown revision HEAD'),
      };

      const result = getDiff();
      expect(result).toEqual({
        files: [],
        filesByDir: {},
        additions: 0,
        deletions: 0,
        rawDiff: '',
        commitHash: '',
        isEmpty: true,
      });
    });

    it('should return the fallback empty DiffResult if ORIG_HEAD and all fallbacks fail', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': new Error('ambiguous argument \'ORIG_HEAD\''),
        'diff HEAD~1 HEAD --numstat': new Error('no parent commit'),
        'diff 4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc HEAD --numstat': new Error('empty tree error'),
      };

      const result = getDiff();
      expect(result).toEqual({
        files: [],
        filesByDir: {},
        additions: 0,
        deletions: 0,
        rawDiff: '',
        commitHash: '',
        isEmpty: true,
      });
    });

    it('should fallback to HEAD~1 if ORIG_HEAD is missing', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': new Error('ambiguous argument \'ORIG_HEAD\''),
        'diff HEAD~1 HEAD --numstat': '5\t2\tsrc/git.ts\n',
        'diff HEAD~1 HEAD': 'diff from HEAD~1',
        'reflog': 'commit: some message\n',
        'log -1': 'some message\n',
      };

      const result = getDiff();
      expect(result.commitHash).toBe('hash123');
      expect(result.additions).toBe(5);
      expect(result.deletions).toBe(2);
      expect(result.files).toEqual(['src/git.ts']);
      expect(result.rawDiff).toBe('diff from HEAD~1');
    });

    it('should fallback to empty tree hash if ORIG_HEAD and HEAD~1 are missing', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': new Error('ambiguous argument \'ORIG_HEAD\''),
        'diff HEAD~1 HEAD --numstat': new Error('no parent commit'),
        'diff 4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc HEAD --numstat': '15\t4\tsrc/git.ts\n',
        'diff 4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc HEAD': 'diff from empty tree',
        'reflog': 'commit: initial\n',
        'log -1': 'initial commit\n',
      };

      const result = getDiff();
      expect(result.commitHash).toBe('hash123');
      expect(result.additions).toBe(15);
      expect(result.deletions).toBe(4);
      expect(result.files).toEqual(['src/git.ts']);
      expect(result.rawDiff).toBe('diff from empty tree');
    });

    it('should parse numstat and raw diff successfully', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': '10\t5\tsrc/git.ts\n2\t0\tpackage.json\n-\t-\tassets/logo.png\n0\t1\tREADME.md\n',
        'diff ORIG_HEAD HEAD': 'diff details here\n',
        'reflog': 'merge feature/auth: Merge made by the \'ort\' strategy.\n',
        'log -1': 'Merge branch \'feature/auth\'\n',
      };

      const result = getDiff();

      expect(result.commitHash).toBe('hash123');
      expect(result.additions).toBe(12);
      expect(result.deletions).toBe(6);
      expect(result.files).toEqual(['src/git.ts', 'package.json', 'assets/logo.png', 'README.md']);
      expect(result.filesByDir).toEqual({
        src: ['src/git.ts'],
        '.': ['package.json', 'README.md'],
        assets: ['assets/logo.png'],
      });
      expect(result.rawDiff).toBe('diff details here');
      expect(result.sourceBranch).toBe('feature/auth');
      expect(result.isEmpty).toBe(false);
    });

    it('should handle ignore patterns correctly', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': '10\t5\tsrc/git.ts\n2\t0\tpackage.json\n5\t5\tcustom_ignored/temp.txt\n20\t10\tcustom_ignored/nested/file.js\n0\t1\tREADME.md\n',
        'diff ORIG_HEAD HEAD': 'diff details here\n',
        'reflog': 'checkout: moving from feature/payments to main\n',
        'log -1': 'checkout: moving from feature/payments to main\n',
      };

      const result = getDiff(undefined, ['custom_ignored/**']);

      expect(result.additions).toBe(12); // custom_ignored/temp.txt and custom_ignored/nested/file.js should be excluded
      expect(result.deletions).toBe(6);
      expect(result.files).toEqual(['src/git.ts', 'package.json', 'README.md']);
      expect(result.filesByDir).toEqual({
        src: ['src/git.ts'],
        '.': ['package.json', 'README.md'],
      });
      expect(result.sourceBranch).toBe('feature/payments');
    });

    it('should handle rename syntax correctly in parseGitPath', () => {
      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': '10\t5\tsrc/{auth => security}/login.ts\n1\t1\tutils.ts => helpers.ts\n',
        'diff ORIG_HEAD HEAD': 'diff details\n',
        'reflog': new Error('Reflog empty'),
        'log -1': 'Merge pull request #12 from owner/feature/billing\n',
      };

      const result = getDiff(undefined, []);

      expect(result.files).toEqual(['src/security/login.ts', 'helpers.ts']);
      expect(result.filesByDir).toEqual({
        src: ['src/security/login.ts'],
        '.': ['helpers.ts'],
      });
      expect(result.sourceBranch).toBe('feature/billing');
    });

    it('should truncate rawDiff if it is longer than 8000 characters', () => {
      const veryLongDiff = 'a'.repeat(9000);
      const lines = Array.from({ length: 300 }, (_, i) => `line ${i}`).join('\n');
      const longDiffWithLines = `${veryLongDiff}\n${lines}`;

      mockGitResponses = {
        'rev-parse --is-inside-work-tree': 'true\n',
        'rev-parse HEAD': 'hash123\n',
        'diff ORIG_HEAD HEAD --numstat': '10\t5\tsrc/git.ts\n',
        'diff ORIG_HEAD HEAD --stat': 'src/git.ts | 15 +++++-----\n1 file changed, 10 insertions(+), 5 deletions(-)\n',
        'diff ORIG_HEAD HEAD': longDiffWithLines,
        'reflog': 'commit: initial\n',
        'log -1': 'Merge branch \'feature/auth\'\n',
      };

      const result = getDiff();

      expect(result.rawDiff).toContain('src/git.ts | 15 +++++-----');
      expect(result.rawDiff).toContain('[... truncated,');
      expect(result.rawDiff.length).toBeLessThan(longDiffWithLines.length);

      // Verify it has prepended stat diff and first 200 lines
      const totalOmitted = longDiffWithLines.split(/\r?\n/).length - 200;
      expect(result.rawDiff).toContain(`[... truncated, ${totalOmitted} lines omitted]`);
    });
  });
});
