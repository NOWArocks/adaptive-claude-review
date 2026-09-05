export type ChangeKind = "modified" | "added" | "deleted";

export type ChangedFile = {
  path: string;
  addedLines: number;
  deletedLines: number;
  kind: ChangeKind;
};

export type ReviewDecision = {
  review: boolean;
  score: number;
  reasons: string[];
  totalLines: number;
};

export type ReviewPolicyOptions = {
  reviewDocumentation?: boolean;
  sensitiveDataPrefixes?: string[];
};

export type ReviewProfileId = "figjam";
export type ReviewProfilesConfig = Partial<Record<ReviewProfileId, string[]>>;

export type EvidenceSourceKind = "jira" | "confluence" | "repository" | "workspace-file" | "visual";
export type EvidenceSource = {
  kind: EvidenceSourceKind;
  detail: string;
  path?: string;
};
export type EvidenceCheck = {
  command: string;
  passed: boolean;
};
export type EvidenceObservations = {
  officialProductSource: boolean;
  visualArtifact: boolean;
};
export type ToolEvidenceObservation = {
  source?: EvidenceSource;
  check?: EvidenceCheck;
};
export type TaskEvidenceLedger = {
  record(source?: EvidenceSource, check?: EvidenceCheck): void;
  reset(): void;
  sources(): EvidenceSource[];
  checks(): EvidenceCheck[];
  observed(): EvidenceObservations;
};

const HIGH_RISK_PATH = /(?:^|\/)(?:auth|security|permissions?|payments?|billing|finance|banking|money|ledger|transactions?|migrations?|alembic|database|crypto|secrets?|infrastructure|infra|deploy|terraform|k8s|kubernetes|queues?|workers?|concurrency|sessions?)(?:\/|\.|-|_|$)/i;
const HIGH_RISK_FILE = /(?:schema|migration|permission|policy|auth|payment|billing|transaction|ledger|encryption|token|session|webhook|middleware)/i;
const API_BOUNDARY = /(?:^|\/)(?:api|routes?|controllers?|endpoints?|graphql|openapi|schemas?|models?)(?:\/|\.|-|_|$)/i;
const SENSITIVE_DATA_PATH = /(?:^|\/)(?:pii|personal-data|privacy|customers?|users?|profiles?|identities|kyc|bank-data)(?:\/|\.|-|_|$)/i;
const INFRA_CONFIG = /(?:^|\/)(?:Dockerfile|docker-compose[^/]*|nginx[^/]*|terraform[^/]*|.*\.tf|helm\/|k8s\/|kubernetes\/|\.github\/workflows\/.*\.ya?ml)$/i;
const DEPENDENCY_OR_BUILD = /(?:^|\/)(?:package\.json|pyproject\.toml|requirements[^/]*\.txt|poetry\.lock|uv\.lock|Cargo\.toml|go\.mod|.*\.ya?ml)$/i;
const DOC_ONLY = /(?:^|\/)(?:docs?\/|README(?:\.[^/]+)?$|CHANGELOG(?:\.[^/]+)?$|.*\.(?:md|mdx|txt|rst))$/i;
const LOCKFILE_ONLY = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|Cargo\.lock)$/i;
const TEST_FILE = /(?:^|\/)(?:tests?|__tests__)\/|(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/i;
const SOURCE_FILE = /\.(?:c|cc|cjs|cpp|cs|go|java|js|jsx|kt|kts|m|mjs|mm|php|py|rb|rs|scala|swift|ts|tsx|vue|svelte)$/i;
const REVIEW_TEXT_FILE = /(?:^|\/)(?:Dockerfile|Makefile|Procfile|[^/]+\.(?:c|cc|cjs|conf|config|cpp|cs|css|csv|env\.example|go|graphql|gql|h|hpp|html|ini|java|js|json|jsonl|jsx|kt|kts|m|md|mdx|mjs|mm|php|properties|py|rb|rs|rst|scala|scss|sh|sql|svelte|swift|tf|toml|ts|tsx|txt|vue|xml|ya?ml))$/i;
const FIGJAM_PATH = /(?:^|\/)figjam(?:\/|[-_.])/i;
const IMAGE_PATH = /\.(?:avif|bmp|gif|heic|jpe?g|png|svg|webp)$/i;
const CHECK_COMMAND = /(?:\b(?:bun\s+(?:run\s+)?(?:test|build|lint|typecheck|verify)|npm\s+(?:--prefix\s+\S+\s+)?(?:run\s+)?(?:test|build|lint|typecheck|verify)|pnpm\s+(?:run\s+)?(?:test|build|lint|typecheck|verify)|yarn\s+(?:run\s+)?(?:test|build|lint|typecheck|verify)|pytest|python(?:3)?\s+-m\s+pytest|go\s+test|cargo\s+test|bundle\s+exec\s+rspec|php\s+artisan\s+test|xcodebuild\b.*\b(?:test|build)|flutter\s+test|gradlew\s+(?:test|build)|tsc|eslint|playwright|appium)\b|(?:^|[\s;&|])\.\/verify\b)/i;
const NON_EXECUTING_CHECK = /(?:^|\s)--(?:help|version|dry-run|list|list-tests|collect-only|no-run)\b|(?:^|\s)-(?:h|V)\b/i;
const MASKED_CHECK_RESULT = /\|\||(?:^|[;&]\s*)(?:true|exit\s+0)(?:\s|$)|\|(?!\|)/;
const SENSITIVE_COMMAND = /(?:^|[\s;&|])(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=\S+|\b(?:api[_-]?key|authorization|credential|password|passwd|secret|token)\b\s*(?:=|:|\s)\s*["']?\S+|(?:^|\s)-u\s+\S+:\S+|https?:\/\/[^/\s:@]+:[^@\s/]+@/i;

export function createTaskEvidenceLedger(limit = 20): TaskEvidenceLedger {
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit) || 20, 100));
  const sourceMap = new Map<string, EvidenceSource>();
  const checkList: EvidenceCheck[] = [];
  const observed: EvidenceObservations = { officialProductSource: false, visualArtifact: false };
  return {
    record(source, check) {
      if (source) {
        if (source.kind === "jira" || source.kind === "confluence") observed.officialProductSource = true;
        if (source.kind === "visual") observed.visualArtifact = true;
        sourceMap.set(`${source.kind}:${source.detail}`, source);
        while (sourceMap.size > boundedLimit) sourceMap.delete(sourceMap.keys().next().value as string);
      }
      if (check) {
        checkList.push(check);
        if (checkList.length > boundedLimit) checkList.splice(0, checkList.length - boundedLimit);
      }
    },
    reset() {
      sourceMap.clear();
      checkList.length = 0;
      observed.officialProductSource = false;
      observed.visualArtifact = false;
    },
    sources: () => [...sourceMap.values()],
    checks: () => [...checkList],
    observed: () => ({ ...observed }),
  };
}

