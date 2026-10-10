// Stand-in for the `claude` CLI in tests. Reads the prompt from stdin and
// replays a short stream-json transcript. FAKE_MODE: ok (default) | nofiles | fail.
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const emit = (o) => process.stdout.write(JSON.stringify(o) + "\n");
  const mode = process.env.FAKE_MODE ?? "ok";
  emit({ type: "system", subtype: "init" });
  emit({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read", input: { file_path: `${process.cwd()}/src/app/page.tsx` } }] },
  });
  emit({ type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "export" } }] } });
  if (mode === "fail") {
    process.stderr.write("boom: not logged in\n");
    process.exit(2);
  }
  if (!input.includes("=== FILE: architecture.md ===")) process.exit(3);
  const body =
    mode === "nofiles"
      ? "I could not find anything."
      : [
          "=== FILE: architecture.md ===\n# Architecture\n\nOne module.\n=== END FILE ===",
          "=== FILE: flows.md ===\n# Flows\n\n1. `src/app/page.tsx:1`\n=== END FILE ===",
          "=== FILE: gotchas.md ===\n# Gotchas\n\nNone yet.\n=== END FILE ===",
          "=== FILE: ../../evil.md ===\nnope\n=== END FILE ===",
        ].join("\n\n");
  emit({ type: "result", subtype: "success", is_error: false, result: body });
});
