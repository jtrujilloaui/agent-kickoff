import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import type { RepoFacts } from "./types";

/**
 * The optional deep-analysis step: hands the scan facts to the user's own
 * `claude` CLI, lets it read the code, and turns its answer into three
 * reference files.
 *
 * Claude gets read-only tools (Read, Grep, Glob) and never writes to disk.
 * Path-scoped `Write(...)` permission rules are not honoured by `claude -p`
 * on Windows (verified 2026-10-09 against 2.1.296), so instead of trusting a
 * scope, Claude returns the files inside FILE blocks in its final message and
 * this module writes them, only to the three known paths.
 */

export const ENRICH_FILES = ["architecture.md", "flows.md", "gotchas.md"] as const;
export type EnrichFile = (typeof ENRICH_FILES)[number];

export type EnrichEvent =
  | { type: "tool"; label: string }
  | { type: "wrote"; path: string }
  | { type: "done"; ok: boolean; message?: string };

export interface EnrichResult {
  ok: boolean;
  /** File names (from ENRICH_FILES) actually written. */
  written: EnrichFile[];
  message?: string;
}

export interface EnrichOptions {
  /** Executable to run (the resolved `claude` path, or a test double). */
  command: string;
  /** Args placed before ours, e.g. a script path when `command` is node/bun. */
  prefixArgs?: string[];
  env?: NodeJS.ProcessEnv;
}

export const referencesDir = (slug: string) => `.claude/skills/${slug}-context/references`;

/** Facts minus anything machine-specific or bulky, for the prompt. */
function factsForPrompt(f: RepoFacts) {
  const { root: _root, dependencies, structure, ...rest } = f;
  return { ...rest, dependencies: dependencies.slice(0, 80), structure: structure.slice(0, 40) };
}

export function buildPrompt(f: RepoFacts): string {
  return [
    `You are documenting the ${f.name} repository so coding agents can work in it well. A static scan already collected the facts below; trust them and go deeper by reading the code.`,
    "",
    "```json",
    JSON.stringify(factsForPrompt(f), null, 2),
    "```",
    "",
    "Use only Read, Grep and Glob. Do not try to write or edit any file.",
    "",
    "Produce exactly three markdown documents:",
    "1. architecture.md: the main modules, what each owns, and how they connect. Name real files.",
    "2. flows.md: the 3 to 6 most important request or data flows, step by step, each step anchored as `path:line`.",
    "3. gotchas.md: non-obvious rules, legacy areas not to copy, sharp edges, and anything a new engineer would get wrong here.",
    "",
    "Be concrete and short (each document under 150 lines). Do not invent behaviour you did not read.",
    "",
    "Your final message must contain only the three documents, each wrapped exactly like this:",
    "=== FILE: architecture.md ===",
    "<markdown>",
    "=== END FILE ===",
  ].join("\n");
}

export function enrichArgs(): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    // Explicit, so a user-level `defaultMode: bypassPermissions` can't widen it.
    "--permission-mode",
    "default",
    "--allowedTools",
    "Read",
    "Grep",
    "Glob",
    "--disallowedTools",
    "Write",
    "Edit",
    "NotebookEdit",
    "Bash",
    "WebFetch",
    "WebSearch",
  ];
}

/** Pulls `=== FILE: name === … === END FILE ===` blocks out of Claude's final text. */
export function parseFileBlocks(text: string): Partial<Record<EnrichFile, string>> {
  const out: Partial<Record<EnrichFile, string>> = {};
  const re = /^=== FILE: ([\w.-]+) ===\r?\n([\s\S]*?)\r?\n=== END FILE ===/gm;
  for (const m of text.matchAll(re)) {
    const name = m[1] as EnrichFile;
    if ((ENRICH_FILES as readonly string[]).includes(name)) out[name] = m[2].trim() + "\n";
  }
  return out;
}

function relTo(p: string, root: string): string {
  const n = p.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/$/, "");
  return n.toLowerCase().startsWith(r.toLowerCase() + "/") ? n.slice(r.length + 1) : n;
}

