# Briefed Core LLM Prompt

Every backend (Gemini, Claude, Ollama) gets the same single prompt, built in `src/summarize.ts` (`constructPrompt`).

```text
You write the "recent changes" note that an AI coding agent reads before working in this repository.
From the commits and diff below, list only facts that change how the agent should work: new, renamed or removed commands, scripts, modules, public APIs, config keys, environment variables, dependencies, conventions, and breaking behavior changes.
Output 1 to 5 lines, each starting with "- ". No headings, no file lists, no line counts, no markdown fences, no filler.
If nothing matters to an agent, output exactly: - Minor changes only.

Commits:
<non-merge commit subjects in the range, newest first>

Changed files:
<one per line, ignored patterns already excluded>

Git diff:
<scrubbed, budgeted diff>
```

## Design choices

1. **Written for the agent, not as a changelog.** "Bug report template added" doesn't help an agent write code. "Auth moved to src/security" does.
2. **Commit subjects come first.** They carry the author's intent at no cost. They're also the whole summary when no LLM is configured.
3. **No empty categories.** The old `FILES/ADDED/REMOVED/RENAMED/DEPS` schema used tokens on empty lines in every entry. The file list is added once by the writer, capped at 20 files.
4. **Credential scrubbing for every backend**, Ollama included, because `apiUrl` can point at a remote host.
5. **Diff budget:** over 8,000 characters, each file gets an equal share after a `git diff --stat` header, so one huge file can't push the rest out.
6. **Output cleanup:** `<think>` blocks are stripped, then the summary is capped at `maxSummaryWords` (default 250) on a line boundary.
7. **Gemini Flash runs with `thinkingBudget: 0`**: summarizing doesn't need reasoning tokens, and they add latency and cost.
