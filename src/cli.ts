import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import pkg from "../package.json";
import { HELP, parseCli } from "./args";
import { WORK_MODE_LABELS, askAnswers, defaultAnswers } from "./ask";
import { SKILL_CATALOG, installCommands } from "./catalog";
import { runInstall, skillPath } from "./install";
import { findClaude, runEnrich } from "./enrich";
import { loadSaved, planFiles } from "./plan";
import { loadTemplates } from "./plan/templates";
import { scan } from "./scan";
import type { Answers, RepoFacts, WriteResult } from "./types";
import {
  AMBER,
  BLUE,
  LiveLine,
  MUTED,
  Rail,
  SOFT,
  VIOLET,
  box,
  detectCaps,
  gradientText,
  installCursorGuard,
  paint,
  playLogo,
  printStaggered,
  shimmer,
  spinner,
  treeLines,
  truncate,
  type TermCaps,
} from "./ui";
import { applyPlan } from "./write";

const run = promisify(execFile);
const out = process.stdout;

/** Explicit dir as given; otherwise the git root of the cwd, else the cwd. */
async function resolveRoot(dir?: string): Promise<string> {
  if (dir) {
    const abs = resolve(dir);
    const s = await stat(abs).catch(() => undefined);
    if (!s?.isDirectory()) throw new Error(`Not a directory: ${abs}`);
    return abs;
  }
  try {
    const { stdout } = await run("git", ["rev-parse", "--show-toplevel"], { timeout: 3000 });
    if (stdout.trim()) return resolve(stdout.trim());
  } catch {
    // not a git repo; fall through
  }
  return process.cwd();
}

