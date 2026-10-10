/**
 * Shared data shapes. Every unit (scan, ask, plan, write, enrich) talks in
 * these and nothing else, so each can be built and tested on its own.
 */

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm" | "none";
export type Language = "typescript" | "javascript" | "python" | "go" | "rust";

export interface Commands {
  dev?: string;
  build?: string;
  test?: string;
  lint?: string;
  typecheck?: string;
  format?: string;
}

/** A directory in the repo (posix path relative to the root) and a guess at what it holds. */
export interface DirEntry {
  path: string;
  role?: string;
}

export interface DesignSystemFacts {
  /** File holding design tokens, e.g. a CSS file with a Tailwind v4 `@theme` block. */
  tokens?: string;
  /** Directory of UI primitives, e.g. `src/components/ui`. */
  primitives?: string;
  /** A design-system package found in dependencies. */
  package?: string;
}

export interface GitFacts {
  /** origin URL with any credentials stripped. */
  remote?: string;
  defaultBranch?: string;
  conventionalCommits: boolean;
}

export interface RepoFacts {
  /** Absolute path. Never written into generated files. */
  root: string;
  name: string;
  /** Kebab-case name without npm scope; used for the `<slug>-context` skill. */
  slug: string;
  description?: string;
  packageManager: PackageManager;
  languages: Language[];
  /** Human labels, e.g. "next 16 (app router)", "react 19". */
  frameworks: string[];
  /** Stable ids for logic, e.g. "next", "react", "tailwind". */
  frameworkIds: string[];
  scripts: Record<string, string>;
  /** Dependency names (deps + devDeps), sorted. */
  dependencies: string[];
  workspaces: string[];
  commands: Commands;
  structure: DirEntry[];
  routes: string[];
  dataModels: string[];
  dataSource?: "prisma" | "drizzle" | "supabase";
  /** Variable NAMES from .env.example/.sample/.template. Never values, never real .env files. */
  envVars: string[];
  designSystem?: DesignSystemFacts;
  testRunner?: string;
  ciJobs: string[];
  git: GitFacts;
  /** Existing instruction/doc files, relative paths. */
  docs: string[];
  hasFrontend: boolean;
  hasBackend: boolean;
  hasDatabase: boolean;
  isMonorepo: boolean;
  warnings: string[];
}

export type TeamShape = "solo" | "small" | "multi-squad";
export type Tracker = "linear" | "github" | "none";
export type GenerateKey = "context" | "instructions" | "agents";

/** How the developer works with agents; drives skill and section presets. */
export type WorkMode = "single" | "subagents" | "multi";

/** Sections of the generated AGENTS.md the user can toggle. */
export type SectionKey = "routing" | "workflow" | "ui" | "backend" | "verify" | "pr" | "tracker" | "git";

export interface Answers {
  teamShape: TeamShape;
  workMode: WorkMode;
  tracker: Tracker;
  linear?: { teamName: string; teamKey: string };
  humanReview: boolean;
  generate: GenerateKey[];
  sections: SectionKey[];
  /** Ids from SKILL_CATALOG (src/catalog.ts). */
  skills: string[];
  enrich: boolean;
  issueLanguage: string;
}

export type SavedAnswers = Omit<Answers, "enrich">;

/**
 * - `owned`: a file this tool owns, wrapped in markers. If it exists without
 *   markers, the new version is written beside it as `<path>.new`.
 * - `managed`: AGENTS.md / CLAUDE.md. If it exists without markers, our
 *   marked region is appended at the end.
 * - `state`: tool state (JSON); always overwritten.
 */
export type FileMode = "owned" | "managed" | "state";

export interface FilePlan {
  /** Posix path relative to the repo root. */
  path: string;
  content: string;
  mode: FileMode;
}

export type WriteAction = "new" | "update" | "append" | ".new" | "unchanged";

export interface WriteResult {
  path: string;
  /** Where the content actually went (differs from `path` for `.new`). */
  writtenPath: string;
  action: WriteAction;
}
