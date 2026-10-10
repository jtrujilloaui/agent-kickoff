import { RESET } from "./ansi";
import type { TermCaps } from "./term";

export type RGB = readonly [number, number, number];

export const VIOLET: RGB = [0x8b, 0x5c, 0xf6];
export const BLUE: RGB = [0x3b, 0x82, 0xf6];
export const MUTED: RGB = [0x6b, 0x72, 0x80];
export const SOFT: RGB = [0xa5, 0xb4, 0xfc];
export const AMBER: RGB = [0xf5, 0x9e, 0x0b];
const WHITE: RGB = [255, 255, 255];

export function lerp(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

export function to256(rgb: RGB): number {
  const c = (v: number) => Math.round((v / 255) * 5);
  return 16 + 36 * c(rgb[0]) + 6 * c(rgb[1]) + c(rgb[2]);
}

export function fg(rgb: RGB, caps: TermCaps): string {
  if (caps.color === "truecolor") return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
  if (caps.color === "256") return `\x1b[38;5;${to256(rgb)}m`;
  return "";
}

export function paint(text: string, rgb: RGB, caps: TermCaps): string {
  if (caps.color === "none" || text === "") return text;
  return fg(rgb, caps) + text + RESET;
}

export function gradientText(
  text: string,
  caps: TermCaps,
  opts: { from?: RGB; to?: RGB; width?: number; band?: number; bandWidth?: number } = {},
): string {
  if (caps.color === "none") return text;
  const chars = Array.from(text);
  const { from = VIOLET, to = BLUE, band, bandWidth = 6 } = opts;
  const width = opts.width ?? chars.length;
  let out = "";
  chars.forEach((ch, i) => {
    if (ch === " ") {
      out += ch;
      return;
    }
    const t = width <= 1 ? 0 : i / (width - 1);
    let color = lerp(from, to, t);
    if (band !== undefined) {
      const d = Math.abs(i - band);
      if (d < bandWidth) color = lerp(color, WHITE, (1 - d / bandWidth) * 0.85);
    }
    out += fg(color, caps) + ch;
  });
  return out + RESET;
}
