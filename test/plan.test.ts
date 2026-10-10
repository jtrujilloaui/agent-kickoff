import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SectionKey, WorkMode } from "../src/types";
import { loadSaved, planFiles, savedStatePath } from "../src/plan";
import { contextSkill } from "../src/plan/context";
import { render } from "../src/plan/render";
import { loadTemplates } from "../src/plan/templates";
import { templateFlags, templateVars } from "../src/plan/vars";
import { answers, ALL_SECTIONS } from "./helpers/answers";
import { apiFacts, nextFacts } from "./helpers/facts";

describe("render", () => {
  test("substitutes variables", () => {
    expect(render("Hi {{NAME}}!", { NAME: "Ada" }, {})).toBe("Hi Ada!");
  });
  test("IF / ELSE", () => {
    const t = "<!-- IF A -->yes<!-- ELSE -->no<!-- END IF -->";
    expect(render(t, {}, { A: true })).toBe("yes");
    expect(render(t, {}, { A: false })).toBe("no");
  });
  test("nesting", () => {
    const t = "<!-- IF A -->a<!-- IF B -->b<!-- ELSE -->nb<!-- END IF --><!-- END IF -->";
    expect(render(t, {}, { A: true, B: true })).toBe("ab");
    expect(render(t, {}, { A: true, B: false })).toBe("anb");
    expect(render(t, {}, { A: false, B: true })).toBe("");
    expect(render(t, {}, { A: false, B: false })).toBe("");
  });
  test("inline IF", () => {
    expect(render("x<!-- IF A --> y<!-- END IF -->.", {}, { A: true })).toBe("x y.");
    expect(render("x<!-- IF A --> y<!-- END IF -->.", {}, { A: false })).toBe("x.");
  });
  test("inactive branches do not need their variables", () => {
    expect(render("<!-- IF A -->{{NOPE}}<!-- END IF -->ok", {}, { A: false })).toBe("ok");
  });
  test("collapses blank lines", () => {
    expect(render("a\n\n\n\nb", {}, {})).toBe("a\n\nb");
  });
  test("errors", () => {
    expect(() => render("<!-- IF X -->", {}, {})).toThrow("Unknown template flag: X");
    expect(() => render("{{X}}", {}, {})).toThrow("Missing template variable: X");
    expect(() => render("<!-- ELSE -->", {}, {})).toThrow("ELSE without IF");
    expect(() => render("<!-- END IF -->", {}, {})).toThrow("END IF without IF");
    expect(() => render("<!-- IF A -->", {}, { A: true })).toThrow("Unclosed IF");
  });
});

const templates = loadTemplates();
const FLAGS = [
  "LINEAR",
  "GITHUB_ISSUES",
  "MULTI_REPO",
  "FRONTEND",
  "DESIGN_SYSTEM",
  "BACKEND",
  "HUMAN_REVIEW",
  "ROUTING",
  "WORKFLOW",
  "UI",
  "VERIFY",
  "PR",
  "TRACKER",
  "GIT",
  "AGENTS",
];

describe("templates", () => {
  const vars = templateVars(nextFacts(), answers());
  const all: [string, string][] = [
    ["AGENTS.md", templates.agents],
    ["CLAUDE.md", templates.claude],
    ...Object.entries(templates.agentFiles),
    ...Object.entries(templates.linear),
  ];

  test("every flag combination renders cleanly", () => {
    for (let mask = 0; mask < 1 << FLAGS.length; mask++) {
      const flags = Object.fromEntries(FLAGS.map((k, i) => [k, !!(mask & (1 << i))]));
      for (const [name, tpl] of all) {
        const out = render(tpl, vars, flags);
        expect(out.includes("{{"), `${name} mask ${mask}`).toBe(false);
      }
    }
  });

  test("linear templates have a Team setup section", () => {
    for (const tpl of Object.values(templates.linear)) {
      const out = render(tpl, vars, templateFlags(nextFacts(), answers()));
      expect(out).not.toContain("## Configure");
      expect(out).toContain("## Team setup");
      expect(out).toContain("**Web** (`WEB`)");
    }
  });
});

