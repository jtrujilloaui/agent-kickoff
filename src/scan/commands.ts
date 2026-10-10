import type { Commands, PackageManager, RepoFacts } from "../types";

export function runScript(pm: PackageManager, script: string): string {
  switch (pm) {
    case "bun":
      return `bun run ${script}`;
    case "pnpm":
      return `pnpm ${script}`;
    case "yarn":
      return `yarn ${script}`;
    default:
      return script === "test" || script === "start" ? `npm ${script}` : `npm run ${script}`;
  }
}

export function execBin(pm: PackageManager, bin: string): string {
  switch (pm) {
    case "bun":
      return `bunx ${bin}`;
    case "pnpm":
      return `pnpm exec ${bin}`;
    case "yarn":
      return `yarn ${bin}`;
    default:
      return `npx ${bin}`;
  }
}

const CANDIDATES: Record<keyof Commands, string[]> = {
  dev: ["dev", "start:dev", "start"],
  build: ["build"],
  test: ["test"],
  lint: ["lint"],
  typecheck: ["typecheck", "type-check", "check-types", "tsc"],
  format: ["format", "fmt"],
};

export function resolveCommands(
  f: Pick<RepoFacts, "packageManager" | "scripts" | "languages" | "testRunner" | "dependencies">,
): Commands {
  const out: Commands = {};
  for (const key of Object.keys(CANDIDATES) as (keyof Commands)[]) {
    const script = CANDIDATES[key].find((s) => s in f.scripts);
    if (script) out[key] = runScript(f.packageManager, script);
  }
  if (!out.typecheck && f.languages.includes("typescript") && f.dependencies.includes("typescript")) {
    out.typecheck = execBin(f.packageManager, "tsc --noEmit");
  }
  if (f.languages.includes("python") && f.testRunner === "pytest" && !out.test) out.test = "pytest";
  if (f.languages.includes("go")) {
    out.build ??= "go build ./...";
    out.test ??= "go test ./...";
    out.lint ??= "go vet ./...";
  }
  if (f.languages.includes("rust")) {
    out.build ??= "cargo build";
    out.test ??= "cargo test";
    out.lint ??= "cargo clippy";
  }
  return out;
}
