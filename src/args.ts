import { parseArgs } from "node:util";

export interface CliOptions {
  dir?: string;
  dryRun: boolean;
  yes: boolean;
  /** true / false when forced by a flag, undefined to ask. */
  enrich?: boolean;
  noMotion: boolean;
  version: boolean;
  help: boolean;
}

export const HELP = (version: string) => `agent-kickoff ${version}

Scan a repo and give coding agents a knowledge base: a context skill,
AGENTS.md, CLAUDE.md, subagents and (optionally) Linear skills.

Usage
  agent-kickoff [dir] [options]

Options
  --dry-run       Show what would be written; write nothing
  -y, --yes       Accept the defaults, no prompts
  --enrich        Run the deep analysis with Claude without asking
  --no-enrich     Skip the deep analysis with Claude
  --no-motion     Keep color, drop animation
  -v, --version   Print the version
  -h, --help      Print this help
`;

/** Throws on unknown flags; the caller prints the message and the help. */
export function parseCli(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean" },
      yes: { type: "boolean", short: "y" },
      enrich: { type: "boolean" },
      "no-enrich": { type: "boolean" },
      "no-motion": { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (positionals.length > 1) throw new Error(`Expected at most one directory, got: ${positionals.join(" ")}`);
  return {
    dir: positionals[0],
    dryRun: !!values["dry-run"],
    yes: !!values.yes,
    enrich: values["no-enrich"] ? false : values.enrich ? true : undefined,
    noMotion: !!values["no-motion"],
    version: !!values.version,
    help: !!values.help,
  };
}
