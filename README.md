# Briefed

Briefed bridges the AI context gap for modern developer tools by dynamically tracking, summarizing, and appending Git changes into your repository's AI context files (such as `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`). 

Running as a zero-dependency CLI or post-merge/post-rewrite Git hook, Briefed captures structural diffs between `ORIG_HEAD` and `HEAD`, groups directory-level alterations, and uses LLM backends (or mechanical fallbacks) to generate context-rich, word-bounded updates so your AI assistants remain continuously aligned without manual context-dumping.

---

## Features

- ⚙️ **Automated Hook Installation**: Standalone or chained integration into your `.husky` or `.git/hooks` directories.
- 📂 **Target Auto-Detection**: Dynamically resolves target AI documentation in order of priority (`CLAUDE.md` → `AGENTS.md` → `.github/copilot-instructions.md`).
- 🤖 **Multi-Backend Summarization**: Powered locally by **Ollama**, in the cloud by **Anthropic** or **Google Gemini**, or via structured mechanical heuristics.
- ⚡ **Smart Skip Check**: Bypasses LLMs on minimal changes (diffs below a configurable line threshold) to save time and tokens.
- ✂️ **Token-Safe Limits & Truncation**: Automatically limits and truncates massive git diffs (> 8,000 chars) and enforces a strict word cap on LLM outputs using line-boundary pruning.
- 🛡️ **Non-Blocking Execution**: Safe exit codes guarantee your Git merges, rebases, and pulls are never blocked by LLM downtime or missing network dependencies.

---

## Installation

Install Briefed globally to use it across any repository, or add it to your project's development dependencies:

