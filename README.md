# agent-kickoff

Run it in any repo. It scans the project and leaves behind a knowledge base for coding agents (Claude Code, Codex, Cursor, Copilot): what the stack is, how to run it, where things live, and the rules to follow.

```sh
bunx agent-kickoff        # or: npx agent-kickoff
```

## What it does

1. **Scans** the repo, with no questions and nothing executed: the package manager, frameworks and versions, scripts, folder structure, routes, data models, env variable *names*, the design system, tests, CI, git conventions and existing instruction files.
2. **Asks** only what it can't infer:
   - the team shape;
   - **how you work with agents**: one session, subagents by tier, or several agents in parallel;
   - where issues live and whether PRs get reviewed;
   - which `AGENTS.md` sections to include;
   - **which skills to install** (multi-select, with presets for your work mode).
3. **Writes**:

| File | What it holds |
|---|---|
| `.claude/skills/<repo>-context/SKILL.md` + `references/` | A context skill for this repo: stack, commands, structure, data, conventions |
| `AGENTS.md` | Plan-first workflow, model routing, UI and backend quality gates (when they apply), and how to verify before calling something done |
| `CLAUDE.md` | `@AGENTS.md` plus a pointer to the context skill |
| `.claude/agents/{architect,builder,mechanic}.md` | Subagents routed by complexity (opus / sonnet / haiku) |
| `.claude/skills/linear-*` + `issue-authoring` | Linear planning, sync, project health and issue writing, configured for your team (only if you use Linear) |

4. **Installs skills into the repo** from their authors' own repos, with the [`skills`](https://www.npmjs.com/package/skills) CLI. They are copied into `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex, Cursor), and a `skills-lock.json` lets the team restore them:
   - **Planning and execution** by [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent): `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, code review and worktrees.
   - **Design**, when the repo has a frontend: skills by Jakub Krehel, Raphael Salaja, 0xdesign and Emil Kowalski.
   - **Linear**, generated and configured for your team.

   `AGENTS.md` gets a **Workflow** section that chains the installed skills: idea → `brainstorming` → `writing-plans` → execution → verification → review → finish.
5. **Goes deeper with Claude** (optional, when the `claude` CLI is installed): Claude reads the code with read-only tools and returns `architecture.md`, `flows.md` and `gotchas.md` for the context skill.

## Safe to re-run

Everything it generates sits between `<!-- agent-kickoff:start -->` and `<!-- agent-kickoff:end -->`, and a re-run only refreshes that region.

- If `AGENTS.md` or `CLAUDE.md` already exist, your text is kept and the generated block is appended.
- Any other existing file without markers is never overwritten. The new version is written beside it as `.new`.
- Real `.env` files are never opened; only the variable names in `.env.example` are read.
- Credentials in the git remote URL are stripped.

## Options

```
agent-kickoff [dir] [options]

  --dry-run       Show what would be written; write nothing
  -y, --yes       Accept the defaults, no prompts
  --enrich        Run the deep analysis with Claude without asking
  --no-enrich     Skip the deep analysis with Claude
  --no-motion     Keep color, drop animation
  -v, --version   Print the version
  -h, --help      Print this help
```

Animation turns itself off in CI, with `TERM=dumb` and in non-interactive output. `NO_COLOR` gives plain text.

## Develop

```sh
bun install
bun test
bun run typecheck
bun run build                       # dist/cli.js, runs on Node 18+
node dist/cli.js ../some-repo --dry-run
bun scripts/ui-preview.ts           # just the terminal visuals
```

## License

MIT
