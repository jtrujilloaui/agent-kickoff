import { visibleLength } from "./ansi";
import { BLUE, VIOLET, gradientText, paint } from "./gradient";
import type { TermCaps } from "./term";

export function box(lines: string[], caps: TermCaps): string[] {
  const inner = Math.max(0, ...lines.map(visibleLength)) + 4;
  const top = gradientText("╭" + "─".repeat(inner) + "╮", caps);
  const bottom = gradientText("╰" + "─".repeat(inner) + "╯", caps);
  const body = lines.map(
    (l) =>
      `${paint("│", VIOLET, caps)}  ${l}${" ".repeat(inner - 4 - visibleLength(l))}  ${paint("│", BLUE, caps)}`,
  );
  return [top, ...body, bottom].map((l) => "  " + l);
}
