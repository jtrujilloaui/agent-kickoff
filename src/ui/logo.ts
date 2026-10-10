import { HIDE_CURSOR, SHOW_CURSOR, up } from "./ansi";
import { gradientText } from "./gradient";
import { sleep } from "./sleep";
import type { Out, TermCaps } from "./term";

const GLYPHS: Record<string, [string, string]> = {
  A: ["▄▀█", "█▀█"],
  G: ["█▀▀", "█▄█"],
  E: ["█▀▀", "██▄"],
  N: ["█▄ █", "█ ▀█"],
  T: ["▀█▀", " █ "],
  K: ["█▄▀", "█ █"],
  I: ["█", "█"],
  C: ["█▀▀", "█▄▄"],
  O: ["█▀█", "█▄█"],
  F: ["█▀▀", "█▀ "],
  " ": ["  ", "  "],
};

export function wordmark(text: string): [string, string] {
  const top: string[] = [];
  const bottom: string[] = [];
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`No glyph for "${ch}"`);
    top.push(g[0]);
    bottom.push(g[1]);
  }
  return [top.join(" "), bottom.join(" ")];
}

const [TOP, BOTTOM] = wordmark("AGENT KICKOFF");
export const LOGO_LINES: string[] = [TOP, BOTTOM, "░".repeat(TOP.length)];

const LOGO_WIDTH = Math.max(...LOGO_LINES.map((l) => Array.from(l).length));

export function renderLogo(caps: TermCaps, band?: number): string {
  return (
    LOGO_LINES.map(
      (l) => "  " + gradientText(l, caps, { width: LOGO_WIDTH, band, bandWidth: 8 }),
    ).join("\n") + "\n"
  );
}

export async function playLogo(out: Out, caps: TermCaps, durationMs = 700): Promise<void> {
  if (!caps.motion) {
    out.write("\n" + renderLogo(caps) + "\n");
    return;
  }
  out.write("\n" + HIDE_CURSOR);
  const frames = Math.max(1, Math.round(durationMs / 33));
  const span = LOGO_WIDTH + 16;
  for (let f = 0; f < frames; f++) {
    const band = -8 + (frames > 1 ? (span * f) / (frames - 1) : span);
    out.write(renderLogo(caps, band) + up(LOGO_LINES.length));
    await sleep(33);
  }
  out.write(renderLogo(caps) + "\n" + SHOW_CURSOR);
}
