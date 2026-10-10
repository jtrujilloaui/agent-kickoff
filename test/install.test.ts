import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCommands } from "../src/catalog";
import { installedPaths, runInstall, type InstallEvent } from "../src/install";

const FAKE = join(import.meta.dir, "support", "fake-skills.mjs");

describe("installCommands", () => {
  test("groups selected external skills by repo with the right args", () => {
    const cmds = installCommands(["writing-plans", "brainstorming", "better-ui", "linear-sync", "nope"]);
    expect(cmds.map((c) => c.repo)).toEqual(["obra/superpowers", "jakubkrehel/skills"]);
    expect(cmds[0]!.skills).toEqual(["brainstorming", "writing-plans"]);
    expect(cmds[0]!.args).toEqual([
      "-y", "skills", "add", "obra/superpowers", "-s", "brainstorming", "writing-plans",
      "-a", "claude-code", "codex", "cursor", "--copy", "-y",
    ]);
  });

  test("generated skills and an empty selection produce no commands", () => {
    expect(installCommands(["linear-sync"])).toEqual([]);
    expect(installCommands([])).toEqual([]);
  });
});

test("installedPaths lists the Claude copy and the .agents mirror", () => {
  expect(installedPaths(["a"])).toEqual([".claude/skills/a/SKILL.md", ".agents/skills/a/SKILL.md"]);
});

describe("runInstall", () => {
  test("installs with a fake command and survives a failing repo", async () => {
    const root = mkdtempSync(join(tmpdir(), "ak-install-"));
    const cmds = [
      { repo: "good/repo", skills: ["one", "two"], args: ["-y", "skills", "add", "good/repo", "-s", "one", "two", "-a", "claude-code"] },
      { repo: "fail/repo", skills: ["three"], args: ["-y", "skills", "add", "fail/repo", "-s", "three", "-a", "claude-code"] },
      { repo: "other/repo", skills: ["four"], args: ["-y", "skills", "add", "other/repo", "-s", "four", "-a", "claude-code"] },
    ];
    const events: InstallEvent[] = [];
    const r = await runInstall(root, cmds, (e) => events.push(e), { command: process.execPath, prefixArgs: [FAKE] });
    expect(r.installed).toEqual(["one", "two", "four"]);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]!.repo).toBe("fail/repo");
    expect(r.failed[0]!.message).toContain("boom");
    expect(existsSync(join(root, ".claude/skills/one/SKILL.md"))).toBe(true);
    expect(events.map((e) => `${e.type}:${e.repo}`)).toEqual([
      "start:good/repo", "done:good/repo", "start:fail/repo", "done:fail/repo", "start:other/repo", "done:other/repo",
    ]);
  });

  test("a missing executable is a failure, not a throw", async () => {
    const root = mkdtempSync(join(tmpdir(), "ak-install-"));
    const cmds = [{ repo: "x/y", skills: ["s"], args: ["add"] }];
    const r = await runInstall(root, cmds, () => {}, { command: "definitely-not-a-real-binary-xyz" });
    expect(r.installed).toEqual([]);
    expect(r.failed).toHaveLength(1);
  });
});
