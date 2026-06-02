/**
 * Configuration for the rolling window mechanism that bounds the context file.
 */
export interface WindowConfig {
  /**
   * The maximum age of entries to retain, in days.
   */
  days: number;

  /**
   * The maximum number of entries to retain in the context file.
   */
  entries: number;

  /**
   * The maximum total words allowed across all combined entries to strictly bound context size.
   * Older entries are pruned dynamically until the total fits within this budget.
   * Defaults to 1000.
   */
  maxTotalWords?: number;
}

/**
 * Main configuration for the Briefed CLI tool, specifying behavior, LLM choices, and target file.
 */
export interface BriefedConfig {
  /**
   * The target context file path. Use 'auto' to auto-detect markdown-compatible files
   * (such as CLAUDE.md, AGENTS.md, or .github/copilot-instructions.md).
   */
  target: string;

  /**
   * The summarization backend to use.
   * - 'ollama': Local LLM backend.
   * - 'anthropic': Cloud LLM backend.
   * - 'gemini': Google Gemini API backend.
   * - 'none': Mechanical fallback (dir groupings and add/delete counts only).
   */
  backend: 'ollama' | 'anthropic' | 'gemini' | 'none';

  /**
   * The model name to use for the selected backend (e.g., 'llama3', 'claude-sonnet-4-20250514').
   */
  model: string;

  /**
   * Optional API key for the Anthropic backend. Fallback: ANTHROPIC_API_KEY or BRIEFED_API_KEY env.
   */
  apiKey?: string;

  /**
   * Optional API URL for the Ollama backend. Defaults to http://localhost:11434.
   */
  apiUrl?: string;

  /**
   * Rolling window configuration to keep the context file bounded.
   */
  window: WindowConfig;

  /**
   * Glob patterns of files to ignore. Ignored files are completely excluded from the diff.
   */
  ignored: string[];

  /**
   * Minimum number of lines changed to trigger LLM summary. If change lines are below this,
   * it will skip the LLM and use mechanical summary to save tokens/time.
   */
  minDiffLines?: number;

  /**
   * Maximum number of words allowed in an LLM-generated summary.
   * LLM responses exceeding this limit are truncated at the last complete line boundary.
   * Defaults to 150.
   */
  maxSummaryWords?: number;
}

/**
 * Results of the git diff execution after ignored files filtering and path grouping.
 */
export interface DiffResult {
  /**
   * List of changed file paths after applying ignore glob filtering.
   */
  files: string[];

  /**
   * Changed file paths grouped by their top-level directory segment.
   */
  filesByDir: Record<string, string[]>;

  /**
   * Number of added lines in the diff.
   */
  additions: number;

  /**
   * Number of deleted lines in the diff.
   */
  deletions: number;

  /**
   * The raw string representation of the diff. Truncated to ~8000 characters if it exceeds limit.
   */
  rawDiff: string;

  /**
   * The commit hash corresponding to HEAD.
   */
  commitHash: string;

  /**
   * Extracted branch name from git reflog if available (e.g. source branch of the merge/rebase).
   */
  sourceBranch?: string;

  /**
   * Set to true if there are no meaningful or non-ignored changes to summarize.
   */
  isEmpty: boolean;
}

/**
 * Represents a single parsed or formatted entry within the Briefed context file.
 */
export interface ContextEntry {
  /**
   * Date and time of the entry in ISO 8601 format.
   */
  date: string;

  /**
   * Commit hash of the HEAD state corresponding to this entry.
   */
  commitHash: string;

  /**
   * The source branch of the merge/rebase, if available.
   */
  sourceBranch?: string;

  /**
   * The structured, LLM-generated or mechanical summary of the changes.
   */
  summary: string;

  /**
   * List of paths that were changed in this entry.
   */
  filesChanged: string[];
}

/**
 * Input structure passed to the LLM/mechanical summarizer.
 */
export interface SummarizeInput {
  /**
   * The parsed git diff result.
   */
  diff: DiffResult;

  /**
   * Current config setup of Briefed.
   */
  config: BriefedConfig;
}

/**
 * Output result structure from the summarizer process.
 */
export interface SummarizeOutput {
  /**
   * The constructed context entry ready to be appended.
   */
  entry: ContextEntry;

  /**
   * The actual backend used (could differ from config backend in case of dynamic fallback).
   */
  backendUsed: 'ollama' | 'anthropic' | 'gemini' | 'none';

  /**
   * True if the diff was below the line threshold and LLM summarization was skipped.
   */
  skippedLLM: boolean;
}
