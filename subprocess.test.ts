import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfigFile, runClaudeProcess } from "./index.ts";

function processConfig(command: string, timeoutMs = 2_000) {
  const root = mkdtempSync(join(tmpdir(), "adaptive-review-process-config-"));
  const path = join(root, "config.json");
  writeFileSync(path, JSON.stringify({ enabled: true, allowedRoots: [root], claudeCommand: command, timeoutMs: 30_000 }));
  const config = loadConfigFile(path).config;
  return { root, config: { ...config, timeoutMs } };
}

describe("Claude subprocess boundary", () => {
  test("runs in an empty temporary directory with a minimal environment", async () => {
    const scriptRoot = mkdtempSync(join(tmpdir(), "adaptive-review-fake-claude-"));
    const script = join(scriptRoot, "fake-claude");
    writeFileSync(script, `#!/usr/bin/env node
const fs = require("node:fs");
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const cleanCwd = fs.readdirSync(process.cwd()).length === 0;
  const secretAbsent = process.env.AWS_SECRET_ACCESS_KEY === undefined;
  const effortIndex = process.argv.indexOf("--effort");
  const lowEffort = effortIndex >= 0 && process.argv[effortIndex + 1] === "low";
  const turnsIndex = process.argv.indexOf("--max-turns");
  const twoTurns = turnsIndex >= 0 && process.argv[turnsIndex + 1] === "2";
  if (!cleanCwd || !secretAbsent || !lowEffort || !twoTurns || !input.includes("review bundle")) process.exit(2);
  process.stdout.write("VERDICT: PASS\\nIsolated reviewer process.");
});
`);
    chmodSync(script, 0o755);
    const previous = process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_SECRET_ACCESS_KEY = "must-not-be-inherited";
    const { root, config } = processConfig(script);
    try {
      await expect(runClaudeProcess(config, "review bundle")).resolves.toContain("VERDICT: PASS");
    } finally {
      if (previous === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
      else process.env.AWS_SECRET_ACCESS_KEY = previous;
      rmSync(root, { recursive: true, force: true });
      rmSync(scriptRoot, { recursive: true, force: true });
    }
  });

  test("terminates and reaps a reviewer that ignores SIGTERM", async () => {
    const scriptRoot = mkdtempSync(join(tmpdir(), "adaptive-review-fake-claude-"));
    const script = join(scriptRoot, "fake-claude");
    writeFileSync(script, `#!/usr/bin/env node
process.on("SIGTERM", () => {});
process.stdin.resume();
setInterval(() => {}, 1000);
`);
    chmodSync(script, 0o755);
    const { root, config } = processConfig(script, 50);
    const started = Date.now();
    try {
      await expect(runClaudeProcess(config, "review bundle")).rejects.toThrow("timed out after 50 ms");
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(scriptRoot, { recursive: true, force: true });
    }
  });

  test("fails closed when reviewer output exceeds the bound", async () => {
    const scriptRoot = mkdtempSync(join(tmpdir(), "adaptive-review-fake-claude-"));
    const script = join(scriptRoot, "fake-claude");
    writeFileSync(script, `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write("x".repeat(31000)));
`);
    chmodSync(script, 0o755);
    const { root, config } = processConfig(script);
    try {
      await expect(runClaudeProcess(config, "review bundle")).rejects.toThrow("output exceeded");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(scriptRoot, { recursive: true, force: true });
    }
  });
});
