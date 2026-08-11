# Changelog

## 0.1.1 (2026-08-11)

- Add adaptive review policy, task-scoped file attribution, evidence metadata, delivery gating, correction turns, and bounded manual release.
- Isolate the Claude subprocess with no tools, no session persistence, a minimal environment, and bounded input and output.
- Fail closed when credential detection or bundle cancellation interrupts changed-file or related-context collection.
- Withhold configured denied paths from snapshots, evidence metadata, and review bundles, and warn about invalid privacy path configuration.
- Add policy, Git-state, lifecycle integration, and subprocess boundary tests.
- Add installation, privacy, security, contribution, release, and MIT License guidance for public distribution.
- Keep synthetic credential fixtures out of static secret scans.
