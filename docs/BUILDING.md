# Building Briefed: From Fundamentals to a Full Product

A guide to how Briefed works and how to build a tool like it, from the git internals it relies on to shipping it as an open-source product people actually adopt.

---

## 1. What Briefed is and why it exists

Briefed is a zero-dependency Node CLI. It turns every `git pull`, merge, rebase or branch switch into a short note that AI coding agents read automatically. The note lives in `.briefed/context.md`, and `CLAUDE.md`, `AGENTS.md` and `.github/copilot-instructions.md` link to it.

**The problem.** Claude Code, Cursor and Copilot load project rules at session start, but those rules don't change when teammates do. After a pull, the agent still believes the old module layout, scripts and env vars. It suggests code against an API that was renamed this morning.

**The value proposition.** An agent *can* run `git log`, but it won't unless asked, and a raw log is noisy. Briefed's note is:

- **Always loaded:** it's imported into the agent's context file, so no prompt is needed.
- **Agent-relevant:** renamed modules, new commands, new env vars, breaking changes. Version bumps and template files don't belong in it.
- **Bounded:** about 1000 words, newest first, older entries pruned.
- **Free by default:** without an API key, it summarizes from commit messages.

**Design constraints that shape everything below:**

1. Never slow down or break git.
2. Never dirty the working tree.
3. Never send secrets anywhere.
4. Work with zero configuration.

Every later decision is one of these constraints applied to a concrete problem.

---

## 2. Fundamentals: the git concepts Briefed relies on

You can't build this tool without understanding these. Each one is a primitive git already gives you, which means less code to write.

### Hooks

Hooks are executable scripts in `.git/hooks/` that git runs at fixed points. Briefed uses three *post-* hooks:

| Hook | Fires after | Arguments | Briefed uses it for |
| --- | --- | --- | --- |
| `post-merge` | `git merge`, `git pull` (merge mode) | `$1` = 1 if squash | Pulls and merges |
| `post-rewrite` | `git rebase`, `git commit --amend` | `$1` = `rebase` or `amend` | Rebases only (`[ "$1" = "rebase" ]`) |
| `post-checkout` | `git checkout` / `git switch` | `$1` old HEAD, `$2` new HEAD, `$3` 1 = branch switch | Branch switches only |

Key facts:

- **Post-hooks cannot block git.** Their exit code is ignored, so failing in one is harmless to the user's operation, but *slowness* still hurts. Git waits for the hook to finish.
- **Hooks are not committed.** `.git/` is never pushed, so every clone has to install them. This is a product problem (section 10), not just a technical one.
- **Hooks run with a minimal environment.** They need a POSIX `sh`, which Git for Windows ships. Write them in plain `sh`, not bash, with LF line endings (CRLF breaks the interpreter line).
- **Husky** sets `core.hooksPath=.husky`, so hooks live in the repo and are shared. If `.husky/` exists, install there.

### ORIG_HEAD

Before a merge, pull, rebase or reset moves HEAD, git saves the old position in `ORIG_HEAD`. So after a pull, `git diff ORIG_HEAD HEAD` is exactly "what just arrived". That one fact is the heart of the tool.

Fallback chain when `ORIG_HEAD` doesn't exist: `HEAD~1` (the previous commit), then the **empty tree** `4b825dc642cb6eb9a0fb9e4c4e2921d1d61301fc`. Every git repository has this object id, and diffing against it means "everything".

### merge-base

`git checkout` does not set `ORIG_HEAD`. For a branch switch, the right base is `git merge-base <old HEAD> <new HEAD>`, the last common ancestor. That gives "what this branch has that the previous one didn't". If the new branch is an ancestor of the old one, the merge-base equals HEAD and the diff is empty, so nothing is written. That's the correct result.

### Pathspecs

Git commands accept *pathspecs* after `--` to limit which files they consider. Magic signatures make them powerful:

```bash
git diff ORIG_HEAD HEAD -- . ':(exclude,glob)**/*.lock' ':(exclude,glob)**/dist/**'
```

`:(exclude,glob)` means "glob pattern, exclude matches". With git doing the filtering, ignored files never appear in numstat, the raw diff or the stat. One mechanism, no glob library, no drift between the three views.

### numstat, stat, log

