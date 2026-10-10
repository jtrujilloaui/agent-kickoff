import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export const IGNORE = new Set([
  "node_modules", ".git", ".next", "dist", "build", "coverage", ".venv", "venv",
  "target", ".turbo", ".vercel", "out", "__pycache__", ".cache",
]);

export interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  packageManager?: string;
}

export async function readText(root: string, rel: string): Promise<string | undefined> {
  try {
    return await readFile(join(root, rel), "utf8");
  } catch {
    return undefined;
  }
}

export async function exists(root: string, rel: string): Promise<boolean> {
  try {
    await stat(join(root, rel));
    return true;
  } catch {
    return false;
  }
}

export async function isDir(root: string, rel: string): Promise<boolean> {
  try {
    return (await stat(join(root, rel))).isDirectory();
  } catch {
    return false;
  }
}

/** Entries directly inside `start` are depth 1; recurse while depth < maxDepth. */
export async function walk(
  root: string,
  start: string,
  maxDepth: number,
): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [];
  const base = start === "." || start === "" ? "" : start.replace(/\/+$/, "");

  async function visit(rel: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(join(root, rel || "."), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORE.has(e.name)) continue;
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        dirs.push(path);
        if (depth < maxDepth) await visit(path, depth + 1);
      } else if (e.isFile()) {
        files.push(path);
      }
    }
  }

  await visit(base, 1);
  return { files: files.sort(), dirs: dirs.sort() };
}
