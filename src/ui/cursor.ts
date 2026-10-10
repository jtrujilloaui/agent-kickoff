import { SHOW_CURSOR } from "./ansi";
import type { Out } from "./term";

export function installCursorGuard(out: Out): void {
  process.on("exit", () => {
    out.write(SHOW_CURSOR);
  });
  process.on("SIGINT", () => {
    out.write(SHOW_CURSOR + "\n");
    process.exit(130);
  });
}
