import { describe, expect, test } from "bun:test";
import { defaultAnswers } from "../src/ask";
import { offeredSkills } from "../src/catalog";
import { apiFacts, nextFacts } from "./helpers/facts";
import type { SavedAnswers } from "../src/types";

describe("defaultAnswers presets", () => {
  test("defaults to subagents and all three outputs", () => {
    const a = defaultAnswers(nextFacts());
    expect(a.workMode).toBe("subagents");
    expect(a.generate).toEqual(["context", "instructions", "agents"]);
    expect(a.skills).toContain("subagent-driven-development");
    expect(a.skills).toContain("better-ui");
    expect(a.sections).not.toContain("git");
  });

  test("single: executing-plans, no subagent-driven-development", () => {
    const a = defaultAnswers(nextFacts(), { workMode: "single" });
    expect(a.skills).toContain("executing-plans");
    expect(a.skills).not.toContain("subagent-driven-development");
    expect(a.sections).not.toContain("git");
  });

  test("multi: parallel agents, worktrees and the git section", () => {
    const a = defaultAnswers(nextFacts(), { workMode: "multi" });
    expect(a.skills).toContain("dispatching-parallel-agents");
    expect(a.skills).toContain("using-git-worktrees");
    expect(a.sections).toContain("git");
  });

  test("design skills are offered only for frontends", () => {
    const design = (f: ReturnType<typeof nextFacts>) => offeredSkills(f, "none").filter((s) => s.group === "design");
    expect(design(nextFacts()).length).toBeGreaterThan(0);
    expect(design(apiFacts())).toEqual([]);
    expect(defaultAnswers(apiFacts()).skills).not.toContain("better-ui");
  });
});

describe("saved answers", () => {
  test("v0.1 shape does not crash and drops the removed 'design' key", () => {
    const v01 = { teamShape: "small", tracker: "none", humanReview: true, generate: ["context", "design"], issueLanguage: "English" };
    const a = defaultAnswers(nextFacts(), v01 as unknown as Partial<SavedAnswers>);
    expect(a.generate).toEqual(["context"]);
    expect(a.teamShape).toBe("small");
    expect(a.workMode).toBe("subagents");
    expect(a.skills.length).toBeGreaterThan(0);
    expect(a.sections.length).toBeGreaterThan(0);
  });

  test("saved sections and skills are filtered to what is offered", () => {
    const a = defaultAnswers(apiFacts(), { sections: ["ui", "verify"], skills: ["better-ui", "writing-plans"] });
    expect(a.sections).toEqual(["verify"]);
    expect(a.skills).toEqual(["writing-plans"]);
  });
});
