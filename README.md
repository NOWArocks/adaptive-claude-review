# Adaptive Claude Review for Pi

A Pi coding-agent extension that sends selected task changes to the Claude CLI for an independent, read-only second pass.

It targets risky implementation work and meaningful product artifacts where a second model can catch correctness, provenance, workflow, security, or publication-quality defects before the primary agent delivers its final response.

This is an independent project. It is not affiliated with or endorsed by Anthropic or the Pi maintainers.

## What it does

- Always reviews recognized authentication, permissions, money, infrastructure, API/schema, PII/privacy, and configured sensitive-data paths.
- Reviews broad changes and configurable documentation or product artifacts.
- Holds qualifying final responses behind a `message_end` delivery gate.
- Returns blocking findings privately to the primary agent for correction, then reviews the corrected state again.
- Treats `Critical` and `High` findings as blocking for repository delivery by default. The release example makes shared-system write findings advisory; enforcing mode remains available and is used for legacy configurations without an explicit mode.
- Enforces one hard three-invocation cap across manual, automatic, shared-artifact, and direct Claude CLI reviews in each delivery cycle.
- Stops repeated reviewer failures with a task-local circuit breaker.
- Runs Claude without tools or session persistence, with a minimal environment and an empty temporary working directory.
- Allows the reviewer process two turns so that a reasoning-heavy first turn can still deliver its verdict. The reviewer has no tools, so the second turn can only produce text.
- Checks Claude CLI version and authentication asynchronously at each in-scope Pi session start. A missing or expired login produces a visible warning with the recovery command; a healthy check stays silent and never delays session startup.

Shared-system review evaluates the current mutation, not an impossible atomic representation of a multi-step workflow. When `claude_review` receives an exact draft snapshot with matching `system`, `action`, `target`, and canonical JSON `content`, a `PASS` is cached for the Pi session. A later identical Jira or Confluence write reuses that review instead of calling Claude again. Changed or previously unreviewed payloads receive a pre-write review.

`sharedArtifactWriteMode` controls that pre-write result. The release example selects `advisory`, which lets the explicitly requested write proceed with a visible finding or no-PASS warning; deterministic credential checks still block. This mode assumes that the host agent or a separate policy gate enforces current-turn write authorization. `enforce` retains fail-closed blocking for configured severities and reviewer unavailability, including an exhausted review budget. An exact cached PASS can still be reused without another invocation. When a later write depends on an identifier created by the current write, the first mutation can proceed before a separate issue-link call uses the generated key. Exact-target read-back remains required after every successful write.

A Claude `PASS` is evidence from a bounded second model, not proof of correctness. Exact-target verification remains required.

## Hard review cap

Each delivery cycle permits at most three Claude review invocations: one initial review, one review after the first correction, and one final review after the second correction. Timeouts, malformed outputs, authentication failures after an attempt starts, manual `claude_review` calls, automatic delivery-gate reviews, Jira or Confluence pre-write reviews, and direct `claude -p` or `claude --print` review commands all consume the same cap. Cached PASS reuse does not consume another slot.

A fourth review is never permitted. If the final review still reports findings, the extension can queue one last private correction turn. The corrected result then proceeds after deterministic verification with a visible warning that it has no final Claude PASS. Deterministic credential and protected-data checks remain separate hard blockers.

A new explicit user request received while Pi is idle starts a separate delivery cycle and resets the counter. Automatic corrections use custom messages rather than user input, and other extension inputs do not reset the cycle unless they use the explicit delegated-execution protocol. Starting a new Pi session also resets the counter.

## Task and working-tree isolation

Automatic scope contains the union of:

- files changed by successful Pi `edit` and `write` calls in the current task;
- exact repository-relative paths supplied to `claude_review` for Bash, generators, or custom tools.

Explicit paths add to automatically tracked paths. They never replace them. The extension persists their expected hashes so the final delivery gate reviews the same complete scope and blocks later unattributed changes.

