// pnpm ask "question" [team]   Runs one question through the core and prints the trace.
import { run, type Step } from "../src/lib/pipeline";
import { team } from "../src/lib/teams";

const pct = (p: number) => `${Math.round(p * 100)}%`;

function print(step: Step) {
  switch (step.kind) {
    case "lookup":
      console.log(`lookup    named: ${step.named.map((n) => n.title).join(", ") || "none"}`);
      break;
    case "family":
      console.log(`family    ${step.title} (${pct(step.confidence)})  [${step.ms} ms]`);
      console.log(`          ${step.bars.map((b) => `${b.title} ${pct(b.p)}`).join(" | ")}`);
      console.log(`          ${step.checks.map((c) => `${c.id} ${pct(c.p)}`).join(" | ")}`);
      break;
    case "product":
      console.log(`product   ${step.title} (${pct(step.confidence)}) by ${step.decidedBy}  [${step.ms} ms]`);
      break;
    case "gate":
      console.log(`gate      ${step.stage}: ${step.outcome}${step.reasons.length ? ` because ${step.reasons.join(" ")}` : ""}`);
      break;
    case "search":
      console.log(`search    ${step.candidates} candidates  [${step.ms} ms]`);
      break;
    case "evidence":
      console.log(`evidence  kept ${step.kept.length} of ${step.considered}  [${step.ms} ms, ${step.calls} calls]`);
      for (const s of step.kept) console.log(`          [${s.n}] ${pct(s.p)} ${s.page} / ${s.heading}`);
      break;
    case "write":
      console.log(`write     ${step.model}  [${step.ms} ms]`);
      break;
    case "check":
      console.log(`check     ${step.claims.length - step.removed} kept, ${step.removed} removed  [${step.ms} ms, ${step.calls} calls]`);
      for (const c of step.claims) console.log(`          ${c.kept ? "keep" : "DROP"} ${c.verdict} ${pct(c.confidence)}: ${c.text.slice(0, 110)}`);
      break;
    case "final": {
      const r = step.result;
      console.log(`\nOUTCOME   ${r.outcome.toUpperCase()}  flags: ${r.flags.join(", ") || "none"}`);
      if (r.answer) {
        for (const c of r.answer.claims) console.log(`  ${c.text} ${c.cites.map((n) => `[${n}]`).join("")}`);
        if (r.answer.notCovered) console.log(`  Not covered: ${r.answer.notCovered}`);
        for (const s of r.answer.sources) console.log(`  [${s.n}] ${s.url}`);
      }
      if (r.handoff) {
        console.log(`  to: ${r.handoff.queue.title}${r.handoff.queue.illustrative ? " (illustrative)" : ""}`);
        for (const reason of r.handoff.reasons) console.log(`  why: ${reason}`);
      }
      console.log(`  map: ${r.map.map((n) => n.title).join(" -> ")}`);
      console.log(`  totals: ${r.totals.decisionCalls} decision calls, ${r.totals.writerCalls} writer calls, ${(r.totals.ms / 1000).toFixed(1)} s, $${r.totals.cost.toFixed(4)}`);
    }
  }
}

async function main() {
  const [question, teamSlug] = process.argv.slice(2);
  if (!question) throw new Error('Usage: pnpm ask "question" [team]');
  console.log(`\nQ: ${question}\n`);
  for await (const step of run(question, [], team(teamSlug))) print(step);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
