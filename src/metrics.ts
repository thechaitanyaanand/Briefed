import * as fs from 'fs/promises';
import * as path from 'path';

export interface DurationMetric {
  action: string;
  ms: number;
  recordedAt: string;
}

export interface APIUsageMetric {
  backend: string;
  tokens: number;
  recordedAt: string;
}

export interface DiffMetrics {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface MetricsPayload {
  recordedAt: string;
  durations: DurationMetric[];
  apiUsage: APIUsageMetric[];
  backendUsed?: string;
  diffSize?: DiffMetrics;
  success?: boolean;
  errorMessage?: string | null;
}

export interface MetricsCollectorOptions {
  rootPath?: string;
  fileName?: string;
}

export class MetricsCollector {
  private durations: DurationMetric[] = [];
  private apiUsage: APIUsageMetric[] = [];
  private backendUsed?: string;
  private diffSize?: DiffMetrics;
  private success?: boolean;
  private errorMessage?: string | null;
  private readonly rootPath: string;
  private readonly fileName: string;

  constructor(options?: MetricsCollectorOptions) {
    this.rootPath = options?.rootPath || process.cwd();
    this.fileName = options?.fileName || '.briefed-metrics.json';
  }

  recordDuration(action: string, ms: number): void {
    this.durations.push({
      action,
      ms,
      recordedAt: new Date().toISOString()
    });
  }

  recordAPIUsage(backend: string, tokens: number): void {
    this.apiUsage.push({
      backend,
      tokens,
      recordedAt: new Date().toISOString()
    });
  }

  recordBackendUsed(backend: string): void {
    this.backendUsed = backend;
  }

  recordDiffSize(additions: number, deletions: number, filesChanged: number): void {
    this.diffSize = { additions, deletions, filesChanged };
  }

  recordOutcome(success: boolean, errorMessage?: string | null): void {
    this.success = success;
    this.errorMessage = success ? null : errorMessage ?? null;
  }

  getMetrics(): MetricsPayload {
    return {
      recordedAt: new Date().toISOString(),
      durations: [...this.durations],
      apiUsage: [...this.apiUsage],
      backendUsed: this.backendUsed,
      diffSize: this.diffSize,
      success: this.success,
      errorMessage: this.errorMessage
    };
  }

  async saveMetrics(filePath?: string): Promise<void> {
    const outputPath = filePath ?? path.resolve(this.rootPath, this.fileName);
    const payload = this.getMetrics();
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
