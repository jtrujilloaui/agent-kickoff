import { truncate } from "./ansi";
import { AMBER, BLUE, MUTED, VIOLET, paint } from "./gradient";
import { LiveLine, shimmer, spinner } from "./live";
import { sleep } from "./sleep";
import type { Out, TermCaps } from "./term";

export function railActiveLine(label: string, frame: number, caps: TermCaps): string {
  const text = truncate(label || "scanning", Math.max(1, caps.columns - 8)) + "…";
  return `  ${paint("│", MUTED, caps)} ${paint(spinner(frame), VIOLET, caps)} ${shimmer(text, caps, frame)}`;
}

export class Rail {
  private label = "";
  private queue: string[] = [];
  private started = false;
  private pumping: Promise<void> | undefined;
  private live: LiveLine;

  constructor(
    private out: Out,
    private caps: TermCaps,
  ) {
    this.live = new LiveLine(out, caps, (frame) => railActiveLine(this.label, frame, caps));
  }

  header(title: string): void {
    this.out.write(`  ${paint("◆", VIOLET, this.caps)} ${title}\n`);
  }

  setActive(label: string): void {
    this.label = label;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.live.start();
    this.kick();
  }

  done(text: string, ok = true): void {
    const mark = ok ? paint("✔", BLUE, this.caps) : paint("!", AMBER, this.caps);
    const body = truncate(text, Math.max(1, this.caps.columns - 6));
    this.queue.push(`  ${paint("│", MUTED, this.caps)} ${mark} ${body}`);
    if (this.started) this.kick();
  }

  async finish(): Promise<void> {
    this.start();
    while (this.pumping) await this.pumping;
    this.live.stop(`  ${paint("└", MUTED, this.caps)}`);
  }

  private kick(): void {
    if (this.pumping) return;
    this.pumping = this.pump().finally(() => {
      this.pumping = undefined;
    });
  }

  private async pump(): Promise<void> {
    while (this.queue.length > 0) {
      const wait = this.caps.motion ? Math.min(60, 400 / this.queue.length) : 0;
      this.live.print(this.queue.shift()!);
      if (wait > 0) await sleep(wait);
    }
  }
}
