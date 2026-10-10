import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const LINEAR_SKILLS = [
  "linear-planning",
  "linear-sync",
  "linear-project-health",
  "issue-authoring",
] as const;

const AGENT_NAMES = ["architect", "builder", "mechanic"] as const;

export interface TemplateSet {
  agents: string;
  claude: string;
  /** name -> template */
  agentFiles: Record<string, string>;
  /** linear skill name -> template */
  linear: Record<string, string>;
}

/** Walk up from this file to the first directory holding `templates/AGENTS.md`. */
export function templatesDir(from: string = dirname(fileURLToPath(import.meta.url))): string {
  let dir = from;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "templates");
    if (existsSync(join(candidate, "AGENTS.md"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate the templates directory");
}

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

export function loadTemplates(dir: string = templatesDir()): TemplateSet {
  const agentFiles: Record<string, string> = {};
  for (const n of AGENT_NAMES) agentFiles[n] = read(join(dir, "agents", `${n}.md`));
  const linear: Record<string, string> = {};
  for (const n of LINEAR_SKILLS) linear[n] = read(join(dir, "linear", `${n}.md`));
  return {
    agents: read(join(dir, "AGENTS.md")),
    claude: read(join(dir, "CLAUDE.md")),
    agentFiles,
    linear,
  };
}
