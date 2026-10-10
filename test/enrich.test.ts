import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrompt, enrichArgs, findClaude, parseFileBlocks, parseStreamLine, runEnrich, type EnrichEvent } from "../src/enrich";
import type { RepoFacts } from "../src/types";

const FAKE = join(import.meta.dir, "support", "fake-claude.mjs");

function facts(root: string): RepoFacts {
  return {
    root,
    name: "acme-web",
    slug: "acme-web",
    packageManager: "bun",
    languages: ["typescript"],
    frameworks: ["next 16 (app router)"],
    frameworkIds: ["next"],
    scripts: {},
    dependencies: ["next"],
    workspaces: [],
    commands: {},
    structure: [],
    routes: ["/"],
    dataModels: [],
    envVars: [],
    ciJobs: [],
    git: { conventionalCommits: false },
    docs: [],
    hasFrontend: true,
    hasBackend: false,
    hasDatabase: false,
    isMonorepo: false,
    warnings: [],
  };
}

function run(mode: "ok" | "nofiles" | "fail") {
  const root = mkdtempSync(join(tmpdir(), "ak-enrich-"));
  const events: EnrichEvent[] = [];
  const { done } = runEnrich(root, facts(root), (e) => events.push(e), {
    command: process.execPath,
    prefixArgs: [FAKE],
    env: { ...process.env, FAKE_MODE: mode },
  });
  return { root, events, done };
}

describe("enrich", () => {
  test("prompt carries the facts but not the absolute root", () => {
    const prompt = buildPrompt(facts("/secret/place/acme-web"));
    expect(prompt).toContain('"name": "acme-web"');
    expect(prompt).toContain("=== FILE: architecture.md ===");
    expect(prompt).not.toContain("/secret/place");
  });

  test("args allow read-only tools and deny every writing tool", () => {
    const args = enrichArgs();
    const allowed = args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--disallowedTools"));
    expect(allowed).toEqual(["Read", "Grep", "Glob"]);
    for (const t of ["Write", "Edit", "Bash"]) expect(args.slice(args.indexOf("--disallowedTools"))).toContain(t);
    expect(args).toContain("default");
  });

  test("parseStreamLine labels tools relative to the root and reads the result", () => {
    const root = "C:\\repo";
    const read = parseStreamLine(
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "C:\\repo\\src\\a.ts" } }] } }),
      root,
    );
    expect(read.events).toEqual([{ type: "tool", label: "Reading src/a.ts" }]);
    const res = parseStreamLine(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "hi" }), root);
    expect(res.result).toEqual({ ok: true, text: "hi" });
    expect(parseStreamLine("not json", root).events).toEqual([]);
  });

  test("parseFileBlocks keeps only the three known files", () => {
    const files = parseFileBlocks(
      "=== FILE: flows.md ===\n# F\n=== END FILE ===\n=== FILE: ../../evil.md ===\nx\n=== END FILE ===",
    );
    expect(Object.keys(files)).toEqual(["flows.md"]);
    expect(files["flows.md"]).toBe("# F\n");
  });

  test("happy path writes the three references and nothing else", async () => {
    const { root, events, done } = run("ok");
    const r = await done;
    expect(r.ok).toBe(true);
    expect(r.written).toEqual(["architecture.md", "flows.md", "gotchas.md"]);
    const dir = join(root, ".claude/skills/acme-web-context/references");
    expect(readFileSync(join(dir, "flows.md"), "utf8")).toContain("src/app/page.tsx:1");
    expect(existsSync(join(root, "evil.md"))).toBe(false);
    expect(events.some((e) => e.type === "tool" && e.label === "Reading src/app/page.tsx")).toBe(true);
    expect(events.filter((e) => e.type === "wrote")).toHaveLength(3);
  });

  test("no documents in the answer is a clean failure", async () => {
    const { root, done } = run("nofiles");
    const r = await done;
    expect(r.ok).toBe(false);
    expect(r.message).toContain("without returning");
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });

  test("a crashing claude surfaces its last stderr line", async () => {
    const r = await run("fail").done;
    expect(r.ok).toBe(false);
    expect(r.message).toBe("boom: not logged in");
  });

  test("a missing binary resolves instead of throwing", async () => {
    const root = mkdtempSync(join(tmpdir(), "ak-enrich-"));
    const r = await runEnrich(root, facts(root), () => {}, { command: join(root, "no-such-claude") }).done;
    expect(r.ok).toBe(false);
  });

  test("findClaude searches PATH", () => {
    expect(findClaude({ PATH: "" }, "linux")).toBeNull();
  });
});
