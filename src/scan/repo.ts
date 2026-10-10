import { execFile } from "node:child_process";
import { exists } from "./fs";
import type { Detector } from "./types";

const NONE = "—";

function runGit(root: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("git", ["-C", root, ...args], { timeout: 3000 }, (err, stdout) => {
      resolve(err ? undefined : String(stdout).trim());
    });
  });
}

export function redactRemote(url: string): string {
  return url.replace(/\/\/[^/@\s]*@/, "//");
}

const CONVENTIONAL = /^(feat|fix|chore|docs|refactor|test|perf|build|ci|style|revert)(\([^)]*\))?!?: /;

export const git: Detector = {
  id: "git",
  label: "Git",
  async run({ root }) {
    if ((await runGit(root, ["rev-parse", "--is-inside-work-tree"])) !== "true") {
      return { facts: { git: { conventionalCommits: false } }, summary: "not a git repo" };
    }
    const rawRemote = await runGit(root, ["remote", "get-url", "origin"]);
    const remote = rawRemote ? redactRemote(rawRemote) : undefined;
    const head = await runGit(root, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
    const defaultBranch =
      (head ? head.replace(/^origin\//, "") : undefined) ||
      (await runGit(root, ["branch", "--show-current"])) ||
      undefined;
    const log = await runGit(root, ["log", "-30", "--format=%s"]);
    const subjects = log ? log.split("\n").filter(Boolean) : [];
    const conventionalCommits =
      subjects.length >= 3 && subjects.filter((s) => CONVENTIONAL.test(s)).length / subjects.length >= 0.6;

    const g: { remote?: string; defaultBranch?: string; conventionalCommits: boolean } = { conventionalCommits };
    if (remote) g.remote = remote;
    if (defaultBranch) g.defaultBranch = defaultBranch;
    return {
      facts: { git: g },
      summary:
        [defaultBranch, conventionalCommits ? "conventional commits" : undefined].filter(Boolean).join(" · ") ||
        "git repo",
    };
  },
};

const DOC_FILES = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".github/copilot-instructions.md",
  "CONTRIBUTING.md",
];

export const docs: Detector = {
  id: "docs",
  label: "Docs",
  async run({ root }) {
    const found: string[] = [];
    for (const f of DOC_FILES) if (await exists(root, f)) found.push(f);
    return { facts: { docs: found }, summary: found.length ? found.join(" · ") : NONE };
  },
};