```bash
# Global installation
npm install -g briefed-cli

# Local project installation
npm install --save-dev briefed-cli
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
LLM engines are instructed to return a structured block output using specific categories: `FILES`, `ADDED`, `REMOVED`, `RENAMED`, and `DEPS`. Briefed enforces a configurable word cap on the returned string. If the response exceeds the limit, it prunes trailing content at the last complete line boundary, maintaining document formatting.

### 6. Smart Skip Optimization
If a change is extremely minor (i.e. number of changed files ≤ 2 AND total additions + deletions ≤ `minDiffLines` [default: 10]), Briefed automatically bypasses the LLM engine to run the mechanical generator instantly.

### 7. Structured Core Prompts
Briefed utilizes a highly-focused prompt structure (including dedicated system prompt configurations) to ensure clean categorical summaries. You can review the exact templates and engineering choices in [PROMPT.md](PROMPT.md).

---

## Configuration

You can customize Briefed behavior globally by placing a `~/.briefed.json` file in your home directory, or locally via a `.briefed.json` file in your project root. Briefed deep-merges configurations in the following precedence order:
1. **Local Project Config (`.briefed.json`)** — Project-specific overrides.
2. **Global User Config (`~/.briefed.json`)** — Global developer defaults (e.g., API keys).
3. **Built-in System Defaults** — Fallback options.

| Option | Type | Default Value | Environment Fallback | Description |
| :--- | :--- | :--- | :--- | :--- |
| `target` | `string` | `"auto"` | None | The path to your target AI context file. Set to `"auto"` to run auto-detection or provide a custom relative/absolute path. |
| `backend` | `"ollama" \| "anthropic" \| "gemini" \| "none"` | `"ollama"` | None | The summarization service to use. Select `"none"` to completely skip LLM usage and use local mechanical templates. |
| `model` | `string` | `"llama3"` | None | The specific model identifier passed to the LLM backend (e.g. `"llama3"`, `"claude-3-5-sonnet-20241022"`, `"gemini-2.5-flash"`). Defaults to `"gemini-2.5-flash"` when `gemini` is selected. |
| `apiKey` | `string` | `undefined` | `GEMINI_API_KEY`, `BRIEFED_API_KEY`, `ANTHROPIC_API_KEY` | Secret credential API key required for Anthropic and Gemini backends. Resolves first-found in priority. |
| `apiUrl` | `string` | `"http://localhost:11434"` | None | Connection endpoint API URL used specifically for local `"ollama"` requests. |
| `window.days` | `number` | `7` | None | The maximum age of entries (in days) to retain inside the context file. Older entries are pruned. |
| `window.entries` | `number` | `10` | None | The maximum number of entries to keep. Oldest entries are deleted when this limit is exceeded. |
| `window.maxTotalWords` | `number` | `1000` | None | The maximum cumulative words allowed across all combined entries to strictly bound context file footprint. Older entries are pruned dynamically. |
| `ignored` | `string[]` | `["*.lock", "package-lock.json", "pnpm-lock.yaml", "dist/", "*.map", "*.min.js", "*.min.css"]` | None | Glob patterns used to filter files out of git diff parsing. |
| `minDiffLines` | `number` | `10` | None | The minimum number of lines changed (insertions + deletions) to qualify for an LLM summarization call. |
| `maxSummaryWords` | `number` | `250` | None | The maximum word count enforced on LLM summary outputs. |

### Configuration Example (`.briefed.json` or `~/.briefed.json`)

```json
{
  "backend": "gemini",
  "model": "gemini-2.5-flash",
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

### 1. Google Gemini (Recommended)
Fast, highly accurate, and extremely token-efficient.
1. Obtain an API key from Google AI Studio.
2. Configure `"backend": "gemini"` and set your model to `"gemini-2.5-flash"` (or `gemini-2.5-pro`).
3. Export your key to the environment:
   ```bash
   export GEMINI_API_KEY="your-google-api-key"
   ```

### 2. Ollama (Local Model)
Ideal for zero-cost, local-first workflows.
1. Download and run [Ollama](https://ollama.com/).
2. Pull your chosen local model:
   ```bash
   ollama pull llama3
   ```
3. Set your backend to `"ollama"`. Briefed connects locally via `http://localhost:11434/api/generate` with a 15-second fail-safe timeout.

### 3. Anthropic Claude
Best for advanced semantic understanding and precise structured summaries.
1. Obtain an API key from the Anthropic Console.
2. Configure `"backend": "anthropic"` and set your model to `"claude-3-5-sonnet-20241022"`.
3. Export your key:
   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-key"
   ```

---

## Local-First vs. CI/CD Workflows

Briefed is designed primarily as a **local-first** developer tool, but it also supports optional **CI/CD automation** to fit any team setup:

### Option A: Local-First Workflow (Default & Recommended)
By default, all AI context file updates happen completely offline and private to your development machine:
* **Disk-Only Updates:** When you run `git pull`, `git merge`, or `git rebase` locally, Briefed's Git hooks automatically run `briefed run` and update `CLAUDE.md` on your disk.
* **No Automated Commits:** Briefed **never** stages or commits these changes automatically locally. This ensures your local Git history remains 100% clean and under your control.
* **Instant Agent Context:** Your local IDE agent (Cursor, Claude Code, or Antigravity) immediately sees the beautiful, rich summaries in `CLAUDE.md` as you code.
* **Privacy:** All API keys remain securely inside your local processes or your gitignored `.briefed.json` file.

### Option B: CI/CD Automation Workflow (Optional)
If you are working in a team and want to guarantee that your remote GitHub repository's default branch (e.g. `main`) always has an updated `CLAUDE.md` even when pull requests are merged directly through the GitHub web UI, you can deploy Briefed as a GitHub Action.

When deployed as an Action, the cloud runner executes `briefed run` upon pushes to `main`, auto-detects changes, and commits the updated context file back to your repository under the name `github-actions[bot]`.

---

## GitHub Action Setup

To set up automated remote updates on GitHub:

1. Create a file named `.github/workflows/briefed.yml` in your repository:

```yaml
name: Briefed Context Update

on:
  push:
    branches:
      - main  # Adjust this to match your default branch

permissions:
  contents: write

jobs:
  briefed-context:
    runs-on: ubuntu-latest
    if: ${{ secrets.GEMINI_API_KEY != '' || secrets.BRIEFED_API_KEY != '' || secrets.ANTHROPIC_API_KEY != '' }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Fetches previous history to compare HEAD~1 with HEAD

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'

      - name: Install Briefed
        run: npm install -g briefed-cli

      - name: Set ORIG_HEAD manually
        run: git update-ref ORIG_HEAD $(git rev-parse HEAD~1)

      - name: Run briefed
        run: briefed run
        env:
          BRIEFED_API_KEY: ${{ secrets.BRIEFED_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Check and commit context changes
        run: |
          CHANGED=$(git diff --name-only | grep -E '^(CLAUDE\.md|AGENTS\.md|\.github/copilot-instructions\.md)$' | head -1)
          if [ -n "$CHANGED" ]; then
            git config --local user.name "github-actions[bot]"
            git config --local user.email "github-actions[bot]@users.noreply.github.com"
            git add "$CHANGED"
            git commit -m "Update AI context [skip ci]"
            git push
          fi
```

### 🔑 Configuring Repository Secrets for CI/CD
Since gitignored files like `.briefed.json` are private and **never committed to your repository**, the GitHub Actions cloud runner cannot read your local API key.

For the runner to successfully invoke Gemini or Claude instead of falling back to a mechanical summary, you must configure your API key as a secure **GitHub Secret**:
1. On GitHub, navigate to your repository's homepage.
2. Click **Settings** ➡️ **Secrets and variables** ➡️ **Actions** in the sidebar.
3. Click **New repository secret**.
4. Name the secret **`GEMINI_API_KEY`** (or `ANTHROPIC_API_KEY`/`BRIEFED_API_KEY`) and paste your API key as the value.
5. Click **Add secret**.

---

## Troubleshooting & Mechanical Fallback

### Graceful Engine Degradation
Briefed incorporates a robust mechanical fallback layer when:
- The local Ollama daemon is offline or returns connection errors.
- Gemini or Anthropic API keys are not specified or credentials fail.
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
To guarantee git operations (like pulls or merges) are never blocked by Briefed execution issues, all runtime failures inside hooks are caught, printed as console warnings, and the program exits with code `0`.

---

## 🤖 System Prompt for Agentic IDEs (Cursor, Windsurf, Claude Dev, Antigravity)

### 💡 Why This Prompt is Vital
By default, when your AI assistant (like Claude Code in the terminal, Cursor in the editor, or Copilot in your environment) boots up, it has no native awareness that Briefed is running git hooks and maintaining a live chronological history in your workspace context files. 

Feeding this **System Instruction Directive** into your agent's custom rules (such as `.cursorrules`, Claude's custom instructions, or global IDE rules):
1. **Bridges the Context Latency Gap**: Forces the agent to automatically read the Briefed block so its memory matches your exact local branch state.
2. **Prevents Redundant Tool Calls**: Instructs the agent not to run expensive, slow commands (like running manual `git logs` or `git diffs`), saving substantial token fees and API response time.
3. **Unlocks Cross-Agent Alignment**: Ensures that if you switch from Claude Code to Cursor, or if multiple developers on your team use different tools, all of your AI agents stay 100% aligned on the exact same codebase history seamlessly.

Copy and paste the exact markdown block below into your global custom instructions, `.cursorrules`, `CLAUDE.md`, or IDE custom rules:

```markdown
# Git Context Alignment (Briefed CLI)
This project utilizes the Briefed CLI tool, which automatically updates the active AI context file (e.g. CLAUDE.md) after every `git pull`, merge, or rebase.

## Instructions for the AI Agent:
1. Always parse the dated Git context blocks written inside the `<!-- BRIEFED_START -->` and `<!-- BRIEFED_END -->` markers in your context file to keep your short-term memory aligned with the latest workspace state.
2. Do not attempt to run manual git diffs or git logs to understand recent pull histories; instead, inspect the structured logs inside the context markers.
3. The context log is bounded dynamically under a strict `maxTotalWords` ceiling (~1000 words) to protect your context window. Parse only the active entries between the start and end markers.
4. Entries have been sanitized client-side of any internal reasoning (`<think>`) blocks and lockfile bloat, leaving only high-signal category blocks (`FILES`, `ADDED`, `REMOVED`, `RENAMED`, `DEPS`).
5. Use this structural information to instantly grasp which endpoints, APIs, or components were recently introduced or deprecated, ensuring all code suggestions align 100% with the latest codebase updates.
```
