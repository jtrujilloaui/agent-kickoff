import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FilePlan, WriteAction, WriteResult } from "./types";
import { mergeMarked } from "./plan/markers";

async function readExisting(path: string): Promise<string | undefined> {
  try {
    return (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}

export async function applyPlan(
  root: string,
  plans: FilePlan[],
  opts: { dryRun: boolean },
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];

  for (const p of plans) {
    const existing = await readExisting(join(root, p.path));
    let action: WriteAction;
    let target = p.path;
    let content = p.content;

    if (existing === undefined) {
      action = "new";
    } else if (p.mode === "state") {
      action = existing === p.content ? "unchanged" : "update";
    } else {
      const merged = mergeMarked(existing, p.content);
      if (merged !== null) {
        content = merged;
        action = merged === existing ? "unchanged" : "update";
      } else if (p.mode === "managed") {
        content = existing.trimEnd() + "\n\n" + p.content;
        action = "append";
      } else {
        target = `${p.path}.new`;
        action = ".new";
      }
    }

    if (!opts.dryRun && action !== "unchanged") {
      const out = join(root, target);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, content, "utf8");
    }
    results.push({ path: p.path, writtenPath: target, action });
  }
  return results;
}
