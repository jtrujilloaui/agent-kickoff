---
name: linear-planning
description: "Reactive, goal-backward planning for Linear. Turns an objective, feature or roadmap item into an executable plan inside Linear (project, milestones, issues with dependencies) and keeps it alive with gap closure when reality changes. Use when asked to 'plan X', 'break this feature into issues', 'create the project plan in Linear', 're-plan', or when QA reveals gaps that need new issues. Pairs with issue-authoring (issue bodies), linear-sync (status while coding) and linear-project-health (health and changelog after shipping)."
---

# Linear Planning

Goal-backward decomposition, dependency waves, a plan-checker pass and gap closure, expressed as real Linear objects. Guiding principle: **the plan is the prompt**: every issue must be executable without further interpretation. Second principle: **issues, not user stories**, and **small-scope projects** (1-3 weeks) that ship and iterate.

## Team setup

Configured by agent-kickoff for **{{TEAM_NAME}}** (`{{TEAM_KEY}}`), team shape **{{TEAM_SHAPE}}**.

Team shape changes the plan:
- **solo**: assignee is always the user. Skip owner questions. Milestones are just delivery stages. No review steps in checklists unless the user asks.
- **small**: assign by domain or by who has capacity; ask once if unclear. Add a review step to issues that touch shared contracts.
- **multi-squad**: milestones may map to squads; issues carry the owning squad as a label and cross-squad dependencies are explicit `blocked by` relations. Contract-first issues are mandatory when two squads consume the same interface.

## Mapping: goal-backward planning to Linear

| Planning concept | Linear object |
|---|---|
| Project brief and requirements | Project plus brief (project content) |
| Roadmap phase | Milestone (or its own project if it exceeds ~3 weeks) |
| A unit of work (2-3 tasks) | Issue with a 2-5 item checklist |
| Task with files, action, verify, done | Checklist item naming a real artifact plus acceptance criteria |
| Dependencies and waves | `Blocked by` / `Blocks` relations; Wave 1 = startable now |
| Must-haves (truths, artifacts, key links) | Brief success criteria, issue acceptance criteria, an explicit wiring item |
| Locked decisions and deferred ideas | `## Closed decisions` and `## Out of scope` in the brief |
| Verification gaps | Gap closure: new issues, never rewrites |
| Retros and state | Delegated to `linear-project-health` |

## Modes

1. **New plan**: objective or feature becomes a project (or milestone in an existing project) plus issues.
2. **Decompose something existing**: an epic or a roadmap project with no issues becomes sub-issues or issues.
3. **Gap closure / re-plan**: QA failed, scope changed or a blocker appeared; add issues to the living plan.

Detect the mode first. In modes 2 and 3 the container already exists and is NOT recreated.

## Phase 1: Discuss before planning

Lightweight: at most 3-5 high-value questions (batched, via AskUserQuestion), and only if there is real ambiguity. Capture three lists:

- **Closed decisions**: non-negotiable; every issue must honor them literally. Record each with a dated authority: `(decided 2026-01-15)`, `(<person or channel>, <date>)`.
- **Deferred**: forbidden in the plan. Not an issue, not a checklist item.
- **Discretion**: decided during decomposition and documented in the issue.

The goal must be **outcome-shaped**, not task-shaped: "Teachers can assign practice by topic" yes, "Build the practice module" no.

## Phase 2: Ground in reality (double grounding)

**a) Real code.** Never decompose from the prompt alone. Map the work to a repo using `{{REPOS}}`, read the actual files, and produce a `## Current state of the code` section: what exists, what is net-new, which existing module to mirror. For large areas use an Explore subagent.

**b) Real Linear.**
- List projects: does the work fit an existing project? If so, plan INSIDE it (mode 2) instead of creating another.
- List issues for `{{TEAM_NAME}}` including archived: look for duplicates. If something exists, reference it (`Depends on {{TEAM_KEY}}-NN` / `Related:`) instead of duplicating.
- If the team runs cycles, note the current cycle for the Wave 1 proposal.

## Phase 3: Goal-backward decomposition

Do not ask "what do we build?" Ask "what must be TRUE for the goal to be met?"

1. **Goal** becomes 2-5 **observable truths** from the user's perspective ("The teacher can create an assignment filtered by topic", "The assignment persists after refresh"). Each is verifiable by a human using the app.
2. Each truth becomes the **artifacts** that must exist (concrete files, tables, endpoints; never "auth module").
3. Each artifact gets its **wiring**: what must be connected. **Key links** (connections where a break cascades: submit to API, API to DB, component to real data) get their own checklist item or wiring issue.
4. Group artifacts plus wiring into **issues**.

