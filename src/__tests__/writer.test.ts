import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseEntries, writeEntry, getLastEntry } from '../writer.js';
import { BriefedConfig, ContextEntry } from '../types.js';

const TEST_DIR = path.resolve(__dirname, '../../temp_test');
const TEST_FILE = path.join(TEST_DIR, 'CONTEXT.md');

const DEFAULT_CONFIG: BriefedConfig = {
  target: TEST_FILE,
  backend: 'none',
  model: 'none',
  window: { days: 7, entries: 5 },
  ignored: [],
};

describe('writer.ts', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmdirSync(TEST_DIR);
    }
  });

  describe('parseEntries', () => {
    it('should return empty list if markers are missing', () => {
      const content = `
# AI Context
Some content without markers.
      `;
      expect(parseEntries(content)).toEqual([]);
    });

    it('should return empty list if markers are empty', () => {
      const content = `
# AI Context
<!-- BRIEFED_START -->
<!-- BRIEFED_END -->
      `;
      expect(parseEntries(content)).toEqual([]);
    });

    it('should parse simple entries correctly without source branch', () => {
      const content = `
# AI Context
<!-- BRIEFED_START -->
## [2026-06-01T12:00:00Z] abcdef123456
This is a summary of features.
- Item 1
- Item 2

FILES: src/types.ts, src/writer.ts
<!-- BRIEFED_END -->
      `;
      const entries = parseEntries(content);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        date: '2026-06-01T12:00:00Z',
        commitHash: 'abcdef123456',
        sourceBranch: undefined,
        summary: 'This is a summary of features.\n- Item 1\n- Item 2',
        filesChanged: ['src/types.ts', 'src/writer.ts'],
      });
    });

    it('should parse entries with source branch and space-separated FILES: line', () => {
      const content = `
<!-- BRIEFED_START -->
## [2026-06-01T15:00:00Z] 7777777 (feature/login)
- Updated login UI

FILES: src/login.tsx src/login.css
<!-- BRIEFED_END -->
      `;
      const entries = parseEntries(content);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        date: '2026-06-01T15:00:00Z',
        commitHash: '7777777',
        sourceBranch: 'feature/login',
        summary: '- Updated login UI',
        filesChanged: ['src/login.tsx', 'src/login.css'],
      });
    });

    it('should parse multiple entries in correct order', () => {
      const content = `
<!-- BRIEFED_START -->
## [2026-06-01T15:00:00Z] 2222222 (feature/b)
Summary 2

FILES: file2.ts

## [2026-06-01T12:00:00Z] 1111111 (feature/a)
Summary 1

FILES: file1.ts
<!-- BRIEFED_END -->
      `;
      const entries = parseEntries(content);
      expect(entries).toHaveLength(2);
      expect(entries[0].commitHash).toBe('2222222');
      expect(entries[1].commitHash).toBe('1111111');
    });
  });

  describe('writeEntry', () => {
    it('should create file with default header and entry if it does not exist', () => {
      const entry: ContextEntry = {
        date: '2026-06-01T12:00:00Z',
        commitHash: 'abcdef',
        summary: 'New changes',
        filesChanged: ['src/a.ts'],
      };

      writeEntry(entry, DEFAULT_CONFIG);

      expect(fs.existsSync(TEST_FILE)).toBe(true);
      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('# AI Context');
      expect(content).toContain('<!-- BRIEFED_START -->');
      expect(content).toContain('## [2026-06-01T12:00:00Z] abcdef');
      expect(content).toContain('New changes');
      expect(content).toContain('FILES: src/a.ts');
    });

    it('should append markers to end of file if they are missing', () => {
      fs.writeFileSync(TEST_FILE, '# Existing Content\nNo markers here.', 'utf-8');
      const entry: ContextEntry = {
        date: '2026-06-01T12:00:00Z',
        commitHash: 'abcdef',
        summary: 'Appended content',
        filesChanged: [],
      };

      writeEntry(entry, DEFAULT_CONFIG);

      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('# Existing Content\nNo markers here.');
      expect(content).toContain('<!-- BRIEFED_START -->');
      expect(content).toContain('## [2026-06-01T12:00:00Z] abcdef');
      expect(content).toContain('Appended content');
    });

    it('should skip writing if the commit hash already exists (deduplication)', () => {
      const initialContent = `
# Context
<!-- BRIEFED_START -->
## [2026-06-01T12:00:00Z] abcdef
Existing summary
<!-- BRIEFED_END -->
      `;
      fs.writeFileSync(TEST_FILE, initialContent, 'utf-8');

      const entry: ContextEntry = {
        date: '2026-06-01T13:00:00Z',
        commitHash: 'abcdef', // Same hash
        summary: 'New duplicated summary',
        filesChanged: [],
      };

      writeEntry(entry, DEFAULT_CONFIG);

      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('Existing summary');
      expect(content).not.toContain('New duplicated summary');
    });

    it('should prune entries older than config.window.days', () => {
      const now = new Date();
      // Let's create dates: one is 10 days ago, one is 2 days ago
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      const initialContent = `
<!-- BRIEFED_START -->
## [${tenDaysAgo}] oldcommit
Old summary
<!-- BRIEFED_END -->
      `;
      fs.writeFileSync(TEST_FILE, initialContent, 'utf-8');

      const newEntry: ContextEntry = {
        date: twoDaysAgo,
        commitHash: 'newcommit',
        summary: 'New summary',
        filesChanged: [],
      };

      writeEntry(newEntry, DEFAULT_CONFIG); // days limit is 7

      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('newcommit');
      expect(content).not.toContain('oldcommit');
    });

    it('should prune entries beyond config.window.entries', () => {
      const initialContent = `
<!-- BRIEFED_START -->
## [2026-06-01T10:00:00Z] c4
Summary 4

## [2026-06-01T09:00:00Z] c3
Summary 3

## [2026-06-01T08:00:00Z] c2
Summary 2

## [2026-06-01T07:00:00Z] c1
Summary 1
<!-- BRIEFED_END -->
      `;
      fs.writeFileSync(TEST_FILE, initialContent, 'utf-8');

      const newEntry: ContextEntry = {
        date: '2026-06-01T11:00:00Z',
        commitHash: 'c5',
        summary: 'Summary 5',
        filesChanged: [],
      };

      const limitConfig: BriefedConfig = {
        ...DEFAULT_CONFIG,
        window: { days: 100, entries: 3 }, // Only keep 3 entries
      };

      writeEntry(newEntry, limitConfig);

      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content).toContain('c5');
      expect(content).toContain('c4');
      expect(content).toContain('c3');
      expect(content).not.toContain('c2');
      expect(content).not.toContain('c1');
    });
  });

  describe('getLastEntry', () => {
    it('should return null if file does not exist', () => {
      expect(getLastEntry(DEFAULT_CONFIG)).toBeNull();
    });

    it('should return null if file has no entries', () => {
      fs.writeFileSync(TEST_FILE, '<!-- BRIEFED_START -->\n<!-- BRIEFED_END -->', 'utf-8');
      expect(getLastEntry(DEFAULT_CONFIG)).toBeNull();
    });

    it('should return the first (newest) entry from the file', () => {
      const initialContent = `
<!-- BRIEFED_START -->
## [2026-06-01T10:00:00Z] newest_hash (main)
Newest summary

FILES: src/new.ts

## [2026-06-01T09:00:00Z] older_hash
Older summary
<!-- BRIEFED_END -->
      `;
      fs.writeFileSync(TEST_FILE, initialContent, 'utf-8');

      const entry = getLastEntry(DEFAULT_CONFIG);
      expect(entry).not.toBeNull();
      expect(entry?.commitHash).toBe('newest_hash');
      expect(entry?.date).toBe('2026-06-01T10:00:00Z');
      expect(entry?.sourceBranch).toBe('main');
      expect(entry?.summary).toBe('Newest summary');
      expect(entry?.filesChanged).toEqual(['src/new.ts']);
    });
  });
});
