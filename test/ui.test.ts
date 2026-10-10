import { describe, expect, test } from "bun:test";
import {
  HIDE_CURSOR,
  LOGO_LINES,
  PLAIN,
  Rail,
  SHOW_CURSOR,
  box,
  detectCaps,
  gradientText,
  lerp,
  playLogo,
  railActiveLine,
  renderLogo,
  stripAnsi,
  to256,
  treeLines,
  truncate,
  visibleLength,
  wordmark,
  type TermCaps,
} from "../src/ui";

const collector = () => {
  let s = "";
  return {
    write: (c: string) => ((s += c), true),
    get text() {
      return s;
    },
  };
};
const TRUE: TermCaps = { color: "truecolor", motion: true, columns: 80 };
const C256: TermCaps = { color: "256", motion: false, columns: 80 };

describe("detectCaps", () => {
  test("NO_COLOR", () => {
    const c = detectCaps({ env: { NO_COLOR: "1" }, isTTY: true });
    expect(c.color).toBe("none");
    expect(c.motion).toBe(false);
  });
  test("non-TTY", () => expect(detectCaps({ env: {}, isTTY: false }).color).toBe("none"));
  test("WT_SESSION", () =>
    expect(detectCaps({ env: { WT_SESSION: "x" }, isTTY: true }).color).toBe("truecolor"));
  test("COLORTERM", () =>
    expect(detectCaps({ env: { COLORTERM: "truecolor" }, isTTY: true }).color).toBe("truecolor"));
  test("plain TTY", () => {
    const c = detectCaps({ env: {}, isTTY: true });
    expect(c.color).toBe("256");
    expect(c.motion).toBe(true);
    expect(c.columns).toBe(80);
  });
  test("CI keeps color, no motion", () => {
    const c = detectCaps({ env: { CI: "1" }, isTTY: true });
    expect(c.color).toBe("256");
    expect(c.motion).toBe(false);
  });
  test("TERM=dumb", () =>
    expect(detectCaps({ env: { TERM: "dumb" }, isTTY: true }).motion).toBe(false));
  test("noMotion", () =>
    expect(detectCaps({ env: {}, isTTY: true, noMotion: true }).motion).toBe(false));
});

describe("gradient", () => {
  test("lerp", () => {
    expect(lerp([0, 0, 0], [100, 200, 50], 0)).toEqual([0, 0, 0]);
    expect(lerp([0, 0, 0], [100, 200, 50], 1)).toEqual([100, 200, 50]);
    expect(lerp([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
  });
  test("to256", () => expect(to256([255, 255, 255])).toBe(231));
  test("gradientText", () => {
    expect(gradientText("hello", PLAIN)).toBe("hello");
    expect(gradientText("hello", TRUE).startsWith("\x1b[38;2;139;92;246m")).toBe(true);
    expect(gradientText("hello", C256)).toContain("\x1b[38;5;");
    expect(stripAnsi(gradientText("hello world", TRUE, { band: 3 }))).toBe("hello world");
  });
});

describe("logo", () => {
  test("shapes", () => {
    const [a, b] = wordmark("AGENT KICKOFF");
    expect(a.length).toBe(b.length);
    expect(LOGO_LINES[0]!.length).toBe(LOGO_LINES[2]!.length);
    expect(renderLogo(PLAIN)).not.toContain("\x1b");
    expect(() => wordmark("Z")).toThrow();
  });
  test("playLogo plain", async () => {
    const o = collector();
    await playLogo(o, PLAIN);
    expect(o.text).not.toContain("\x1b");
    expect(o.text).toContain("█");
  });
  test("playLogo motion", async () => {
    const o = collector();
    await playLogo(o, TRUE, 66);
    expect(o.text).toContain(HIDE_CURSOR);
    expect(o.text.endsWith(SHOW_CURSOR)).toBe(true);
  });
});

describe("truncate / rail line", () => {
  test("truncate", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello");
    expect(truncate("hello world", 6)).toBe("hello…");
    expect(truncate("hello", 1)).toBe("…");
    expect(truncate("hello", 0)).toBe("…");
  });
  test("railActiveLine fits", () => {
    const caps: TermCaps = { color: "truecolor", motion: true, columns: 30 };
    expect(visibleLength(railActiveLine("x".repeat(100), 3, caps))).toBeLessThanOrEqual(29);
  });
});

describe("Rail", () => {
  test("no motion output", async () => {
    const o = collector();
    const r = new Rail(o, PLAIN);
    r.header("Scan x");
    r.done("a");
    r.done("b");
    r.done("c", false);
    await r.finish();
    expect(o.text).not.toContain("\x1b");
    expect(o.text.split("\n")).toEqual(["  ◆ Scan x", "  │ ✔ a", "  │ ✔ b", "  │ ! c", "  └", ""]);
  });
});

describe("tree", () => {
  test("treeLines", () => {
    const lines = treeLines(
      [
        { path: ".claude/agents/architect.md", tag: "new" },
        { path: ".claude/agents/builder.md", tag: "new" },
        { path: ".claude/skills/x-context/SKILL.md", tag: "update" },
        { path: "AGENTS.md", tag: "append" },
      ],
      PLAIN,
    );
    const f = (t: string, tag: string) => "  " + t.padEnd(20) + tag;
    expect(lines).toEqual([
      "  .claude/",
      "  ├─ agents/",
      f("│  ├─ architect.md", "new"),
      f("│  └─ builder.md", "new"),
      "  └─ skills/",
      "     └─ x-context/",
      f("      └─ SKILL.md", "update"),
      f("AGENTS.md", "append"),
    ]);
  });
});

describe("box", () => {
  test("plain", () => {
    expect(box(["hello", "a"], PLAIN)).toEqual([
      "  ╭─────────╮",
      "  │  hello  │",
      "  │  a      │",
      "  ╰─────────╯",
    ]);
  });
});
