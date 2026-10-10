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
    DEFAULT_ASSIGNEE: "me",
    HAS_REVIEW: a.humanReview ? "yes" : "no",
    TITLE_PREFIXES: prefixes.map((p) => `\`${p}\``).join(", "),
  };
}

export function templateFlags(f: RepoFacts, a: Answers): Record<string, boolean> {
  return {
    LINEAR: a.tracker === "linear",
    GITHUB_ISSUES: a.tracker === "github",
    MULTI_REPO: false,
    FRONTEND: f.hasFrontend,
    DESIGN_SYSTEM: !!f.designSystem,
    BACKEND: f.hasBackend || f.hasDatabase,
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
