# AI Context

## Briefed CLI Guidelines
- Run `briefed run` to manually synchronize git context or review change stats.
- Run `briefed status` to inspect the latest summarized entry.
- Do not manually edit the BRIEFED dynamic blocks below; the post-merge and post-rewrite hooks handle them automatically.

<!-- BRIEFED_START -->
## [2026-06-02T15:43:19.768Z] f4a0a77aa09f07aa61fcec25d01f6d594bf66650 (master)
FILES: ./ (README.md) | docs/ (getting-started.html)
DEPS: 36 insertions, 6 deletions

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

## [2026-06-01T23:53:51.596Z] 52d60d237c9fd7cd95ebac94c2a4c2659d4e444a (master)
DEPS: 2 insertions, 2 deletions

FILES: src/ (config.ts, summarize.ts)

## [2026-06-01T23:52:27.499Z] dff0d69a52e0b969a7296078c03c3f92b7a6c49f


FILES: docs/ci-cd.html, docs/cli-reference.html, docs/configuration.html, docs/getting-started.html, docs/index.html, package-lock.json, package.json, src/__tests__/summarize.test.ts, src/summarize.ts
<!-- BRIEFED_END -->