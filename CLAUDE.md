# AI Context

Managed by Briefed.

<!-- BRIEFED_START -->
## [2026-06-01T23:36:46.525Z] 9389a2f6f3b4f0313b393cba639795ac8eaeefdf (master)
FILES: src/ (summarize.test.ts, summarize.ts)
DEPS: 4 insertions, 4 deletions

## [2026-06-01T23:36:07.218Z] 5d716fd633dd940854d067e6fe53a7e55bc30754
ADDED: MetricsCollector class for gathering application performance and usage metrics| New `metrics.ts` module with `MetricsCollector` implementation| Test suite for `MetricsCollector` in `src/__tests__/metrics.test.ts`| Integration of metric recording into `src/cli.ts` for operations like summary duration, API usage, diff size, backend used, and run outcome| Persistent storage for collected metrics in a JSON file
REMOVED:
RENAMED:
DEPS: 196 additions, 6 deletions

FILES: CLAUDE.md, src/__tests__/metrics.test.ts, src/cli.ts, src/metrics.ts
<!-- BRIEFED_END -->