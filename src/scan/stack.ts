import type { RepoFacts } from "../types";
import { exists, isDir, readText, walk } from "./fs";
import type { Detector } from "./types";

const NONE = "—";

const TABLE: [id: string, dep: string][] = [
  ["next", "next"],
  ["remix", "@remix-run/react"],
  ["astro", "astro"],
  ["expo", "expo"],
  ["react-native", "react-native"],
  ["react", "react"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["vite", "vite"],
  ["nestjs", "@nestjs/core"],
  ["express", "express"],
  ["hono", "hono"],
  ["fastify", "fastify"],
  ["tailwind", "tailwindcss"],
  ["prisma", "prisma"],
  ["prisma", "@prisma/client"],
  ["drizzle", "drizzle-orm"],
  ["supabase", "@supabase/supabase-js"],
];

export const frameworks: Detector = {
  id: "frameworks",
  label: "Stack",
  async run({ root, pkg }) {
    const ranges: Record<string, string> = { ...pkg?.devDependencies, ...pkg?.dependencies };
    const ids: string[] = [];
    const labels: string[] = [];
    const add = (id: string, range?: string) => {
      if (ids.includes(id)) return;
      ids.push(id);
      let label = id;
      const major = range?.match(/\d+/)?.[0];
      if (major) label += ` ${major}`;
      labels.push(label);
    };
    for (const [id, dep] of TABLE) {
      if (dep in ranges) {
        if (ids.includes(id)) continue;
        add(id, ranges[dep]);
        if (id === "next") {
          const app = (await isDir(root, "app")) || (await isDir(root, "src/app"));
          labels[labels.length - 1] += app ? " (app router)" : " (pages router)";
        }
      }
    }
    if (!ids.includes("supabase") && (await exists(root, "supabase/config.toml"))) add("supabase");

    const facts: Partial<RepoFacts> = {};
    if (ids.length) {
      facts.frameworkIds = ids;
      facts.frameworks = labels;
    }
    return { facts, summary: labels.slice(0, 4).join(" · ") || NONE };
  },
};

export const designSystem: Detector = {
  id: "designSystem",
  label: "Design",
  async run({ root, pkg }) {
    const { files } = await walk(root, ".", 4);
    let tokens: string | undefined;
    for (const f of files.filter((f) => /\.(css|scss)$/.test(f))) {
      if ((await readText(root, f))?.includes("@theme")) {
        tokens = f;
        break;
      }
    }
    tokens ??= files.find((f) => /(^|\/)tokens\.(json|ts|js|css)$/.test(f));

    let primitives: string | undefined;
    for (const d of ["src/components/ui", "components/ui", "src/ui"]) {
      if (await isDir(root, d)) {
        primitives = d;
        break;
      }
    }
    const deps = Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies });
    const dsPkg = deps.find((d) => /(^|[/-])(ds|design-system)$/.test(d));

    if (!tokens && !primitives && !dsPkg) return { facts: {}, summary: NONE };
    const ds: NonNullable<RepoFacts["designSystem"]> = {};
    if (tokens) ds.tokens = tokens;
    if (primitives) ds.primitives = primitives;
    if (dsPkg) ds.package = dsPkg;
    return {
      facts: { designSystem: ds },
      summary: [tokens && "tokens", primitives && "primitives", dsPkg && "package"].filter(Boolean).join(" · "),
    };
  },
};

export const testsCi: Detector = {
  id: "testsCi",
  label: "Tests & CI",
  async run({ root, pkg }) {
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    let testRunner: string | undefined;
    for (const [dep, name] of [
      ["vitest", "vitest"],
      ["jest", "jest"],
      ["@playwright/test", "playwright"],
      ["mocha", "mocha"],
    ] as const) {
      if (dep in deps) {
        testRunner = name;
        break;
      }
    }
    if (!testRunner && pkg?.scripts?.test?.includes("bun test")) testRunner = "bun test";

    const { files } = await walk(root, ".github/workflows", 1);
    const ciJobs = files
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => f.split("/").pop()!.replace(/\.ya?ml$/, ""));

    const facts: Partial<RepoFacts> = { ciJobs };
    if (testRunner) facts.testRunner = testRunner;
    const parts = [testRunner, ciJobs.length ? `${ciJobs.length} workflows` : undefined].filter(Boolean);
    return { facts, summary: parts.join(" · ") || NONE };
  },
};
