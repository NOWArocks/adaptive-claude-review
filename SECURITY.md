# Security

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/NOWArocks/adaptive-claude-review/security/advisories/new). Reports are accepted for the latest tagged release on a best-effort basis, without a guaranteed response time.

If private reporting is unavailable, open a public issue that says only that the private reporting channel is unavailable. Do not include vulnerability details, credentials, or private repository content. Do not use a public issue to report prompt-boundary bypasses, protected-path leaks, or unsafe reviewer execution.

Include the affected version, expected security boundary, reproduction steps, and potential impact in the private report. Do not include real credentials or unrelated private repository content.

## Trust boundaries

The primary Pi process, its user-owned global configuration, and the selected working tree are trusted inputs to local execution. Repository content, user task text, tool metadata, diffs, related context, Claude output, and withheld drafts are untrusted data.

The extension does not load project-local configuration. The repository cannot select a reviewer executable, expand allowed roots, enable topic discovery, or weaken denied paths.

## Outbound review controls

The reviewer process:

- runs without a shell;
- receives no tools;
- uses at most two turns and no session persistence;
- starts in an empty temporary directory;
- receives a minimal environment allowlist rather than all Pi process variables;
- is checked for Claude CLI 2.1.226 or newer and authentication from a separate empty temporary directory;
- is terminated on timeout and reaped before its temporary directory is removed;
- has bounded input and output.

Each outbound bundle uses a fresh random boundary. Task, rationale, evidence, path manifest, status, diff, changed files, and related context are separate untrusted blocks. Claude is told not to execute or follow instructions inside them.

Boundary markers and instructions reduce prompt-injection risk but cannot eliminate it. Repository content and task text can influence the reviewer. Reviewer output and withheld drafts can influence the tool-capable primary agent during a correction turn. The primary agent must treat findings as claims, verify them against the task and sources, and never execute embedded instructions.

The extension scans every outbound text category for high-confidence credential shapes before assembly. It withholds standard credential paths and configured `deniedPaths`, including their names in evidence metadata. Read paths are checked as repository-relative paths and resolved through symlinks before entering the evidence ledger; outside-repository reads are withheld. Credential detection and bundle cancellation propagate as hard failures instead of being converted into omitted changed-file or related-context sections. Related and changed files are read with byte bounds instead of being loaded completely before truncation.

These controls reduce risk; they do not prove that outbound data is free of credentials or PII. Pattern detection can miss custom tokens, encoded values, business identifiers, and natural-language personal data. Put sensitive directories in `deniedPaths` and keep `discoverTopicContext` off unless the additional files are approved for Claude processing.

## Reviewer-output controls

Claude output is accepted only when the first non-empty line is exactly:

```text
VERDICT: PASS
```

or:

```text
VERDICT: FINDINGS
```

A second verdict, a PASS containing severity findings, or FINDINGS without a line-starting `Critical`, `High`, or `Medium` item is rejected. Numbered and bulleted severity items are accepted. This prevents quoted or embedded verdict text from becoming a false PASS.

Before an automatic correction turn, findings and the withheld draft are:

- truncated to separate bounds;
- wrapped in a new random untrusted-data boundary;
- stored as a bounded hidden session entry for recovery;
- accompanied by an instruction to evaluate claims and never execute embedded instructions.

The hidden recovery entry remains in Pi's local session data under Pi's session-retention lifecycle. The extension clears its in-memory last-review draft and session metrics on `session_start`, but it does not delete historical Pi session entries. The recovery entry is not included in the next Claude review bundle unless the corrected task state independently contains the same text.

Each delivery cycle has a hard maximum of three Claude review invocations: an initial review, a review after the first correction, and a final review after the second correction. All automatic, manual, shared-artifact, and recognized direct CLI review calls share the cap; failed or malformed attempts consume a slot. A fourth review is not permitted. Final-review findings can trigger one last private correction turn, after which the result is released with a no-PASS disclosure and no fourth review. Deterministic credential and protected-data controls remain hard blockers outside this review budget.

