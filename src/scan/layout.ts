import type { DirEntry, RepoFacts } from "../types";
import { readText, walk } from "./fs";
import type { Detector } from "./types";

const NONE = "—";

const ROLES: Record<string, string> = {
  src: "application source",
  "src/app": "routes (app router)",
  app: "application code or routes",
  pages: "routes (pages router)",
  "src/pages": "routes (pages router)",
  "src/components": "UI components",
  components: "UI components",
  "src/lib": "shared utilities",
  lib: "shared utilities",
  "src/hooks": "React hooks",
  public: "static assets",
  content: "content files",
  scripts: "build and maintenance scripts",
  prisma: "Prisma schema and migrations",
  supabase: "Supabase config and migrations",
  "supabase/migrations": "SQL migrations",
  migrations: "database migrations",
  test: "tests",
  tests: "tests",
  __tests__: "tests",
  e2e: "end-to-end tests",
  docs: "documentation",
  ".github": "GitHub config and CI",
  ".github/workflows": "CI workflows",
  "src/modules": "feature modules",
  "src/server": "server code",
  server: "server code",
  api: "API",
  "src/api": "API",
  packages: "workspace packages",
  apps: "workspace apps",
  styles: "stylesheets",
  "src/styles": "stylesheets",
  ".claude": "agent config",
};

export const structure: Detector = {
  id: "structure",
  label: "Structure",
  async run({ root }) {
    const { dirs } = await walk(root, ".", 2);
    const kept = dirs
      .filter((d) => d.split("/").every((s) => !s.startsWith(".") || s === ".github" || s === ".claude"))
      .slice(0, 40);
    const entries: DirEntry[] = kept.map((path) => {
      const role = ROLES[path];
      return role ? { path, role } : { path };
    });
    const top = kept.filter((d) => !d.includes("/")).length;
    return { facts: { structure: entries }, summary: `${top} top-level dirs` };
  },
};

const APP_RE = /^(?:src\/)?app\/(?:(.*)\/)?page\.(?:tsx|ts|jsx|js|mdx)$/;
const PAGES_RE = /^(?:src\/)?pages\/(.+)\.(?:tsx|ts|jsx|js)$/;

export function appRoute(file: string): string | undefined {
  const m = APP_RE.exec(file);
  if (!m) return undefined;
  const segs = (m[1] ?? "").split("/").filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return "/" + segs.join("/");
}

export function pagesRoute(file: string): string | undefined {
  const m = PAGES_RE.exec(file);
  if (!m) return undefined;
  const segs = m[1].split("/");
  if (segs[0] === "api" || segs.some((s) => s.startsWith("_"))) return undefined;
  if (segs[segs.length - 1] === "index") segs.pop();
  return "/" + segs.join("/");
}

export const routes: Detector = {
  id: "routes",
  label: "Routes",
  async run({ root }) {
    const found = new Set<string>();
    for (const start of ["app", "src/app", "pages", "src/pages"]) {
      const { files } = await walk(root, start, 10);
      for (const f of files) {
        const r = appRoute(f) ?? pagesRoute(f);
        if (r) found.add(r);
      }
    }
    const { files } = await walk(root, "src", 6);
    for (const f of files.filter((f) => f.endsWith(".controller.ts"))) {
      const text = await readText(root, f);
      if (!text) continue;
      for (const m of text.matchAll(/@Controller\(\s*(?:["'`]([^"'`]*)["'`])?\s*\)/g)) {
        const p = (m[1] ?? "").replace(/^\/+|\/+$/g, "");
        found.add("/" + p);
      }
    }
    const list = [...found].sort().slice(0, 50);
    return { facts: { routes: list }, summary: list.length ? `${list.length} routes` : NONE };
  },
};

export const data: Detector = {
  id: "data",
  label: "Data",
  async run({ root, pkg }) {
    const models: Record<"prisma" | "drizzle" | "supabase", string[]> = {
      prisma: [],
      drizzle: [],
      supabase: [],
    };
    const prisma = await readText(root, "prisma/schema.prisma");
    if (prisma) for (const m of prisma.matchAll(/^model\s+(\w+)/gm)) models.prisma.push(m[1]);

    if (pkg && "drizzle-orm" in { ...pkg.dependencies, ...pkg.devDependencies }) {
      const { files } = await walk(root, ".", 4);
      for (const f of files.filter((f) => /schema.*\.ts$/.test(f.split("/").pop()!))) {
        const text = await readText(root, f);
        if (!text) continue;
        for (const m of text.matchAll(/(?:pg|mysql|sqlite)Table\(\s*["'`](\w+)/g)) models.drizzle.push(m[1]);
      }
    }

    const { files: migrations } = await walk(root, "supabase/migrations", 1);
    for (const f of migrations.filter((f) => f.endsWith(".sql"))) {
      const text = await readText(root, f);
      if (!text) continue;
      for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)/gi)) {
        models.supabase.push(m[1]);
      }
    }

    const dataSource = (["prisma", "drizzle", "supabase"] as const).find((k) => models[k].length > 0);
    const all = [...new Set(Object.values(models).flat())].sort().slice(0, 60);
    const facts: Partial<RepoFacts> = { dataModels: all };
    if (dataSource) facts.dataSource = dataSource;
    return {
      facts,
      summary: dataSource ? `${dataSource} · ${all.length} models` : NONE,
    };
  },
};

const ENV_FILES = [".env.example", ".env.sample", ".env.template"];

export const env: Detector = {
  id: "env",
  label: "Env",
  async run({ root }) {
    const names = new Set<string>();
    let any = false;
    for (const f of ENV_FILES) {
      const text = await readText(root, f);
      if (text === undefined) continue;
      any = true;
      for (const m of text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)) names.add(m[1]);
    }
    const list = [...names].sort();
    return {
      facts: { envVars: list },
      summary: any ? `${list.length} names (values never read)` : NONE,
    };
  },
};
