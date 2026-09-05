# Changelog

## 0.3.1 (2026-09-05)

- Recheck repository state and task context after review so concurrent changes cannot receive a stale PASS.
- Normalize read paths before evidence filtering, including absolute paths, parent-relative paths, and symlink targets. Withhold denied and outside-repository path metadata.
- Fingerprint complete shared-write arguments, including cloud destination, Jira assignment, Confluence space, and comment location fields.
- Allow shared-artifact findings to be reconsidered after new evidence, rationale, or declared unknowns. Cache repeated contexts without spending another review slot.
- Keep enforcing shared-system writes blocked when the three-review budget is exhausted. Exact cached PASS reuse remains available; advisory mode retains its visible no-PASS warning.

## 0.3.0 (2026-09-02)

- Allow the reviewer process two turns. With a one-turn limit, medium and higher effort ended the turn without a verdict in a measurable share of runs, which surfaced as `no strict verdict` failures.
- Change the default and example `effort` to `low`. Measured on a typical ticket bundle, `low` returned complete findings in 15–30 seconds with no turn-limit failures.
- Check Claude CLI version and authentication asynchronously at each in-scope Pi session start, and show a recovery warning without delaying startup when review readiness is unavailable.
- Enforce one hard three-invocation cap across automatic, manual, shared-artifact, and recognized direct Claude CLI reviews in each delivery cycle.
- Permit two reviewed correction rounds and a final third review; after third-review findings, release the last deterministic correction with a visible no-PASS disclosure instead of requesting a fourth review.
- Start a separate delivery cycle for each explicit user request received while Pi is idle. Internal correction turns remain in the current cycle.

## 0.2.0 (2026-08-18)

- Reuse exact passed Jira and Confluence draft reviews across follow-up turns, while requiring exact-target read-back after writes.
- Add advisory and enforcing shared-artifact write modes; the example opts into advisory while existing configurations preserve fail-closed enforcement until the mode is set explicitly.
- Record nested Jira read evidence from MCP tool envelopes and retain bounded source metadata across follow-up turns.
- Withhold configured denied path names from evidence metadata.
- Fail closed when credential detection or bundle cancellation interrupts changed-file or related-context collection.
- Accept safely numbered severity findings without weakening strict leading-verdict handling.
- Prevent missing bounded evidence content from reopening product choices already reviewed with the user.
- Allow blocking findings to be superseded for unchanged files only when the bounded review context changes.

## 0.1.1 (2026-08-11)

- Add adaptive review policy, task-scoped file attribution, evidence metadata, delivery gating, correction turns, and bounded manual release.
- Isolate the Claude subprocess with no tools, no session persistence, a minimal environment, and bounded input and output.
- Fail closed when credential detection or bundle cancellation interrupts changed-file or related-context collection.
- Withhold configured denied paths from snapshots, evidence metadata, and review bundles, and warn about invalid privacy path configuration.
- Add policy, Git-state, lifecycle integration, and subprocess boundary tests.
- Add installation, privacy, security, contribution, release, and MIT License guidance for public distribution.
- Keep synthetic credential fixtures out of static secret scans.
