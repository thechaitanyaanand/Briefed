# Changelog

## 0.10.0

**Behavior changes — read before upgrading**

- **New default target:** entries go to `.briefed/context.md` (it gitignores itself), and `briefed init` links it from `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md`. No more dirty working tree or merge conflicts. To keep the old behavior, set `"target": "CLAUDE.md"`.
- **Re-run `briefed init` after upgrading.** Hooks written by older versions are upgraded in place; your own hook code is left alone.
- **No API key? No problem:** with no backend configured and no key in the environment, summaries come from commit messages and PR titles. A `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` selects an LLM automatically.
- **Age pruning is off by default** (`window.days: 0`). Entries are bounded by count and word budget instead, so a quiet week no longer empties the context.
- **CI:** pass `--target CLAUDE.md` (see the README workflow), since the default target is now gitignored.

**New**

- Hooks run Briefed in the background: `git pull` returns immediately. Output goes to `.git/briefed.log`.
- `post-checkout` hook: branch switches are summarized from the merge-base (`briefed run --since <ref>`).
- `briefed context`: print recent changes to stdout, for agent session-start hooks.
- `briefed stats`: local run statistics (runs, LLM vs commit-log, fallbacks, average time).
- `briefed status` shows the last run's time, backend and duration.
- Summaries are written for AI agents: up to 5 bullets of renamed modules, new commands, env vars, breaking changes.
- PR titles from GitHub merge commits are used as summary input.
- The context link tells Codex, Copilot and Cursor to read the file (Claude Code imports it).

**Fixes**

- Ignored files (lockfiles, `dist/`) were still sent to the LLM; patterns are now git exclude pathspecs.
- Gemini could send `ANTHROPIC_API_KEY` to Google.
- The Ollama prompt skipped secret scrubbing.
- An Anthropic-only setup got the Gemini model name, so every call failed.
- Pulls recorded "made" as the source branch.
- The file list in mechanical entries came back garbled when the file was re-read.
- Hooks preferred a stale global `briefed` over the project's pinned version.
- Spinner output leaked into git output when run from hooks.
- Errors exited 0 in Git Bash.

**Internal**

- Zero runtime dependencies (removed commander, chalk, minimatch). Requires Node 18.3+.
- Large diffs get an equal per-file budget instead of being cut after 200 lines.
- Gemini Flash runs with thinking disabled; default Anthropic model is `claude-haiku-5-5`.
