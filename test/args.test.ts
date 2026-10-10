import { describe, expect, test } from "bun:test";
import { parseCli } from "../src/args";

describe("parseCli", () => {
  test("defaults", () => {
    expect(parseCli([])).toEqual({
      dir: undefined,
      dryRun: false,
      yes: false,
      enrich: undefined,
      noMotion: false,
      version: false,
      help: false,
    });
  });

  test("dir and flags", () => {
    const o = parseCli(["../app", "--dry-run", "-y", "--no-motion", "--enrich"]);
    expect(o).toMatchObject({ dir: "../app", dryRun: true, yes: true, noMotion: true, enrich: true });
  });

  test("--no-enrich wins over --enrich", () => {
    expect(parseCli(["--enrich", "--no-enrich"]).enrich).toBe(false);
  });

  test("unknown flags and extra dirs throw", () => {
    expect(() => parseCli(["--nope"])).toThrow();
    expect(() => parseCli(["a", "b"])).toThrow("at most one directory");
  });
});
