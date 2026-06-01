import * as path from 'path';
import chalk from 'chalk';
import { SummarizeInput, SummarizeOutput, DiffResult } from './types.js';

/**
 * Formats a mechanical summary when LLM is skipped or fails.
 */
function formatMechanicalSummary(diff: DiffResult): string {
  const fileGroups: string[] = [];
  for (const [dir, files] of Object.entries(diff.filesByDir)) {
    const dirLabel = dir === '.' ? './' : (dir.endsWith('/') ? dir : `${dir}/`);
    const basenames = files.map(f => path.basename(f));
    fileGroups.push(`${dirLabel} (${basenames.join(', ')})`);
  }

  return [
    `FILES: ${fileGroups.join(' | ')}`,
    `DEPS: ${diff.additions} insertions, ${diff.deletions} deletions`
  ].join('\n');
}

/**
 * Enforces a word count limit on the given text.
 * Truncates at the last complete line that fits, or truncates the line itself if needed.
 */
function enforceWordLimit(text: string, maxWords: number = 150): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  const lines = text.split('\n');
  const keptLines: string[] = [];
  let currentWordCount = 0;

  for (const line of lines) {
    const lineWords = line.trim().split(/\s+/).filter(Boolean).length;
    if (currentWordCount + lineWords <= maxWords) {
      keptLines.push(line);
      currentWordCount += lineWords;
    } else {
      break;
    }
  }

  if (keptLines.length === 0 && lines.length > 0) {
    const firstLineWords = lines[0].trim().split(/\s+/).filter(Boolean);
    return firstLineWords.slice(0, maxWords).join(' ');
  }

  return keptLines.join('\n');
}

/**
 * Constructs the prompt template for LLM summarization.
 */
function constructPrompt(diff: DiffResult): string {
  return `Summarize the following git diff.
You MUST output ONLY a structured block format with exactly these categories: FILES, ADDED, REMOVED, RENAMED, DEPS.
Use pipe (|) to separate items within each category. Do not include any markdown fences, extra explanations, or conversational filler.

Format:
FILES: <comma-separated list of directories/files changed>
ADDED: <key features, modules or code additions, separated by |>
REMOVED: <key removals or deprecations, separated by |>
RENAMED: <files renamed, e.g. path/to/old -> path/to/new, separated by |>
DEPS: <dependency changes or change counts, e.g., "X additions, Y deletions">

Git Diff:
${diff.rawDiff}

List of changed files:
${diff.files.join('\n')}

Change Statistics:
Additions: ${diff.additions}
Deletions: ${diff.deletions}
`;
}

/**
 * Summarizes the changed git diff using Ollama, Anthropic, or none backend.
 */
export async function summarize(input: SummarizeInput): Promise<SummarizeOutput> {
  const { diff, config } = input;

  // 1. Smart Skip Check
  const minLines = config.minDiffLines ?? 10;
  const isSmartSkip = diff.files.length <= 2 && (diff.additions + diff.deletions) <= minLines;

  if (isSmartSkip) {
    const summary = formatMechanicalSummary(diff);
    return {
      entry: {
        date: new Date().toISOString(),
        commitHash: diff.commitHash,
        sourceBranch: diff.sourceBranch,
        summary,
        filesChanged: diff.files
      },
      backendUsed: 'none',
      skippedLLM: true
    };
  }

  // 2. If configured backend is 'none'
  if (config.backend === 'none') {
    const summary = formatMechanicalSummary(diff);
    return {
      entry: {
        date: new Date().toISOString(),
        commitHash: diff.commitHash,
        sourceBranch: diff.sourceBranch,
        summary,
        filesChanged: diff.files
      },
      backendUsed: 'none',
      skippedLLM: false
    };
  }

  // 3. Otherwise try LLM Backends
  let summary = '';
  let backendUsed: 'ollama' | 'anthropic' | 'gemini' | 'none' = config.backend;

  try {
    const prompt = constructPrompt(diff);

    if (config.backend === 'ollama') {
      const apiUrl = config.apiUrl || 'http://localhost:11434';
      const response = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
          options: { num_predict: 200 }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      if (!data || typeof data.response !== 'string') {
        throw new Error('Invalid Ollama response format');
      }
      summary = data.response.trim();
    } else if (config.backend === 'anthropic') {
      const apiKey = config.apiKey || process.env.BRIEFED_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Anthropic API key is not configured');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const text = data.content?.[0]?.text;
      if (typeof text !== 'string') {
        throw new Error('Invalid Anthropic response format');
      }
      summary = text.trim();
    } else if (config.backend === 'gemini') {
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.BRIEFED_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured');
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            maxOutputTokens: 200
          }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') {
        throw new Error('Invalid Gemini response format');
      }
      summary = text.trim();
    } else {
      throw new Error(`Unknown backend: ${config.backend}`);
    }

    // 4. Word-Count Enforcement (response > 150 words)
    summary = enforceWordLimit(summary, 150);
    summary = summary.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;');

  } catch (error: any) {
    console.warn(
      chalk.yellow(
        `Warning: LLM summarization failed (${error?.message || error}). Falling back to none backend.`
      )
    );
    summary = formatMechanicalSummary(diff);
    backendUsed = 'none';
  }

  return {
    entry: {
      date: new Date().toISOString(),
      commitHash: diff.commitHash,
      sourceBranch: diff.sourceBranch,
      summary,
      filesChanged: diff.files
    },
    backendUsed,
    skippedLLM: false
  };
}