describe("planFiles", () => {
  const plan = () =>
    planFiles({
      facts: nextFacts(),
      answers: answers(),
      templates,
      version: "0.0.0-test",
      date: "2026-10-09",
    });

  test("path list", () => {
    expect(plan().map((p) => p.path)).toEqual([
      ".claude/skills/acme-web-context/SKILL.md",
      ".claude/skills/acme-web-context/references/stack.md",
      ".claude/skills/acme-web-context/references/commands.md",
      ".claude/skills/acme-web-context/references/structure.md",
      ".claude/skills/acme-web-context/references/data.md",
      ".claude/skills/acme-web-context/references/conventions.md",
      "AGENTS.md",
      "CLAUDE.md",
      ".claude/agents/architect.md",
      ".claude/agents/builder.md",
      ".claude/agents/mechanic.md",
      ".claude/skills/linear-planning/SKILL.md",
      ".claude/skills/linear-sync/SKILL.md",
      ".claude/skills/linear-project-health/SKILL.md",
      ".claude/skills/issue-authoring/SKILL.md",
      ".claude/agent-kickoff.json",
    ]);
  });

  test("markers and shape", () => {
    const files = plan();
    for (const p of files.filter((x) => x.mode !== "state")) {
      expect(p.content).toContain("<!-- agent-kickoff:start -->");
      expect(p.content).toContain("<!-- agent-kickoff:end -->");
    }
    const get = (path: string) => files.find((p) => p.path === path)!.content;
    expect(
      get(".claude/skills/acme-web-context/SKILL.md").startsWith("---\nname: acme-web-context\n"),
    ).toBe(true);
    const agents = get("AGENTS.md");
    expect(agents).toContain("acme-web-context");
    expect(agents).toContain("UI work");
    expect(agents).not.toContain("Backend work");
    const state = JSON.parse(get(".claude/agent-kickoff.json"));
    expect(state.version).toBe("0.0.0-test");
    expect(state.savedAt).toBe("2026-10-09");
    expect(state.answers.enrich).toBeUndefined();
  });

  test("never leaks the absolute root", () => {
    for (const p of plan()) expect(p.content).not.toContain("/tmp/acme-web");
  });

  test("api repo without tracker", () => {
    const files = planFiles({
      facts: apiFacts(),
      answers: answers({ tracker: "none", linear: undefined, humanReview: false }),
      templates,
      version: "0.0.0-test",
      date: "2026-10-09",
    });
    expect(files.some((p) => p.path.includes("linear"))).toBe(false);
    const agents = files.find((p) => p.path === "AGENTS.md")!.content;
    expect(agents).toContain("Backend work");
    expect(agents).toContain("Changes may land without human review");
    expect(agents).toContain("`main`");
    expect(agents).not.toContain("UI work");
  });

  test("snapshot", () => {
    expect(
      plan()
        .map((p) => `=== ${p.path} (${p.mode})\n${p.content}`)
        .join("\n"),
    ).toMatchSnapshot();
  });
});

const HEADINGS: Record<SectionKey, string> = {
  routing: "## Plan first",
  workflow: "## Workflow",
  ui: "## UI work",
  backend: "## Backend work",
  verify: "## Verify before",
  pr: "## Pull requests",
  tracker: "## Issue tracking",
  git: "## Git and worktrees",
};

const agentsMd = (facts: ReturnType<typeof nextFacts>, over: Parameters<typeof answers>[0]) =>
  planFiles({ facts, answers: answers(over), templates, version: "0", date: "2026-10-09" }).find(
    (p) => p.path === "AGENTS.md",
  )!.content;

