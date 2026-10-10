---
name: linear-project-health
description: "Update a Linear project's health and changelog after an issue is completed, grounded in the real PR and commits. Use whenever an issue is marked Done or its PR is merged, or when asked to 'update project health' or 'post a project status update'. Reads the merged PR and commits, summarizes what shipped, posts a project status update with a health signal (onTrack/atRisk/offTrack), and appends to a living changelog document on the project."
---

# Linear Project Health

Keep a Linear **project** honest and documented as issues land. After an issue completes, this skill (1) reads the real PR and commits behind it, (2) posts a **project status update** with a health signal, and (3) appends an entry to a living **changelog document** on the project. Documentation must reflect what actually shipped, never progress invented from an issue title.

## Team setup

Configured by agent-kickoff for **{{TEAM_NAME}}** (`{{TEAM_KEY}}`), team shape **{{TEAM_SHAPE}}**.

Team shape: **solo** keeps updates short (health plus one paragraph) and may batch several issues per update. **small** posts per issue or per merged PR. **multi-squad** posts per project, names the squad, and lists cross-squad blockers explicitly.

Pair with `linear-sync` (moves issue state). This skill runs *after* an issue reaches Done or its PR is up.

## When to run

- An issue or sub-task just moved to **Done**, or its PR was **merged**.
- The user asks to "update project health" or "post a status update".
- A batch of issues landed and the project documentation is stale.

If the work is not merged or done yet, say so and stop: health updates describe shipped reality, not intentions.

## Inputs

- The completed **issue identifier** (e.g. `{{TEAM_KEY}}-247`). If not given, ask or infer from the branch (`git branch --show-current`).
- The **project** the issue belongs to (from the issue's `project` / `projectId`).

## Procedure

### 1. Read the issue and its project
Fetch the issue with relations. Capture `project`, `projectId`, `parentId`, `status` and `attachments` (the PR URL is usually attached once the PR is opened).

### 2. Read the REAL PR and commits
With the `gh` CLI in the repo:
```bash
gh pr view <PR#> --json title,body,state,mergedAt,additions,deletions,files,commits
gh pr diff <PR#> --stat
git log --oneline origin/{{DEFAULT_BRANCH}}..<branch>
```
- Prefer the **merged** PR. If still open, label the entry *in review*, not shipped.
- Summarize from the **diff and commit messages**, not the issue description. Note new routes, components, dependencies, env vars and anything explicitly deferred.

### 3. Assess project health
Pull current state: the project, its issues (remaining, blocked, in progress) and the last status update. Choose health with this rubric:

| Signal | Use when |
|---|---|
| `onTrack` | Remaining issues are unblocked and moving; this completion advances the plan as expected. |
| `atRisk` | A dependency blocks progress (e.g. a UI slice shipped on mock data because the API is not ready), a deadline is tight, or scope is growing. |
| `offTrack` | A blocker has no owner or ETA, the plan slipped materially, or the completed issue showed the approach will not work. |

Be honest. A green status hiding a known blocker is worse than no update. When torn between two, pick the more cautious and explain why.

### 4. Post the project status update
Post a project-type status update with `health` and a markdown body, written in `{{ISSUE_LANGUAGE}}`:
```markdown
**<KEY-XXX> <issue title>: <shipped | in review>**

<2-4 lines: what actually shipped, from the PR/commits. Name new routes/components/deps.>

- PR: <url>
- Key commits: <hash: summary>, ...

**Health:** <onTrack/atRisk/offTrack>: <one-line justification>.
**Pending / blockers:** <what is left or what blocks the next issue>.
```

### 5. Append to the project changelog document
One living document per project, titled **"<Project>: Changelog"**. Find it (search the project's documents for "Changelog"); if missing, create it with a header and the first entry.
- **Prepend** new entries (newest first). Never drop earlier entries: read, then write the full content back.
- Entry format:
```markdown
## <YYYY-MM-DD>: <KEY-XXX> <issue title>

**Status:** <shipped | in review> · **Project health:** <signal>
**PR:** <url>

<2-4 line summary of the real changes.>
Files/areas: <key files or features>.
Pending: <deferred work / blockers>.
```

### 6. Report back
Tell the user: the chosen health with a one-line reason, a link to the status update or project, and the changelog entry added. Surface any blocker you flagged.

## Rules

- **Ground every claim in the diff.** If you cannot access the PR, say so and do not fabricate a summary.
- **Use absolute dates** (today's date in changelog headers).
- **Do not move issue state here.** That is `linear-sync`'s job. This skill only writes health and docs.
- **Idempotent-ish:** check the last status update and the changelog head first; if this issue is already documented, update that entry instead of duplicating.
- **Honest health over green vanity.** A mock-first slice with a backend dependency is `atRisk`, not `onTrack`.
- Never merge or change repo state as part of a health update.
