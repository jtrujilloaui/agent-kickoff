import type { RepoFacts, SectionKey, Tracker, WorkMode } from "./types";

/**
 * Every skill the wizard can put in a repo. `external` skills are installed
 * from their author's repo with the `skills` CLI (copied into the repo, never
 * re-hosted here); `generated` ones are rendered from this package's templates.
 */
export type SkillGroup = "workflow" | "design" | "linear";

export interface CatalogSkill {
  id: string;
  group: SkillGroup;
  /** One line shown as the prompt hint. */
  hint: string;
  source: { kind: "external"; repo: string; author: string } | { kind: "generated" };
  /** Only offered when this holds. */
  when?: "frontend" | "linear";
  /** Preselected for these work modes (workflow), or always when offered (design/linear). */
  preselect?: WorkMode[] | "always";
}

const SUPERPOWERS = { kind: "external", repo: "obra/superpowers", author: "Jesse Vincent" } as const;
const KREHEL = { kind: "external", repo: "jakubkrehel/skills", author: "Jakub Krehel" } as const;
const ALL: WorkMode[] = ["single", "subagents", "multi"];
const DELEGATING: WorkMode[] = ["subagents", "multi"];

export const SKILL_CATALOG: CatalogSkill[] = [
  // Planning and execution
  { id: "brainstorming", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "turn an idea into an agreed design before any code" },
  { id: "writing-plans", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "write a step-by-step implementation plan from the design" },
  { id: "executing-plans", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "execute a plan in the current session, task by task" },
  { id: "subagent-driven-development", group: "workflow", source: SUPERPOWERS, preselect: DELEGATING, hint: "one fresh subagent per task, reviewed before the next" },
  { id: "dispatching-parallel-agents", group: "workflow", source: SUPERPOWERS, preselect: ["multi"], hint: "run independent tasks in parallel agents" },
  { id: "test-driven-development", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "red, green, refactor" },
  { id: "systematic-debugging", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "root cause before any fix" },
  { id: "verification-before-completion", group: "workflow", source: SUPERPOWERS, preselect: ALL, hint: "prove it works before saying it does" },
  { id: "requesting-code-review", group: "workflow", source: SUPERPOWERS, preselect: DELEGATING, hint: "review before merging" },
  { id: "receiving-code-review", group: "workflow", source: SUPERPOWERS, preselect: DELEGATING, hint: "act on review feedback with rigor" },
  { id: "using-git-worktrees", group: "workflow", source: SUPERPOWERS, preselect: ["multi"], hint: "isolated workspace per task" },
  { id: "finishing-a-development-branch", group: "workflow", source: SUPERPOWERS, preselect: ["multi"], hint: "merge, PR or clean up when work is done" },
  { id: "writing-skills", group: "workflow", source: SUPERPOWERS, hint: "write and test new skills for this repo" },
  // Design (frontend only)
  { id: "better-ui", group: "design", source: KREHEL, when: "frontend", preselect: "always", hint: "radius, alignment, depth, icon motion, hit areas" },
  { id: "make-interfaces-feel-better", group: "design", source: { kind: "external", repo: "jakubkrehel/make-interfaces-feel-better", author: "Jakub Krehel" }, when: "frontend", preselect: "always", hint: "the small details that compound" },
  { id: "userinterface-wiki", group: "design", source: { kind: "external", repo: "raphaelsalaja/userinterface-wiki", author: "Raphael Salaja" }, when: "frontend", preselect: "always", hint: "UI/UX rules with file:line findings" },
  { id: "better-typography", group: "design", source: KREHEL, when: "frontend", hint: "type scale, spacing, wrapping" },
  { id: "better-accessibility", group: "design", source: KREHEL, when: "frontend", hint: "accessibility standards" },
  { id: "interface-review", group: "design", source: KREHEL, when: "frontend", hint: "full review across UI, type, layout, color, a11y" },
  { id: "design-lab", group: "design", source: { kind: "external", repo: "0xdesign/design-plugin", author: "0xdesign" }, when: "frontend", hint: "five variations before committing to one" },
  { id: "emil-design-eng", group: "design", source: { kind: "external", repo: "emilkowalski/skill", author: "Emil Kowalski" }, when: "frontend", hint: "polish and animation decisions" },
  // Linear (generated from templates, configured for the team)
  { id: "linear-planning", group: "linear", source: { kind: "generated" }, when: "linear", preselect: "always", hint: "goal-backward plans as projects, milestones and issues" },
  { id: "linear-sync", group: "linear", source: { kind: "generated" }, when: "linear", preselect: "always", hint: "issue status in sync while coding" },
  { id: "linear-project-health", group: "linear", source: { kind: "generated" }, when: "linear", preselect: "always", hint: "health and changelog after shipping" },
  { id: "issue-authoring", group: "linear", source: { kind: "generated" }, when: "linear", preselect: "always", hint: "one structure for every issue" },
];

export const GROUP_LABELS: Record<SkillGroup, string> = {
  workflow: "Planning & execution (superpowers)",
  design: "Design",
  linear: "Linear (configured for your team)",
};

/** Agents the external skills are copied for: Claude Code → .claude/skills, Codex + Cursor → .agents/skills. */
export const SKILL_AGENTS = ["claude-code", "codex", "cursor"] as const;

export function offeredSkills(f: RepoFacts, tracker: Tracker): CatalogSkill[] {
  return SKILL_CATALOG.filter(
    (s) => !s.when || (s.when === "frontend" ? f.hasFrontend : tracker === "linear"),
  );
}

export function presetSkills(f: RepoFacts, tracker: Tracker, mode: WorkMode): string[] {
  return offeredSkills(f, tracker)
    .filter((s) => s.preselect === "always" || (Array.isArray(s.preselect) && s.preselect.includes(mode)))
    .map((s) => s.id);
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  routing: "Plan first, route by complexity",
  workflow: "Workflow: how the installed skills chain together",
  ui: "UI work gate",
  backend: "Backend work gate",
  verify: "Verify before claiming done",
  pr: "Pull request rules",
  tracker: "Issue tracking",
  git: "Git branches and worktrees",
};

export function offeredSections(f: RepoFacts, tracker: Tracker): SectionKey[] {
  const keys: SectionKey[] = ["routing", "workflow"];
  if (f.hasFrontend) keys.push("ui");
  if (f.hasBackend || f.hasDatabase) keys.push("backend");
  keys.push("verify", "pr");
  if (tracker !== "none") keys.push("tracker");
  keys.push("git");
  return keys;
}

/** Everything offered is on by default, except worktrees outside multi-agent work. */
export function presetSections(f: RepoFacts, tracker: Tracker, mode: WorkMode): SectionKey[] {
  return offeredSections(f, tracker).filter((k) => k !== "git" || mode === "multi");
}

/** One `npx skills add` invocation per source repo, for the selected external skills. */
export function installCommands(selected: string[]): { repo: string; skills: string[]; args: string[] }[] {
  const byRepo = new Map<string, string[]>();
  for (const s of SKILL_CATALOG) {
    if (!selected.includes(s.id) || s.source.kind !== "external") continue;
    byRepo.set(s.source.repo, [...(byRepo.get(s.source.repo) ?? []), s.id]);
  }
  return [...byRepo].map(([repo, skills]) => ({
    repo,
    skills,
    args: ["-y", "skills", "add", repo, "-s", ...skills, "-a", ...SKILL_AGENTS, "--copy", "-y"],
  }));
}