- `git diff --numstat`: `added<TAB>deleted<TAB>path`, machine-readable per-file counts (`-` for binary files). Renames print as `src/{old => new}/file.ts` and need parsing.
- `git diff --stat`: a human summary, used as a header when the diff is truncated.
- `git log --no-merges --format=%s base..HEAD`: the commit subjects in the range. This is the cheapest, highest-signal input available, because it's the author's intent in their own words.

### reflog

`git reflog -1 --format=%gs` describes the last HEAD move: `merge feature/auth: Merge made by the 'ort' strategy.` or `checkout: moving from main to feature`. Briefed parses it for a branch label. **Anchor your regexes:** an unanchored `/merge\s+(\S+)/` on a pull's `pull origin master: Merge made by…` captures "made". That bug shipped, and it's visible in this repo's history.

### Worktrees and submodules

In a worktree or submodule, `.git` is a *file* containing `gitdir: <path>`, not a directory. Hook installation has to follow that pointer. For file paths inside git's own directory (like the log file), use `git rev-parse --git-path briefed.log`, which resolves correctly everywhere.

---

## 3. Architecture and data flow

Six modules, each with one job:

```
                 ┌──────────────────────────────── git pull / merge / rebase / checkout
                 ▼
   scripts/post-*  (sh)  ── backgrounds ──▶  briefed run [--since <old HEAD>]
                                                   │
   src/cli.ts       parse args (util.parseArgs), dispatch commands
                                                   │
   src/config.ts    defaults ← ~/.briefed.json ← .briefed.json ← env keys
                    resolve target (.briefed/context.md), pick backend + model
                                                   │
   src/git.ts       base ref → numstat + diff + log (pathspec-filtered)
                    → DiffResult { files, additions, deletions, rawDiff, commits, ... }
                                                   │
   src/summarize.ts smart skip? → commit-log summary
                    else prompt → Gemini | Anthropic | Ollama → clean + cap
                    (any failure → commit-log summary)
                                                   │
   src/writer.ts    lock → read → parse entries → dedupe → prepend → prune
                    → atomic write (tmp + rename) → unlock
                                                   ▼
                    .briefed/context.md  ◀── @import ── CLAUDE.md / AGENTS.md
```

`src/hook.ts` sits beside this flow. It installs and uninstalls the scripts (standalone, or appended to an existing hook between sentinel markers).

### Core types (`src/types.ts`)

- `BriefedConfig`: target, backend, model, apiKey, apiUrl, window `{days, entries, maxTotalWords}`, ignored, minDiffLines, maxSummaryWords.
- `DiffResult`: what git found. `isEmpty` short-circuits the run.
- `ContextEntry`: `{date, commitHash, sourceBranch, summary, filesChanged}`, one block in the file.
- `SummarizeOutput`: an entry plus which backend actually ran and whether the LLM was skipped.

### The context file format

```markdown
# Recent changes

<!-- BRIEFED_START -->
## [2026-10-20T13:23:38.670Z] 278ccf0b… (feature/auth)
- Auth moved from src/auth to src/security; import from there
- New `npm run db:migrate` script

FILES: src/security/login.ts, package.json
<!-- BRIEFED_END -->
```

HTML-comment markers are invisible when rendered and let Briefed own one region of a file that humans also edit. The header regex `## [date] hash (branch)` makes the file both human-readable and machine-parseable. **The file is the database**, so every write must round-trip through the parser losslessly (section 6).

---

## 4. Build it yourself, step by step

Build in this order. Each milestone is usable on its own, and each one teaches you the next problem.

### Milestone 1: the 30-line MVP

A hook that appends the diff stat to a file:

```sh
#!/bin/sh
# .git/hooks/post-merge
{ echo "## $(date -u +%FT%TZ) $(git rev-parse --short HEAD)"; git log --format='- %s' ORIG_HEAD..HEAD; echo; } >> CHANGES.md
```

This already delivers about 60% of the value. Everything after this is about quality, safety and adoption.

### Milestone 2: a real CLI

- `package.json` with `"bin": {"briefed": "dist/cli.js"}`, `"type": "module"`, and a `#!/usr/bin/env node` shebang.
- Commands: `init`, `run`, `status`, `config`, `uninstall`.
- Use `util.parseArgs` (Node ≥ 18.3) instead of a framework. Subcommand dispatch is a `Record<string, CommandSpec>` lookup.
- Run git with `execFileSync('git', args)`, **never** `exec` with string interpolation. An array of args can't be shell-injected.

### Milestone 3: structured diffing (`git.ts`)