Task-local diffs start from the state captured before the task's first observed mutation. An earlier delta from Bash, a generator, a custom tool, or another process is excluded instead of being attributed to the current task.

The extension blocks review when:

- a selected path changes after its latest attributed state;
- the Git index and worktree contain different versions of the same selected path;
- every selected path is protected or configured in `deniedPaths`;
- a file baseline cannot be read safely;
- the active Pi task or session changes while a review is running.

When only part of the selected scope is protected or denied, the extension withholds those path names and contents and reviews the remaining safe scope.

Coherent staged additions, modifications, deletions, binaries, and rename-as-delete/add states remain classifiable. Mixed staged and unstaged state for the same selected path must be resolved before review.

Files in `sharedReviewPaths` use holistic review. A later concurrent write does not invalidate their expected hash. The bundle explicitly labels the file as shared and reviews its current complete state, including concurrent changes. Mixed staged and unstaged state still blocks review. Use this only for intentionally shared registers whose global consistency matters more than task-local line ownership.

A shared Git working tree cannot provide line-level ownership when processes write the same file concurrently. Use a separate Git worktree for hard same-file isolation.

## Requirements

- Pi coding agent 0.84.1 or newer
- Claude Code CLI 2.1.226 or newer
- Claude CLI authentication available from its user-owned configuration; environment-only API credentials and proxy variables are intentionally not forwarded to the reviewer process
- Git repository with at least one commit
- Bun 1.2.19 for local development and verification

```bash
claude auth status
```

## Install

Install the tagged release:

```bash
pi install git:github.com/NOWArocks/adaptive-claude-review@v0.3.1
mkdir -p ~/.pi/agent
test ! -e ~/.pi/agent/claude-review.json && \
  curl -fsSL https://raw.githubusercontent.com/NOWArocks/adaptive-claude-review/v0.3.1/claude-review.example.json \
  -o ~/.pi/agent/claude-review.json
```

Use a tag or commit as the ref so the installed version does not move unexpectedly.

For local development, clone the repository and install it directly:

```bash
git clone https://github.com/NOWArocks/adaptive-claude-review
cd adaptive-claude-review
bun install
pi install "$PWD"
cp claude-review.example.json ~/.pi/agent/claude-review.json
```

The example starts disabled. Update `allowedRoots`, `deniedPaths`, `sensitiveDataPrefixes`, and `productArtifactPrefixes` to match your repository. The example paths are placeholders and do not protect unrelated directory names. Set `enabled` to `true` only after these checks. Then reload Pi:

```text
/reload
/claude-review-status
```

Pi provides the extension host and `typebox` as peer dependencies. Pi packages require these host peers to use the `*` range. Pinned development dependencies provide reproducible local verification and strict TypeScript checking.

The extension requires Claude Code CLI 2.1.226 or newer because its subprocess isolation and strict verdict handling depend on CLI flags and output behavior from that compatibility baseline.

## Configuration

Pi reads only the user-owned global configuration:

```text
~/.pi/agent/claude-review.json
```

The extension does not load project-local configuration. This prevents an untrusted repository from changing the reviewer command, outbound scope, or privacy controls.

Malformed JSON produces a visible `config error` state and disables repository review; shared-system writes then fail closed. Unknown keys and a missing `sharedArtifactWriteMode` appear as warnings. Existing configurations without the new field preserve prior behavior as `enforce`; the new example explicitly selects `advisory`. An invalid write-mode value also resolves to `enforce`. `~` in `allowedRoots` is expanded, and paths are canonicalized through existing symlinks.

