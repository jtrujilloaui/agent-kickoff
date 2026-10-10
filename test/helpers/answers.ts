import { offeredSkills } from "../../src/catalog";
import type { Answers } from "../../src/types";
import { nextFacts } from "./facts";

export const ALL_SECTIONS: Answers["sections"] = [
  "routing",
  "workflow",
  "ui",
  "backend",
  "verify",
  "pr",
  "tracker",
  "git",
];

export function answers(over: Partial<Answers> = {}): Answers {
  return {
    teamShape: "small",
    workMode: "subagents",
    tracker: "linear",
    linear: { teamName: "Web", teamKey: "WEB" },
    humanReview: true,
    generate: ["context", "instructions", "agents"],
    sections: [...ALL_SECTIONS],
    skills: offeredSkills(nextFacts(), "linear").map((s) => s.id),
    enrich: false,
    issueLanguage: "English",
    ...over,
  };
}
