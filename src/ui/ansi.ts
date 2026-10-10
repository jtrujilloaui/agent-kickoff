export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";
export const CLEAR_LINE = "\r\x1b[2K";
export const RESET = "\x1b[0m";

export function up(n: number): string {
  return n <= 0 ? "" : `\x1b[${n}A`;
}

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export function visibleLength(s: string): number {
  return Array.from(stripAnsi(s)).length;
}

/** Plain text only. Cuts to max-1 code points plus an ellipsis when too long. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  if (max <= 1) return "…";
  return chars.slice(0, max - 1).join("") + "…";
}