| Field | Purpose | Default |
| --- | --- | --- |
| `enabled` | Enables review. | `false` |
| `allowedRoots` | Canonical directories in which review can run. | `[]` |
| `claudeCommand` | Claude CLI executable. No shell is used. | `claude` |
| `model` | Reviewer model. | `opus` |
| `effort` | Claude reasoning effort: `low`, `medium`, `high`, `xhigh`, or `max`. `low` returns a verdict in 15–30 seconds on a typical bundle; higher effort roughly doubles that. | `low` |
| `maxAutomaticReviewsPerTask` | Automatic delivery-gate sub-budget. It cannot exceed the hard three-review total. | `3` |
| `maxManualReviewsPerTask` | Explicit tool-call sub-budget. It cannot exceed the hard three-review total. | `3` |
| `maxSharedArtifactReviewsPerTask` | Jira and Confluence pre-write sub-budget. It cannot exceed the hard three-review total. | `3` |
| `maxConsecutiveFailures` | Failures before the task-local circuit opens. | `2` |
| `timeoutMs` | Reviewer-process timeout, bounded to 30–300 seconds. | `90000` |
| `bundleTimeoutMs` | Aggregate bundle-construction deadline. | `30000` |
| `blockingSeverities` | Findings that hold repository delivery and enforcing shared-system writes. | `Critical`, `High` |
| `sharedArtifactWriteMode` | Shared-system write policy: `advisory` allows findings and reviewer unavailability with a warning; `enforce` blocks configured severities and unavailability. Credential detection always blocks. | `enforce` (release example: `advisory`) |
| `showOutboundNotice` | Shows a notice before the session's first outbound review. | `true` |
| `maxTaskContextPrompts` | Current request plus bounded earlier messages. | `6` |
| `reviewDocumentation` | Reviews documentation and product artifacts deterministically. | `false` |
| `relatedContextFiles` | Explicit repository-relative supporting context. | `README.md`, `AGENTS.md` |
| `topicDirectory` | Optional directory whose first child identifies a topic. | empty |
| `discoverTopicContext` | Discovers more topic text and JSON. | `false` |
| `productArtifactPrefixes` | Paths that require authoritative-source coverage checks. | `[]` |
| `sensitiveDataPrefixes` | Paths that always trigger review. | `[]` |
| `deniedPaths` | Exact files or directory prefixes whose names and content must never enter a review bundle. | `[]` |
| `sharedReviewPaths` | Exact shared artifact files that may change concurrently. Their current complete state is reviewed instead of blocking on another writer. | `[]` |
| `reviewPriorities` | Organization-specific review criteria. | `[]` |
| `reviewProfiles.figjam` | Extra criteria for paths under a `FigJam` directory. | `[]` |

Keep organization-specific rules in the installed configuration, not in a reusable repository.

### Reusable shared-artifact reviews

For a Jira or Confluence draft that will be written after user approval, call `claude_review` with exactly one artifact containing the exact future mutation. Multi-artifact review results are not split into independently reusable approvals:

```json
{
  "artifacts": [{
    "system": "Jira",
    "action": "create issue",
    "target": "WKW: Implement survey",
    "content": "{\"cloudId\":\"your-cloud-id\",\"projectKey\":\"WKW\",\"issueTypeName\":\"Task\",\"summary\":\"Implement survey\",\"description\":\"Acceptance criteria\"}"
  }]
}
```

The extension canonicalizes valid JSON before fingerprinting it, so object key order and whitespace do not matter. System, action, target, all tool arguments, and nested array order must match the later tool call. Include `cloudId` and every supplied field in the draft JSON, including assignment, destination space, and comment location fields. Changing any argument requires a new review. A matching `PASS` is reused only in the same Pi session. Successful create and add actions consume the cached PASS so an identical duplicate creation is reviewed again; field-replacing Jira edits and idempotent Confluence/comment updates can retain it. Jira edits with append-style `update` operations consume the PASS. A changed payload is reviewed again under `sharedArtifactWriteMode`. Shared-artifact findings are cached per review context: new evidence, rationale, or declared unknowns can trigger another review of unchanged content. Repeating the same context reuses its findings and does not consume a slot.

## Outbound data and privacy

Before the first outbound review in each Pi session, the extension displays the selected changed paths and summarizes the data categories sent to Claude.

