# AI Context

## Briefed CLI Guidelines
- Run `briefed run` to manually synchronize git context or review change stats.
- Run `briefed status` to inspect the latest summarized entry.
- Do not manually edit the BRIEFED dynamic blocks below; the post-merge and post-rewrite hooks handle them automatically.

<!-- BRIEFED_START -->
## [2026-06-02T18:23:03.080Z] b72c2c04109b35e01481b77d4e7cce5fee95aea0 (master)
FILES: docs/ci-cd.html, docs/cli-reference.html, docs/configuration.html, docs/getting-started.html, docs/index.html, package.json
ADDED: Version 0.9.0-beta.6 reference in documentation and package.json
REMOVED: Version 0.9.1 reference from documentation and package.json
RENAMED:
DEPS: 7 additions, 7 deletions

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

## [2026-06-02T15:30:26.358Z] cd5d34ac9681b9fe6508e584c2661fb55e668489 (master)
DEPS: 53 insertions, 2 deletions

FILES: ./ (PROMPT.md, README.md)

## [2026-06-02T00:22:41.245Z] 605e556a3db8ddea81a8a030adb661444b9a0021 (master)
DEPS: 6 insertions, 6 deletions

FILES: docs/ (ci-cd.html, cli-reference.html, configuration.html, getting-started.html, index.html)

## [2026-06-02T00:01:02.183Z] bc0d6d7a197b65c79ca758ffe89d7283a65ef808
Here are the step-by-step changes based on your request:

1. **Update `package-lock.json`:**
   - Bump version from 0.2.3 to 0.3.0.
   - Add a new devDependencies.json with the updated tsconfig.json.

2. **Modify `package.json`:**
   - Add "@types/briefed" as a dependency under devDependencies.

3. **Update Test Files:**
   - In `src/__tests__/summarize.test.ts`, add specific test cases to enforce the 250-word limit.
   - Include both tests that check successful summarization and edge cases where reasoning blocks should be removed.

4. **Adjust Configuration Values:**
   - In both `src/config.ts` and `src/summarize.ts`, update the default maximum summary words from 150 to 250.

These changes ensure that Briefed's TypeScript implementation can handle longer summaries while maintaining proper type definitions and test coverage.

FILES: package-lock.json, package.json, src/__tests__/summarize.test.ts, src/config.ts, src/summarize.ts
<!-- BRIEFED_END -->