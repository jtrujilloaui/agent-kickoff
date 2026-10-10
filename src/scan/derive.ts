import { basename } from "node:path";
import type { RepoFacts } from "../types";
import { resolveCommands } from "./commands";

export function slugify(name: string): string {
  const s = name
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "project";
}

export function mergeFacts(base: Partial<RepoFacts>, partial: Partial<RepoFacts>): Partial<RepoFacts> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (cur === undefined) out[k] = v;
    else if (Array.isArray(cur) && Array.isArray(v)) out[k] = [...new Set([...cur, ...v])];
  }
  return out as Partial<RepoFacts>;
}

const FRONTEND = ["next", "react", "vue", "svelte", "astro", "remix", "vite", "expo", "react-native"];
const BACKEND = ["nestjs", "express", "hono", "fastify", "django", "fastapi", "flask"];
const DB_DEPS = [
  "prisma",
  "@prisma/client",
  "drizzle-orm",
  "@supabase/supabase-js",
  "pg",
  "mysql2",
  "mongoose",
  "typeorm",
  "sequelize",
];

export function finalize(root: string, p: Partial<RepoFacts>): RepoFacts {
  const name = p.name ?? (basename(root) || "project");
  const frameworkIds = p.frameworkIds ?? [];
  const dependencies = p.dependencies ?? [];
  const languages = p.languages ?? [];
  const workspaces = p.workspaces ?? [];
  const packageManager = p.packageManager ?? "none";
  const scripts = p.scripts ?? {};
  const facts: RepoFacts = {
    root,
    name,
    slug: slugify(name),
    packageManager,
    languages,
    frameworks: p.frameworks ?? [],
    frameworkIds,
    scripts,
    dependencies,
    workspaces,
    commands: resolveCommands({ packageManager, scripts, languages, testRunner: p.testRunner, dependencies }),
    structure: p.structure ?? [],
    routes: p.routes ?? [],
    dataModels: p.dataModels ?? [],
    envVars: p.envVars ?? [],
    ciJobs: p.ciJobs ?? [],
    git: p.git ?? { conventionalCommits: false },
    docs: p.docs ?? [],
    hasFrontend: frameworkIds.some((f) => FRONTEND.includes(f)),
    hasBackend:
      frameworkIds.some((f) => BACKEND.includes(f)) || languages.includes("go") || languages.includes("rust"),
    hasDatabase: !!p.dataSource || dependencies.some((d) => DB_DEPS.includes(d)),
    isMonorepo: workspaces.length > 0,
    warnings: p.warnings ?? [],
  };
  if (p.description !== undefined) facts.description = p.description;
  if (p.dataSource !== undefined) facts.dataSource = p.dataSource;
  if (p.designSystem !== undefined) facts.designSystem = p.designSystem;
  if (p.testRunner !== undefined) facts.testRunner = p.testRunner;
  return facts;
}
