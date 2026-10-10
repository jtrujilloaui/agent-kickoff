import * as p from "@clack/prompts";
import type { Answers, GenerateKey, RepoFacts, SavedAnswers, TeamShape, Tracker } from "./types";

export const GENERATE_LABELS: Record<GenerateKey, string> = {
  context: "Context skill (stack, commands, structure, data, conventions)",
  instructions: "AGENTS.md + CLAUDE.md (plan-first, quality gates)",
  agents: "Subagents: architect · builder · mechanic",
  linear: "Linear skills: planning, sync, project health, issue authoring",
  design: "Design skills (install commands from their authors' repos)",
};

/** What can be generated for this repo with this tracker, in display order. */
export function availableGenerate(f: RepoFacts, tracker: Tracker): GenerateKey[] {
  const keys: GenerateKey[] = ["context", "instructions", "agents"];
  if (tracker === "linear") keys.push("linear");
  if (f.hasFrontend) keys.push("design");
  return keys;
}

/** Answers for `--yes` (and for "reuse the saved answers"), no prompts. */
export function defaultAnswers(f: RepoFacts, saved?: SavedAnswers, opts: { enrich?: boolean } = {}): Answers {
  const tracker = saved?.tracker ?? "none";
  const allowed = availableGenerate(f, tracker);
  return {
    teamShape: saved?.teamShape ?? "solo",
    tracker,
    linear: tracker === "linear" ? saved?.linear : undefined,
    humanReview: saved?.humanReview ?? false,
    generate: (saved?.generate ?? allowed).filter((g) => allowed.includes(g)),
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
  saved: SavedAnswers | undefined,
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

  const options = availableGenerate(f, tracker).map((value) => ({ value, label: GENERATE_LABELS[value] }));
  const generate = bail(
    await p.multiselect<GenerateKey>({
      message: "What should I generate?",
      options,
      initialValues: options.map((o) => o.value),
      required: true,
    }),
  );

  return {
    teamShape,
    tracker,
    linear,
    humanReview,
    generate,
    enrich: await askEnrich(o.claudeAvailable, o.enrich),
    issueLanguage: saved?.issueLanguage ?? "English",
  };
}
