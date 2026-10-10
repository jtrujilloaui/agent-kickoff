import { GROUP_LABELS, SKILL_CATALOG, type SkillGroup } from "../catalog";
import type { Answers, RepoFacts } from "../types";
import { checkCommands, stackSummary } from "./context";

export function templateVars(f: RepoFacts, a: Answers): Record<string, string> {
  const c = f.commands;
  const labelled: [string, string | undefined][] = [
    ["Dev", c.dev],
    ["Typecheck", c.typecheck],
    ["Lint", c.lint],
    ["Test", c.test],
    ["Build", c.build],
    ["Format", c.format],
  ];
  const lines = labelled.filter(([, cmd]) => !!cmd).map(([l, cmd]) => `- ${l}: \`${cmd}\``);
  const checks = checkCommands(f);
  const linear = a.tracker === "linear" ? a.linear : undefined;

  const prefixes = [
    ...(f.hasFrontend ? ["Frontend:"] : []),
    ...(f.hasBackend || f.hasDatabase ? ["Backend:"] : []),
    ...(f.hasDatabase ? ["Migration:"] : []),
    "Tests:",
    "Docs:",
  ];

  return {
    PROJECT_NAME: f.name,
    PROJECT_DESCRIPTION: f.description ?? "",
    SLUG: f.slug,
    PACKAGE_MANAGER: f.packageManager === "none" ? "the project's native tooling" : f.packageManager,
    COMMANDS_LIST: lines.length ? lines.join("\n") : "- No scripts detected; ask before assuming commands.",
    CHECK_COMMANDS: checks.length
      ? checks.map((x) => `\`${x}\``).join(", ")
      : "the project's checks (none detected; ask which to run)",
    DEFAULT_BRANCH: f.git.defaultBranch ?? "main",
    DESIGN_SYSTEM_RULE: designSystemRule(f),
    REVIEW_NOTE_BACKEND: a.humanReview
      ? ""
      : " Changes may land without human review, so this gate is the only check.",
    TEAM_NAME: linear?.teamName ?? "",
    TEAM_KEY: linear?.teamKey ?? "",
    REPOS: `\`${f.slug}\` (this repo: ${stackSummary(f)})`,
    ISSUE_LANGUAGE: a.issueLanguage,
    TEAM_SHAPE: a.teamShape,
    HAS_REVIEW: a.humanReview ? "yes" : "no",
    TITLE_PREFIXES: prefixes.map((p) => `\`${p}\``).join(", "),
    WORK_MODE_NOTE: workModeNote(a),
    WORKFLOW_STEPS: workflowSteps(a),
    SKILLS_LIST: skillsList(a),
  };
}

export function templateFlags(f: RepoFacts, a: Answers): Record<string, boolean> {
  return {
    LINEAR: a.tracker === "linear",
    GITHUB_ISSUES: a.tracker === "github",
    MULTI_REPO: false,
    FRONTEND: f.hasFrontend,
    DESIGN_SYSTEM: !!f.designSystem,
    AGENTS: a.generate.includes("agents"),
    ROUTING: a.sections.includes("routing"),
    WORKFLOW: a.sections.includes("workflow"),
    UI: a.sections.includes("ui") && f.hasFrontend,
    BACKEND: a.sections.includes("backend") && (f.hasBackend || f.hasDatabase),
    VERIFY: a.sections.includes("verify"),
    PR: a.sections.includes("pr"),
    TRACKER: a.sections.includes("tracker"),
    GIT: a.sections.includes("git"),
    HUMAN_REVIEW: a.humanReview,
  };
}

/** "Use `@acme/ds`: tokens in `src/app/globals.css`, primitives in `src/components/ui`." with only the parts found. */
export function designSystemRule(f: RepoFacts): string {
  const ds = f.designSystem;
  if (!ds) return "";
  const where = [ds.tokens && `tokens in \`${ds.tokens}\``, ds.primitives && `primitives in \`${ds.primitives}\``].filter(Boolean);
  const subject = ds.package ? `\`${ds.package}\`` : "the project's design system";
  return `Use ${subject}${where.length ? `: ${where.join(", ")}` : ""}.`;
}

