import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarize } from '../summarize.js';
import { BriefedConfig, DiffResult, SummarizeInput } from '../types.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('summarize.ts', () => {
  let mockConsoleWarn: any;
  let originalWarn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWarn = console.warn;
    mockConsoleWarn = vi.fn();
    console.warn = mockConsoleWarn;
  });

  afterEach(() => {
    console.warn = originalWarn;
    vi.restoreAllMocks();
  });

  const defaultConfig: BriefedConfig = {
    target: 'auto',
    backend: 'ollama',
    model: 'llama3',
    apiUrl: 'http://localhost:11434',
    window: { days: 7, entries: 10 },
    ignored: [],
    minDiffLines: 10
  };

  const emptyDiff: DiffResult = {
    files: [],
    filesByDir: {},
    additions: 0,
    deletions: 0,
    rawDiff: '',
    commitHash: 'abc123commit',
    sourceBranch: 'main',
    isEmpty: true
  };

  describe('Smart Skip', () => {
    it('should skip LLM and run none backend if files <= 2 and changed lines <= minDiffLines', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 5,
        deletions: 4,
        isEmpty: false
      };

      const input: SummarizeInput = {
        diff,
        config: defaultConfig
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(true);
      expect(output.backendUsed).toBe('none');
      expect(output.entry.summary).toBe('FILES: src/ (git.ts)\nDEPS: 5 insertions, 4 deletions');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT skip LLM if files > 2 even if changed lines <= minDiffLines', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts', 'src/types.ts', 'package.json'],
        filesByDir: { src: ['src/git.ts', 'src/types.ts'], '.': ['package.json'] },
        additions: 3,
        deletions: 2,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'LLM Response' })
      });

      const input: SummarizeInput = {
        diff,
        config: defaultConfig
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('ollama');
      expect(output.entry.summary).toBe('LLM Response');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT skip LLM if changed lines > minDiffLines even if files <= 2', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 8,
        deletions: 5, // total 13 lines > 10 minDiffLines
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'LLM Response' })
      });

      const input: SummarizeInput = {
        diff,
        config: defaultConfig
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('ollama');
      expect(output.entry.summary).toBe('LLM Response');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('None Backend', () => {
    it('should execute none backend directly if configured backend is none', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts', 'src/types.ts', 'package.json'],
        filesByDir: { src: ['src/git.ts', 'src/types.ts'], '.': ['package.json'] },
        additions: 50,
        deletions: 30,
        isEmpty: false
      };

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'none'
        }
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('none');
      expect(output.entry.summary).toBe('FILES: src/ (git.ts, types.ts) | ./ (package.json)\nDEPS: 50 insertions, 30 deletions');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Ollama Backend', () => {
    it('should make correct POST request to Ollama and return summary', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Ollama custom summary output' })
      });

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'ollama',
          model: 'custom-llama'
        }
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('ollama');
      expect(output.entry.summary).toBe('Ollama custom summary output');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('http://localhost:11434/api/generate');
      const options = call[1];
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
      const body = JSON.parse(options.body);
      expect(body.model).toBe('custom-llama');
      expect(body.prompt).toContain('Summarize the following git diff.');
      expect(body.stream).toBe(false);
      expect(body.options).toEqual({ num_predict: 200 });
    });
  });

  describe('Anthropic Backend', () => {
    it('should make correct POST request to Anthropic and return summary', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Anthropic custom summary output' }]
        })
      });

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'anthropic',
          model: 'claude-3-opus',
          apiKey: 'test-key-123'
        }
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('anthropic');
      expect(output.entry.summary).toBe('Anthropic custom summary output');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.anthropic.com/v1/messages');
      const options = call[1];
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'x-api-key': 'test-key-123',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      });
      const body = JSON.parse(options.body);
      expect(body.model).toBe('claude-3-opus');
      expect(body.max_tokens).toBe(200);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('Summarize the following git diff.');
    });
  });

  describe('Gemini Backend', () => {
    it('should make correct POST request to Gemini and return summary', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Gemini custom summary output' }]
            }
          }]
        })
      });

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'gemini',
          model: 'gemini-2.5-flash',
          apiKey: 'gemini-test-key'
        }
      };

      const output = await summarize(input);

      expect(output.skippedLLM).toBe(false);
      expect(output.backendUsed).toBe('gemini');
      expect(output.entry.summary).toBe('Gemini custom summary output');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
      const options = call[1];
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'x-goog-api-key': 'gemini-test-key'
      });
      const body = JSON.parse(options.body);
      expect(body.contents[0].parts[0].text).toContain('Summarize the following git diff.');
      expect(body.generationConfig).toEqual({ maxOutputTokens: 200 });
    });
  });

  describe('Error Fallback', () => {
    it('should log a console warning and fallback to mechanical summary if Ollama API fails', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      mockFetch.mockRejectedValueOnce(new Error('Network offline'));

      const input: SummarizeInput = {
        diff,
        config: defaultConfig
      };

      const output = await summarize(input);

      expect(output.backendUsed).toBe('none');
      expect(output.entry.summary).toBe('FILES: src/ (git.ts)\nDEPS: 15 insertions, 0 deletions');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should fallback to mechanical summary if Anthropic API key is missing', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'anthropic',
          apiKey: undefined
        }
      };

      // Ensure env vars are also empty
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      const originalBriefedKey = process.env.BRIEFED_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.BRIEFED_API_KEY;

      try {
        const output = await summarize(input);

        expect(output.backendUsed).toBe('none');
        expect(output.entry.summary).toBe('FILES: src/ (git.ts)\nDEPS: 15 insertions, 0 deletions');
        expect(mockConsoleWarn).toHaveBeenCalled();
      } finally {
        process.env.ANTHROPIC_API_KEY = originalApiKey;
        process.env.BRIEFED_API_KEY = originalBriefedKey;
      }
    });

    it('should log a console warning and fallback to mechanical summary if Gemini API fails', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      mockFetch.mockRejectedValueOnce(new Error('Gemini offline'));

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'gemini',
          model: 'gemini-2.5-flash',
          apiKey: 'gemini-test-key'
        }
      };

      const output = await summarize(input);

      expect(output.backendUsed).toBe('none');
      expect(output.entry.summary).toBe('FILES: src/ (git.ts)\nDEPS: 15 insertions, 0 deletions');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should fallback to mechanical summary if Gemini API key is missing', async () => {
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        deletions: 0,
        isEmpty: false
      };

      const input: SummarizeInput = {
        diff,
        config: {
          ...defaultConfig,
          backend: 'gemini',
          model: 'gemini-2.5-flash',
          apiKey: undefined
        }
      };

      // Ensure env vars are also empty
      const originalGeminiKey = process.env.GEMINI_API_KEY;
      const originalBriefedKey = process.env.BRIEFED_API_KEY;
      const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.BRIEFED_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const output = await summarize(input);

        expect(output.backendUsed).toBe('none');
        expect(output.entry.summary).toBe('FILES: src/ (git.ts)\nDEPS: 15 insertions, 0 deletions');
        expect(mockConsoleWarn).toHaveBeenCalled();
      } finally {
        process.env.GEMINI_API_KEY = originalGeminiKey;
        process.env.BRIEFED_API_KEY = originalBriefedKey;
        process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      }
    });
  });

  describe('Word-Count Enforcement', () => {
    it('should not truncate if response is <= 150 words', async () => {
      const shortResponse = 'This is a short response.'.repeat(10); // 50 words
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: shortResponse })
      });

      const output = await summarize({ diff, config: defaultConfig });
      expect(output.entry.summary).toBe(shortResponse);
    });

    it('should truncate at the last complete line that fits if response > 150 words', async () => {
      // 10 words per line, 20 lines -> 200 words total
      // Let's make it exactly 10 words per line:
      // "one two three four five six seven eight nine ten"
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i} two three four five six seven eight nine`).join('\n');
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: lines })
      });

      const output = await summarize({ diff, config: defaultConfig });
      const outputLines = output.entry.summary.split('\n');
      // 15 lines * 10 words/line = 150 words.
      // So line 15 (index 14) is the last one that fits.
      expect(outputLines.length).toBe(15);
      expect(outputLines[14]).toBe('line 14 two three four five six seven eight nine');
    });

    it('should truncate at word level if even the first line has > 150 words', async () => {
      // One single extremely long line of 200 words
      const longSingleLine = 'word '.repeat(200).trim();
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: longSingleLine })
      });

      const output = await summarize({ diff, config: defaultConfig });
      const words = output.entry.summary.split(/\s+/);
      expect(words.length).toBe(150);
    });
  });

  describe('LLM Response Sanitization', () => {
    it('should sanitize HTML comment tags from LLM response', async () => {
      const responseWithComments = 'Here is <!-- COMMENT --> test --> and <!-- again.';
      const diff: DiffResult = {
        ...emptyDiff,
        files: ['src/git.ts'],
        filesByDir: { src: ['src/git.ts'] },
        additions: 15,
        isEmpty: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: responseWithComments })
      });

      const output = await summarize({ diff, config: defaultConfig });
      expect(output.entry.summary).toBe('Here is &lt;!-- COMMENT --&gt; test --&gt; and &lt;!-- again.');
    });
  });
});
