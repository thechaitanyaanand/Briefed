# AI Context

## Briefed CLI Guidelines
- Run `briefed run` to manually synchronize git context or review change stats.
- Run `briefed status` to inspect the latest summarized entry.
- Do not manually edit the BRIEFED dynamic blocks below; the post-merge and post-rewrite hooks handle them automatically.

<!-- BRIEFED_START -->
## [2026-06-05T14:48:35.279Z] bbb58a2e6b5195399aba1268c46f478d37186eab (made)
FILES: ./ (README.md)
DEPS: 4 insertions, 1 deletions

## [2026-06-04T17:17:03.736Z] df7b34a1a4d0d6cdf589fa16b1c1957194e2f9a2 (master)
DEPS: 4 insertions, 1 deletions

FILES: ./, (README.md)

## [2026-06-04T14:20:24.206Z] d9b2bb5cfa61ecc9266e87e2207cf3ed15d86f53 (master)
ADDED: Security validation for configuration target paths to prevent writing outside the workspace|Improved handling of Git hooks installation in worktrees/submodules (.git file pointers)|Lock file contention check and error handling for write operations to prevent concurrent write issues|Explicit package specification (`--package=briefed-cli`) in npx commands within Git hook scripts|Unit tests for target path security, worktree hook resolution, and lock file handling
REMOVED: Less specific `npx briefed run` command invocation in git hooks|Prior target path resolution logic lacking security validation
RENAMED:
DEPS: 114 insertions, 15 deletions

FILES: scripts/post-merge, scripts/post-rewrite, src/__tests__/config.test.ts, src/__tests__/hook.test.ts, src/__tests__/writer.test.ts, src/config.ts, src/hook.ts, src/summarize.ts, src/writer.ts

## [2026-06-02T18:23:03.080Z] b72c2c04109b35e01481b77d4e7cce5fee95aea0 (master)
ADDED: Version 0.9.0-beta.6 reference in documentation and package.json
REMOVED: Version 0.9.1 reference from documentation and package.json
RENAMED:
DEPS: 7 additions, 7 deletions

FILES: docs/ci-cd.html, docs/cli-reference.html, docs/configuration.html, docs/getting-started.html, docs/index.html, package.json

## [2026-06-02T17:26:38.455Z] 42dbeaa2d58f0640aff52724856881e2a7abbfe0 (master)
ADDED: GitHub Actions step to check for API key availability (GEMINI, BRIEFED, ANTHROPIC) and output a `has_keys` flag|New conditional logic based on `has_keys` flag for several workflow steps
REMOVED: Direct inline checks for API key presence from multiple GitHub Actions step conditions
RENAMED:
DEPS: 55 additions, 9 deletions

FILES: .github/workflows/briefed-context.yml, README.md, docs/ci-cd.html

## [2026-06-02T16:35:50.594Z] 6c9e8a5c51b27cdb8e76eb39dbc30b1eff21bcfc (master)
ADDED: Detailed explanation of local-first vs. CI/CD workflows for Briefed; instructions for configuring GitHub repository secrets (API keys) for CI/CD automation; npm cache added to Node.js setup in GitHub Action.
REMOVED: General introductory sentence about CI/CD deployment replaced by more detailed workflow explanations.
RENAMED:
DEPS: 32 additions, 3 deletions

FILES: README.md

## [2026-06-02T16:19:29.817Z] 76057f32d11f3f048c883fa894f77debbdf0d506 (master)
DEPS: 21 insertions, 1 deletions

FILES: src/ (summarize.test.ts, summarize.ts)

## [2026-06-02T16:12:29.335Z] 4b5415f392868fde449f3b2e1a6fe03326752ee5 (master)
DEPS: 52 insertions, 11 deletions

FILES: .github/ (briefed-context.yml) | src/ (config.test.ts, config.ts, summarize.ts)

## [2026-06-02T15:43:19.768Z] f4a0a77aa09f07aa61fcec25d01f6d594bf66650 (master)
DEPS: 36 insertions, 6 deletions

FILES: ./, (README.md), |, docs/, (getting-started.html)

## [2026-06-02T15:31:18.982Z] cffb4f615b1352ed7b1690b96cb6fd2f03886ed6 (master)
DEPS: 7 insertions, 3 deletions

FILES: docs/, (configuration.html)
<!-- BRIEFED_END -->