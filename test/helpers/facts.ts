import type { RepoFacts } from "../../src/types";

export function nextFacts(): RepoFacts {
  return {
    root: "/tmp/acme-web",
    name: "acme-web",
    slug: "acme-web",
    description: "Marketing site for Acme.",
    packageManager: "bun",
    languages: ["typescript"],
    frameworks: ["next 16 (app router)", "react 19", "tailwind 4"],
    frameworkIds: ["next", "react", "tailwind"],
    scripts: {
      dev: "next dev",
      build: "next build",
      lint: "eslint .",
      typecheck: "tsc --noEmit",
    },
    dependencies: ["next", "react", "react-dom", "tailwindcss", "typescript"],
    workspaces: [],
    commands: {
      dev: "bun run dev",
      build: "bun run build",
      lint: "bun run lint",
      typecheck: "bun run typecheck",
    },
    structure: [
      { path: "src/app", role: "routes (app router)" },
      { path: "src/components", role: "UI components" },
      { path: "public", role: "static assets" },
    ],
    routes: ["/", "/about", "/blog/[slug]"],
    dataModels: [],
    envVars: ["NEXT_PUBLIC_SITE_URL", "ANALYTICS_KEY"],
    designSystem: { tokens: "src/app/globals.css", primitives: "src/components/ui" },
    ciJobs: [],
    git: { defaultBranch: "main", conventionalCommits: true },
    docs: ["README.md"],
    hasFrontend: true,
    hasBackend: false,
    hasDatabase: false,
    isMonorepo: false,
    warnings: [],
  };
}

export function apiFacts(): RepoFacts {
  return {
    root: "/tmp/api",
    name: "api",
    slug: "api",
    packageManager: "pnpm",
    languages: ["typescript"],
    frameworks: ["nestjs 11", "prisma 6"],
    frameworkIds: ["nestjs", "prisma"],
    scripts: {
      build: "nest build",
      test: "jest",
      lint: "eslint .",
    },
    dependencies: ["@nestjs/core", "@prisma/client", "prisma"],
    workspaces: [],
    commands: {
      dev: "pnpm run start:dev",
      build: "pnpm run build",
      test: "pnpm run test",
      lint: "pnpm run lint",
    },
    structure: [
      { path: "src", role: "application code" },
      { path: "prisma", role: "schema and migrations" },
    ],
    routes: [],
    dataModels: ["User", "Order"],
    dataSource: "prisma",
    envVars: ["DATABASE_URL"],
    testRunner: "jest",
    ciJobs: [],
    git: { conventionalCommits: false },
    docs: [],
    hasFrontend: false,
    hasBackend: true,
    hasDatabase: true,
    isMonorepo: false,
    warnings: [],
  };
}
