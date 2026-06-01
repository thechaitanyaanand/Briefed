import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

describe('CLI Integration Tests', () => {
  const cliPath = path.resolve(__dirname, '../../dist/cli.js');

  it('should display the custom Help & Configuration Guide', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('HELP & CONFIGURATION GUIDE');
    expect(output).toContain('Environment Keys:');
    expect(output).toContain('BRIEFED_API_KEY');
    expect(output).toContain('GEMINI_API_KEY');
    expect(output).toContain('ANTHROPIC_API_KEY');
    expect(output).toContain('Fallback Mechanics:');
    expect(output).toContain('none');
    expect(output).toContain('Config File Blueprint:');
    expect(output).toContain('.briefed.json');
  });

  it('should accept override options in "run" command', () => {
    const output = execSync(`node ${cliPath} run --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('-b, --backend <backend>');
    expect(output).toContain('-m, --model <model>');
    expect(output).toContain('-t, --target <path>');
    expect(output).toContain('-v, --verbose');
  });

  it('should accept interactive option in "init" command', () => {
    const output = execSync(`node ${cliPath} init --help`, { encoding: 'utf-8' });
    
    expect(output).toContain('-i, --interactive');
  });

  it('should display help for the uninstall command', () => {
    const output = execSync(`node ${cliPath} uninstall --help`, { encoding: 'utf-8' });
    expect(output).toContain('Uninstall Git hooks');
  });

  it('should print sanitized config', () => {
    // Temporarily set an environment variable to mock configuration API key
    const output = execSync(`node ${cliPath} config`, {
      encoding: 'utf-8',
      env: { ...process.env, BRIEFED_API_KEY: 'super-secret-key' }
    });
    const parsed = JSON.parse(output);
    expect(parsed.apiKey).toBe('[REDACTED]');
  });
});
