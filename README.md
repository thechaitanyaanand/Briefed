# Briefed

Briefed bridges the AI context gap for modern developer tools by dynamically tracking, summarizing, and appending Git changes into your repository's AI context files (such as `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`). 

Running as a zero-dependency CLI or post-merge/post-rewrite Git hook, Briefed captures structural diffs between `ORIG_HEAD` and `HEAD`, groups directory-level alterations, and uses LLM backends (or mechanical fallbacks) to generate context-rich, word-bounded updates so your AI assistants remain continuously aligned without manual context-dumping.

---

## Features

- ⚙️ **Automated Hook Installation**: Standalone or chained integration into your `.husky` or `.git/hooks` directories.
- 📂 **Target Auto-Detection**: Dynamically resolves target AI documentation in order of priority (`CLAUDE.md` → `AGENTS.md` → `.github/copilot-instructions.md`).
- 🤖 **Multi-Backend Summarization**: Powered locally by **Ollama**, in the cloud by **Anthropic**, or locally via highly structured mechanical heuristics.
- ⚡ **Smart Skip Check**: Bypasses LLMs on minimal changes (diffs below a configurable line threshold) to save time and tokens.
- ✂️ **Token-Safe Limits & Truncation**: Automatically limits and truncates massive git diffs (> 8,000 chars) and enforces a strict 150-word cap on LLM outputs using line-boundary pruning.
- 🛡️ **Non-Blocking Execution**: Safe exit codes guarantee your Git merges, rebases, and pulls are never blocked by LLM downtime or missing network dependencies.

---

## Installation

Install Briefed globally to use it across any repository, or add it to your project's development dependencies:

```bash
# Global installation
npm install -g briefed

# Local project installation
npm install --save-dev briefed
```

---

## Quick Start

### 1. Initialize Hooks and Target Files
Set up Git hooks and resolve your repository's target context file:
```bash
briefed init
```
*This targets `.husky/` if present; otherwise, it configures standard `.git/hooks/post-merge` and `.git/hooks/post-rewrite` hooks.*

### 2. Print Current Configuration
Inspect the active configurations (a deep merge of default options, local environment variables, and `.briefed.json` settings):
```bash
briefed config
```

### 3. Review the Latest Summary Entry
Read and verify the most recently written context block inside your active target file:
```bash
briefed status
```

### 4. Manually Run a Context Sync
Trigger a manual diff check against `ORIG_HEAD` and update the active context file:
```bash
briefed run
```

---

## How It Works

Briefed coordinates hook triggers, smart file detection, precise git diffing, and strict token trimming to write standard, parsable Markdown blocks within `<!-- BRIEFED_START -->` and `<!-- BRIEFED_END -->` markers.

### 1. Hook Orchestration
When running `briefed init`:
- The CLI checks for `.husky/` directories. If found, it appends to `.husky/post-merge` and `.husky/post-rewrite`.
- If Husky is absent, it writes to `.git/hooks/post-merge` and `.git/hooks/post-rewrite`.
- If an existing hook file exists, Briefed injects its command cleanly within block boundaries (`# BRIEFED_HOOK_APPENDED_START` and `# BRIEFED_HOOK_APPENDED_END`), ensuring other workflows are unaffected.

### 2. Target File Auto-Detection
If `target` is configured to `"auto"`, Briefed scans the root directory for:
1. `CLAUDE.md`
2. `AGENTS.md`
3. `.github/copilot-instructions.md`

If none of these exist, a fresh `CLAUDE.md` is generated automatically with a standard markdown header.

### 3. Diff and Segment Grouping
Briefed executes `git diff ORIG_HEAD HEAD --numstat` to identify modified files. Files matching glob patterns specified under the `"ignored"` configuration are discarded. 
To optimize semantic analysis:
- Files are grouped by their top-level directory segments (e.g. `src/`, `tests/`).
- The CLI parses git reflogs and commit history to extract the source branch name (e.g., resolving active branch merges/rebases).

### 4. Smart Diff Truncation
To safeguard context limits, if the diff exceeds 8,000 characters, Briefed computes a high-level `git diff ORIG_HEAD HEAD --stat`, captures it, and truncates the detailed raw diff after 200 lines. It appends a truncated line count suffix (e.g., `[... truncated, 342 lines omitted]`).

### 5. Word-Count Enforcement
LLM engines are instructed to return a structured block output using specific categories: `FILES`, `ADDED`, `REMOVED`, `RENAMED`, and `DEPS`. Briefed enforces a rigid 150-word cap on the returned string. If the response exceeds 150 words, it iterates backwards and prunes trailing content at the last complete line, or slices the line itself, maintaining document formatting.

### 6. Smart Skip Optimization
If a change is extremely minor (i.e. number of changed files $\le$ 2 AND total additions + deletions $\le$ `minDiffLines` [default: 10]), Briefed automatically bypasses the LLM engine to run the mechanical generator instantly.