const tick = (id: string) => `\`${id}\``;

/** How this repo's agents are meant to work; names a skill only if it is installed. */
export function workModeNote(a: Answers): string {
  const has = (id: string) => a.skills.includes(id);
  if (a.workMode === "single") {
    const plan = has("writing-plans") ? `plan with the ${tick("writing-plans")} skill` : "write a plan";
    const run = has("executing-plans")
      ? `execute it yourself with ${tick("executing-plans")}`
      : "execute it yourself";
    return `You work in one session: ${plan}, then ${run}.`;
  }
  const where = a.generate.includes("agents") ? "the subagents below" : "subagents";
  const sdd = has("subagent-driven-development") ? ` with ${tick("subagent-driven-development")}` : "";
  let note = `Delegate well-scoped tasks to ${where}; for a written plan, run one fresh subagent per task${sdd} and review each before the next.`;
  if (a.workMode === "multi") {
    const par = has("dispatching-parallel-agents") ? ` (${tick("dispatching-parallel-agents")})` : "";
    const wt = has("using-git-worktrees") ? ` (${tick("using-git-worktrees")})` : "";
    note += ` Independent tasks run in parallel${par}, each in its own git worktree${wt}.`;
  }
  return note;
}

/** Numbered list built only from installed skills. */
export function workflowSteps(a: Answers): string {
  const has = (id: string) => a.skills.includes(id);
  const steps: string[] = [];
  if (has("brainstorming")) steps.push(`New idea or behavior: ${tick("brainstorming")} (agree the design first).`);
  if (has("writing-plans")) steps.push(`Plan: ${tick("writing-plans")} (plan saved under \`docs/plans/\`).`);
  const exec =
    has("subagent-driven-development") && a.workMode !== "single"
      ? "subagent-driven-development"
      : has("executing-plans")
        ? "executing-plans"
        : undefined;
  if (exec) steps.push(`Execute: ${tick(exec)}.`);
  if (a.workMode === "multi") {
    if (has("dispatching-parallel-agents")) {
      steps.push(`Parallel work: ${tick("dispatching-parallel-agents")} for independent tasks.`);
    }
    if (has("using-git-worktrees")) steps.push(`Isolation: ${tick("using-git-worktrees")}, one worktree per task.`);
  }
  if (has("test-driven-development")) steps.push(`While building: ${tick("test-driven-development")}.`);
  if (has("systematic-debugging")) steps.push(`Bugs: ${tick("systematic-debugging")} (root cause before any fix).`);
  if (has("verification-before-completion")) {
    steps.push(`Before done: ${tick("verification-before-completion")}.`);
  }
  const review = ["requesting-code-review", "receiving-code-review"].filter(has).map(tick);
  if (review.length) steps.push(`Review: ${review.join(" / ")}.`);
  if (has("finishing-a-development-branch")) {
    steps.push(`Wrap up: ${tick("finishing-a-development-branch")}.`);
  }
  if (!steps.length) {
    return "No workflow skills installed; plan before multi-file changes and verify before claiming done.";
  }
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

/** Selected catalog skills, grouped, with credit for external authors. */
export function skillsList(a: Answers): string {
  const blocks: string[] = [];
  for (const group of Object.keys(GROUP_LABELS) as SkillGroup[]) {
    const rows = SKILL_CATALOG.filter((s) => s.group === group && a.skills.includes(s.id)).map((s) =>
      s.source.kind === "external"
        ? `- ${tick(s.id)}: ${s.hint} (by ${s.source.author})`
        : `- ${tick(s.id)}: ${s.hint}`,
    );
    if (rows.length) blocks.push(`**${GROUP_LABELS[group]}**\n\n${rows.join("\n")}`);
  }
  return blocks.length ? blocks.join("\n\n") : "- None yet. Re-run `bunx agent-kickoff` to add some.";
}