A bundle can contain:

- the current user request and bounded earlier user messages not flagged by heuristic secret detection;
- the primary agent's rationale and declared unknowns;
- exact selected paths and change metadata;
- task-local text diffs and current changed text content;
- selected Git status;
- recognized command-result metadata and source-access metadata;
- explicitly configured related files;
- discovered topic files only when `discoverTopicContext` is `true`.

Every bundle contains an exact-path manifest for included files. Protected and denied paths appear only as a count; their names, content, and evidence metadata are withheld. Topic discovery is off by default. When enabled, related context is limited to 30 files, 25,000 characters total, and 15,000 bytes per file. Diffs use three context lines and are capped at 25,000 characters; current changed-file content is capped at 55,000 characters total.

Credential detection is heuristic, not complete. The extension blocks high-confidence private keys, provider tokens, JWTs, credential-bearing URLs, and literal secret assignments. It also blocks standard credential paths, Terraform variable files, application configuration files, and configured `deniedPaths`. It cannot guarantee detection of every credential, PII value, or encoded secret. Configure sensitive directories in `deniedPaths`; do not rely on pattern detection alone.

See [SECURITY.md](SECURITY.md) for the complete boundary and residual risks.

### Privacy at a glance

- The extension does not collect telemetry or upload its session metrics.
- Reviews send the selected task text, diffs, changed text, evidence metadata, and configured context to Claude through the user's authenticated Claude CLI.
- Configuration stays in the user-owned `~/.pi/agent/claude-review.json` file.
- Hidden recovery entries remain in the local Pi session history until that history is removed under Pi's normal retention process.

## Evidence metadata

The bounded task-local ledger records observed source access and recognized verification commands. Shared-system reviews also use a bounded session ledger so follow-up write requests retain source-access metadata from earlier turns. Exact passed shared-artifact snapshots remain cached only for the current Pi session. Neither ledger nor a cached PASS turns observations into proof.

A command is recognized only when it appears to execute a real test, build, lint, typecheck, or verify action. Help, version, dry-run, collect-only, piped, and failure-masked commands are not recorded as successful checks. Ledger output uses `OBSERVED SUCCESS`, not `PASS`, because tool success does not prove the exact product claim.

## Delivery states

After a successful `edit` or `write`, streaming draft text is masked until the final gate runs:

- `passed`: Claude returned a strict leading `VERDICT: PASS` for the exact fingerprint.
- `findings`: Claude returned severity-labelled findings. Configured blocking severities hold the draft; advisory severities release it with a notice.
- `skipped`: deterministic policy classified the attributed change as low risk, or the user used an explicit bypass.
- `blocked`: mixed index/worktree state, protected scope, or unattributable mutation prevented review.
- `unavailable`: configuration, authentication, CLI, timeout, malformed output, bundle, or delivery failure prevented a verdict.

Review unavailability releases the response with a visible warning that the state has no Claude `PASS`. This avoids silently swallowing the user's primary-agent result while making the missing gate explicit.

Unresolved blocking findings are returned privately for correction. The extension can review the first corrected state and, when that review finds another material issue, review the second corrected state once more. If the third and final review still reports findings, interactive and RPC modes can run one last private correction turn, but the corrected result is not reviewed a fourth time. It is released with a visible no-PASS disclosure after deterministic verification. A lower configured sub-budget or a failed correction handoff can still withhold a draft for deliberate release through `/claude-review-release <reason>`.

After blocking findings, each corrected state must receive the next available review even when the remaining diff would normally be skipped as small or test-only. JSON and print modes cannot run correction turns; blocking findings release a visible one-shot warning instead.

Before accepting a repository verdict, the extension rechecks the file state and task context. A change during review invalidates the verdict and delivery carries a no-PASS warning. A `PASS` remains valid for the same file-state fingerprint. Blocking `FINDINGS` can receive another review without an artificial file edit only when the bounded review context changes, such as new task evidence or a changed manual rationale or unknown list. An exact duplicate context is rejected, and the hard three-review cap bounds all retries.