---

## Configuration

You can customize Briefed behavior by placing a `.briefed.json` file in your project root. Here is the complete list of options:

| Option | Type | Default Value | Environment Fallback | Description |
| :--- | :--- | :--- | :--- | :--- |
| `target` | `string` | `"auto"` | None | The path to your target AI context file. Set to `"auto"` to run auto-detection or provide a custom relative/absolute path. |
| `backend` | `"ollama" \| "anthropic" \| "none"` | `"ollama"` | None | The summarization service to use. Select `"none"` to completely skip LLM usage and use local mechanical templates. |
| `model` | `string` | `"llama3"` | None | The specific model identifier passed to the LLM backend (e.g. `"llama3"`, `"claude-3-5-sonnet-20241022"`). |
| `apiKey` | `string` | `undefined` | `BRIEFED_API_KEY`, `ANTHROPIC_API_KEY` | Secret credential API key required only for the `"anthropic"` backend. |
| `apiUrl` | `string` | `"http://localhost:11434"` | None | Connection endpoint API URL used specifically for local `"ollama"` requests. |
| `window.days` | `number` | `7` | None | The maximum age of entries (in days) to retain inside the context file. Older entries are pruned. |
| `window.entries` | `number` | `10` | None | The maximum number of entries to keep. Oldest entries are deleted when this limit is exceeded. |
| `ignored` | `string[]` | `["*.lock", "dist/", "*.map", "*.min.js", "*.min.css"]` | None | Glob patterns used to filter files out of git diff parsing. |
| `minDiffLines` | `number` | `10` | None | The minimum number of lines changed (insertions + deletions) to qualify for an LLM summarization call. |

### Configuration Example (`.briefed.json`)

```json
{
  "target": "CLAUDE.md",
  "backend": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "window": {
    "days": 14,
    "entries": 15
  },
  "ignored": [
    "*.lock",
    "dist/",
    "node_modules/",
    "coverage/"
  ],
  "minDiffLines": 15
}
```

---

## Supported Backends

### 1. Ollama (Local Model)
Ideal for zero-cost, local-first workflows.
1. Download and run [Ollama](https://ollama.com/).
2. Pull your chosen local model:
   ```bash
   ollama pull llama3
   ```
3. Set your `.briefed.json` backend to `"ollama"`. Briefed connects locally via `http://localhost:11434/api/generate` with a 15-second fail-safe timeout.

### 2. Anthropic (Cloud Model)
Best for advanced semantic understanding and precise structured summaries.
1. Obtain an API key from the [Anthropic Console](https://console.anthropic.com/).
2. Configure `"backend": "anthropic"` and set your model to `"claude-3-5-sonnet-20241022"` (or other models).
3. Export your key to the environment:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key"
   ```

---

## GitHub Action Setup

You can deploy Briefed on CI/CD pipelines to ensure your project's context remains up-to-date even when pull requests are merged directly through the GitHub UI.

Create a file named `.github/workflows/briefed.yml`:

```yaml
name: Briefed Context Synchronizer

on:
  push:
    branches:
      - main  # Adjust this to match your default branch

permissions:
  contents: write

jobs:
  update-context:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Compares previous commit (HEAD^) with current commit (HEAD)

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Briefed
        run: npm install -g briefed

      - name: Configure Git and Ref
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          # Set ORIG_HEAD to HEAD^ to ensure Briefed detects the merged commit range
          git update-ref ORIG_HEAD HEAD^

      - name: Generate AI Context Summary
        env:
          # Use Anthropic or other cloud backend if Ollama is unavailable in standard CI runners
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: briefed run

      - name: Commit and Push Updated Context
        run: |
          # Only commit and push if the context file actually changed
          git diff --quiet || (git add -A && git commit -m "docs: update AI context summary [skip ci]" && git push)
```

---

## Troubleshooting & Mechanical Fallback

### Graceful Engine Degradation
Briefed incorporates a robust mechanical fallback layer when:
- The local Ollama daemon is offline or returns connection errors.
- Anthropic API keys are not specified or credentials fail.
- Summarization queries hit timeouts (15-second cap).

When a failure occurs, the console writes a warning and invokes the mechanical fallback:
```text
Warning: LLM summarization failed (Ollama API error: 503 Service Unavailable). Falling back to none backend.
```

### The Mechanical Format
The local fallback formats changes into structural aggregates instantly without network roundtrips:
```markdown
FILES: src/ (cli.ts, summarize.ts) | config/ (types.ts)
DEPS: 15 insertions, 2 deletions
```

### Non-Blocking Git Hooks
To guarantee git operations (like pulls or merges) are never blocked by Briefed execution issues, the CLI inspects active environment variables. If any environment variables start with `GIT_` (signifying a Git hook runtime execution), all runtime failures are caught, printed as console warnings, and the program exits with code `0`.
