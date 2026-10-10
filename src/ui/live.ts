import { CLEAR_LINE, HIDE_CURSOR, SHOW_CURSOR } from "./ansi";
import { SOFT, gradientText } from "./gradient";
import type { Out, TermCaps } from "./term";

const SPINNER = ["✷", "✶", "✸", "✹"];

export function spinner(frame: number): string {
  return SPINNER[((frame % SPINNER.length) + SPINNER.length) % SPINNER.length]!;
}

export function shimmer(text: string, caps: TermCaps, frame: number): string {
  const len = Array.from(text).length;
  return gradientText(text, caps, {
    from: SOFT,
    to: SOFT,
    band: (frame * 1.5) % (len + 12) - 6,
    bandWidth: 5,
  });
}

export class LiveLine {
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;

  constructor(
    private out: Out,
    private caps: TermCaps,
    private render: (frame: number) => string,
  ) {}

  private draw(): void {
    this.out.write(CLEAR_LINE + this.render(this.frame));
  }

  start(): void {
    if (!this.caps.motion || this.timer) return;
    this.out.write(HIDE_CURSOR);
    this.draw();
    this.timer = setInterval(() => {
      this.frame++;
      this.draw();
    }, 80);
  }

  print(line: string): void {
    if (!this.timer) {
      this.out.write(line + "\n");
      return;
    }
    this.out.write(CLEAR_LINE + line + "\n");
    this.draw();
  }

  stop(final?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.out.write(CLEAR_LINE + SHOW_CURSOR);
    }
    if (final !== undefined) this.out.write(final + "\n");
  }
}
