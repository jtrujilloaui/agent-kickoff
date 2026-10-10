import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Answers, FilePlan, RepoFacts, SavedAnswers } from "../types";
import {
  commandsMd,
  contextSkill,
  conventionsMd,
  dataMd,
  hasDataRef,
  stackMd,
  structureMd,
} from "./context";
import { wrap } from "./markers";
import { render } from "./render";
import { LINEAR_SKILLS, type TemplateSet } from "./templates";
import { templateFlags, templateVars } from "./vars";

export interface PlanInput {
  facts: RepoFacts;
  answers: Answers;
  templates: TemplateSet;
  version: string;
  enriched?: string[];
  date?: string;
}

export const savedStatePath = ".claude/agent-kickoff.json";

export function planFiles(i: PlanInput): FilePlan[] {
  const { facts: f, answers: a, templates: t } = i;
  const date = i.date ?? new Date().toISOString().slice(0, 10);
  const vars = templateVars(f, a);
  const flags = templateFlags(f, a);
  const plans: FilePlan[] = [];
  const owned = (path: string, content: string) =>
    plans.push({ path, content: wrap(content), mode: "owned" });

  if (a.generate.includes("context")) {
    const base = `.claude/skills/${f.slug}-context`;
    owned(`${base}/SKILL.md`, contextSkill(f, i.enriched ?? [], date));
    owned(`${base}/references/stack.md`, stackMd(f));
    owned(`${base}/references/commands.md`, commandsMd(f));
    owned(`${base}/references/structure.md`, structureMd(f));
    if (hasDataRef(f)) owned(`${base}/references/data.md`, dataMd(f));
    owned(`${base}/references/conventions.md`, conventionsMd(f));
  }

  if (a.generate.includes("instructions")) {
    plans.push({ path: "AGENTS.md", content: wrap(render(t.agents, vars, flags)), mode: "managed" });
    plans.push({ path: "CLAUDE.md", content: wrap(render(t.claude, vars, flags)), mode: "managed" });
  }

  if (a.generate.includes("agents")) {
    for (const [name, tpl] of Object.entries(t.agentFiles)) {
      owned(`.claude/agents/${name}.md`, render(tpl, vars, flags));
    }
  }

  if (a.generate.includes("linear") && a.tracker === "linear") {
    for (const name of LINEAR_SKILLS) {
      owned(`.claude/skills/${name}/SKILL.md`, render(t.linear[name], vars, flags));
    }
  }

  const { enrich: _enrich, ...saved } = a;
  plans.push({
    path: savedStatePath,
    content: JSON.stringify({ version: i.version, savedAt: date, answers: saved }, null, 2) + "\n",
    mode: "state",
  });
  return plans;
}

export async function loadSaved(root: string): Promise<SavedAnswers | undefined> {
  try {
    const raw = JSON.parse(await readFile(join(root, savedStatePath), "utf8"));
    const x = raw?.answers;
    if (
      !x ||
      typeof x.teamShape !== "string" ||
      typeof x.tracker !== "string" ||
      !Array.isArray(x.generate)
    ) {
      return undefined;
    }
    return x as SavedAnswers;
  } catch {
    return undefined;
  }
}
