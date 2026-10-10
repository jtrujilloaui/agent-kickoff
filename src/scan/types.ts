import type { RepoFacts } from "../types";
import type { PackageJson } from "./fs";

export interface ScanCtx {
  root: string;
  pkg?: PackageJson;
}

export interface DetectorResult {
  facts: Partial<RepoFacts>;
  /** Short line shown in the terminal; "—" when nothing found. */
  summary: string;
}

export interface Detector {
  id: string;
  label: string;
  run(ctx: ScanCtx): Promise<DetectorResult>;
}
