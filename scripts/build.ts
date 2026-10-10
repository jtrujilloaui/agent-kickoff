import { chmodSync, readFileSync, writeFileSync } from "node:fs";

// Bundles src/cli.ts (and @clack/prompts with it) into one Node-compatible
// file, so the published package has zero runtime dependencies and runs under
// both `npx` and `bunx`.
const result = await Bun.build({
  entrypoints: ["src/cli.ts"],
  outdir: "dist",
  target: "node",
  format: "esm",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const out = "dist/cli.js";
const code = readFileSync(out, "utf8");
writeFileSync(out, code.startsWith("#!") ? code : `#!/usr/bin/env node\n${code}`);
chmodSync(out, 0o755);
console.log(`built ${out}`);
