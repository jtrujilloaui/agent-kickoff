export type ColorLevel = "none" | "256" | "truecolor";

export interface TermCaps {
  color: ColorLevel;
  motion: boolean;
  columns: number;
}

export interface Out {
  write(chunk: string): unknown;
}

export const PLAIN: TermCaps = { color: "none", motion: false, columns: 80 };

export function detectCaps(opts: {
  env: Record<string, string | undefined>;
  isTTY?: boolean;
  columns?: number;
  noMotion?: boolean;
}): TermCaps {
  const { env } = opts;
  const isTTY = !!opts.isTTY;
  const forced = env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "" && env.FORCE_COLOR !== "0";
  let color: ColorLevel = "none";
  if (!(env.NO_COLOR !== undefined && env.NO_COLOR !== "") && (isTTY || forced)) {
    const ct = env.COLORTERM;
    color =
      ct === "truecolor" || ct === "24bit" || env.WT_SESSION !== undefined || env.FORCE_COLOR === "3"
        ? "truecolor"
        : "256";
  }
  const motion = isTTY && color !== "none" && !env.CI && env.TERM !== "dumb" && !opts.noMotion;
  return { color, motion, columns: opts.columns && opts.columns > 0 ? opts.columns : 80 };
}
