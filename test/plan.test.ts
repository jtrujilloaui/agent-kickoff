import { describe, expect, test } from "bun:test";
import type { Answers } from "../src/types";
import { planFiles } from "../src/plan";
import { contextSkill } from "../src/plan/context";
import { render } from "../src/plan/render";
import { loadTemplates } from "../src/plan/templates";
import { templateFlags, templateVars } from "../src/plan/vars";
import { apiFacts, nextFacts } from "./helpers/facts";

function answers(over: Partial<Answers> = {}): Answers {
  return {
    teamShape: "small",
    tracker: "linear",
    linear: { teamName: "Web", teamKey: "WEB" },
    humanReview: true,
    generate: ["context", "instructions", "agents", "linear", "design"],
    enrich: false,
    issueLanguage: "English",
    ...over,
  };
}

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

describe("contextSkill", () => {
  test("lists enrich files only when enriched", () => {
    expect(contextSkill(nextFacts(), [], "2026-10-09")).not.toContain("architecture.md");
    expect(contextSkill(nextFacts(), ["architecture.md"], "2026-10-09")).toContain(
      "architecture.md",
    );
  });
});
