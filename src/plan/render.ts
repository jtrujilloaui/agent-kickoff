const TOKEN = /<!-- (?:IF ([A-Z0-9_]+)|(ELSE)|(END IF)) -->/g;

interface Frame {
  parentActive: boolean;
  cond: boolean;
  inElse: boolean;
}

/** Resolve IF/ELSE/END IF blocks (nestable), then substitute `{{VAR}}`. */
export function render(
  template: string,
  vars: Record<string, string>,
  flags: Record<string, boolean>,
): string {
  const stack: Frame[] = [];
  const active = () => {
    const top = stack[stack.length - 1];
    return !top || (top.parentActive && (top.inElse ? !top.cond : top.cond));
  };

  let out = "";
  let last = 0;
  for (const m of template.matchAll(TOKEN)) {
    if (active()) out += template.slice(last, m.index);
    last = m.index + m[0].length;

    if (m[1]) {
      if (!(m[1] in flags)) throw new Error(`Unknown template flag: ${m[1]}`);
      stack.push({ parentActive: active(), cond: flags[m[1]], inElse: false });
    } else if (m[2]) {
      const top = stack[stack.length - 1];
      if (!top) throw new Error("ELSE without IF");
      top.inElse = true;
    } else {
      if (!stack.pop()) throw new Error("END IF without IF");
    }
  }
  if (stack.length) throw new Error("Unclosed IF");
  out += template.slice(last);

  return out
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, name: string) => {
      if (!(name in vars)) throw new Error(`Missing template variable: ${name}`);
      return vars[name];
    })
    .replace(/\n{3,}/g, "\n\n");
}
