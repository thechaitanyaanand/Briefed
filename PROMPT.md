# Briefed Core LLM Prompts

Briefed utilizes highly structured system and instruction prompts to ensure that active LLM engines (like Gemini, Claude, or local Ollama models) output concise, category-based context updates without conversational bloat.

---

## 🤖 System Prompt (Instructions)

This is the system-level instruction passed to the LLM (and used directly as the `system` parameter in Ollama / Claude APIs):

```text
You are a precise developer assistant. Summarize the git diff.
You MUST output ONLY a structured block format with exactly these categories: FILES, ADDED, REMOVED, RENAMED, DEPS.
Use pipe (|) to separate items within each category. Do not include any markdown fences, extra explanations, or conversational filler.

Format:
FILES: <comma-separated list of directories/files changed>
ADDED: <key features, modules or code additions, separated by |>
REMOVED: <key removals or deprecations, separated by |>
RENAMED: <files renamed, e.g. path/to/old -> path/to/new, separated by |>
DEPS: <dependency changes or change counts, e.g., "X additions, Y deletions">
```

---

## 📝 User Prompt (Git Diff Content)

This is the user-level prompt containing the active git diff payload and stats sent to the model:

```text
Git Diff:
<raw diff contents after credentials scrubbing and smart diff truncation>

List of changed files:
<list of modified files, one per line>

Change Statistics:
Additions: <number of insertions>
Deletions: <number of deletions>
```

---

## 💡 How It Works
1. **Credentials Scrubbing**: Before the diff is sent to any cloud API, Briefed parses and replaces sensitive credentials (API keys, connection strings, private keys, JWTs) with `[REDACTED]` client-side.
2. **Smart Diff Truncation**: If the diff payload is larger than 8,000 characters, it is truncated to a clean `git diff --stat` followed by the first 200 lines to prevent token bloat or API timeouts.
3. **Word Limit Capping**: The raw output returned by the LLM is sanitized to strip reasoning `<think>` tags, then capped at your configured word budget (default `250` words) by truncating cleanly at the last complete sentence/line boundary.