1. Verify it's a repo: `git rev-parse --is-inside-work-tree`.
2. Resolve the base: `--since` → merge-base, otherwise `ORIG_HEAD` → `HEAD~1` → empty tree.
3. `--numstat` for files and counts, the raw diff for content, `log` for commit subjects, all with the same exclude pathspecs.
4. Parse renames, group files by top directory, extract the branch label.

### Milestone 4: the writer (`writer.ts`)

1. Create the file with markers if it's missing. Repair markers if they're corrupted or reversed.
2. Parse existing entries and skip if this commit hash is already there (hooks can fire twice).
3. Prepend, then prune: by entry count, then by a total word budget (always keep at least the newest entry).
4. Write to `file.tmp` and `rename()` over the original. A rename is atomic, so readers never see half a file.
5. Wrap it all in a lock file (`fs.writeFileSync(lock, pid, {flag: 'wx'})` fails if it exists), released in `finally`.

### Milestone 5: summaries (`summarize.ts`)

Start with no LLM: commit subjects plus a stats line. Then add backends behind one prompt (section 5). Always keep the no-LLM path as the fallback for every failure.

### Milestone 6: hook installation (`hook.ts`)

- Hook bodies live in `scripts/` as real files (one source of truth, shipped in the npm package) and are read at install time.
- Existing user hook → append the body inside `# BRIEFED_HOOK_APPENDED_START/END` markers, wrapped in a `( … )` subshell so `cd` and `exit` can't leak into the user's script.
- Uninstall → delete standalone hooks, cut appended blocks out.

### Milestone 7: product polish

Background execution, zero-config defaults, the gitignored target with links, `post-checkout`, README positioning. These turn a working tool into one people keep installed (section 10).

---

## 5. LLM integration and prompt design

### Backends

| Backend | Endpoint | Auth | Notes |
| --- | --- | --- | --- |
| `none` | none | none | Commit subjects + stats. The default, and the universal fallback. |
| `gemini` | `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | `x-goog-api-key` | Flash models get `thinkingConfig: {thinkingBudget: 0}`. Pro rejects 0. |
| `anthropic` | `api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version` | Default model `claude-haiku-5-5`: fast and cheap is right for summaries. |
| `ollama` | `<apiUrl>/api/generate` | none | Fully local. 60 s timeout, because local models are slow. |

All of them use plain `fetch` with `AbortSignal.timeout(...)`. No SDKs: three small HTTP calls don't justify three dependencies.

**Backend auto-selection** (only when none is configured): `GEMINI_API_KEY` → gemini, `ANTHROPIC_API_KEY`/`BRIEFED_API_KEY` → anthropic, otherwise none. The model then defaults per backend. Never carry one backend's model to another; that bug made every Anthropic call 404.

### The prompt

One prompt for all backends:

```text
You write the "recent changes" note that an AI coding agent reads before working in this repository.
From the commits and diff below, list only facts that change how the agent should work: new, renamed or
removed commands, scripts, modules, public APIs, config keys, environment variables, dependencies,
conventions, and breaking behavior changes.
Output 1 to 5 lines, each starting with "- ". No headings, no file lists, no line counts, no markdown
fences, no filler. If nothing matters to an agent, output exactly: - Minor changes only.

