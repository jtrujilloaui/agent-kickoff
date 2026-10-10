---
name: linear-sync
description: "Keep Linear in sync while coding AND ground every issue in the real codebase before prescribing how to do it. Use at the start of any coding session, whenever an issue key is mentioned or picked up, and whenever work starts, progresses or finishes. Triggers on 'update linear', 'move to in progress', starting an issue, 'how do I do <issue>', opening a PR, or completing a feature."
---

# Linear Sync

Keep the Linear board reflecting reality while you work, without being asked.

## Team setup

Configured by agent-kickoff for **{{TEAM_NAME}}** (`{{TEAM_KEY}}`), team shape **{{TEAM_SHAPE}}**.

Status flow: `Todo` then `In Progress` then (`In Review` if `{{HAS_REVIEW}}` is yes, set when a PR opens) then `Done`.

Team shape:
- **solo**: only touch issues assigned to `me`; with no review, go straight from `In Progress` to `Done` on merge.
- **small**: only touch issues assigned to `me`; set `In Review` when the PR opens.
- **multi-squad**: same, and respect squad boundaries: do not change issues owned by another squad, comment instead.

## Figure out the active project (every session, first)

Do not assume a project; detect it.

1. Identify the issue(s) the current work maps to, in order of confidence:
   - **Branch name**: any `{{TEAM_KEY}}-NNN` token (case-insensitive) in the branch gives the issue directly.
   - **Repo / working directory**: map the folder to its project. When unsure, list projects and pick the one whose name or description matches the repo.
   - **Files being touched vs files named in issue descriptions**, or the feature being discussed.
2. Once an issue is matched, read its `project` field and treat THAT as the active project. Never hardcode one.
3. If issues from several projects are in play, sync each in its own project.

## Ground the issue in the code (before any task-specific "how")

Run this **whenever an issue is mentioned, picked up or about to be worked**, not only at session start. NEVER give implementation steps from the issue text alone: the body is point-in-time and may be stale. Read the real code first, then prescribe. The output is a file-level plan: exactly which files to change, which patterns to mirror, and any drift to flag.

### 1. Map issue to repo and area

Use the issue's project, title prefix and the artifacts named in its body:

{{REPOS}}

If the issue crosses repos, ground each side in its own repo. Read that repo's `CLAUDE.md` / `AGENTS.md` first: its rules are binding.

### 2. Locate and verify real entry points
- Grep/Glob for **every artifact the issue names**: files, symbols, tables/columns, `METHOD /route`, components. Read the actual files; do not trust the issue text.
- Confirm they still exist and that the issue's `## Current state of the code` is still true.
- For a large or unfamiliar area, launch an **Explore** subagent for the fan-out and return conclusions (paths and symbols), not dumps.

### 3. Trace the flow to find where to act
Follow the real call chain end to end (route or page, to state, to data access, to schema/validation, to UI or storage). Find the closest existing analogous feature and mirror its structure.

### 4. Produce a grounded, file-level plan
Translate the issue into concrete steps: which file to create or edit, which module or component to mirror, the exact insertion point, and the repo's own conventions. No generic advice. Propose the **minimal set of edits** that respects the repo's instruction files.

### 5. Surface drift
If real code contradicts the issue (moved file, different endpoint, changed pattern), say so **before executing** and offer to update the issue's current-state section (with `issue-authoring`).

## When a coding session starts

1. Match the current work to issue(s) using the steps above.
2. For every matched issue still in `Todo`/`Backlog`: set `state: "In Progress"`. Do this silently.
3. **Ground the issue in the code** before prescribing or writing anything.
4. If no issue matches and the work is substantial (more than ~30 minutes of changes), offer once to create an issue in the detected project. Do not nag.

## While working

- After a meaningful chunk (a component wired up, an API integrated, a bug fixed), post a short comment on the issue: 2-4 bullets in `{{ISSUE_LANGUAGE}}` saying what is done and what remains. At most one comment per issue per session unless asked.
- Never move an issue backwards (e.g. In Review to In Progress) without confirming.

## When work finishes

- PR opened: set `In Review` (if `{{HAS_REVIEW}}` is yes) and attach the PR link via the `links` parameter.
- Merged or shipped: set `Done`.

## Guardrails

- Only touch issues assigned to the current user.
- Never edit titles, descriptions, priorities or estimates unless explicitly asked. Only `state`, comments and links.
