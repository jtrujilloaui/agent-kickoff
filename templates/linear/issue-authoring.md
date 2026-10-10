---
name: issue-authoring
description: "Write Linear (or GitHub) issues with a consistent structure and voice. Use ALWAYS before creating or drafting an issue: features, backend specs, cross-team handoffs, bugs, epics, sub-tasks or design issues. Complements linear-sync (states, comments, links) and linear-planning (decomposition); this skill covers HOW the issue body is written. Triggers: 'create issue', 'write up a task', 'open a ticket', 'move this to Linear', drafting an issue body."
---

# Issue Authoring

Defines how issues are written so every one is grounded, specific and executable without follow-up questions. For states, comments and PRs use **linear-sync**; this skill covers **the content of the issue**.

## Team setup

Configured by agent-kickoff for **{{TEAM_NAME}}** (`{{TEAM_KEY}}`), team shape **{{TEAM_SHAPE}}**.

Team shape:
- **solo**: always the minimalist skeleton unless it is a contract or a bug. No handoff skeleton, no approval lines.
- **small**: add an explicit review line to design and contract issues.
- **multi-squad**: use the handoff skeleton whenever one squad needs work from another; name the requesting and owning squad.

## Before creating (always)

1. **Check for duplicates**: list issues for `{{TEAM_NAME}}` (including archived) and compare. If something similar exists, reference it with `Depends on...` / `Related:` instead of duplicating.
2. **Show the draft and wait for approval** before creating, unless the user says "just create it".
3. **Always assign a project.** If it is part of an epic, use `parentId` and list it under `## Sub-issues` / `## Child Work` of the parent.

## Voice and format

- **Language**: prose in `{{ISSUE_LANGUAGE}}`. Code identifiers are always in English and in `backticks`: *"extract `institution_id` from `req.user.id`"*, `AbortSignal.timeout(30_000)`.
- **Directive, declarative tone.** Imperative verbs ("Add...", "Mirror the orders module", "Replace..."). State decisions as closed facts **with dated authority**: `(decided 2026-06-19)`, `(agreed in chat)`, `(<person>, <channel>, <date>)`.
- **No decorative emojis** in prose. Allowed only inside a specified output format (a CI or chat template).
- **Tables** only as a payload/field contract (`Field | Type | Content`). Everything else: checklists and code blocks.
- **Density**: no filler, no invented scaffolding ("User Story", an empty "Out of Scope"). Default to the minimalist tier unless the issue is foundational, a contract, or blocking.

## Title

Format `Prefix: concrete description` (pack the *what* and the *where*; reference real modules, files or routes). Typical prefixes, adapt to `{{TITLE_PREFIXES}}`:

- **By domain**: `Backend:` · `Frontend:` · `SDK:` · `Migration:` · `Tests:` · `Content:` · `Design:`
- **By audience**: `Students:` · `Teachers:` · `Admin:`
- **Brackets = cross-discipline handoff**: `[Frontend Support]` · `[QA Support]` · `[Backend]`
- **Other archetypes**: `Bug:` · `Epic:` · `Phase N:`
- **Conventional-commit style** (lowercase): `feat(frontend): ...`, `fix(api): ...`

## Choosing the skeleton

| Type | Skeleton |
|---|---|
| Sub-task or product feature (default) | **Minimalist** |
| Backend spec or contract | **Full spec** |
| UI blocked by another team or layer | **Handoff** |
| Bug | **Bug** |
| Large refactor or performance epic | **Epic** |
| Design issue | **Minimalist + design link and approval item** |

### Minimalist (no headings)
```
<1-2 declarative lines describing the change, imperative verbs>

- [ ] <concrete step naming a real artifact>
- [ ] <concrete step>
- [ ] Design link attached            # if UI
- [ ] Design approved by <reviewer>   # design issues, if the team reviews

Depends on {{TEAM_KEY}}-NN. / Blocks {{TEAM_KEY}}-NN.
```

