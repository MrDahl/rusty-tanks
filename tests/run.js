// Runs every test in this folder:   node tests/run.js
// Each test prints "ok:" / "FAIL:" lines and exits with an error if something failed.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
let failed = 0;
for (const f of fs.readdirSync(__dirname).filter((n) => n.endsWith(".test.js")).sort()) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const bad = r.status !== 0 || /FAIL/.test(out);
  console.log((bad ? "FAIL  " : "pass  ") + f);
  if (bad) { failed++; console.log(out.split("\n").filter((l) => /FAIL|Error/.test(l)).join("\n")); }
}
console.log(failed ? failed + " test file(s) failed" : "All tests passed");
process.exit(failed ? 1 : 0);
