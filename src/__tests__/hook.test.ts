import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { install, uninstall } from '../hook.js';

const TEST_DIR = path.resolve(__dirname, '../../temp_hook_test');
const GIT_DIR = path.join(TEST_DIR, '.git');
const HUSKY_DIR = path.join(TEST_DIR, '.husky');

describe('hook.ts', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should throw an error if no .git folder is found', () => {
    const nonGitTempDir = path.join(os.tmpdir(), `briefed_non_git_${Date.now()}`);
    fs.mkdirSync(nonGitTempDir, { recursive: true });
    try {
      expect(() => install(nonGitTempDir)).toThrow('Git repository not found');
    } finally {
      if (fs.existsSync(nonGitTempDir)) {
        fs.rmSync(nonGitTempDir, { recursive: true, force: true });
      }
    }
  });

  it('should install hooks under .git/hooks if .husky does not exist', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });

    const result = install(TEST_DIR);

    expect(result.installed).toContain('post-merge');
    expect(result.installed).toContain('post-rewrite');
    expect(result.skipped).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);

    const postMergePath = path.join(GIT_DIR, 'hooks', 'post-merge');
    const postRewritePath = path.join(GIT_DIR, 'hooks', 'post-rewrite');

    expect(fs.existsSync(postMergePath)).toBe(true);
    expect(fs.existsSync(postRewritePath)).toBe(true);

    const mergeContent = fs.readFileSync(postMergePath, 'utf-8');
    expect(mergeContent).toContain('# BRIEFED_HOOK');
    expect(mergeContent).toContain('briefed run');
  });

  it('should install hooks under .husky if .husky exists', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    fs.mkdirSync(HUSKY_DIR, { recursive: true });

    const result = install(TEST_DIR);

    expect(result.installed).toContain('post-merge');
    expect(result.installed).toContain('post-rewrite');

    const postMergePath = path.join(HUSKY_DIR, 'post-merge');
    const postRewritePath = path.join(HUSKY_DIR, 'post-rewrite');

    expect(fs.existsSync(postMergePath)).toBe(true);
    expect(fs.existsSync(postRewritePath)).toBe(true);

    expect(fs.existsSync(path.join(GIT_DIR, 'hooks', 'post-merge'))).toBe(false);
  });

  it('should append to existing user hooks that do not have Briefed sentinels', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    const hooksDir = path.join(GIT_DIR, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const existingMerge = '#!/bin/sh\necho "User merge hook"\n';
    fs.writeFileSync(path.join(hooksDir, 'post-merge'), existingMerge, 'utf-8');

    const result = install(TEST_DIR);

    expect(result.installed).toContain('post-merge');
    expect(result.warnings).toContain('Appended to existing hook: post-merge');

    const updatedMerge = fs.readFileSync(path.join(hooksDir, 'post-merge'), 'utf-8');
    expect(updatedMerge).toContain('echo "User merge hook"');
    expect(updatedMerge).toContain('# BRIEFED_HOOK_APPENDED_START');
    expect(updatedMerge).toContain('# BRIEFED_HOOK_APPENDED_END');
    expect(updatedMerge).toContain('briefed run');
  });

  it('should skip installation if Briefed hook sentinel is already present', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    const hooksDir = path.join(GIT_DIR, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const existingMerge = '#!/bin/sh\n# BRIEFED_HOOK\n...';
    fs.writeFileSync(path.join(hooksDir, 'post-merge'), existingMerge, 'utf-8');

    const result = install(TEST_DIR);

    expect(result.skipped).toContain('post-merge');
    expect(result.installed).not.toContain('post-merge');
  });

  it('should skip installation if Briefed appended sentinel is already present', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    const hooksDir = path.join(GIT_DIR, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const existingMerge = '#!/bin/sh\n# BRIEFED_HOOK_APPENDED_START\n...\n# BRIEFED_HOOK_APPENDED_END';
    fs.writeFileSync(path.join(hooksDir, 'post-merge'), existingMerge, 'utf-8');

    const result = install(TEST_DIR);

    expect(result.skipped).toContain('post-merge');
    expect(result.installed).not.toContain('post-merge');
  });

  it('should uninstall/delete standalone hooks', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    install(TEST_DIR);

    const postMergePath = path.join(GIT_DIR, 'hooks', 'post-merge');
    expect(fs.existsSync(postMergePath)).toBe(true);

    uninstall(TEST_DIR);
    expect(fs.existsSync(postMergePath)).toBe(false);
  });

  it('should uninstall/clean chained hooks and restore original content', () => {
    fs.mkdirSync(GIT_DIR, { recursive: true });
    const hooksDir = path.join(GIT_DIR, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const originalContent = '#!/bin/sh\necho "Hello World"\n';
    fs.writeFileSync(path.join(hooksDir, 'post-merge'), originalContent, 'utf-8');

    install(TEST_DIR);
    expect(fs.readFileSync(path.join(hooksDir, 'post-merge'), 'utf-8')).toContain('# BRIEFED_HOOK_APPENDED_START');

    uninstall(TEST_DIR);
    const contentAfterUninstall = fs.readFileSync(path.join(hooksDir, 'post-merge'), 'utf-8');
    expect(contentAfterUninstall).not.toContain('# BRIEFED_HOOK_APPENDED_START');
    expect(contentAfterUninstall).toBe(originalContent);
  });
});
