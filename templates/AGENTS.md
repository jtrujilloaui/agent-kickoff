# {{PROJECT_NAME}}

{{PROJECT_DESCRIPTION}}

Repo knowledge base: read the `{{SLUG}}-context` skill (`.claude/skills/{{SLUG}}-context/SKILL.md`) before non-trivial work. It maps the stack, commands, structure, data and conventions.

## Stack and commands

- Toolchain: {{PACKAGE_MANAGER}} (use it for every install and script; do not mix package managers).
{{COMMANDS_LIST}}
- Default branch: `{{DEFAULT_BRANCH}}`. Branch from it (`feat/<slug>`, `fix/<slug>`)<!-- IF LINEAR --> and include the issue key (`feat/{{TEAM_KEY}}-123-slug`)<!-- END IF -->.

<!-- IF MULTI_REPO -->
## Repos

{{REPOS}}

Read the other repo's instruction file before changing code there.
<!-- END IF -->

## Plan first, route by complexity

Plan before executing when the task touches 3+ files, a schema or migration, or security-sensitive code, or when the right approach is not obvious. Skip planning for trivial one-file edits, read-only questions, or when the exact change is already specified.

Route work to the subagent that fits (defined in `.claude/agents/`):

| Tier | Use when | Agent |
|---|---|---|
| Mechanical | Typos, copy edits, renames, config bumps: the exact change is known | `mechanic` (haiku) |
| Standard | Clear spec or known root cause: a component, endpoint, tests, a contained refactor | `builder` (sonnet) |
| High-stakes or ambiguous | Architecture, data model, unknown-cause debugging, security review, cross-cutting refactors | `architect` (opus) |

Default to the cheapest tier that can succeed; escalate if the result comes back shallow or wrong. Never route ambiguous, high-stakes or security-sensitive work down to a cheap tier.

<!-- IF FRONTEND -->
## UI work: mandatory gate

Applies to any change to how something looks or feels. One padding value, one hover state or a full page: no size threshold.

1. **Design system first.** <!-- IF DESIGN_SYSTEM -->{{DESIGN_SYSTEM_RULE}}<!-- ELSE -->Find the project's existing components and CSS variables and reuse them.<!-- END IF --> Do not hand-roll a component that exists, do not introduce a raw color or size a token already covers, and never add a second styling system for a polish fix. If the system lacks the piece, say so explicitly instead of forking it quietly.
2. **Match the tier.** A micro fix (one property on one element) needs a quick check of the neighbors. Building or reworking a component or section needs a pass on spacing, hierarchy, states and motion. New UI with no settled direction needs a few quick variations before committing.
3. **Build it** matching the project's density and motion language. Where a guideline prescribes an exact value (easing curve, scale, duration), use it exactly.
4. **Audit before done.** Check and report findings as `file:line`:
   - concentric radius (outer = inner + padding) on nested elements
   - optical vs geometric alignment of icons inside buttons
   - shadows for elevation, borders only for structure or state
   - interruptible transitions for state changes; keyframes only for one-shot sequences
   - every state walked: default, hover, focus-visible, active, loading, empty, error
   - `prefers-reduced-motion` honored
   - tabular numbers on anything that counts or changes in place
   - touch hit areas of at least 44px
5. **Look at it.** Run the app and view the change in a browser at mobile and desktop widths before saying it works. A diff that compiles is not a verified UI change.
<!-- END IF -->

<!-- IF BACKEND -->
## Backend work: mandatory gate

Applies to any change to the backend or the database, from a one-line fix to a new module.{{REVIEW_NOTE_BACKEND}}

1. **Start from the remote default branch.** `git fetch origin` and branch off `origin/{{DEFAULT_BRANCH}}`. Check whether the thing already exists before building it.
2. **Read the local rules** (`AGENTS.md`, lessons or notes files) and copy the patterns of the most recent, cleanest module, not legacy ones.
3. **Tests first** for non-trivial logic: red, green, refactor.
4. **Sensitive areas** (auth, roles, guards, row-level security, secrets, public routes) need an explicit security pass: who can call this, what does it return, what happens unauthenticated.
5. **Schema changes** (tables, columns, constraints, functions, triggers, policies): write a migration, apply it to a dev environment first, then production, then verify both are in sync.
6. **Check before done**: {{CHECK_COMMANDS}}.
7. **Prove it.** Exercise every new or changed endpoint locally (for example with `curl`) and report the actual output.

Reporting: say which checks applied and paste the lint/test/build result. If a step was skipped (no database, no token), say which and why; do not report it as done.
<!-- END IF -->

<!-- IF LINEAR -->
## Issue tracking (Linear)

- Team: `{{TEAM_NAME}}`, issue key `{{TEAM_KEY}}`. Issue prose in {{ISSUE_LANGUAGE}}; code identifiers in English and in backticks.
- Project skills in `.claude/skills/`: `linear-planning` (turn a goal into a plan), `issue-authoring` (how issue bodies are written), `linear-sync` (state and comments while coding), `linear-project-health` (status update and changelog after shipping).
- Ground every issue in the real code before prescribing how to implement it.
<!-- END IF -->

<!-- IF GITHUB_ISSUES -->
## Issue tracking (GitHub Issues)

- Reference issues as `#NNN` in commits and PRs. Use `gh issue view` to read an issue before implementing it, and ground it in the real code first.
<!-- END IF -->

## Verify before claiming done

Run {{CHECK_COMMANDS}} and fix what breaks. Say which checks ran and their results; if one was skipped, say why.

<!-- IF HUMAN_REVIEW -->
## Pull requests

PRs are reviewed by a human before merge. Body: what changed, linked issue, whether there is a migration or new environment variable, and which tests or manual checks were run.
<!-- END IF -->
