// pnpm knowledge:lint
// Checks the OKF bundle: required fields, working links, every product placed in a real family.
import { existsSync } from "node:fs";
import path from "node:path";
import { loadBundle } from "../src/lib/okf";

const dir = path.resolve(__dirname, "..", "knowledge");
const b = loadBundle(dir);
const problems: string[] = [];

for (const e of b.entities.values()) {
  if (!e.resource) problems.push(`${e.id}: no source link (resource)`);
  if (!e.title) problems.push(`${e.id}: no title`);
  if ((e.type === "Product" || e.type === "Agent") && !b.entities.has(`families/${e.family}`)) {
    problems.push(`${e.id}: family "${e.family}" does not exist`);
  }
  if (e.type === "Queue" && !e.illustrative) problems.push(`${e.id}: queue is not marked illustrative`);
  for (const link of e.links) {
    if (!b.entities.has(link.to)) problems.push(`${e.id}: broken link to /${link.to}.md`);
  }
}
for (const reserved of ["index.md", "log.md"]) {
  if (!existsSync(path.join(dir, reserved))) problems.push(`${reserved} is missing`);
}

const counts: Record<string, number> = {};
for (const e of b.entities.values()) counts[e.type] = (counts[e.type] ?? 0) + 1;
console.log(`${b.entities.size} entities`, counts);
const unverified = [...b.entities.values()].filter((e) => e.needsVerification).map((e) => e.id);
if (unverified.length) console.log(`marked needs_verification: ${unverified.join(", ")}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("knowledge bundle is clean");