function safeReasonPath(path: string): string {
  return path.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240);
}

function pathSegments(path: string): Set<string> {
  return new Set(path.toLowerCase().split(/[\\/._-]+/).filter(Boolean));
}

export function normalizeBoundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : fallback;
}

export function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function truncateBundleContent(content: string, limit: number, label: string): string {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n[${label} truncated after ${limit} of ${content.length} characters.]`;
}

export function bundleBlock(boundary: string, kind: string, content: string, path?: string): string {
  const metadata = path ? ` path=${JSON.stringify(path)}` : "";
  return `<<<BEGIN_${kind}_${boundary}${metadata}>>>\n${content}\n<<<END_${kind}_${boundary}>>>`;
}

export function parseNumstat(value: string): Map<string, { added: number; deleted: number }> {
  const result = new Map<string, { added: number; deleted: number }>();
  const records = value.split("\0");
  for (let index = 0; index < records.length; index++) {
    const match = records[index].match(/^([^\t]+)\t([^\t]+)\t(.*)$/s);
    if (!match) continue;
    let path = match[3];
    if (!path) {
      index += 2;
      path = records[index] ?? "";
    }
    if (!path) continue;
    result.set(path, {
      added: match[1] === "-" ? 100 : Number.parseInt(match[1], 10) || 0,
      deleted: match[2] === "-" ? 100 : Number.parseInt(match[2], 10) || 0,
    });
  }
  return result;
}

export function classifyReview(files: ChangedFile[], options: ReviewPolicyOptions = {}): ReviewDecision {
  if (files.length === 0) return { review: false, score: 0, reasons: ["no changed files"], totalLines: 0 };

  const totalLines = files.reduce((sum, file) => sum + file.addedLines + file.deletedLines, 0);
  const paths = files.map((file) => file.path);

  if (paths.every((path) => DOC_ONLY.test(path))) {
    if (options.reviewDocumentation) {
      return { review: true, score: 3, reasons: ["product or documentation artifact changed"], totalLines };
    }
    return { review: false, score: 0, reasons: ["documentation-only change"], totalLines };
  }

  if (paths.every((path) => LOCKFILE_ONLY.test(path))) {
    return { review: false, score: 0, reasons: ["lockfile-only change"], totalLines };
  }

  let score = 0;
  const reasons: string[] = [];

  if (options.reviewDocumentation && paths.some((path) => DOC_ONLY.test(path))) {
    score += 3;
    reasons.push("product or documentation artifact changed");
  }

  if (options.reviewDocumentation && paths.some((path) => FIGJAM_PATH.test(path.replace(/\\/g, "/")))) {
    score += 3;
    reasons.push("FigJam artifact profile selected");
  }

  const riskyFiles = files.filter((file) => HIGH_RISK_PATH.test(file.path) || HIGH_RISK_FILE.test(file.path));

  if (riskyFiles.length > 0) {
    score += 4;
    reasons.push(`high-risk area: ${riskyFiles.slice(0, 3).map((file) => safeReasonPath(file.path)).join(", ")}`);
  }

  const boundaryFiles = files.filter((file) => API_BOUNDARY.test(file.path));
  if (boundaryFiles.length > 0) {
    score += 3;
    reasons.push("API, schema, or data-model boundary changed");
  }

  const sensitivePrefixes = (options.sensitiveDataPrefixes ?? [])
    .map((prefix) => normalizeReviewScopePath(prefix))
    .filter((prefix): prefix is string => Boolean(prefix));
  if (files.some((file) => {
    const path = file.path.replace(/\\/g, "/");
    return SENSITIVE_DATA_PATH.test(path)
      || sensitivePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  })) {
    score += 4;
    reasons.push("PII, privacy, identity, or sensitive-data path changed");
  }

  if (files.some((file) => INFRA_CONFIG.test(file.path))) {
    score += 4;
    reasons.push("infrastructure or deployment configuration changed");
  } else if (files.some((file) => DEPENDENCY_OR_BUILD.test(file.path) && !LOCKFILE_ONLY.test(file.path))) {
    score += 2;
    reasons.push("dependency, build, or runtime configuration changed");
  }

  if (files.some((file) => file.kind === "deleted")) {
    score += 1;
    reasons.push("file deletion detected");
  }

  if (files.some((file) => file.kind === "added" && SOURCE_FILE.test(file.path))) {
    score += 1;
    reasons.push("new source file added");
  }

  if (files.length >= 7) {
    score += 3;
    reasons.push(`${files.length} files changed`);
  } else if (files.length >= 3) {
    score += 1;
    reasons.push(`${files.length} files changed`);
  }

  if (totalLines >= 300) {
    score += 3;
    reasons.push(`${totalLines} changed lines`);
  } else if (totalLines >= 100) {
    score += 2;
    reasons.push(`${totalLines} changed lines`);
  } else if (totalLines >= 60) {
    score += 1;
    reasons.push(`${totalLines} changed lines`);
  }

  const sourceFamilies = new Set<string>();
  for (const path of paths.filter((candidate) => SOURCE_FILE.test(candidate) && !TEST_FILE.test(candidate))) {
    const extension = path.split(".").pop()?.toLowerCase();
    if (extension) sourceFamilies.add(extension);
    const segments = pathSegments(path);
    if (segments.has("frontend") || segments.has("app") || segments.has("ui")) sourceFamilies.add("frontend-layer");
    if (segments.has("backend") || segments.has("server") || segments.has("api")) sourceFamilies.add("backend-layer");
  }
  if (sourceFamilies.size >= 3) {
    score += 1;
    reasons.push("change crosses languages or application layers");
  }

  const onlyTests = paths.every((path) => TEST_FILE.test(path));
  if (onlyTests && totalLines < 150 && files.length <= 2) {
    return { review: false, score, reasons: ["small test-only change"], totalLines };
  }

  const review = score >= 3;
  if (!review && reasons.length === 0) reasons.push("small localized low-risk change");
  return { review, score, reasons, totalLines };
}

export function normalizeReviewScopePath(path: string): string | undefined {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return undefined;
  if (normalized.split("/").some((segment) => segment === ".." || segment === "")) return undefined;
  return normalized;
}

export function scopeChangedFiles(files: ChangedFile[], scopePaths: Iterable<string>): ChangedFile[] {
  const scope = new Set([...scopePaths].flatMap((path) => {
    const normalized = normalizeReviewScopePath(path);
    return normalized ? [normalized] : [];
  }));
  return files.filter((file) => scope.has(file.path.replace(/\\/g, "/")));
}

export function findTopicRoots(paths: string[], topicDirectory: string): string[] {
  const baseSegments = topicDirectory.replace(/\\/g, "/").split("/").filter(Boolean);
  if (baseSegments.length === 0) return [];
  const roots = new Set<string>();
  for (const path of paths) {
    const segments = path.replace(/\\/g, "/").split("/").filter(Boolean);
    const matchesBase = baseSegments.every((segment, index) => segments[index] === segment);
    if (matchesBase && segments.length > baseSegments.length + 1) {
      roots.add([...baseSegments, segments[baseSegments.length]].join("/"));
    }
  }
  return [...roots].sort();
}

export function startsNewReviewTask(source: string, hostIsIdle: boolean): boolean {
  return source !== "extension" && hostIsIdle;
}

/** Opt-in protocol for delegated executor extensions. Other extension messages remain non-task context. */
export function isDelegatedExecutionInput(text: string): boolean {
  return text.trimStart().startsWith("[delegated-execution:v1]");
}

export function shouldRetainTaskPrompt(prompt: string): boolean {
  return Boolean(prompt.trim()) && !containsLikelySecret(prompt);
}

export function sanitizeTaskPromptForReview(prompt: string): string {
  return containsLikelySecret(prompt)
    ? "(task request withheld because it may contain a credential; do not claim completeness against user intent)"
    : prompt;
}

export function selectEarlierPrompts(promptHistory: string[], currentPrompt: string, maxPrompts: number): string[] {
  const limit = Math.max(0, maxPrompts - 1);
  const earlier: string[] = [];
  const seen = new Set([currentPrompt.trim()]);
  for (let index = promptHistory.length - 1; index >= 0 && earlier.length < limit; index--) {
    const prompt = promptHistory[index].trim();
    if (!prompt || seen.has(prompt)) continue;
    seen.add(prompt);
    earlier.push(prompt);
  }
  return earlier;
}

export function formatTaskContext(currentPrompt: string, earlierPrompts: string[]): string {
  const current = currentPrompt.trim() || "(current user request is empty)";
  const earlier = earlierPrompts.map((prompt) => prompt.trim()).filter(Boolean);
  const sections = [
    "CURRENT USER REQUEST — this defines the current scope and overrides conflicting earlier messages:",
    current,
  ];
  if (earlier.length > 0) {
    sections.push(
      "EARLIER USER MESSAGES — newest first; use only messages that clearly clarify or constrain the current request, and ignore unrelated or superseded topics:",
      ...earlier.map((prompt, index) => `[Earlier ${index + 1}]\n${prompt}`),
    );
  }
  return sections.join("\n\n");
}

export function formatReviewPriorities(priorities: string[]): string {
  const normalized = priorities.map((priority) => priority.trim()).filter(Boolean);
  if (normalized.length === 0) return "- No additional user-specific review priorities are configured.";
  return normalized.map((priority) => `- ${priority}`).join("\n");
}

export function selectReviewProfiles(paths: string[]): ReviewProfileId[] {
  return paths.some((path) => FIGJAM_PATH.test(path.replace(/\\/g, "/"))) ? ["figjam"] : [];
}

export function selectRelatedContextCandidates(
  relatedContextFiles: string[],
  topicRoots: string[],
  discoveredPaths: string[],
  discoverTopicContext: boolean,
): string[] {
  return [...new Set([
    ...relatedContextFiles,
    ...(discoverTopicContext ? topicRoots.map((topicRoot) => `${topicRoot}/README.md`) : []),
    ...(discoverTopicContext ? discoveredPaths : []),
  ])];
}

export function formatReviewProfiles(profileIds: ReviewProfileId[], profiles: ReviewProfilesConfig): string {
  if (profileIds.length === 0) return "- No artifact-specific review profile applies.";
  return profileIds.map((profileId) => {
    const criteria = profiles[profileId]?.map((criterion) => criterion.trim()).filter(Boolean) ?? [];
    const label = profileId === "figjam" ? "FigJam artifact profile" : profileId;
    const body = criteria.length > 0
      ? criteria.map((criterion) => `- ${criterion}`).join("\n")
      : "- No criteria are configured for this selected profile. Treat profile coverage as Unknown.";
    return `### ${label}\n${body}`;
  }).join("\n\n");
}

