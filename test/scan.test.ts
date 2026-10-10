import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DETECTORS, appRoute, pagesRoute, redactRemote, scan, slugify, type ScanEvent } from "../src/scan";

const fx = (name: string) => join(import.meta.dir, "fixtures", name);

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "kickoff-scan-"));
}

describe("fixtures", () => {
  test("next-app", async () => {
    const f = await scan(fx("next-app"));
    expect(f.packageManager).toBe("bun");
    expect(f.name).toBe("acme-web");
    expect(f.slug).toBe("acme-web");
    expect(f.languages).toEqual(["typescript"]);
    expect(f.frameworkIds).toEqual(["next", "react", "tailwind"]);
    expect(f.frameworks).toEqual(["next 16 (app router)", "react 19", "tailwind 4"]);
    expect(f.routes).toEqual(["/", "/about", "/blog/[slug]"]);
    expect(f.envVars).toEqual(["NEXT_PUBLIC_SITE_URL", "RESEND_API_KEY"]);
    expect(f.designSystem?.tokens).toBe("src/app/globals.css");
    expect(f.designSystem?.primitives).toBe("src/components/ui");
    expect(f.commands).toEqual({
      dev: "bun run dev",
      build: "bun run build",
      lint: "bun run lint",
      typecheck: "bun run typecheck",
    });
    expect(f.hasFrontend).toBe(true);
    expect(f.hasBackend).toBe(false);
    expect(f.hasDatabase).toBe(false);
    expect(f.docs).toEqual(["README.md"]);
    expect(f.structure).toContainEqual({ path: "src/app", role: "routes (app router)" });
  });

  test("nest-api", async () => {
    const f = await scan(fx("nest-api"));
    expect(f.packageManager).toBe("pnpm");
    expect(f.slug).toBe("api");
    expect(f.frameworkIds).toEqual(["nestjs", "prisma"]);
    expect(f.frameworks).toEqual(["nestjs 11", "prisma 6"]);
    expect(f.routes).toEqual(["/orders", "/users"]);
    expect(f.dataSource).toBe("prisma");
    expect(f.dataModels).toEqual(["Order", "User"]);
    expect(f.testRunner).toBe("jest");
    expect(f.ciJobs).toEqual(["ci"]);
    expect(f.commands).toEqual({
      dev: "pnpm start:dev",
      build: "pnpm build",
      test: "pnpm test",
      lint: "pnpm lint",
      typecheck: "pnpm exec tsc --noEmit",
    });
    expect(f.hasBackend).toBe(true);
    expect(f.hasDatabase).toBe(true);
    expect(f.hasFrontend).toBe(false);
  });

  test("python-fastapi", async () => {
    const f = await scan(fx("python-fastapi"));
    expect(f.name).toBe("inventory");
    expect(f.languages).toEqual(["python"]);
    expect(f.frameworkIds).toEqual(["fastapi"]);
    expect(f.testRunner).toBe("pytest");
    expect(f.commands).toEqual({ test: "pytest" });
    expect(f.packageManager).toBe("none");
    expect(f.hasBackend).toBe(true);
  });

  test("empty", async () => {
    const f = await scan(fx("empty"));
    expect(f.packageManager).toBe("none");
    expect(f.name).toBe("empty");
    expect(f.frameworks).toEqual([]);
    expect(f.hasFrontend).toBe(false);
  });
});

describe("safety", () => {
  test("never reads real .env files", async () => {
    const dir = await tmp();
    try {
      await writeFile(join(dir, ".env"), "SECRET_TOKEN=abc123\n");
      await writeFile(join(dir, ".env.example"), "PUBLIC_URL=\n");
      const f = await scan(dir);
      expect(f.envVars).toEqual(["PUBLIC_URL"]);
      const json = JSON.stringify(f);
      expect(json).not.toContain("abc123");
      expect(json).not.toContain("SECRET_TOKEN");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("invalid package.json warns and continues", async () => {
    const dir = await tmp();
    try {
      await writeFile(join(dir, "package.json"), "{nope");
      const events: ScanEvent[] = [];
      const f = await scan(dir, (e) => events.push(e));
      expect(f.warnings).toContain("package.json is not valid JSON");
      expect(events.some((e) => e.type === "warn")).toBe(false);
      const last = events[events.length - 1];
      expect(last.type).toBe("done");
      expect(last.id).toBe("commands");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("git", () => {
  test("not a repo", async () => {
    const dir = await tmp();
    try {
      const f = await scan(dir);
      expect(f.git.conventionalCommits).toBe(false);
      expect(f.git.defaultBranch).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repo with conventional commits and credentialed remote", async () => {
    const dir = await tmp();
    try {
      const run = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { stdio: "ignore" });
      run("init", "-b", "main");
      run("config", "user.name", "Test");
      run("config", "user.email", "test@example.com");
      run("config", "commit.gpgsign", "false");
      for (const msg of ["feat: a", "fix: b", "chore: c"]) run("commit", "--allow-empty", "-m", msg);
      run("remote", "add", "origin", "https://user:tok@github.com/x/y.git");
      const f = await scan(dir);
      expect(f.git.defaultBranch).toBe("main");
      expect(f.git.conventionalCommits).toBe(true);
      expect(f.git.remote).toBe("https://github.com/x/y.git");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("redactRemote leaves ssh and clean urls alone", () => {
    expect(redactRemote("git@github.com:x/y.git")).toBe("git@github.com:x/y.git");
    expect(redactRemote("https://github.com/x/y.git")).toBe("https://github.com/x/y.git");
  });
});

describe("route helpers", () => {
  test("appRoute", () => {
    expect(appRoute("src/app/page.tsx")).toBe("/");
    expect(appRoute("app/page.js")).toBe("/");
    expect(appRoute("src/app/(marketing)/about/page.tsx")).toBe("/about");
    expect(appRoute("app/blog/[slug]/page.mdx")).toBe("/blog/[slug]");
    expect(appRoute("app/@modal/login/page.tsx")).toBe("/login");
    expect(appRoute("app/layout.tsx")).toBeUndefined();
  });

  test("pagesRoute", () => {
    expect(pagesRoute("pages/index.tsx")).toBe("/");
    expect(pagesRoute("src/pages/about.tsx")).toBe("/about");
    expect(pagesRoute("pages/blog/index.tsx")).toBe("/blog");
    expect(pagesRoute("pages/api/hello.ts")).toBeUndefined();
    expect(pagesRoute("pages/_app.tsx")).toBeUndefined();
  });
});

describe("derive", () => {
  test("slugify", () => {
    expect(slugify("@acme/API Server")).toBe("api-server");
    expect(slugify("***")).toBe("project");
  });
});

describe("events", () => {
  test("start and done for every detector plus commands", async () => {
    const events: ScanEvent[] = [];
    await scan(fx("next-app"), (e) => events.push(e));
    for (const d of DETECTORS) {
      expect(events.filter((e) => e.type === "start" && e.id === d.id)).toHaveLength(1);
      expect(events.filter((e) => e.type === "done" && e.id === d.id)).toHaveLength(1);
    }
    const last = events[events.length - 1];
    expect(last).toMatchObject({ type: "done", id: "commands", label: "Commands" });
    // starts are all emitted before any detector finishes
    const firstDone = events.findIndex((e) => e.type !== "start");
    expect(firstDone).toBe(DETECTORS.length);
  });
});
