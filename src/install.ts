import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { installCommands } from "./catalog";

export type InstallCommand = ReturnType<typeof installCommands>[number];

export type InstallEvent =
  | { type: "start"; repo: string; skills: string[] }
  | { type: "done"; repo: string; ok: boolean; message?: string };

export interface InstallResult {
  installed: string[];
  failed: { repo: string; message: string }[];
}

export const skillPath = (id: string) => `.claude/skills/${id}/SKILL.md`;

/** Paths in the result tree: the Claude copy and the Codex/Cursor mirror. */
export function installedPaths(ids: string[]): string[] {
  return ids.flatMap((id) => [skillPath(id), `.agents/skills/${id}/SKILL.md`]);
}

const quote = (a: string) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function runOne(root: string, cmd: InstallCommand, command: string, prefix: string[]): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const shell = process.platform === "win32";
    const args = [...prefix, ...cmd.args];
    const child = spawn(shell ? [command, ...args].map(quote).join(" ") : command, shell ? [] : args, {
      cwd: root,
      shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", CI: "1" },
    });
    let log = "";
    for (const s of [child.stdout, child.stderr]) {
      s.setEncoding("utf8");
      s.on("data", (d: string) => {
        log += d;
      });
    }
    const last = () => log.trim().split(/\r?\n/).filter(Boolean).pop();
    child.on("error", (err) => resolve({ ok: false, message: err.message }));
    child.on("close", (code) =>
      resolve(code === 0 ? { ok: true } : { ok: false, message: last() || `exited with code ${code}` }),
    );
  });
}

/** Runs the commands one after another; a failed repo does not stop the next. */
export async function runInstall(
  root: string,
  cmds: InstallCommand[],
  onEvent: (e: InstallEvent) => void,
  opts: { command?: string; prefixArgs?: string[] } = {},
): Promise<InstallResult> {
  const command = opts.command ?? "npx";
  const failed: InstallResult["failed"] = [];
  for (const cmd of cmds) {
    onEvent({ type: "start", repo: cmd.repo, skills: cmd.skills });
    const r = await runOne(root, cmd, command, opts.prefixArgs ?? []);
    if (!r.ok) failed.push({ repo: cmd.repo, message: r.message ?? "failed" });
    onEvent({ type: "done", repo: cmd.repo, ok: r.ok, message: r.message });
  }
  const installed = cmds.flatMap((c) => c.skills).filter((id) => existsSync(join(root, skillPath(id))));
  return { installed, failed };
}
