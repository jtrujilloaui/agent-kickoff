# agent-kickoff — design

Date: 2026-10-09 · Status: approved in conversation, pending spec review

## Goal

One command, run inside any repo, that reads the project and leaves behind everything a coding agent needs to work well in it: a context skill that describes the repo, the shared instruction files, model-tiered subagents and (optionally) a Linear workflow. It should feel good to run.

```
bunx agent-kickoff [dir]      # or: npx agent-kickoff [dir]
```

Success looks like: on a real repo (first target: `jesus-portfolio`) it detects the stack, scripts, structure and conventions correctly without asking, asks only what it cannot infer, writes files that a fresh Claude Code session picks up and uses, and never destroys hand-written content.

## Non-goals (v0.1)

- No hosted service, no telemetry, no accounts.
- No editing of application code. It only writes agent-facing files.
- No support for running inside Claude Code as a skill (the existing `project-kickoff` skill keeps that role).
- No monorepo-per-package context skills. Workspaces are detected and described in one skill; per-package skills can come later.

## Users and inputs

The user is a developer starting or adopting a repo. Inputs, in order of preference:

1. **The repo itself** (scanned, no questions).
2. **Previous answers** in `.claude/agent-kickoff.json` (re-runs).
3. **Questions**, only for what 1 and 2 cannot answer.

## Flags

| Flag | Effect |
|---|---|
| `[dir]` | Target repo. Defaults to the git root of the cwd, else cwd. |
| `--dry-run` | Run everything, print the file tree and a diff summary, write nothing. |
| `--yes` / `-y` | Accept every default; no prompts (still prints). Enrichment is skipped unless `--enrich` is also passed. |
| `--enrich` / `--no-enrich` | Force the Claude step on or off without asking. |
| `--no-motion` | Keep color, drop animation. |
| `--version`, `--help` | Standard. |

## Architecture

Four units with one job each, connected by plain data:

```
scan(dir) ──▶ RepoFacts ──▶ ask(facts, saved) ──▶ Answers
                                   │
             plan(facts, answers) ─┴─▶ FilePlan[] ──▶ write(plan, {dryRun})
                                                        │
                                       enrich(facts) ◀──┘ (optional, claude -p)
```

All four are driven by `cli.ts`, and every user-visible output goes through `ui/`. Units never print directly. They report progress through a callback, so they can be tested headless.

### 1. `scan/` → `RepoFacts`

A set of small detectors, each `(dir) => Promise<Partial<RepoFacts>>`, run concurrently and merged. Each detector reports a label + summary line for the scan animation as it resolves.