Commits: …   Changed files: …   Git diff: …
```

Why it's shaped this way:

- **Name the reader.** "An AI coding agent" steers the model away from changelog prose toward actionable facts.
- **Commit subjects first.** They're the author's intent. The diff is supporting evidence.
- **Give it an explicit "nothing to say" output.** Otherwise models invent significance for a typo fix.
- **No rigid categories.** The first version demanded `FILES/ADDED/REMOVED/RENAMED/DEPS`, which produced empty `REMOVED:` lines in nearly every entry and wasted tokens in every agent session that read the file.

### Output cleanup

1. Strip `<think>…</think>` blocks (reasoning models), including an unclosed one at the start.
2. Cap at `maxSummaryWords` on a line boundary.
3. Escape `<!--` and `-->` so model output can never forge the file's markers.

### Smart skip

If ≤ 2 files and ≤ `minDiffLines` lines changed, skip the LLM entirely. A one-line fix doesn't need a network round trip.

---

## 6. Safety, security and reliability

| Risk | Defence | Where |
| --- | --- | --- |
| Secrets in diffs sent to an LLM | Regex scrubbing of key assignments, AWS keys, bearer tokens, GitHub/npm tokens, PEM keys, DB URLs, applied to **every** backend (an Ollama `apiUrl` can be remote) | `summarize.ts` `scrubSecrets` |
| Key sent to the wrong provider | Gemini reads only `GEMINI_API_KEY`/`BRIEFED_API_KEY`, never `ANTHROPIC_API_KEY` | `config.ts`, `summarize.ts` |
| Malicious repo config writing outside the repo | `.briefed.json` comes from the cloned repo, so it's untrusted: a target that resolves outside the workspace is refused | `config.ts` |
| Prototype pollution via config JSON | `deepMerge` skips `__proto__` and `constructor` | `config.ts` |
| Shell injection | `execFileSync` with an args array | `git.ts` |
| Concurrent hooks (rebase fires checkout + rewrite) | `wx` lock file with retries, plus commit-hash dedupe | `writer.ts` |
| Half-written file on crash | Write to tmp, then atomic `rename`; retry on Windows `EPERM`/`EBUSY` | `writer.ts` |
| Model output breaking the file | Escape comment markers, round-trip parser tests | `summarize.ts`, tests |
| Blocking git | Hooks background the process and always `exit 0` | `scripts/post-*` |
| Committed API keys | Recommend env vars; `.briefed.json` is gitignored; `config` redacts the key | README, `cli.ts` |

**Never block git** is the rule that matters most. A tool that makes `git pull` fail even once gets uninstalled.

---

## 7. Performance and optimizations

| Optimization | Before | After |
| --- | --- | --- |
| Background hooks | `git pull` waited 1–60 s for the LLM | Returns immediately (measured: 439 ms total pull) |
| Pathspec filtering | Lockfile diffs filled the 8 KB budget | Git drops ignored files before Briefed sees them |
| Per-file diff budget | First 200 lines kept, so later files were invisible | Each file gets `8000 / n` chars, plus a `--stat` header |
| Thinking budget 0 (Gemini Flash) | Reasoning tokens on a summary | Lower latency and cost |
| Smart skip | LLM call for a one-line change | No network |
| Zero dependencies | commander, chalk, minimatch | Node stdlib only: faster `npx` cold start, smaller attack surface |
| Sleep, not spin | Busy-wait loops burned CPU while waiting on locks | `Atomics.wait` blocks without CPU |
| Word budgets | Unbounded context file | ~1000 words total, so agent context stays cheap |

The pattern: **let the platform do the work.** Git filters files, the OS makes renames atomic, Node parses arguments, and the shell backgrounds the process. Each one replaced code and removed a failure mode.

---

## 8. Testing strategy

Vitest, all tests under `src/__tests__/`:

- **git.ts:** `child_process.execFileSync` is mocked. The test maps argument substrings to canned outputs, so every git edge case (no ORIG_HEAD, no commits, renames, reflog formats, merge-base failure) runs in milliseconds with no repository.
- **summarize.ts:** global `fetch` is mocked. The tests assert the exact request shape per backend, every fallback path, word capping, `<think>` stripping, and the security regressions (Ollama scrubbing, no Anthropic key to Gemini).
- **writer.ts / config.ts / hook.ts:** real filesystem in a temp directory, created in `beforeEach` and removed in `afterEach`. The global config is isolated by mocking `os.homedir`, and environment keys by `vi.stubEnv`.
- **cli.test.ts:** runs the built `dist/cli.js` and checks help output and config redaction.
- **End to end (manual, before a release):** a bare "origin" repo plus two clones in a scratch directory, a shim `briefed` on `PATH` pointing at `dist/cli.js`, then a real pull, branch switch and rebase. Check that the pull returns fast, `.git/briefed.log`, `.briefed/context.md`, and a clean `git status`.

Lessons from this codebase:

- **Time bombs:** tests with hard-coded dates plus a 7-day window passed when written and failed weeks later. Use relative dates, or turn age pruning off in fixtures.
- **Test the behaviour, not the implementation.** After moving ignore handling into git, the right test asserts that the pathspecs are *passed to git*, not that JavaScript filtered a list.
- **Every fixed bug gets one regression test.**

---

## 9. Packaging, distribution and CI

### npm package

```json
{
  "name": "briefed-cli",
  "type": "module",
  "bin": { "briefed": "dist/cli.js" },
  "files": ["dist", "scripts", "README.md", "LICENSE"],
  "engines": { "node": ">=18.3.0" },
  "scripts": { "build": "tsc", "test": "vitest run", "prepublishOnly": "npm run build" }
}
```

- `files` ships `scripts/` because `hook.ts` reads the hook bodies at runtime.
- `.gitattributes` forces `scripts/post-* text eol=lf`, so a Windows checkout can't turn hooks into CRLF.
- Three ways to run it: `npm i -g briefed-cli`, `npx briefed-cli init`, or as a devDependency. The hook script tries a global `briefed`, then `./node_modules/.bin/briefed`, then `npx --yes --package=briefed-cli`.

### Release checklist

1. `npm run build && npm test`.
2. The scratch-repo end-to-end run (section 8).
3. Bump the version in `package.json` and the `docs/*.html` footers.
4. `npm publish` (or `--tag beta` for prereleases).
5. Tag the release with notes that call out behaviour changes, such as the move of the default target to `.briefed/context.md`.

### CI mode

For teams that merge in the GitHub UI, a workflow on `push: main` sets `ORIG_HEAD` to `HEAD~1`, runs `briefed run --target CLAUDE.md`, and commits the result as `github-actions[bot]` with `[skip ci]`, so it doesn't trigger itself. Here the target is committed on purpose: one shared file, written by one writer, so there are no conflicts.

---

## 10. Product and open-source thinking

A developer tool lives or dies in its first five minutes and its first week. Each decision below removed a reason to uninstall.

| Friction | Why it kills adoption | Fix |
| --- | --- | --- |
| Needs an API key to be useful | Most people try a tool before paying for anything | Zero-config commit-message mode; a key in the env upgrades automatically |
| Every pull modified `CLAUDE.md` | Dirty tree, accidental commits, teammates' merge conflicts | Gitignored `.briefed/context.md` (its own `.gitignore` containing `*`) plus a one-time `@import` link |
| `git pull` got slower | Users notice latency on a command they run 20 times a day | Background hook |
| Entries full of noise | An agent context that's mostly "4 insertions" teaches users the tool is useless | Agent-focused prompt, pathspec filtering, commit subjects |
| Only fired on pull | Branch switches left agents stale | `post-checkout` hook with merge-base |
| Hooks aren't shared | A team tool that one person installs isn't a team tool | `npx briefed-cli init`, a `prepare` script, Husky support |

### Positioning

- **The README answers "why not just `git log`?" first.** Every evaluator asks it, and if the README doesn't answer, they decide for themselves.
- **One-line install in the first screen,** then a real example entry. Show the output, not the architecture.
- **Honest scope:** local-first by default, CI optional.

### The contribution path

- `CONTRIBUTING.md`, issue and PR templates, `SECURITY.md`, a code of conduct.
- Label small, well-scoped issues `good first issue`. The bug list from the review (pathspecs, a reflog regex, a parser round-trip) is exactly that kind of work.
- Keep the codebase small and dependency-free. Contributors read the whole thing before their first PR.

### Lessons from reviewing this project

1. **Dogfood the output.** This repo's own `CLAUDE.md` showed the problems (noise entries, `(made)`, garbled file lists) long before any user report would have.
2. **Defaults are the product.** Most users never change config, so the default backend, target and window *are* the experience.
3. **Delete before adding.** Moving work into git, Node and the shell removed three dependencies and several bug classes.

---

## 11. Roadmap

| Idea | Why | How to know it worked |
| --- | --- | --- |
| Done in 0.10.0: `briefed context`, `briefed stats`, `init` upgrading old hooks, project-local binary first, PR titles from merge commits | Upgrades reach users; value is visible | Issues about stale hooks stop |
| Summarize since *your* last session (per-developer state in `.git/`) | Also catches commits that arrived outside hooks | Fewer "stale context" reports |
| Cursor rules / Windsurf targets | More agents covered by the link step | Installs among those editors' users |
| Smarter diff budget (redistribute unused share, prefer source over tests) | Better summaries on big merges | Fewer "Minor changes only" on large diffs |
| Per-file importance scoring (exports, config, scripts weighted up) | Agent-relevant facts surface first | Manual review of 20 real merges |
| A 20-second demo GIF in the README | Shows the value faster than any text | Click-through from README to install |

Measure success by **retention, not installs:** is the hook still installed a month later? The proxies you can see without telemetry are GitHub issues ("it slowed my pull", "conflicts in CLAUDE.md"), npm weekly downloads after the first week, and stars from people who also open issues.
