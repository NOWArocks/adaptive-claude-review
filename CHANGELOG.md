# Changelog

## Unreleased

- Review shared-system mutations as ordered pre-write steps and keep exact-target read-back as a post-write requirement.
- Record nested Jira read evidence from MCP tool envelopes and retain bounded source metadata across follow-up turns.
- Apply the configured severity threshold to shared-system pre-write findings instead of blocking advisory findings.
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
