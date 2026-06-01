import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MetricsCollector } from '../metrics.js';

const TEST_DIR = path.resolve(__dirname, '../../temp_metrics_test');
const METRICS_FILE = path.join(TEST_DIR, '.briefed-metrics.json');

describe('MetricsCollector', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(METRICS_FILE)) {
      fs.unlinkSync(METRICS_FILE);
    }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmdirSync(TEST_DIR);
    }
  });

  it('records duration metrics in memory', () => {
    const metrics = new MetricsCollector({ rootPath: TEST_DIR });
    metrics.recordDuration('summarize', 1234);

    const stored = metrics.getMetrics();
    expect(stored.durations).toHaveLength(1);
    expect(stored.durations[0]).toEqual(
      expect.objectContaining({ action: 'summarize', ms: 1234 })
    );
  });

  it('records API usage metrics correctly', () => {
    const metrics = new MetricsCollector({ rootPath: TEST_DIR });
    metrics.recordAPIUsage('gemini', 482);

    const stored = metrics.getMetrics();
    expect(stored.apiUsage).toHaveLength(1);
    expect(stored.apiUsage[0]).toEqual(
      expect.objectContaining({ backend: 'gemini', tokens: 482 })
    );
  });

  it('persists metrics to a JSON file with default payload structure', async () => {
    const metrics = new MetricsCollector({ rootPath: TEST_DIR });
    metrics.recordDuration('summarize', 100);
    metrics.recordAPIUsage('ollama', 20);
    metrics.recordBackendUsed('ollama');
    metrics.recordDiffSize(15, 3, 2);
    metrics.recordOutcome(true);

    await metrics.saveMetrics(METRICS_FILE);

    expect(fs.existsSync(METRICS_FILE)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
    expect(saved.backendUsed).toBe('ollama');
    expect(saved.diffSize).toEqual({ additions: 15, deletions: 3, filesChanged: 2 });
    expect(saved.success).toBe(true);
    expect(saved.durations[0]).toEqual(expect.objectContaining({ action: 'summarize', ms: 100 }));
    expect(saved.apiUsage[0]).toEqual(expect.objectContaining({ backend: 'ollama', tokens: 20 }));
  });

  it('preserves error outcome when saving metrics after a failed execution', async () => {
    const metrics = new MetricsCollector({ rootPath: TEST_DIR });
    metrics.recordDuration('summarize', 420);
    metrics.recordOutcome(false, 'timeout');

    await metrics.saveMetrics(METRICS_FILE);

    const saved = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf-8'));
    expect(saved.success).toBe(false);
    expect(saved.errorMessage).toBe('timeout');
    expect(saved.recordedAt).toBeDefined();
  });
});
