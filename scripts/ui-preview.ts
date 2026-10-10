import {
  Rail,
  box,
  detectCaps,
  installCursorGuard,
  playLogo,
  printStaggered,
  sleep,
  treeLines,
} from "../src/ui";

const out = process.stdout;
const caps = detectCaps({ env: process.env, isTTY: out.isTTY, columns: out.columns });
installCursorGuard(out);

await playLogo(out, caps);

const rail = new Rail(out, caps);
rail.header("Scanning repository");
rail.start();
const steps = ["package.json", "tsconfig.json", "src/", "tests/", "CI workflows", "git history"];
for (const s of steps) {
  rail.setActive(`reading ${s}`);
  await sleep(150);
  rail.done(`found ${s}`, s !== "CI workflows");
}
await rail.finish();

out.write("\n");
await printStaggered(
  out,
  treeLines(
    [
      { path: ".claude/agents/architect.md", tag: "new" },
      { path: ".claude/agents/builder.md", tag: "new" },
      { path: ".claude/skills/x-context/SKILL.md", tag: "update" },
      { path: "AGENTS.md", tag: "append" },
    ],
    caps,
  ),
  caps,
);
out.write("\n");
out.write(box(["Ready.", "Run your agent and ask it anything."], caps).join("\n") + "\n");
