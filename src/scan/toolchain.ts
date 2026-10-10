import type { Language, PackageManager, RepoFacts } from "../types";
import { exists, readText } from "./fs";
import type { Detector, ScanCtx } from "./types";

const NONE = "—";

const LOCKFILES: [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

export const packageManager: Detector = {
  id: "packageManager",
  label: "Toolchain",
  async run({ root, pkg }) {
    let pm: PackageManager | undefined;
    for (const [file, name] of LOCKFILES) {
      if (await exists(root, file)) {
        pm = name;
        break;
      }
    }
    if (!pm && pkg?.packageManager) {
      const prefix = pkg.packageManager.split("@")[0];
      if (prefix === "bun" || prefix === "pnpm" || prefix === "yarn" || prefix === "npm") pm = prefix;
    }
    if (!pm) pm = pkg ? "npm" : "none";
    return { facts: { packageManager: pm }, summary: pm === "none" ? NONE : pm };
  },
};

function workspaceGlobs(pkg: NonNullable<ScanCtx["pkg"]>): string[] {
  const w = pkg.workspaces;
  if (Array.isArray(w)) return w;
  return w?.packages ?? [];
}

export const nodePackage: Detector = {
  id: "nodePackage",
  label: "Package",
  async run({ root, pkg }) {
    if (!pkg) return { facts: {}, summary: "no package.json" };
    const scripts = pkg.scripts ?? {};
    const dependencies = [
      ...new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]),
    ].sort();
    const workspaces = [...workspaceGlobs(pkg)];
    const pnpmWs = await readText(root, "pnpm-workspace.yaml");
    if (pnpmWs) {
      for (const m of pnpmWs.matchAll(/^\s*-\s*["']?([^"'\s#]+)["']?/gm)) {
        if (!workspaces.includes(m[1])) workspaces.push(m[1]);
      }
    }
    const ts = (await exists(root, "tsconfig.json")) || dependencies.includes("typescript");
    const languages: Language[] = [ts ? "typescript" : "javascript"];
    const facts: Partial<RepoFacts> = { scripts, dependencies, workspaces, languages };
    if (pkg.name) facts.name = pkg.name;
    if (pkg.description) facts.description = pkg.description;
    return {
      facts,
      summary: `${pkg.name ?? "(unnamed)"} · ${Object.keys(scripts).length} scripts`,
    };
  },
};

export const otherLanguages: Detector = {
  id: "otherLanguages",
  label: "Languages",
  async run({ root }) {
    const facts: Partial<RepoFacts> = {};
    const languages: Language[] = [];
    const frameworkIds: string[] = [];
    const frameworks: string[] = [];

    const pyproject = await readText(root, "pyproject.toml");
    const requirements = await readText(root, "requirements.txt");
    if (pyproject !== undefined || requirements !== undefined) {
      languages.push("python");
      const text = `${pyproject ?? ""}\n${requirements ?? ""}`;
      for (const fw of ["django", "fastapi", "flask"]) {
        if (new RegExp(String.raw`\b${fw}\b`, "i").test(text)) {
          frameworkIds.push(fw);
          frameworks.push(fw);
        }
      }
      const name = pyproject?.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
      if (name) facts.name = name;
      if (/\bpytest\b/i.test(text)) facts.testRunner = "pytest";
    }
    if (await exists(root, "go.mod")) languages.push("go");
    if (await exists(root, "Cargo.toml")) languages.push("rust");

    if (languages.length) facts.languages = languages;
    if (frameworkIds.length) {
      facts.frameworkIds = frameworkIds;
      facts.frameworks = frameworks;
    }
    return { facts, summary: languages.length ? languages.join(" · ") : NONE };
  },
};
