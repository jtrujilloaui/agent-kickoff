// Test double for `npx -y skills add <repo> -s <ids...> -a ... --copy -y`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const repo = args[args.indexOf("add") + 1];
if (repo === "fail/repo") {
  console.error("boom: repository not found");
  process.exit(1);
}
const ids = [];
for (let i = args.indexOf("-s") + 1; i < args.length && !args[i].startsWith("-"); i++) ids.push(args[i]);
for (const id of ids) {
  const dir = join(process.cwd(), ".claude", "skills", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${id}\n---\n`);
}
