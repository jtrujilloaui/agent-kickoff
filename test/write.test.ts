import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FilePlan } from "../src/types";
import { END, START, wrap } from "../src/plan/markers";
import { applyPlan } from "../src/write";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kickoff-write-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const read = (path: string) => readFileSync(join(root, path), "utf8");

const owned = (path: string, body: string): FilePlan => ({ path, content: wrap(body), mode: "owned" });
const managed = (path: string, body: string): FilePlan => ({ path, content: wrap(body), mode: "managed" });
const state: FilePlan = { path: ".claude/agent-kickoff.json", content: '{"a":1}\n', mode: "state" };

describe("applyPlan", () => {
  test("writes new files, then reports unchanged", async () => {
    const plans = [owned("a/b.md", "hello"), managed("AGENTS.md", "rules"), state];
    const first = await applyPlan(root, plans, { dryRun: false });
    expect(first.map((r) => r.action)).toEqual(["new", "new", "new"]);
    expect(read("a/b.md")).toBe(plans[0].content);
    const second = await applyPlan(root, plans, { dryRun: false });
    expect(second.map((r) => r.action)).toEqual(["unchanged", "unchanged", "unchanged"]);
  });

  test("state file is overwritten when different", async () => {
    put(state.path, '{"a":0}\n');
    const [r] = await applyPlan(root, [state], { dryRun: false });
    expect(r.action).toBe("update");
    expect(read(state.path)).toBe(state.content);
  });

  test("replaces the marked region and keeps user text", async () => {
    put("AGENTS.md", `before\n\n${START}\nold\n${END}\n\nafter\n`);
    const [r] = await applyPlan(root, [managed("AGENTS.md", "new")], { dryRun: false });
    expect(r.action).toBe("update");
    expect(read("AGENTS.md")).toBe(`before\n\n${START}\nnew\n${END}\n\nafter\n`);
  });

  test("CRLF copy of identical content is unchanged", async () => {
    const p = owned("x.md", "line one\nline two");
    put("x.md", p.content.replace(/\n/g, "\r\n"));
    const [r] = await applyPlan(root, [p], { dryRun: false });
    expect(r.action).toBe("unchanged");
  });

  test("managed file without markers gets an appended region", async () => {
    put("AGENTS.md", "# Mine\n\nKeep me.\n");
    const p = managed("AGENTS.md", "rules");
    const [r] = await applyPlan(root, [p], { dryRun: false });
    expect(r.action).toBe("append");
    expect(read("AGENTS.md")).toBe(`# Mine\n\nKeep me.\n\n${p.content}`);
  });

  test("owned file without markers is untouched and .new is written", async () => {
    put("x.md", "hand written\n");
    const p = owned("x.md", "generated");
    const [r] = await applyPlan(root, [p], { dryRun: false });
    expect(r.action).toBe(".new");
    expect(r.writtenPath).toBe("x.md.new");
    expect(read("x.md")).toBe("hand written\n");
    expect(read("x.md.new")).toBe(p.content);
  });

  test("dry run writes nothing but reports the same actions", async () => {
    put("AGENTS.md", "mine\n");
    const plans = [owned("a.md", "x"), managed("AGENTS.md", "y"), state];
    const dry = await applyPlan(root, plans, { dryRun: true });
    expect(readdirSync(root).sort()).toEqual(["AGENTS.md"]);
    expect(read("AGENTS.md")).toBe("mine\n");
    expect(existsSync(join(root, "a.md"))).toBe(false);
    const real = await applyPlan(root, plans, { dryRun: false });
    expect(dry).toEqual(real);
  });

  test("refreshes the frontmatter of a marked SKILL.md", async () => {
    put("SKILL.md", `---\nname: old\n---\n${START}\nold body\n${END}\n\nmy notes\n`);
    const planned = owned("SKILL.md", "---\nname: fresh\n---\n\n# Body");
    const [r] = await applyPlan(root, [planned], { dryRun: false });
    expect(r.action).toBe("update");
    expect(read("SKILL.md")).toBe(`---\nname: fresh\n---\n${START}\n# Body\n${END}\n\nmy notes\n`);
  });
});
