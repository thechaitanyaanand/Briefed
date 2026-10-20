# Briefed

**Your AI coding agent finds out what your teammates changed, as soon as you pull.**

Briefed is a zero-dependency CLI that hooks into git. After every `git pull`, merge, rebase or branch switch, it writes a short summary of what changed to `.briefed/context.md`, which `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md` all reference. It works out of the box with **no API key** (it uses commit messages), and gets smarter with Gemini, Claude or a local Ollama model.

```bash
npx briefed-cli init     # that's the whole setup
```

<div align="center">
  <img width="914" height="222" alt="Briefed in action" src="https://github.com/user-attachments/assets/d553d8c2-5551-4969-8868-2721315983e1" />
</div>

## Why not just let the agent run `git log`?

It can, but it won't unless you ask, and a raw log is noisy. Briefed keeps a short note that is **always loaded**, newest first and bounded to ~1000 words. It only contains what changes how the agent should work: renamed modules, new commands, new environment variables, breaking changes. Lockfiles, build output and version bumps are filtered out before anything is summarized.

## Features

- **Zero config:** no API key needed. Set `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` and it upgrades to LLM summaries automatically.
- **Never slows git down:** hooks run in the background, so `git pull` returns immediately. Failures never block git.
- **No dirty working tree, no merge conflicts:** `.briefed/` is gitignored. Only the one-line link in `CLAUDE.md` is committed.
- **Every way commits arrive:** `post-merge` (pull/merge), `post-rewrite` (rebase), `post-checkout` (branch switch).
- **Agent-focused summaries:** the prompt asks for facts that change how an agent should work, not a changelog.
- **Token-bounded:** a per-file diff budget, a word cap on each summary, and a rolling window on the whole file.
- **Safe:** secrets are scrubbed from diffs before they're sent to any LLM. Keys are never sent to the wrong provider.
- **Zero runtime dependencies:** Node 18.3+ standard library only.

---

## Quick start

```bash
npm install -g briefed-cli   # or use npx briefed-cli <command>
cd your-repo
briefed init                 # installs hooks, links .briefed/context.md from your agent files
git add CLAUDE.md && git commit -m "Link Briefed context"
```

That's it. Pull, merge or switch branches as usual. Other commands:

| Command | What it does |
| :--- | :--- |
| `briefed run` | Summarize changes since `ORIG_HEAD` now (`--verbose` to see details, `--since <ref>` to pick a base) |
| `briefed status` | Show the last run (when, which backend, how long) and the latest entry |
| `briefed context` | Print recent changes to stdout, for an agent's session-start hook |
| `briefed stats` | Local run statistics: runs, LLM vs commit-log summaries, fallbacks, average time (nothing leaves your machine) |
| `briefed config` | Print the resolved configuration (API key redacted) |
| `briefed init -i` | Interactive setup for backend, target and API key |
| `briefed uninstall` | Remove the hooks |

Hook output from the last run goes to `.git/briefed.log`. **After upgrading Briefed, re-run `briefed init`:** it upgrades hooks written by older versions in place and leaves your own hook code untouched.

### Team setup

Git hooks aren't committed, so each teammate runs `npx briefed-cli init` once per clone. To make it automatic for an npm project, add it to `prepare`:

```json
{ "scripts": { "prepare": "briefed init" }, "devDependencies": { "briefed-cli": "^0.10.0" } }
```

The hooks run the project's own `node_modules/.bin/briefed` before any global install, so the whole team uses the pinned version. If the repo uses Husky, `init` writes into `.husky/` instead of `.git/hooks/`, so the hooks are shared through the repo.

---

## How it works

1. **Hook fires** in the background and runs `briefed run` (or `briefed run --since <previous HEAD>` on branch switches).
2. **Diff:** `git diff <base> HEAD`, where base is `ORIG_HEAD` after a pull, merge or rebase, and the merge-base with the previous branch after a checkout. `ignored` patterns are passed to git as exclude pathspecs, so lockfiles and build output never reach the summarizer.
3. **Budget:** diffs over 8,000 characters are cut down so every file gets an equal share, with `git diff --stat` on top.
4. **Summarize:** commit subjects, the file list and the diff go to the configured backend. Tiny changes (≤ 2 files and ≤ `minDiffLines` lines) skip the LLM.
5. **Write:** the entry is prepended between `<!-- BRIEFED_START -->` / `<!-- BRIEFED_END -->` in the target, with duplicates (same commit) skipped and old entries pruned by `window`.

