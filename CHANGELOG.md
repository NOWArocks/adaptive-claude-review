# Changelog

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