function evidenceDetail(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value : "";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return `${fallback} (detail withheld because it contains control characters)`;
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (containsLikelySecret(normalized) || SENSITIVE_COMMAND.test(normalized)) return `${fallback} (detail withheld because it may contain a credential)`;
  return normalized.slice(0, 240);
}

function evidenceInputLayers(input: Record<string, unknown>): Record<string, unknown>[] {
  const layers = [input];
  let current = input;
  for (let depth = 0; depth < 6; depth++) {
    const nested = current.arguments;
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) break;
    current = nested as Record<string, unknown>;
    layers.push(current);
  }
  return layers;
}

function firstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const values of evidenceInputLayers(input)) {
    for (const key of keys) {
      const value = values[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function figJamTargetMatches(command: string, outcome: RegExp): boolean {
  const segments = command.split(/&&|\|\||[|;\n]/).map((segment) => segment.trim()).filter(Boolean);
  return segments.some((segment) => {
    const packageTarget = segment.match(/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([^\s]+)/i)?.[1];
    const scriptTarget = segment.match(/^(?:node|bun|python(?:3)?)\s+([^\s]+)/i)?.[1];
    const directTarget = segment.match(/^(?:\.\/|\S*\/)([^\s]+)/)?.[0];
    return [packageTarget, scriptTarget, directTarget].some((target) => Boolean(target && /figjam/i.test(target) && outcome.test(target)));
  });
}

export function isFigJamSpecificCheck(command: string): boolean {
  return figJamTargetMatches(command, /(?:build|generate|payload|verify)/i);
}

export function isFigJamImportRenderCheck(command: string): boolean {
  return figJamTargetMatches(command, /(?:import|render)/i);
}

export function isRecognizedVerificationCommand(command: string): boolean {
  const normalized = command.trim();
  if (!normalized || NON_EXECUTING_CHECK.test(normalized) || MASKED_CHECK_RESULT.test(normalized)) return false;
  return CHECK_COMMAND.test(normalized);
}

function commandReferencesUnsafePath(command: string, deniedPaths: string[]): boolean {
  const normalized = command.replace(/\\/g, "/");
  if (/(?:^|[\s"'=])(?:\/|~\/|\.\.\/|[A-Za-z]:\/)/.test(normalized)) return true;
  return deniedPaths.some((candidate) => {
    const denied = normalizeReviewScopePath(candidate);
    return Boolean(denied && normalized.includes(denied));
  });
}

export function sanitizeEvidenceCommand(command: string, deniedPaths: string[] = []): string {
  if (commandReferencesUnsafePath(command, deniedPaths)) return "Verification command detail withheld";
  return evidenceDetail(command, "verification command");
}

export function observeToolEvidence(
  toolName: string,
  input: Record<string, unknown>,
  isError: boolean,
  deniedPaths: string[] = [],
  normalizeReadPath: (path: string) => string | undefined = (path) => path,
): ToolEvidenceObservation {
  if (toolName === "bash") {
    const rawCommand = firstString(input, ["command"]) ?? "";
    const command = sanitizeEvidenceCommand(rawCommand, deniedPaths);
    const observation: ToolEvidenceObservation = {};
    if (isRecognizedVerificationCommand(rawCommand)) observation.check = { command, passed: !isError };
    if (!isError && /\bgit\s+(?:status|diff|log|show)\b/i.test(rawCommand)) {
      observation.source = { kind: "repository", detail: "Git repository inspection" };
    }
    return observation;
  }

  if (isError) return {};

  if (toolName === "read") {
    const rawPath = firstString(input, ["path"]);
    const path = rawPath ? normalizeReadPath(rawPath) : undefined;
    if (!path || isProtectedReviewPath(path, deniedPaths)) return {};
    const safePath = evidenceDetail(path, "file path");
    return IMAGE_PATH.test(path)
      ? { source: { kind: "visual", detail: `Image artifact opened: ${safePath}`, path: safePath } }
      : { source: { kind: "workspace-file", detail: `File read: ${safePath}`, path: safePath } };
  }

  if (/jira/i.test(toolName) && !/(?:status|create|update|delete|transition|comment|assign)/i.test(toolName)) {
    const issueKey = firstString(input, ["issueIdOrKey", "issueKey", "issue_key", "key"]);
    const safeIssueKey = issueKey && /^[A-Za-z][A-Za-z0-9_]*-[0-9]+$/.test(issueKey) ? issueKey : undefined;
    return { source: { kind: "jira", detail: safeIssueKey ? `Jira issue read: ${safeIssueKey}` : `Successful Jira read via ${toolName.slice(0, 120)}` } };
  }

  if (/confluence/i.test(toolName) && !/(?:status|create|update|delete|publish|comment)/i.test(toolName)) {
    const pageId = firstString(input, ["pageId", "page_id", "id"]);
    const safePageId = pageId && /^[A-Za-z0-9_-]{1,80}$/.test(pageId) ? pageId : undefined;
    return { source: { kind: "confluence", detail: safePageId ? `Confluence page read: ${safePageId}` : `Successful Confluence read via ${toolName.slice(0, 120)}` } };
  }

  return {};
}

export function deriveEvidenceUnknowns(
  paths: string[],
  profileIds: ReviewProfileId[],
  sources: EvidenceSource[],
  checks: EvidenceCheck[],
  agentReported: string[] = [],
  observations?: EvidenceObservations,
  productArtifactPrefixes: string[] = [],
): string[] {
  const unknowns = agentReported.map((entry) => evidenceDetail(entry, "Agent-reported unknown")).filter(Boolean);
  const normalizedPrefixes = productArtifactPrefixes.map((prefix) => prefix.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "")).filter(Boolean);
  const productArtifact = paths.some((path) => {
    const normalizedPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return normalizedPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  });
  const retainedOfficialSource = sources.some((source) => source.kind === "jira" || source.kind === "confluence");
  const officialSourceObserved = observations?.officialProductSource ?? retainedOfficialSource;
  if (productArtifact && !retainedOfficialSource) {
    unknowns.push(officialSourceObserved
      ? "An authoritative issue tracker or knowledge base was accessed during this task, but the bounded ledger no longer identifies the source. Exact product-truth coverage remains Unknown."
      : "No successful authoritative issue-tracker or knowledge-base read was observed during this task. Product truth is not verified through this review channel.");
  }
  if (profileIds.includes("figjam")) {
    const changedPathSet = new Set(paths.map((path) => path.replace(/\\/g, "/")));
    const relatedVisual = sources.find((source) => {
      if (source.kind !== "visual" || !source.path) return false;
      const normalizedPath = source.path.replace(/\\/g, "/");
      return FIGJAM_PATH.test(normalizedPath) || changedPathSet.has(normalizedPath);
    });
    if (relatedVisual) {
      unknowns.push(`The primary agent opened ${relatedVisual.path}, but the image is not included in this text-only review bundle. Independent visual verification of hierarchy, readability, clipping, and overlap remains Unknown.`);
    } else if (observations?.visualArtifact) {
      unknowns.push("A rendered image was opened during this task, but the bounded ledger does not establish that it belongs to this FigJam artifact. The final visual result remains Unknown.");
    } else {
      unknowns.push("No related rendered image or screenshot was opened during this task. The final FigJam hierarchy, readability, and visual result remain Unknown.");
    }
    const latestGenerationCheck = [...checks].reverse().find((check) => isFigJamSpecificCheck(check.command));
    if (!latestGenerationCheck?.passed) {
      unknowns.push("No latest passing FigJam-specific check clearly proves payload generation. That outcome remains Unknown.");
    }
    const latestImportRenderCheck = [...checks].reverse().find((check) => isFigJamImportRenderCheck(check.command));
    if (!latestImportRenderCheck?.passed) {
      unknowns.push("No latest passing FigJam-specific import or render check proves importability and rendering. Those outcomes remain Unknown.");
    }
  }
  if (checks.length === 0) unknowns.push("No automated verification command was observed during this task.");
  return [...new Set(unknowns)].slice(0, 20);
}

export function formatReviewEvidence(sources: EvidenceSource[], checks: EvidenceCheck[], unknowns: string[]): string {
  const sourceLines = sources.length > 0
    ? sources.slice(-20).map((source) => `- ${source.kind}: ${source.detail}`).join("\n")
    : "- No task-local source access was observed.";
  const checkLines = checks.length > 0
    ? checks.slice(-20).map((check) => `- ${check.passed ? "OBSERVED SUCCESS" : "OBSERVED FAILURE OR INCOMPLETE"}: ${check.command}`).join("\n")
    : "- No recognized verification command was observed.";
  const unknownLines = unknowns.length > 0
    ? unknowns.slice(0, 20).map((unknown) => `- ${unknown}`).join("\n")
    : "- No explicit unknown was recorded. This does not prove complete coverage.";
  return `Observed source access (a successful tool call proves access only, not that a specific claim is correct):\n${sourceLines}\n\nObserved checks:\n${checkLines}\n\nUnverified or unknown coverage:\n${unknownLines}`;
}

export function isReviewTextPath(path: string): boolean {
  return REVIEW_TEXT_FILE.test(path.replace(/\\/g, "/"));
}

export function isDeniedReviewPath(path: string, deniedPaths: string[] = []): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return deniedPaths.some((candidate) => {
    const denied = normalizeReviewScopePath(candidate);
    return Boolean(denied && (normalized === denied || normalized.startsWith(`${denied}/`)));
  });
}

export function isProtectedReviewPath(path: string, deniedPaths: string[] = []): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (isDeniedReviewPath(normalized, deniedPaths)) return true;
  if (/(?:^|\/)\.env\.example$/i.test(normalized)) return false;
  return /(?:^|\/)(?:\.env(?:\.[^/]+)?|\.npmrc|\.netrc|id_(?:rsa|dsa|ecdsa|ed25519)|credentials(?:\.json)?|secrets?(?:\.json)?|terraform\.tfvars(?:\.json)?|application(?:-[^/]+)?\.ya?ml|.*\.(?:pem|p12|pfx|key))$/i.test(normalized);
}

export function containsLikelySecret(value: string): boolean {
  const providerToken = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/i;
  const jwt = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
  const credentialUrl = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp|https?):\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/i;
  const assignment = /\b(?:api[_-]?key|client[_-]?secret|private[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|token)\b\s*[:=]\s*["']?([^\s"',;}\]]{8,})/ig;
  const literalAssignment = [...value.matchAll(assignment)].some((match) => {
    const assigned = match[1].replace(/["')]+$/, "");
    return !/^(?:get|read|load|process\.|os\.|env\.|settings\.|config\.|undefined$|null$|true$|false$)/i.test(assigned);
  });
  return providerToken.test(value) || jwt.test(value) || credentialUrl.test(value) || literalAssignment;
}

export type ReviewVerdict = "pass" | "findings" | "unknown";
export type ReviewSeverity = "Critical" | "High" | "Medium";

export function reviewFindingSeverities(output: string): ReviewSeverity[] {
  const severities = new Set<ReviewSeverity>();
  for (const match of output.matchAll(/^\s*(?:(?:[-*]|\d+[.)])\s*)?(?:#{1,6}\s*)?(?:\*\*)?(Critical|High|Medium)(?:\*\*)?(?:\s*[:–—]\s*|\s+-+\s+|-\s+)/gim)) {
    const severity = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}` as ReviewSeverity;
    severities.add(severity);
  }
  return [...severities];
}

export function parseReviewVerdict(output: string): ReviewVerdict {
  const lines = output.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstIndex < 0) return "unknown";
  const first = lines[firstIndex].trim().match(/^VERDICT:\s*(PASS|FINDINGS)$/i)?.[1].toUpperCase();
  if (!first) return "unknown";
  const laterVerdict = lines.slice(firstIndex + 1).some((line) => /^\s*VERDICT:\s*(?:PASS|FINDINGS)\b/i.test(line));
  if (laterVerdict) return "unknown";
  const severities = reviewFindingSeverities(lines.slice(firstIndex + 1).join("\n"));
  if (first === "PASS") return severities.length === 0 ? "pass" : "unknown";
  return severities.length > 0 ? "findings" : "unknown";
}

export function reviewPassed(output: string): boolean {
  return parseReviewVerdict(output) === "pass";
}