type StreamMessage = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: unknown;
  message?: { content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }> };
};

/** One stream-json line → zero or more events. `result` carries Claude's final text. */
export function parseStreamLine(
  line: string,
  root: string,
): { events: EnrichEvent[]; result?: { ok: boolean; text: string } } {
  let msg: StreamMessage;
  try {
    msg = JSON.parse(line) as StreamMessage;
  } catch {
    return { events: [] };
  }
  if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
    const events: EnrichEvent[] = [];
    for (const c of msg.message.content) {
      if (c?.type !== "tool_use") continue;
      const input = c.input ?? {};
      const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
      if (c.name === "Read") events.push({ type: "tool", label: `Reading ${relTo(s("file_path"), root)}` });
      else if (c.name === "Grep") events.push({ type: "tool", label: `Searching "${s("pattern")}"` });
      else if (c.name === "Glob") events.push({ type: "tool", label: `Listing ${s("pattern")}` });
      else if (c.name) events.push({ type: "tool", label: c.name });
    }
    return { events };
  }
  if (msg.type === "result") {
    const ok = msg.subtype === "success" && !msg.is_error;
    return { events: [], result: { ok, text: typeof msg.result === "string" ? msg.result : "" } };
  }
  return { events: [] };
}

/** Finds `claude` on PATH (claude.exe / claude.cmd on Windows). */
export function findClaude(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string | null {
  const dirs = (env.PATH ?? env.Path ?? "").split(platform === "win32" ? ";" : delimiter).filter(Boolean);
  const names = platform === "win32" ? ["claude.exe", "claude.cmd", "claude"] : ["claude"];
  for (const d of dirs) for (const n of names) if (existsSync(join(d, n))) return join(d, n);
  return null;
}

const quote = (a: string) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

export function runEnrich(
  root: string,
  f: RepoFacts,
  onEvent: (e: EnrichEvent) => void,
  o: EnrichOptions,
): { done: Promise<EnrichResult>; cancel: () => void } {
  const args = [...(o.prefixArgs ?? []), ...enrichArgs()];
  // npm-installed `claude.cmd` shims need a shell on Windows; the prompt goes
  // over stdin, so no argument ever carries user text through that shell.
  const shell = /\.(cmd|bat)$/i.test(o.command);
  const child = spawn(shell ? [o.command, ...args].map(quote).join(" ") : o.command, shell ? [] : args, {
    cwd: root,
    env: o.env ?? process.env,
    shell,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let buf = "";
  let stderr = "";
  let final: { ok: boolean; text: string } | undefined;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const { events, result } = parseStreamLine(buf.slice(0, i), root);
      buf = buf.slice(i + 1);
      events.forEach(onEvent);
      if (result) final = result;
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (d: string) => {
    stderr += d;
  });
  child.stdin.on("error", () => {});
  child.stdin.end(buildPrompt(f));

  const done = new Promise<EnrichResult>((resolve) => {
    child.on("error", (err) => resolve({ ok: false, written: [], message: err.message }));
    child.on("close", async (code) => {
      if (buf.trim()) {
        const { result } = parseStreamLine(buf, root);
        if (result) final = result;
      }
      const lastErr = stderr.trim().split("\n").pop();
      if (!final) {
        resolve({ ok: false, written: [], message: lastErr || `claude exited with code ${code}` });
        return;
      }
      const files = parseFileBlocks(final.text);
      const names = ENRICH_FILES.filter((n) => files[n]);
      if (!names.length) {
        resolve({ ok: false, written: [], message: "Claude finished without returning any document" });
        return;
      }
      const dir = join(root, referencesDir(f.slug));
      await mkdir(dir, { recursive: true });
      for (const n of names) {
        await writeFile(join(dir, n), files[n]!);
        onEvent({ type: "wrote", path: `${referencesDir(f.slug)}/${n}` });
      }
      onEvent({ type: "done", ok: final.ok });
      resolve({ ok: true, written: names, message: final.ok ? undefined : "Claude reported an error, kept what it returned" });
    });
  });

  return { done, cancel: () => child.kill() };
}