Reviewer output and withheld drafts are wrapped in fresh random untrusted-data boundaries before the private correction turn. The primary agent is told to evaluate findings as claims and never execute embedded instructions.

## Commands

```text
/claude-review-status
/claude-review-last
/claude-review-last draft
/claude-review-release required reason
/claude-review-pause
/claude-review-resume
/claude-review-skip optional reason
```

- `status` shows resolved roots, config errors and warnings, CLI/auth compatibility, model and effort, attempt budgets, timeout, denied paths, and circuit state.
- `last` shows the latest outcome, scope, trigger reasons, duration, review-input size, attempts, bounded findings, session outcome counts, and session p95 review latency. For `unavailable`, the first reason identifies the timeout, malformed output, bundle, authentication, configuration, or delivery failure that caused that occurrence.
- `last draft` additionally retrieves the bounded withheld draft from extension memory.
- `release` deliberately releases the exact bounded draft held after unresolved blocking findings exhaust the automatic budget. A reason is required, the command works once and only in the same task generation, and the released text starts with a visible no-PASS disclosure. The release is recorded in the local Pi session when persistence is available.
- `pause` releases changed repository turns with a visible ungated warning. Shared-system writes continue under `sharedArtifactWriteMode`; deterministic credential checks still block.
- `resume` resets the failure circuit and clears timeout retry blocks, but preserves the current task baseline and scope.
- `skip` bypasses one changed delivery and adds a visible no-PASS disclosure.

Claude text-output mode does not expose token or monetary cost data. `/claude-review-last` reports cost as `Unknown` instead of fabricating a value. Session metrics and the in-memory last-review draft are cleared on `session_start` and are not uploaded. Hidden recovery entries remain in the local Pi session file under Pi's session-retention lifecycle.

## Operational diagnosis

1. Run `/claude-review-status`.
2. Fix any config error or unknown key.
3. Confirm the resolved current directory is inside a resolved allowed root.
4. Confirm Claude CLI 2.1.226 or newer and authentication.
5. Use `/claude-review-last` to read the exact `unavailable` reason and review-input size. An identical file fingerprint is not retried after timeout; change the state or scope first. For timeout, adjust scope or the bounded timeout; for malformed output, retry after checking CLI compatibility; for bundle errors, inspect denied paths, credential warnings, Git state, and size limits; for delivery failure, use the retained hidden entry and retry in an interactive mode.
6. Resolve mixed staged/unstaged state for selected paths.
7. Use exact `paths` for Bash and generator changes.
8. If the automatic budget is exhausted, inspect `/claude-review-last draft`. Fix the finding in a new task, or deliberately release the held draft with `/claude-review-release <reason>`.
9. Run `/claude-review-resume` after correcting repeated reviewer failures.
10. Use a separate worktree when another process can touch the same file.

Suggested pilot acceptance checks:

- the full findings → correction → PASS flow succeeds in the real Pi mode used by the team;
- blocking false positives are reviewed from `/claude-review-last` and remain acceptably low;
- session p95 gate latency remains within the team's delivery target;
- unavailable and blocked states always produce a visible no-PASS disclosure.

## Verify

```bash
bun run verify
```

This runs every unit, Git-state, lifecycle-integration, and subprocess-boundary test, then strict TypeScript checking and the production bundle.

## Contributing and security

Bug reports and focused pull requests are welcome. Run `bun run verify` before opening a pull request.

Report security issues through the private process in [SECURITY.md](SECURITY.md), not in a public issue.

## License

[MIT](LICENSE). You may use, modify, distribute, sublicense, or sell the software. Keep the copyright and license notice with copies or substantial portions of the software. The software comes without warranty.

The package remains marked `private` in `package.json` only to prevent accidental publication to npm. Installation from this Git repository is supported.