| Detector | Reads | Produces |
|---|---|---|
| `packageManager` | lockfiles, `packageManager` field | `bun` / `pnpm` / `yarn` / `npm` / `none` |
| `node` | `package.json` (+ workspaces) | name, description, scripts, deps, workspaces |
| `frameworks` | deps, config files | next (+ app/pages router, version), vite, react, vue, svelte, astro, remix, expo/react-native, nestjs, express, hono, fastify, tailwind (+ v4 `@theme`), prisma, drizzle, supabase |
| `python` / `go` / `rust` | `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml` | language, framework (django, fastapi, flask) |
| `commands` | scripts + package manager | resolved `dev`, `build`, `test`, `lint`, `typecheck`, `format` commands (e.g. `bun run typecheck`) |
| `structure` | directory walk, depth 2, ignoring `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.venv`, `target` | tree + one-line role guesses for known dirs (`src/app` → routes, `src/components`, `content/`, `migrations/` …) |
| `routes` | Next `app/**/page.*`, `pages/**`, Nest `@Controller` decorators | route list (capped at 50) |
| `data` | `prisma/schema.prisma`, drizzle schema files, `supabase/migrations/*.sql` | model/table names (capped) |
| `env` | `.env.example`, `.env.sample`, `.env.template` only | variable **names**. Real `.env*` files are never opened. |
| `designSystem` | tailwind `@theme` blocks, `tokens.*`, `components/ui`, DS packages in deps | location of tokens + primitives |
| `tests` / `ci` | vitest/jest/playwright/bun test config, `.github/workflows/*` | runner, CI job names |
| `git` | `git remote get-url origin`, `git symbolic-ref refs/remotes/origin/HEAD`, last 30 subjects | remote, default branch, commit style (conventional or not) |
| `docs` | `README.md`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md` | existing instructions (kept verbatim, linked, never overwritten) |

Detectors must be cheap (no installs, no network, no executing project code) and fail soft: a throw becomes a `warning` on the facts, not a crash. Total scan target: under 1s on a mid-size repo.

Derived flags: `hasFrontend`, `hasBackend`, `hasDatabase`, `isMonorepo`.

### 2. `ask/` → `Answers`

`@clack/prompts`, one screen, at most five questions. Each one is skipped if facts or saved answers already settle it.

1. **Team shape**: solo / small (2–8, one squad) / multi-squad.
2. **Tracker**: Linear (then team name + key, e.g. `ENG`) / GitHub Issues / none.
3. **Human review on PRs**: yes / no.
4. **What to generate** (multiselect, all on by default): context skill, `AGENTS.md` + `CLAUDE.md`, subagents, Linear skills (only if Linear), design skills (only if `hasFrontend`).
5. **Deep analysis with Claude?** Shown only when `claude` is on PATH, default yes. Explains it takes a few minutes and uses the user's Claude plan.

Answers are saved to `.claude/agent-kickoff.json` (no secrets in it) along with the tool version and a timestamp.

### 3. `plan/` → `FilePlan[]` and `write/`

`plan` is pure: `(facts, answers) => FilePlan[]` where a `FilePlan` is `{ path, content, mode: "create" | "managed" | "skip-exists" }`. Templates live in `templates/` inside the package and are rendered by a ~40-line renderer supporting `{{VAR}}` and `<!-- IF FLAG -->…<!-- ELSE -->…<!-- END IF -->`. The agent, Linear and instruction templates are ported from the `project-kickoff` skill in `jesus-portfolio/public/skill-files/`. From here on, the package is their source of truth.

Generated files:

| Path | Content |
|---|---|
| `.claude/skills/<slug>-context/SKILL.md` | Frontmatter `description` written to trigger on any work in this repo ("Use when working in <name>: …stack…"). Body: what the project is, how to run it, where things live, the conventions, and an index of the reference files. |
| `…/references/stack.md` | Languages, frameworks + versions, package manager, key deps. |
| `…/references/commands.md` | Every resolved command, what it does, and when to run it (before done: typecheck, lint, test, build). |
| `…/references/structure.md` | The tree with roles, routes, entry points. |
| `…/references/data.md` | Models/tables, migrations location, env variable names. Only if `hasDatabase` or env names found. |
| `…/references/conventions.md` | Commit style, branch naming, design-system rules, existing instruction files (linked). |
| `AGENTS.md` | The instruction template (plan-first + routing, UI gate if `hasFrontend`, backend gate if `hasBackend`, tracker section), pointing at the context skill. |
| `CLAUDE.md` | `@AGENTS.md` plus a one-line pointer to the context skill. |
| `.claude/agents/{architect,builder,mechanic}.md` | Model aliases `opus` / `sonnet` / `haiku`. |
| `.claude/skills/{linear-planning,linear-sync,linear-project-health,issue-authoring}/SKILL.md` | Placeholders filled from answers. Linear only. |
| `.claude/agent-kickoff.json` | Saved answers. |

**Design skills** are not copied. If chosen, the outro prints the `npx skills add …` lines from the `/skills` catalog and offers to run them.

**Never destroy content.** `write` applies these rules:

- File missing → create it.
- File exists and contains `<!-- agent-kickoff:start -->` … `<!-- agent-kickoff:end -->` → replace only that region.
- File exists without markers → for `AGENTS.md`/`CLAUDE.md`, append a marked region at the end; for everything else, write `<path>.new` beside it and say so.
- `--dry-run` → compute all of the above, print the tree with a tag per file (`new`, `update`, `append`, `.new`), and write nothing.

### 4. `enrich/` (optional)

Runs only if chosen and `claude` is on PATH. Invocation:

```
claude -p "<prompt>" --output-format stream-json --verbose \
  --allowedTools Read Grep Glob "Write(.claude/skills/<slug>-context/references/**)" \
  --disallowedTools Bash WebFetch WebSearch
