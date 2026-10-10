import type { RepoFacts } from "../types";
import { finalize, mergeFacts } from "./derive";
import { readText, type PackageJson } from "./fs";
import { data, env, routes, structure } from "./layout";
import { docs, git } from "./repo";
import { designSystem, frameworks, testsCi } from "./stack";
import { nodePackage, otherLanguages, packageManager } from "./toolchain";
import type { Detector, DetectorResult } from "./types";

export const DETECTORS: Detector[] = [
  packageManager,
  nodePackage,
  otherLanguages,
  frameworks,
  structure,
  routes,
  data,
  env,
  designSystem,
  testsCi,
  git,
  docs,
];

export type ScanEvent =
  | { type: "start" | "done"; id: string; label: string; summary?: string }
  | { type: "warn"; id: string; label: string; message: string };

export async function scan(root: string, onEvent: (e: ScanEvent) => void = () => {}): Promise<RepoFacts> {
  const warnings: string[] = [];
  let pkg: PackageJson | undefined;
  const raw = await readText(root, "package.json");
  if (raw !== undefined) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") pkg = parsed as PackageJson;
    } catch {
      warnings.push("package.json is not valid JSON");
    }
  }

  for (const d of DETECTORS) onEvent({ type: "start", id: d.id, label: d.label });

  const results = await Promise.all(
    DETECTORS.map(async (d): Promise<DetectorResult> => {
      try {
        const r = await d.run({ root, pkg });
        onEvent({ type: "done", id: d.id, label: d.label, summary: r.summary });
        return r;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(`${d.label}: ${message}`);
        onEvent({ type: "warn", id: d.id, label: d.label, message });
        return { facts: {}, summary: "—" };
      }
    }),
  );

  let merged: Partial<RepoFacts> = {};
  for (const r of results) merged = mergeFacts(merged, r.facts);
  merged.warnings = warnings;
  const facts = finalize(root, merged);

  const keys = Object.keys(facts.commands);
  onEvent({ type: "done", id: "commands", label: "Commands", summary: keys.length ? keys.join(" · ") : "—" });
  return facts;
}

export * from "./commands";
export * from "./derive";
export * from "./fs";
export * from "./layout";
export * from "./repo";
export * from "./stack";
export * from "./toolchain";
export type * from "./types";
