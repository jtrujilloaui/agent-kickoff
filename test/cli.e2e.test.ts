import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");

function cli(args: string[]) {
  const r = Bun.spawnSync([process.execPath, CLI, ...args], {
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
    stdin: "ignore",
  });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

describe("cli", () => {
  test("--yes --dry-run prints the install commands and writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "ak-e2e-"));
    cpSync(join(import.meta.dir, "fixtures", "next-app"), dir, { recursive: true });
    const r = cli([dir, "--yes", "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Installing skills");
    expect(r.stdout).toContain("npx skills add obra/superpowers");
    expect(r.stdout).toContain("dry run");
    expect(r.stdout).toContain("Work mode:");
    expect(r.stdout).not.toContain("\x1b[");
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  }, 30000);

  test("--version prints the package version", () => {
    const r = cli(["--version"]);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  test("an unknown flag exits 2", () => {
    expect(cli(["--nope"]).code).toBe(2);
  });
});