```

with `cwd` = the repo. The prompt includes the `RepoFacts` JSON and asks Claude to read the code and write three files into `references/`: `architecture.md` (modules and how they connect), `flows.md` (the 3–6 most important request/data flows, with `file:line` anchors), and `gotchas.md` (non-obvious rules, legacy areas to avoid copying, sharp edges). The context `SKILL.md` index lists these files only once they exist.

The stream is parsed line by line. Tool-use events drive the live ticker ("Reading src/lib/content.ts"), and a result event ends it. Failure modes: no `claude` binary, non-zero exit, user cancel, or no files written. Each one shows a clear one-line message and leaves the deterministic output intact, so enrichment never blocks the base result. The exact permission flags are verified against the installed CLI during implementation. If `Write(path)` scoping is not honoured, fall back to asking Claude to print the files as fenced blocks and writing them ourselves.

## Terminal experience (Neon gradient)

All visuals live in `ui/` and are pure functions over strings plus one small frame scheduler.

- **Logo.** The hand-drawn block wordmark `AGENT KICKOFF` with a `░` rule under it, colored by a horizontal gradient from violet `#8B5CF6` to blue `#3B82F6` (24-bit). On start, a bright band sweeps left to right over ~700ms at ~30fps, then the logo settles to the static gradient.
- **Scan rail.** Clack-style `◆ │ └`. Each detector prints its `✔` line as it resolves, with a minimum 60ms gap between lines so the sequence reads, capped so the whole scan display never exceeds the real work by more than 400ms. The active line shows a `✷✶✸✹` spinner and a shimmer band moving across its text.
- **Enrichment ticker.** One live line: spinner + shimmer + current action + elapsed time (fixed width, so it doesn't jitter) + files-written count.
- **Result.** The file tree reveals line by line (~20ms stagger), with directories tinted by the gradient and per-file tags (`new`, `update`, `append`, `.new`). It closes with a rounded box with a gradient border and `✦ knowledge base ready`.
- **Rules.** Motion runs while work runs and never adds waiting on its own. Motion only when stdout is a TTY. `CI`, `TERM=dumb` or `--no-motion` turn motion off but keep color. `NO_COLOR` gives plain text. Without truecolor (`COLORTERM` not `truecolor`/`24bit`, legacy Windows console), fall back to 256-color. The cursor is hidden during animation and is always restored on exit, error and SIGINT.

## Package and tooling

- TypeScript, developed with Bun, built with `bun build src/cli.ts --target node --outdir dist` so the published bin runs on Node 18+ (`npx`) and Bun (`bunx`).
- Runtime deps: `@clack/prompts` only. ANSI handling is in-house.
- `package.json`: `name: agent-kickoff`, `bin: { "agent-kickoff": "dist/cli.js" }`, `files: ["dist", "templates"]`, `type: module`, MIT license.
- Repo: `~/personal/agent-kickoff`, pushed to `github.com/jtrujilloaui/agent-kickoff` (public).

## Testing

- `bun test`.
- **Fixtures** in `test/fixtures/`: `next-app` (bun, app router, tailwind v4 tokens), `nest-api` (pnpm, prisma, `.env.example`), `python-fastapi`, `empty`.
- **Scan tests** assert the `RepoFacts` per fixture.
- **Plan tests** snapshot the rendered files for fixed answers.
- **Write tests** cover all four marker/exists cases and `--dry-run` (writes nothing) against a temp copy.
- **Renderer tests** cover vars, IF/ELSE, nesting, missing vars (throws).
- **UI tests** cover gradient interpolation, `NO_COLOR` and no-motion output (no escape codes / no cursor moves).
- **Enrich** is tested with a fake `claude` script on PATH that emits a recorded stream-json transcript.

## Demo before release

Before anything is pushed to GitHub or published to npm: run the real CLI against `jesus-portfolio` with `--dry-run`, in a new Windows Terminal window on the user's machine, so the animation is seen in a real TTY. Release happens only after the user has seen it and approves.

## Release and /skills

1. Push the repo to GitHub (public) and publish `agent-kickoff@0.1.0` to npm as `jesustrujillopo`. Both happen only with explicit confirmation.
2. In `jesus-portfolio`, add `agent-kickoff` to the Execution section of `content/skills.json` as a new `cli` kind:
   - install command `bunx agent-kickoff`;
   - links to the GitHub repo;
   - meta line "CLI · npm";
   - `src/lib/skills.ts` extended for the new kind.

   It sits first in the section, above the `project-kickoff` skill, which stays for in-Claude use.

## Open risks

- `Write(path)` scoping in `--allowedTools` under `-p` may behave differently than expected (mitigation above).
- Windows terminals vary. Test in Windows Terminal (truecolor) and the VS Code terminal. Legacy conhost gets the 256-color path.
- Template drift between this package and the hosted `project-kickoff` skill files. Accepted for v0.1; the package is the source of truth from here on.