const elapsed = (since: number) => {
  const s = Math.floor((Date.now() - since) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

async function scanWithRail(root: string, caps: TermCaps): Promise<RepoFacts> {
  const rail = new Rail(out, caps);
  const running = new Map<string, string>();
  // Scanning starts now and runs underneath the logo animation.
  const scanning = scan(root, (e) => {
    if (e.type === "start") running.set(e.id, e.label);
    else {
      running.delete(e.id);
      const detail = e.type === "warn" ? e.message : (e.summary ?? "—");
      rail.done(`${paint(e.label.padEnd(11), SOFT, caps)} ${detail}`, e.type !== "warn");
    }
    rail.setActive(running.values().next().value ?? "");
  });
  await playLogo(out, caps);
  rail.header(`Scanning ${paint(basename(root), SOFT, caps)}`);
  rail.start();
  const facts = await scanning;
  await rail.finish();
  return facts;
}

async function enrichWithTicker(root: string, facts: RepoFacts, claude: string, caps: TermCaps): Promise<string[]> {
  out.write(`\n  ${paint("◆", VIOLET, caps)} Deep analysis with Claude ${paint("(read-only)", MUTED, caps)}\n`);
  const started = Date.now();
  let action = "Starting Claude";
  let wrote = 0;
  const line = new LiveLine(out, caps, (f) => {
    const meta = `${elapsed(started)} · ${wrote} files`;
    const text = truncate(action, Math.max(10, caps.columns - meta.length - 10));
    return `  ${paint("│", MUTED, caps)} ${paint(spinner(f), VIOLET, caps)} ${shimmer(text, caps, f)}  ${paint(meta, MUTED, caps)}`;
  });
  line.start();
  const { done } = runEnrich(
    root,
    facts,
    (e) => {
      if (e.type === "tool") {
        action = e.label;
        if (!caps.motion) line.print(`  │ ${truncate(e.label, caps.columns - 6)}`);
      } else if (e.type === "wrote") {
        wrote++;
        action = `Writing ${e.path}`;
      }
    },
    { command: claude },
  );
  const r = await done;
  line.stop(
    r.ok
      ? `  ${paint("└", MUTED, caps)} ${paint("✔", BLUE, caps)} Claude wrote ${r.written.join(", ")} in ${elapsed(started)}`
      : `  ${paint("└", MUTED, caps)} ${paint("!", AMBER, caps)} Deep analysis skipped: ${r.message}. The base knowledge base is intact.`,
  );
  return r.written;
}

const authorOf = (repo: string) => {
  const s = SKILL_CATALOG.find((k) => k.source.kind === "external" && k.source.repo === repo);
  return s?.source.kind === "external" ? s.source.author : repo;
};

async function installWithLines(root: string, answers: Answers, dryRun: boolean, caps: TermCaps): Promise<string[]> {
  const cmds = installCommands(answers.skills);
  if (!cmds.length) return [];
  const rail = paint("│", MUTED, caps);
  out.write(`\n  ${paint("◆", VIOLET, caps)} Installing skills ${paint("(copied from their authors' repos)", MUTED, caps)}\n`);
  if (dryRun) {
    for (const c of cmds) out.write(`  ${rail} ${paint("$", MUTED, caps)} npx ${c.args.slice(1).join(" ")}\n`);
    return [];
  }
  let line: LiveLine | undefined;
  const result = await runInstall(root, cmds, (e) => {
    if (e.type === "start") {
      const text = truncate(`Installing ${e.skills.join(", ")} from ${e.repo}`, Math.max(10, caps.columns - 10));
      line = new LiveLine(out, caps, (f) => `  ${rail} ${paint(spinner(f), VIOLET, caps)} ${shimmer(text, caps, f)}`);
      line.start();
      return;
    }
    const cmd = cmds.find((c) => c.repo === e.repo)!;
    const final = e.ok
      ? `  ${rail} ${paint("✔", BLUE, caps)} ${cmd.skills.length} ${cmd.skills.length === 1 ? "skill" : "skills"} from ${e.repo} · ${authorOf(e.repo)}`
      : `  ${rail} ${paint("!", AMBER, caps)} ${e.repo}: ${truncate(e.message ?? "failed", Math.max(10, caps.columns - e.repo.length - 10))}`;
    if (line) line.stop(final);
    else out.write(final + "\n");
    line = undefined;
  });
  out.write(`  ${rail} ${paint("Skills run with full agent permissions: skim them before use.", MUTED, caps)}\n`);
  return result.installed;
}

async function report(
  root: string,
  facts: RepoFacts,
  answers: Answers,
  results: WriteResult[],
  enriched: string[],
  installed: string[],
  opts: { dryRun: boolean },
  caps: TermCaps,
) {
  const items = [
    ...results.map((r) => ({ path: r.writtenPath, tag: r.action })),
    ...installed.map((id) => ({ path: skillPath(id), tag: "installed" })),
    ...enriched.map((n) => ({ path: `.claude/skills/${facts.slug}-context/references/${n}`, tag: "claude" })),
  ];
  out.write(`\n  ${paint("◆", VIOLET, caps)} ${opts.dryRun ? "Would write" : "Wrote"}\n\n`);
  await printStaggered(out, treeLines(items, caps), caps);

  const count = (a: string) => results.filter((r) => r.action === a).length;
  const summary = [
    ["new", count("new")],
    ["updated", count("update")],
    ["appended", count("append")],
    ["unchanged", count("unchanged")],
    [".new copies", count(".new")],
  ]
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${k}`)
    .join(" · ");
  const lines = [
    gradientText(opts.dryRun ? "✦ dry run: nothing was written" : "✦ knowledge base ready", caps),
    "",
    summary || "nothing to do",
    `Work mode: ${WORK_MODE_LABELS[answers.workMode]} · ${answers.skills.length} skills · ${answers.sections.length} AGENTS.md sections`,
    `Open Claude Code in ${basename(root)}: it reads AGENTS.md and the ${facts.slug}-context skill.`,
  ];
  if (installed.length) lines.push("Skills mirrored to .agents/skills for Codex and Cursor.");
  if (count(".new")) lines.push("Some files existed without agent-kickoff markers: review the .new copies.");
  out.write("\n" + box(lines, caps).join("\n") + "\n");

  out.write("\n");
}

export async function main(argv: string[]): Promise<number> {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${HELP(pkg.version)}`);
    return 2;
  }
  if (opts.help) {
    out.write(HELP(pkg.version));
    return 0;
  }
  if (opts.version) {
    out.write(`${pkg.version}\n`);
    return 0;
  }

  const caps = detectCaps({ env: process.env, isTTY: out.isTTY, columns: out.columns, noMotion: opts.noMotion });
  if (caps.motion) installCursorGuard(out);

  const root = await resolveRoot(opts.dir);
  const facts = await scanWithRail(root, caps);

  const saved = await loadSaved(root);
  const claude = findClaude();
  const interactive = !opts.yes && !!process.stdin.isTTY;
  out.write("\n");
  const answers = interactive
    ? await askAnswers(facts, saved, { claudeAvailable: !!claude, enrich: opts.enrich })
    : defaultAnswers(facts, saved, { enrich: opts.enrich === true && !!claude });

  const templates = loadTemplates();
  const plans = planFiles({ facts, answers, templates, version: pkg.version });
  let results = await applyPlan(root, plans, { dryRun: opts.dryRun });

  const installed = await installWithLines(root, answers, opts.dryRun, caps);

  let enriched: string[] = [];
  if (answers.enrich && claude) {
    if (opts.dryRun) {
      out.write(`\n  ${paint("◆", VIOLET, caps)} Deep analysis with Claude ${paint("skipped in --dry-run", MUTED, caps)}\n`);
    } else if (answers.generate.includes("context")) {
      enriched = await enrichWithTicker(root, facts, claude, caps);
      if (enriched.length) {
        // Re-render only the context SKILL.md so its index lists the new files.
        const skillPath = `.claude/skills/${facts.slug}-context/SKILL.md`;
        const again = planFiles({ facts, answers, templates, version: pkg.version, enriched }).filter((f) => f.path === skillPath);
        const [updated] = await applyPlan(root, again, { dryRun: false });
        if (updated) results = results.map((r) => (r.path === skillPath && r.action === "new" ? r : r.path === skillPath ? updated : r));
      }
    }
  }

  await report(root, facts, answers, results, enriched, installed, { dryRun: opts.dryRun }, caps);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`agent-kickoff: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