An entry looks like this:

```markdown
## [2026-10-20T13:23:38Z] 278ccf0 (feature/auth)
- Auth moved from src/auth to src/security; import from there
- New `npm run db:migrate` script; run it after pulling
- BRIEFED_MODE env var is now required in .env

FILES: src/security/login.ts, package.json, .env.example
```

Without an LLM, the bullets are the commit subjects (with PR titles taken from GitHub merge commits), followed by a `STATS:` line.

**Agents other than Claude Code:** Claude Code resolves the `@.briefed/context.md` import automatically. Codex, Copilot and Cursor follow the sentence `init` adds ("Before starting work, read .briefed/context.md…"). For an agent with a session-start hook, run `briefed context` there to inject the entries directly.

---

## Configuration

Put settings in `~/.briefed.json` (applies to all repos) or `.briefed.json` (per repo; gitignore it if it holds a key). Local overrides global, which overrides the defaults.

| Option | Default | Description |
| :--- | :--- | :--- |
| `target` | `"auto"` | `"auto"` = `.briefed/context.md` (gitignored, linked from agent files). Set e.g. `"CLAUDE.md"` to write entries straight into a committed file, as the CI workflow does. |
| `backend` | auto | `"gemini"`, `"anthropic"`, `"ollama"` or `"none"`. If unset: `gemini` when `GEMINI_API_KEY` is set, `anthropic` when `ANTHROPIC_API_KEY`/`BRIEFED_API_KEY` is set, otherwise `none` (commit messages). |
| `model` | per backend | `gemini-2.5-flash`, `claude-haiku-5-5`, `llama3`. |
| `apiKey` | env | Env vars win: Gemini reads `GEMINI_API_KEY` → `BRIEFED_API_KEY`; Anthropic reads `BRIEFED_API_KEY` → `ANTHROPIC_API_KEY`. Prefer env vars over storing keys in files. |
| `apiUrl` | `http://localhost:11434` | Ollama endpoint. |
| `window.entries` | `10` | Maximum entries kept. |
| `window.maxTotalWords` | `1000` | Word budget across all entries; oldest are pruned first. |
| `window.days` | `0` (off) | Optional maximum entry age in days. |
| `ignored` | lockfiles, `dist/`, `*.map`, `*.min.*` | `.gitignore`-style patterns. `*.lock` and `dist/` match at any depth; patterns containing `/` are anchored at the repo root. |
| `minDiffLines` | `10` | Changes this small (in ≤ 2 files) skip the LLM. |
| `maxSummaryWords` | `250` | Word cap per LLM summary. |

---

## CI/CD (optional)

Local hooks cover developers who pull. If your team merges in the GitHub UI and wants a committed, central context file, run Briefed in a workflow that writes straight into `CLAUDE.md`:

```yaml
name: Briefed Context Update
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  briefed-context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 2
      - uses: actions/setup-node@v6
        with:
          node-version: 20
      - name: Run briefed
        run: |
          git update-ref ORIG_HEAD "$(git rev-parse HEAD~1)"
          npx --yes briefed-cli run --target CLAUDE.md
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}  # optional; without it, commit messages are used
      - name: Commit context
        run: |
          if ! git diff --quiet -- CLAUDE.md; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git commit -am "Update AI context [skip ci]" && git push
          fi
```

To add the optional key: **Settings → Secrets and variables → Actions → New repository secret**, named `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`).

---

## Troubleshooting

- **Nothing updates after a pull:** check `.git/briefed.log`, then run `briefed run --verbose`.
- **`LLM summarization failed ... Falling back to commit-log summary`:** the backend was unreachable or the key is missing. The entry is still written, built from commit messages.
- **Is it running? Is the LLM working?** `briefed stats` counts runs and LLM fallbacks.
- **Upgrading from 0.9.x:** entries used to be written into `CLAUDE.md`. Re-run `briefed init` to upgrade the hooks and switch to `.briefed/context.md` (then delete the old marker block), or set `"target": "CLAUDE.md"` to keep the old behavior.

See [PROMPT.md](PROMPT.md) for prompt design notes and [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.
