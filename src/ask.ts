import * as p from "@clack/prompts";
import { GROUP_LABELS, SECTION_LABELS, offeredSections, offeredSkills, presetSections, presetSkills, type SkillGroup } from "./catalog";
import type { Answers, GenerateKey, RepoFacts, SavedAnswers, SectionKey, TeamShape, Tracker, WorkMode } from "./types";

export const GENERATE_LABELS: Record<GenerateKey, string> = {
  context: "Context skill (stack, commands, structure, data, conventions)",
  instructions: "AGENTS.md + CLAUDE.md (plan-first, quality gates)",
  agents: "Subagents: architect · builder · mechanic",
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  single: "One session",
  subagents: "Subagents by tier",
  multi: "Multi-agent, in parallel",
};

export const GENERATE_KEYS: GenerateKey[] = ["context", "instructions", "agents"];

/** Answers for `--yes` (and for "reuse the saved answers"), no prompts. */
export function defaultAnswers(f: RepoFacts, saved?: Partial<SavedAnswers>, opts: { enrich?: boolean } = {}): Answers {
  const tracker = saved?.tracker ?? "none";
  const workMode = saved?.workMode ?? "subagents";
  const offeredS = offeredSections(f, tracker);
  const offeredK = offeredSkills(f, tracker).map((s) => s.id);
  return {
    teamShape: saved?.teamShape ?? "solo",
    workMode,
    tracker,
    linear: tracker === "linear" ? saved?.linear : undefined,
    humanReview: saved?.humanReview ?? false,
    generate: saved?.generate ? saved.generate.filter((g) => GENERATE_KEYS.includes(g)) : [...GENERATE_KEYS],
    sections: saved?.sections ? saved.sections.filter((k) => offeredS.includes(k)) : presetSections(f, tracker, workMode),
    skills: saved?.skills ? saved.skills.filter((k) => offeredK.includes(k)) : presetSkills(f, tracker, workMode),
    enrich: opts.enrich ?? false,
    issueLanguage: saved?.issueLanguage ?? "English",
  };
}

/** Exits cleanly (nothing written yet) when the user presses Ctrl+C / Esc. */
function bail<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel("Cancelled. Nothing was written.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

async function askEnrich(claudeAvailable: boolean, forced?: boolean): Promise<boolean> {
  if (forced !== undefined) return forced && claudeAvailable;
  if (!claudeAvailable) return false;
  return bail(
    await p.confirm({
      message: "Deep analysis with Claude? It reads the code and writes architecture, flows and gotchas (a few minutes, uses your Claude plan).",
      initialValue: true,
    }),
  );
}

export async function askAnswers(
  f: RepoFacts,
  saved: Partial<SavedAnswers> | undefined,
  o: { claudeAvailable: boolean; enrich?: boolean },
): Promise<Answers> {
  if (saved) {
    const reuse = bail(
      await p.select({
        message: "Found answers from a previous run",
        options: [
          { value: "reuse", label: "Update the knowledge base with them" },
          { value: "again", label: "Answer again" },
        ],
      }),
    );
    if (reuse === "reuse") {
      return { ...defaultAnswers(f, saved), enrich: await askEnrich(o.claudeAvailable, o.enrich) };
    }
  }

  const teamShape = bail(
    await p.select<TeamShape>({
      message: "How is the team shaped?",
      initialValue: saved?.teamShape ?? "solo",
      options: [
        { value: "solo", label: "Solo", hint: "just you" },
        { value: "small", label: "Small team", hint: "2–8 people, one squad" },
        { value: "multi-squad", label: "Several squads" },
      ],
    }),
  );

  const workMode = bail(
    await p.select<WorkMode>({
      message: "How do you work with agents?",
      initialValue: saved?.workMode ?? "subagents",
      options: [
        { value: "single", label: WORK_MODE_LABELS.single, hint: "you and one agent: plan, then execute" },
        { value: "subagents", label: WORK_MODE_LABELS.subagents, hint: "architect · builder · mechanic, one task each" },
        { value: "multi", label: WORK_MODE_LABELS.multi, hint: "parallel agents in separate worktrees" },
      ],
    }),
  );

  const tracker = bail(
    await p.select<Tracker>({
      message: "Where do issues live?",
      initialValue: saved?.tracker ?? "none",
      options: [
        { value: "linear", label: "Linear" },
        { value: "github", label: "GitHub Issues" },
        { value: "none", label: "Nowhere yet" },
      ],
    }),
  );

  let linear: Answers["linear"];
  if (tracker === "linear") {
    const teamName = bail(
      await p.text({
        message: "Linear team name",
        placeholder: "Engineering",
        initialValue: saved?.linear?.teamName,
        validate: (v) => (v?.trim() ? undefined : "Required"),
      }),
    );
    const teamKey = bail(
      await p.text({
        message: "Issue key",
        placeholder: "ENG",
        initialValue: saved?.linear?.teamKey,
        validate: (v) => (/^[A-Z][A-Z0-9]{1,9}$/.test(v ?? "") ? undefined : "2–10 capital letters or digits, like ENG"),
      }),
    );
    linear = { teamName: teamName.trim(), teamKey };
  }

  const humanReview = bail(
    await p.confirm({ message: "Does a person review PRs before they merge?", initialValue: saved?.humanReview ?? false }),
  );

  const options = GENERATE_KEYS.map((value) => ({ value, label: GENERATE_LABELS[value] }));
  const generate = bail(
    await p.multiselect<GenerateKey>({
      message: "What should I generate?",
      options,
      initialValues: workMode === "single" ? ["context", "instructions"] : GENERATE_KEYS,
      required: true,
    }),
  );

  let sections: SectionKey[] = [];
  if (generate.includes("instructions")) {
    sections = bail(
      await p.multiselect<SectionKey>({
        message: "Which sections go in AGENTS.md?",
        options: offeredSections(f, tracker).map((value) => ({ value, label: SECTION_LABELS[value] })),
        initialValues: presetSections(f, tracker, workMode),
        required: false,
      }),
    );
  }

  const groups: Record<string, { value: string; label: string; hint: string }[]> = {};
  for (const s of offeredSkills(f, tracker)) {
    const hint = s.source.kind === "external" ? `${s.hint} · ${s.source.author}` : s.hint;
    (groups[GROUP_LABELS[s.group as SkillGroup]] ??= []).push({ value: s.id, label: s.id, hint });
  }
  const skills = bail(
    await p.groupMultiselect<string>({
      message: "Which skills should I install?",
      options: groups,
      initialValues: presetSkills(f, tracker, workMode),
      required: false,
    }),
  );

  return {
    teamShape,
    workMode,
    tracker,
    linear,
    humanReview,
    generate,
    sections,
    skills,
    enrich: await askEnrich(o.claudeAvailable, o.enrich),
    issueLanguage: saved?.issueLanguage ?? "English",
  };
}
