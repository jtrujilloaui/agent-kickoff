import { visibleLength } from "./ansi";
import { BLUE, MUTED, VIOLET, lerp, paint } from "./gradient";
import { sleep } from "./sleep";
import type { Out, TermCaps } from "./term";

export interface TreeItem {
  path: string;
  tag?: string;
}

interface Node {
  name: string;
  tag?: string;
  children: Map<string, Node>;
  isDir: boolean;
}

interface Row {
  prefix: string;
  name: string;
  isDir: boolean;
  depth: number;
  tag?: string;
}

export function treeLines(items: TreeItem[], caps: TermCaps): string[] {
  const root: Node = { name: "", children: new Map(), isDir: true };
  for (const item of items) {
    const parts = item.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, children: new Map(), isDir: !last };
        node.children.set(part, child);
      }
      if (last) child.tag = item.tag;
      else child.isDir = true;
      node = child;
    });
  }

  const rows: Row[] = [];
  const walk = (node: Node, depth: number, childPrefix: string) => {
    const kids = [...node.children.values()].sort(
      (a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
    );
    kids.forEach((kid, i) => {
      const isLast = i === kids.length - 1;
      const prefix = depth === 0 ? "" : childPrefix + (isLast ? "└─ " : "├─ ");
      rows.push({ prefix, name: kid.name, isDir: kid.isDir, depth, tag: kid.tag });
      if (kid.isDir) {
        const next = depth === 0 ? "" : childPrefix + (isLast ? "   " : "│  ");
        walk(kid, depth + 1, next);
      }
    });
  };
  walk(root, 0, "");

  const text = (r: Row) => r.prefix + r.name + (r.isDir ? "/" : "");
  const width = Math.max(0, ...rows.map((r) => visibleLength(text(r)))) + 2;
  const maxDepth = Math.max(0, ...rows.filter((r) => r.isDir).map((r) => r.depth));

  return rows.map((r) => {
    if (r.isDir) {
      const t = maxDepth === 0 ? 0 : r.depth / maxDepth;
      return "  " + r.prefix + paint(r.name + "/", lerp(VIOLET, BLUE, t), caps);
    }
    let line = "  " + r.prefix + r.name;
    if (r.tag) {
      const pad = " ".repeat(width - visibleLength(text(r)));
      line += pad + paint(r.tag, r.tag === "new" ? BLUE : MUTED, caps);
    }
    return line;
  });
}

export async function printStaggered(
  out: Out,
  lines: string[],
  caps: TermCaps,
  gapMs = 20,
): Promise<void> {
  for (const line of lines) {
    out.write(line + "\n");
    if (caps.motion) await sleep(gapMs);
  }
}
