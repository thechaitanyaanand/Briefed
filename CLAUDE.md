# AI Context

## Project Commands
- Build codebase: `npm run build`
- Run development watch compiler: `npm run dev`
- Run test suite: `npm run test`
- Run Vitest in watch mode: `npx vitest`
- Check Briefed status: `node dist/cli.js status`
- Manually run Briefed: `node dist/cli.js run`

## Code Guidelines
- **TypeScript**: Strict mode type safety. Type all variables, function arguments, and return values.
- **Zero Dependencies**: Minimize external dependencies to keep the CLI footprint lightweight.
- **Safety & Error Handling**: Never throw unhandled exceptions from git hooks. Catch file errors, fall back to structural diffs, and exit `0` to avoid blocking Git operations.
- **Tests**: Place all unit test files under `src/__tests__/`. 
- **Hook Formatting**: Ensure hook templates (`scripts/post-merge` and `scripts/post-rewrite`) are formatted with LF line endings to avoid runtime interpreter issues on Windows.
- **Dynamic Blocks**: Do not manually modify the content between the BRIEFED start and end markers.

<!-- BRIEFED_START -->
## [2026-06-06T12:44:04.750Z] c3ff29794af1184a15561063a592174f68b7a515 (master)
FILES: docs/ci-cd.html, docs/cli-reference.html, docs/configuration.html, docs/getting-started.html, docs/index.html
ADDED: Updated npm package link in documentation footers to 'briefed-cli'
REMOVED: Outdated npm package link 'briefed' from documentation footers
RENAMED:
DEPS: 5 additions, 5 deletions

## [2026-06-06T12:39:29.985Z] 2eb13fbff1c6032269416725aec1957d4192b37e (master)
ADDED: Bug report template|Feature request template|Pull request template|Code of Conduct|Contribution guidelines|Local development setup instructions|Security policy
REMOVED:
RENAMED:
DEPS: 194 insertions, 0 deletions

FILES: .github/ISSUE_TEMPLATE/bug_report.md|.github/ISSUE_TEMPLATE/feature_request.md|.github/PULL_REQUEST_TEMPLATE.md|CODE_OF_CONDUCT.md|CONTRIBUTING.md|SECURITY.md

## [2026-06-06T12:35:16.530Z] b6062d2117b85e6da902ead4280df63e8abb5f0a (master)
ADDED: "DEVELOPER'S PREFERRED SETUP" section, including descriptions for Global Gemini Configuration (personal workflow) and CI/CD & GitHub Actions (enterprise team workflow)
REMOVED: The "DEVELOPER'S PREFERRED SETUP" section from its previous location within the file
RENAMED:
DEPS: 45 additions, 45 deletions

FILES: docs/index.html

## [2026-06-05T14:50:58.976Z] da28405eac76af31b91332dde5de145a64e8a21f (master)
ADDED: Project version updated to 0.9.0-beta.8 | Documentation updated to reflect version 0.9.0-beta.8
REMOVED: Previous project version 0.9.0-beta.7 | Documentation reflecting version 0.9.0-beta.7
RENAMED:
DEPS: Project version bumped from 0.9.0-beta.7 to 0.9.0-beta.8 | 7 additions, 7 deletions

FILES: docs/ci-cd.html, docs/cli-reference.html, docs/configuration.html, docs/getting-started.html, docs/index.html, package.json

## [2026-06-05T14:48:35.279Z] bbb58a2e6b5195399aba1268c46f478d37186eab (made)
DEPS: 4 insertions, 1 deletions

FILES: ./, (README.md)

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
<!-- BRIEFED_END -->