**Size and shape rules**
- A project completes in **1-3 weeks**; otherwise split into **milestones** or cut to v1 and move the rest to `## Out of scope`.
- An issue finishes in **at most one day of focused work**, with 2-5 checklist items naming real artifacts. Bigger: split. Smaller than ~30 minutes: merge into a neighbor.
- **Vertical slices, not horizontal layers**: "Complete lists feature (model + API + UI)" yes; "all tables, then all endpoints, then all UI" no. Layers only for genuinely shared foundations (auth before protected features).
- **Interface-first** when several issues share a contract: the first issue defines it (types, endpoint shape, table) and unblocks the rest in parallel.

**Waves and dependencies**
- No dependencies = Wave 1; depends only on Wave 1 = Wave 2; and so on.
- Mark only REAL dependencies with `Blocked by`. No reflexive chaining (issue 3 does not depend on issue 2 just because it comes later).
- Assignment follows `{{TEAM_SHAPE}}` (see Team setup). When ownership is unclear, ask once.

## Phase 4: Quality gate (plan-checker)

Before showing the draft, verify:

- [ ] **Coverage**: every success criterion has at least one issue delivering it; every issue serves at least one criterion.
- [ ] **Completeness**: each issue names real artifacts and has acceptance criteria stated as verifiable end states, with a negative/security criterion where relevant.
- [ ] **Executable without interpretation**: could another developer (or an agent) run it without asking questions?
- [ ] **Dependencies**: no cycles; nothing blocked by something that exists neither in the plan nor in Linear.
- [ ] **Scope sanity**: project at most 3 weeks, issues at most 1 day, no ceremony theater or enterprise artifacts (hour estimates, RACI).
- [ ] **Key links planned**: each critical connection has a wiring item.
- [ ] **Fidelity**: every closed decision has an issue that implements it; nothing deferred appears.

If anything fails, fix the plan and re-run the gate (at most 2-3 rounds).

## Phase 5: Draft and approval (mandatory)

**NEVER create anything in Linear without showing the full draft and getting explicit approval**, unless the user says "just create it". Present:

1. The project (or milestone) brief in full.
2. A summary table: `# | Title | Assignee | Priority | Wave | Blocked by | Milestone`.
3. Every issue body (written per `issue-authoring`).

## Phase 6: Create in Linear

Creation order (IDs from each step feed the next):

1. **Project**, with the brief as content:
   ```
   ## Objective         (outcome, 1-2 lines, plus provenance of the request)
   ## Success criteria  (the 2-5 observable truths, numbered)
   ## Closed decisions  (with dated authority)
   ## Out of scope      (deferred items, explicit)
   ## Plan              (waves and what unblocks what)
   ```
2. **Milestones**, one per stage, in delivery order.
3. **Issues**, one at a time, with project, milestone, assignee, labels (type label plus area label such as backend/frontend) and meaningful priority (Urgent = ship-blocking or contract; High = active feature; Medium = follow-up; Low = exploration). Estimates are optional.
4. **Relations**: `Blocked by` / `Blocks`, and `parentId` for epic sub-issues. Also put `Depends on {{TEAM_KEY}}-NN` lines at the end of the body.
5. If a cycle is active, propose (do not execute alone) moving Wave 1 into it.

Close with a summary: table of created issues with their IDs, the wave structure, and the next step ("Wave 1 can start now: ...").

## Phase 7: Gap closure (keep the plan alive)

When QA fails, scope changes or a blocker appears:

- **Do not rewrite** existing issues or the whole brief. Be a surgeon, not an architect.
- Derive new issues from the gap (truth that failed, what is missing, new issue). Mark them `gap-closure` in the body (`Closes gap from {{TEAM_KEY}}-NN / QA <date>`).
- Update only the affected relations and add the new decision to the brief's `## Closed decisions` with a date.
- Obsolete issue: cancel it with a comment explaining why. Never delete.
- Offer to run `linear-project-health` for a status update (atRisk if the gap threatens the timeline).

## Boundaries with sibling skills

- **Issue bodies**: `issue-authoring`.
- **State and comments while coding**: `linear-sync` (this skill never moves states).
- **Health and changelog after shipping**: `linear-project-health`.

## Don't

- Create nothing without an approved draft; do not duplicate without checking existing (including archived) issues.
- No user stories, no verbose templates, no empty scaffolding.
- No horizontal layers, no reflexive dependency chains.
- No human-time estimates inside issues (control size by splitting).
- Nothing deferred "just in case": deferred means invisible in the plan.
- Do not leave an implementation issue without a repo and layer: it must say which module of which repo it touches, and whether it needs a migration.

## Tool names

The Linear tool calls assume an MCP server mounted as `linear` (tools like `mcp__linear__save_issue`). If your connector uses another prefix (for example the claude.ai connector), resolve the real prefix before Phase 6. If none is authenticated, ask the user to run `/mcp` first.