### Full spec (backend / contract)
```
## Context
## Current state of the code        (or inline: "Today X; Y is missing" / "Net-new" / "Already exists (solid): ...")
## What is needed
   ### Affected endpoints / Database schema (new tables) / File structure
## Closed decisions / Design clarifications
## Important: do NOT include ...    (negative-constraint heading, when there is a security or spoiler risk)
## Technical notes
## Acceptance criteria              (numbered, verifiable, includes a negative/security criterion)
```

### Handoff (cross-team or cross-layer)
A family, not six fixed sections. Anchor on `## Summary` + a blocker section + `## Acceptance Criteria`.
```
## Summary           (1 line: what is requested and why the requester cannot finish it alone)
## Problem / ## Current State    (bullets: requested change, current blocker, why it cannot be done locally)
## Requested Change / ## Contract   (numbered, file by file, with METHOD /route)
## Affected Areas    (files, API fields)
## Acceptance Criteria   (include "unauthenticated requests rejected")
## Out of Scope (this pass)
## Notes for Handoff   (requesting owner, requested owner)
```

### Bug
```
## Problem        (symptom plus user impact)
## Root Cause     (code fence with the culprit line and a pointer comment: // <- no debounce)
## Fix            (code fence with the patch)
## Files          (list path:line)
```

### Epic
```
# <Name> (Epic)
## Goal / ## Success Criteria
## Scope decision (locked)   (In scope / Out of scope, deferred)
## Implementation Rules
## Child Work                (numbered, linking child issues)
## Deliverables              (doc paths)
## Final status              (when closing)
```

## Conveying steps

- **Checklists `- [ ]`** are the unit of work and of acceptance criteria; `- [x]` on completion.
- **Every item names a real artifact**: a file (with `:line` in bugs), `table`/`column`, `METHOD /v1/route?query`, a code symbol, a migration name, a package. All in `backticks`.
- **`## Current state of the code` is the grounding device**: say what exists vs what is net-new before prescribing.
- **Acceptance criteria are verifiable end states**, almost always with a **negative/security criterion** (*"the correct answer is NOT returned by the start endpoint"*, *"`userId` always comes from the session, never from body or query"*, *"unauthenticated requests rejected"*) and, for UI, an item like `- [ ] Visual QA on localhost at mobile and desktop widths`.

## Signature devices (use when they apply)

- **Negative-constraint heading**: `## Important: do NOT include <sensitive fields> in the response` plus its mirror acceptance criterion.
- **Table-as-contract**: `Field | Type | Content` for payload shapes.
- **"Copy literally"**: to port a prototype, list the files and add `## Only allowed change: data source`.
- **"Mirror module X"**: reference an existing module as the template (*"Mirror the orders module (cleanest CRUD)"*).
- **Pointer comments in bug fences**: `// <- no debounce`, `// ^ no timeout`.
- **Dated authority** for decisions: `(decided <date>)`.

## Cross-references

- Mention issues as `{{TEAM_KEY}}-NN` in markdown (the tracker turns them into rich mentions).
- Dependency lines go at the end of the body: `Depends on KEY-NN` · `Blocks: KEY-NN` · `Blocked by: KEY-NN` · `Unblocks KEY-NN`.
- Repos and projects go in backticks: `{{REPOS}}`.
- Design link as a checklist item; design issues close with an approval item when the team has a design review.

## Metadata

- **Labels**: a type label (`Feature`, `Bug`, `Improvement`) plus an area label (`backend`/`frontend`) on technical issues.
- **Priority with meaning**: Urgent = ship-blocking or contract; High = active feature; Medium = follow-up; Low = exploration; None = backlog.
- **Estimate**: optional, rarely used. Do not force it.
- **Assignee** follows `{{TEAM_SHAPE}}`: solo assigns the user; otherwise assign by domain, and for handoffs assign the owner of the requested work, not the requester.

## Don't

- No decorative emojis in prose.
- No tables except as a field/payload contract.
- No vague tasks: every checklist item names an artifact.
- Do not expose sensitive fields (secrets, answers, internal analysis) in start/browse contracts.
- Do not invent provenance: cite the real roadmap item or conversation date.
- Do not duplicate: check existing issues and reference them.
