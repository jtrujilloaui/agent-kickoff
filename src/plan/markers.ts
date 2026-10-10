export const START = "<!-- agent-kickoff:start -->";
export const END = "<!-- agent-kickoff:end -->";

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/** Split a leading `---\n…\n---\n` block from the rest. */
export function splitFrontmatter(s: string): { frontmatter: string; body: string } {
  const m = FRONTMATTER.exec(s);
  const frontmatter = m ? m[0] : "";
  return { frontmatter, body: s.slice(frontmatter.length) };
}

/** Wrap generated content in markers, keeping any frontmatter above them. */
export function wrap(content: string): string {
  const { frontmatter, body } = splitFrontmatter(content);
  return `${frontmatter}${START}\n${body.trim()}\n${END}\n`;
}

/**
 * Replace the marked region of `existing` with the one from `planned`.
 * Returns null when `existing` has no complete marker pair.
 */
export function mergeMarked(existing: string, planned: string): string | null {
  const s = existing.indexOf(START);
  const e = existing.indexOf(END, s + START.length);
  if (s === -1 || e === -1) return null;

  const pS = planned.indexOf(START);
  const pE = planned.indexOf(END, pS + START.length);
  if (pS === -1 || pE === -1) return null;

  let before = existing.slice(0, s);
  const plannedPrefix = planned.slice(0, pS);
  if (plannedPrefix && FRONTMATTER.test(plannedPrefix)) {
    const isBlank = before.trim() === "";
    const isFrontmatter = FRONTMATTER.exec(before)?.[0] === before;
    if (isBlank || isFrontmatter) before = plannedPrefix;
  }
  return before + planned.slice(pS, pE + END.length) + existing.slice(e + END.length);
}