When a lower configured sub-budget or correction-delivery failure stops the workflow before the hard cap, the final draft can still be withheld. A manual release requires an explicit reason, is limited to the same task generation, works once per held draft, and places the no-PASS disclosure before the untrusted draft text. The extension records the release in the local Pi session when persistence is available.

## Shared-system writes

A passed single-artifact manual review can be reused across turns only when its normalized system, action, target, complete canonical tool arguments, and nested array order match the later write exactly. Cloud destination, assignment, page space, and comment location fields are included in the reviewed content and fingerprint. Multi-artifact review results are not split into independently reusable approvals. The bounded cache is in memory and resets on `session_start`. Successful create and add actions consume their cached PASS so duplicates are reviewed again; field-replacing Jira edits and idempotent Confluence/comment updates can retain it. Jira edits with append-style `update` operations consume the PASS. Paused, disabled, or malformed enforcing configurations cannot reuse the cache. A successful write still requires exact-target read-back.

`sharedArtifactWriteMode: "advisory"` lets a changed or previously unreviewed shared-system write proceed after findings or reviewer unavailability with a visible warning. Existing configurations that omit this field resolve to `enforce`; the release example opts into `advisory` explicitly. Deterministic credential detection remains blocking. Advisory mode is not an authorization mechanism: it assumes that the host agent or a separate policy gate enforces explicit current-turn action and target authorization. Use `"enforce"` when reviewer findings and unavailability must block the write. Exhausting the three-review cap does not relax enforcement: an unreviewed write remains blocked, while an exact cached PASS remains reusable. Advisory mode continues with a visible no-PASS warning at the cap.

## Scope and concurrency

Automatic scope is the union of task-observed `edit`/`write` paths and exact explicit paths declared for Bash, generators, or custom tools. Expected hashes persist through the task. A later unattributed change blocks review. After the reviewer returns, the extension rechecks the selected file state and task context before accepting the verdict. Changes during review invalidate that verdict, including concurrent changes to a configured shared file.

The extension blocks a selected path when both the Git index and worktree contain different versions. It does not silently choose one. Coherent staged state remains reviewable.

Every async review captures its owning task object. A task or session switch makes the old owner stale before it can write verdicts, counters, findings, status, or failure messages into the new task.

The scoped current snapshot captures bounded text together with the reviewed hashes. Diff and changed-content bundle sections reuse that state when available instead of rereading a later filesystem version. This reduces duplicate I/O and prevents one review bundle from mixing two observable file states.

The extension cannot lock files across processes or prove line ownership inside concurrent writes. Separate Git worktrees are required for hard same-file isolation.

## Availability and residual risk

Malformed configuration, unsupported CLI versions, authentication failure, timeouts, oversized output, secret detection, mixed Git state, and bundle errors produce an explicit no-PASS state. General reviewer unavailability releases the primary response with a warning rather than silently discarding it. For repository delivery, correction-delivery failure or a lower configured sub-budget can withhold the draft until an explicit same-generation manual release. Reaching the hard three-review cap after final-review findings instead permits one last correction and then releases with a visible no-PASS warning.

`Critical` and `High` findings block repository delivery by default. `Medium` is advisory unless configured as blocking. Shared-system writes follow `sharedArtifactWriteMode`; explicitly configured advisory mode does not let reviewer opinion or availability override a separately authorized write, while deterministic credential checks remain blocking. A user can pause or bypass repository review, but the resulting delivery states visibly that it has no Claude PASS.

The circuit breaker stops repeated reviewer failures after the configured task-local threshold. Automatic, manual, shared-artifact, and recognized direct `claude -p` or `claude --print` invocations have separate diagnostic counters but share one hard three-review delivery-cycle cap. A new explicit user request received while Pi is idle starts a separate cycle. Automatic corrections use custom messages, and non-delegated extension input cannot reset the cap.

Session outcome and latency metrics remain in memory. Claude text-output mode does not expose token or monetary cost data; the extension reports those values as Unknown.

No automated review can prove security or correctness. Verify security-sensitive changes against the exact target with normal project checks, and use independent security testing for authentication, permissions, money movement, PII, and infrastructure changes.