describe("sections and work modes", () => {
  const modes: WorkMode[] = ["single", "subagents", "multi"];

  test("every section subset and work mode renders cleanly", () => {
    for (const workMode of modes) {
      for (let mask = 0; mask < 1 << ALL_SECTIONS.length; mask++) {
        const sections = ALL_SECTIONS.filter((_, i) => mask & (1 << i));
        for (const facts of [nextFacts(), apiFacts()]) {
          const out = agentsMd(facts, { workMode, sections });
          expect(out.includes("{{"), `${workMode} ${mask}`).toBe(false);
        }
      }
    }
  });

  test("omitted sections are absent, selected ones present", () => {
    const facts = { ...nextFacts(), hasBackend: true };
    for (const key of ALL_SECTIONS) {
      const without = agentsMd(facts, { sections: ALL_SECTIONS.filter((k) => k !== key) });
      expect(without, key).not.toContain(HEADINGS[key]);
      const only = agentsMd(facts, { sections: [key] });
      expect(only, key).toContain(HEADINGS[key]);
    }
    const none = agentsMd(nextFacts(), { sections: [] });
    for (const h of Object.values(HEADINGS)) expect(none).not.toContain(h);
    expect(none).toContain("## Stack and commands");
  });

  test("tier table only when agents are generated", () => {
    expect(agentsMd(nextFacts(), {})).toContain("| Tier |");
    const out = agentsMd(nextFacts(), { generate: ["context", "instructions"] });
    expect(out).not.toContain("| Tier |");
    expect(out).toContain("to subagents;");
  });

  test("workflow steps differ for single and multi", () => {
    const single = agentsMd(nextFacts(), { workMode: "single" });
    expect(single).toContain("`executing-plans`");
    expect(single).not.toContain("Execute: `subagent-driven-development`");
    expect(single).not.toContain("Parallel work");
    const multi = agentsMd(nextFacts(), { workMode: "multi" });
    expect(multi).toContain("Execute: `subagent-driven-development`");
    expect(multi).toContain("Parallel work: `dispatching-parallel-agents`");
    expect(multi).toContain("each in its own git worktree (`using-git-worktrees`)");
  });

  test("notes only name installed skills", () => {
    const out = agentsMd(nextFacts(), { workMode: "multi", skills: [] });
    expect(out).toContain("No workflow skills installed");
    expect(out).toContain("None yet.");
    expect(out).not.toContain("subagent-driven-development");
    expect(out).toContain("run one fresh subagent per task and review");
  });

  test("skills list credits authors; generated skills have none", () => {
    const out = agentsMd(nextFacts(), {});
    expect(out).toContain("(by Jesse Vincent)");
    expect(out).toContain("- `linear-sync`: issue status in sync while coding\n");
  });

  test("a deselected linear skill is not generated", () => {
    const skills = answers().skills.filter((s) => s !== "linear-sync");
    const files = planFiles({
      facts: nextFacts(),
      answers: answers({ skills }),
      templates,
      version: "0",
      date: "2026-10-09",
    });
    expect(files.some((p) => p.path.includes("linear-sync"))).toBe(false);
    expect(files.some((p) => p.path.includes("linear-planning"))).toBe(true);
  });

  test("self-review PR text without human review", () => {
    expect(agentsMd(nextFacts(), { humanReview: false })).toContain("self-review");
  });
});

describe("loadSaved", () => {
  test("accepts a v0.1 file", async () => {
    const root = mkdtempSync(join(tmpdir(), "kickoff-saved-"));
    try {
      const path = join(root, savedStatePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        JSON.stringify({
          version: "0.1.0",
          answers: {
            teamShape: "solo",
            tracker: "linear",
            linear: { teamName: "Web", teamKey: "WEB" },
            humanReview: false,
            generate: ["context", "instructions", "agents", "linear", "design"],
            issueLanguage: "English",
          },
        }),
      );
      const saved = await loadSaved(root);
      expect(saved?.workMode).toBe("subagents");
      expect(saved?.generate).toEqual(["context", "instructions", "agents"]);
      expect(saved?.sections).toBeUndefined();
      expect(saved?.skills).toBeUndefined();
      expect(saved?.linear).toEqual({ teamName: "Web", teamKey: "WEB" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("contextSkill", () => {
  test("lists enrich files only when enriched", () => {
    expect(contextSkill(nextFacts(), [], "2026-10-09")).not.toContain("architecture.md");
    expect(contextSkill(nextFacts(), ["architecture.md"], "2026-10-09")).toContain(
      "architecture.md",
    );
  });
  test("agent setup section is optional", () => {
    expect(contextSkill(nextFacts(), [], "2026-10-09")).not.toContain("## Agent setup");
    const out = contextSkill(nextFacts(), [], "2026-10-09", {
      workMode: "multi",
      skills: ["brainstorming", "writing-plans"],
    });
    expect(out).toContain("Work mode: multi.");
    expect(out).toContain("Installed skills: brainstorming, writing-plans.");
  });
});
