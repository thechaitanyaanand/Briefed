import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_CONFIG, resolveTargetFile, getConfig } from '../config.js';

vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>();
  return {
    ...original,
    homedir: () => process.env.FAKE_HOMEDIR || original.homedir(),
  };
});

const TEST_DIR = path.resolve(__dirname, '../../temp_config_test');

describe('config.ts', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Create the fake-home directory for global config isolation
    const fakeHome = path.join(TEST_DIR, 'fake-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    process.env.FAKE_HOMEDIR = fakeHome;
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    delete process.env.FAKE_HOMEDIR;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have standard default values', () => {
      expect(DEFAULT_CONFIG.target).toBe('auto');
      expect(DEFAULT_CONFIG.backend).toBe('ollama');
      expect(DEFAULT_CONFIG.model).toBe('llama3');
      expect(DEFAULT_CONFIG.apiUrl).toBe('http://localhost:11434');
      expect(DEFAULT_CONFIG.window).toEqual({ days: 7, entries: 10 });
      expect(DEFAULT_CONFIG.ignored).toContain('dist/');
      expect(DEFAULT_CONFIG.minDiffLines).toBe(10);
    });
  });

  describe('resolveTargetFile', () => {
    it('should pick CLAUDE.md if it exists', () => {
      const claudePath = path.join(TEST_DIR, 'CLAUDE.md');
      fs.writeFileSync(claudePath, 'CLAUDE content');

      const resolved = resolveTargetFile(TEST_DIR);
      expect(resolved).toBe(path.resolve(claudePath));
    });

    it('should pick AGENTS.md if CLAUDE.md is missing but AGENTS.md exists', () => {
      const agentsPath = path.join(TEST_DIR, 'AGENTS.md');
      fs.writeFileSync(agentsPath, 'AGENTS content');

      const resolved = resolveTargetFile(TEST_DIR);
      expect(resolved).toBe(path.resolve(agentsPath));
    });

    it('should pick .github/copilot-instructions.md if CLAUDE/AGENTS are missing', () => {
      const githubDir = path.join(TEST_DIR, '.github');
      fs.mkdirSync(githubDir, { recursive: true });
      const copilotPath = path.join(githubDir, 'copilot-instructions.md');
      fs.writeFileSync(copilotPath, 'Copilot instructions');

      const resolved = resolveTargetFile(TEST_DIR);
      expect(resolved).toBe(path.resolve(copilotPath));
    });

    it('should create empty CLAUDE.md if none of the candidate files exist', () => {
      const resolved = resolveTargetFile(TEST_DIR);
      const expectedPath = path.resolve(TEST_DIR, 'CLAUDE.md');
      expect(resolved).toBe(expectedPath);
      expect(fs.existsSync(expectedPath)).toBe(true);
      expect(fs.readFileSync(expectedPath, 'utf-8')).toContain('# AI Context');
    });
  });

  describe('getConfig', () => {
    it('should load default config and resolve target to CLAUDE.md (created) when no .briefed.json exists', () => {
      const config = getConfig(TEST_DIR);
      expect(config.backend).toBe('ollama');
      expect(config.model).toBe('llama3');
      expect(config.target).toBe(path.resolve(TEST_DIR, 'CLAUDE.md'));
    });

    it('should override backend and model if specified in .briefed.json', () => {
      const userConfig = {
        backend: 'anthropic',
        model: 'claude-3-5-sonnet',
        target: 'custom-context.md',
      };
      fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

      const config = getConfig(TEST_DIR);
      expect(config.backend).toBe('anthropic');
      expect(config.model).toBe('claude-3-5-sonnet');
      expect(config.target).toBe(path.resolve(TEST_DIR, 'custom-context.md'));
    });

    it('should perform a deep merge of nested configurations such as window', () => {
      const userConfig = {
        window: {
          entries: 25, // only overriding entries, days should be kept from default
        },
      };
      fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

      const config = getConfig(TEST_DIR);
      expect(config.window.entries).toBe(25);
      expect(config.window.days).toBe(7); // default days
    });

    it('should fallback to default config if .briefed.json contains malformed JSON', () => {
      fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), '{ invalid json ');

      const config = getConfig(TEST_DIR);
      expect(config.backend).toBe('ollama'); // still has default backend
      expect(config.window.entries).toBe(10); // still has default entries
    });

    it('should protect against Prototype Pollution in deepMerge', () => {
      const maliciousPayload = '{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted": "yes"}}}';
      fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), maliciousPayload);

      const config = getConfig(TEST_DIR);
      
      // Verify no pollution has occurred on the base Object or config return
      expect((config as any).polluted).toBeUndefined();
      expect(({} as any).polluted).toBeUndefined();
    });

    describe('API Key Resolution Priority', () => {
      it('should prioritize API key from config file over environment variables', () => {
        vi.stubEnv('BRIEFED_API_KEY', 'env-briefed-key');
        vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

        const userConfig = {
          apiKey: 'config-key',
        };
        fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

        const config = getConfig(TEST_DIR);
        expect(config.apiKey).toBe('config-key');
      });

      it('should prioritize BRIEFED_API_KEY over ANTHROPIC_API_KEY if key not in config file', () => {
        vi.stubEnv('BRIEFED_API_KEY', 'env-briefed-key');
        vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

        const config = getConfig(TEST_DIR);
        expect(config.apiKey).toBe('env-briefed-key');
      });

      it('should fallback to ANTHROPIC_API_KEY if BRIEFED_API_KEY is not defined', () => {
        vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

        const config = getConfig(TEST_DIR);
        expect(config.apiKey).toBe('env-anthropic-key');
      });

      it('should be undefined if neither config file nor environment variables have a key', () => {
        const config = getConfig(TEST_DIR);
        expect(config.apiKey).toBeUndefined();
      });
    });

    describe('Three-tiered configuration merging', () => {
      it('should priority-merge in order: System Defaults -> Global Config -> Local Config', () => {
        const fakeHome = path.join(TEST_DIR, 'fake-home');

        // 1. Setup global configuration (~/.briefed.json)
        const globalConfig = {
          backend: 'anthropic',      // Overrides system default ('ollama')
          model: 'claude-3-5-sonnet', // Overrides system default ('llama3')
          minDiffLines: 15,          // Overrides system default (10)
          window: {
            days: 14                 // Overrides system default (7)
          }
        };
        fs.writeFileSync(path.join(fakeHome, '.briefed.json'), JSON.stringify(globalConfig));

        // 2. Setup local configuration (.briefed.json in local test dir)
        const localConfig = {
          model: 'claude-3-opus',    // Overrides global config ('claude-3-5-sonnet')
          window: {
            entries: 50              // Overrides system default (10) while preserving global's days (14)
          }
        };
        fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(localConfig));

        // Get config passing local TEST_DIR
        const config = getConfig(TEST_DIR);

        // Assertions:
        // - backend: overridden by global config to 'anthropic' (local does not specify, default is 'ollama')
        expect(config.backend).toBe('anthropic');
        // - model: overridden by local config to 'claude-3-opus' (overrides global's 'claude-3-5-sonnet')
        expect(config.model).toBe('claude-3-opus');
        // - minDiffLines: overridden by global config to 15
        expect(config.minDiffLines).toBe(15);
        // - window.days: overridden by global to 14
        expect(config.window.days).toBe(14);
        // - window.entries: overridden by local to 50
        expect(config.window.entries).toBe(50);
      });

      it('should gracefully handle missing or malformed global config', () => {
        const fakeHome = path.join(TEST_DIR, 'fake-home');

        // Write a malformed global config
        fs.writeFileSync(path.join(fakeHome, '.briefed.json'), '{ malformed json ');

        // Setup a valid local configuration
        const localConfig = {
          backend: 'gemini',
        };
        fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(localConfig));

        const config = getConfig(TEST_DIR);

        // Should fallback to defaults for anything not in localConfig, and successfully load localConfig
        expect(config.backend).toBe('gemini');
        expect(config.model).toBe('gemini-2.5-flash'); // gemini default since no model is set
        expect(config.minDiffLines).toBe(10); // default
      });
    });

    describe('Gemini backend configuration', () => {
      it('should default model to gemini-2.5-flash when backend is gemini and model is default llama3', () => {
        const userConfig = {
          backend: 'gemini',
        };
        fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

        const config = getConfig(TEST_DIR);
        expect(config.backend).toBe('gemini');
        expect(config.model).toBe('gemini-2.5-flash');
      });

      it('should respect custom model for gemini if specified in user config', () => {
        const userConfig = {
          backend: 'gemini',
          model: 'gemini-1.5-pro'
        };
        fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

        const config = getConfig(TEST_DIR);
        expect(config.backend).toBe('gemini');
        expect(config.model).toBe('gemini-1.5-pro');
      });

      describe('API Key Resolution Priority for Gemini', () => {
        it('should prioritize API key from config file over GEMINI_API_KEY environment variable', () => {
          vi.stubEnv('GEMINI_API_KEY', 'env-gemini-key');
          vi.stubEnv('BRIEFED_API_KEY', 'env-briefed-key');
          vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

          const userConfig = {
            backend: 'gemini',
            apiKey: 'config-key',
          };
          fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

          const config = getConfig(TEST_DIR);
          expect(config.apiKey).toBe('config-key');
        });

        it('should prioritize GEMINI_API_KEY over BRIEFED_API_KEY and ANTHROPIC_API_KEY if key not in config file', () => {
          vi.stubEnv('GEMINI_API_KEY', 'env-gemini-key');
          vi.stubEnv('BRIEFED_API_KEY', 'env-briefed-key');
          vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

          const userConfig = {
            backend: 'gemini',
          };
          fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

          const config = getConfig(TEST_DIR);
          expect(config.apiKey).toBe('env-gemini-key');
        });

        it('should fallback to BRIEFED_API_KEY if GEMINI_API_KEY is not defined', () => {
          vi.stubEnv('BRIEFED_API_KEY', 'env-briefed-key');
          vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

          const userConfig = {
            backend: 'gemini',
          };
          fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

          const config = getConfig(TEST_DIR);
          expect(config.apiKey).toBe('env-briefed-key');
        });

        it('should fallback to ANTHROPIC_API_KEY if GEMINI_API_KEY and BRIEFED_API_KEY are not defined', () => {
          vi.stubEnv('ANTHROPIC_API_KEY', 'env-anthropic-key');

          const userConfig = {
            backend: 'gemini',
          };
          fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

          const config = getConfig(TEST_DIR);
          expect(config.apiKey).toBe('env-anthropic-key');
        });

        it('should be undefined if neither config file nor any environment variables have a key', () => {
          const userConfig = {
            backend: 'gemini',
          };
          fs.writeFileSync(path.join(TEST_DIR, '.briefed.json'), JSON.stringify(userConfig));

          const config = getConfig(TEST_DIR);
          expect(config.apiKey).toBeUndefined();
        });
      });
    });
  });
});
