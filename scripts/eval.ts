// pnpm eval [--set golden|heldout] [--questions v1] [--label name]
// Runs every test question through the same core the chat uses, then scores what came back.
// Scoring is done by code against hand-written expectations. No model grades its own work.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runQuestion, type QuestionSet, type Result, type Step } from "../src/lib/pipeline";
import { team } from "../src/lib/teams";

const ROOT = path.resolve(__dirname, "..");
const CONCURRENCY = 3;
const CONFIDENT = 0.8;

type Case = {
  id: string;
  question: string;
  team: string;
  expect: {
    outcome: string[];
    family?: string[];
    product?: string[];
    queue?: string[];
    source?: string;
    facts?: string[][]; // every group must be satisfied by at least one of its phrases
  };
};

type Row = {
  id: string;
  question: string;
  expected: string;
  got: string;
  outcomeOk: boolean;
  familyOk: boolean | null;
  productOk: boolean | null;
  queueOk: boolean | null;
  pageFound: boolean | null; // right page among the search results
  pageKept: boolean | null; // right page survived the evidence check
  factsOk: boolean | null; // the answer states the expected fact
  pass: boolean;
  family: string | null;
  familyConfidence: number | null;
  product: string | null;
  claimsWritten: number;
  claimsKept: number;
  flags: string[];
  ms: number;
  cost: number;
  decisionCalls: number;
  answer: string | null;
  notes: string[];
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const rate = (xs: (boolean | null)[]) => {
  const scored = xs.filter((x): x is boolean => x !== null);
  return { n: scored.length, right: scored.filter(Boolean).length, rate: scored.length ? scored.filter(Boolean).length / scored.length : null };
};
const samePage = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

function score(c: Case, result: Result, steps: Step[]): Row {
  const e = c.expect;
  const notes: string[] = [];
  const searchStep = steps.find((s): s is Extract<Step, { kind: "search" }> => s.kind === "search");
  const evidenceStep = steps.find((s): s is Extract<Step, { kind: "evidence" }> => s.kind === "evidence");
  const checkStep = steps.find((s): s is Extract<Step, { kind: "check" }> => s.kind === "check");
  const answerText = result.answer ? result.answer.claims.map((x) => x.text).join(" ") : null;

  const outcomeOk = e.outcome.includes(result.outcome);
  if (!outcomeOk) notes.push(`outcome was ${result.outcome}`);

  const familyOk = e.family ? e.family.includes(result.family?.slug ?? "none") : null;
  if (familyOk === false) notes.push(`family was ${result.family?.slug ?? "none"}`);

  const productOk = e.product ? e.product.includes(result.product?.id ?? "general") : null;
  if (productOk === false) notes.push(`product was ${result.product?.id ?? "general"}`);

  const queueOk = e.queue ? (result.handoff ? e.queue.includes(result.handoff.queue.id) : false) : null;
  if (queueOk === false) notes.push(`queue was ${result.handoff?.queue.id ?? "none"}`);

  const pageFound = e.source && searchStep ? searchStep.urls.some((u) => samePage(u, e.source!)) : e.source ? false : null;
  const pageKept = e.source && evidenceStep ? evidenceStep.kept.some((s) => samePage(s.url, e.source!)) : e.source ? false : null;
  if (e.source && !searchStep) notes.push("no search ran");
  else if (e.source && pageFound === false) notes.push("search did not return the right page");
  else if (e.source && pageKept === false) notes.push("evidence check dropped the right page");

  const lower = (answerText ?? "").toLowerCase();
  const factsOk = e.facts ? (answerText ? e.facts.every((group) => group.some((phrase) => lower.includes(phrase))) : false) : null;
  if (factsOk === false && answerText) notes.push("answer left out the expected fact");

  // A case passes when it did the right thing and, if it answered, said the right thing.
  const pass = outcomeOk && queueOk !== false && factsOk !== false;

  return {
    id: c.id,
    question: c.question,
    expected: e.outcome.join(" or "),
    got: result.outcome,
    outcomeOk,
    familyOk,
    productOk,
    queueOk,
    pageFound,
    pageKept,
    factsOk,
    pass,
    family: result.family?.slug ?? null,
    familyConfidence: result.family?.confidence ?? null,
    product: result.product?.id ?? null,
    claimsWritten: checkStep?.claims.length ?? 0,
    claimsKept: checkStep ? checkStep.claims.length - checkStep.removed : 0,
    flags: result.flags,
    ms: result.totals.ms,
    cost: result.totals.cost,
    decisionCalls: result.totals.decisionCalls,
    answer: answerText,
    notes,
  };
}

async function main() {
  const set = arg("set", "golden");
  const version = arg("questions", "v1");
  const label = arg("label", `${set}-${version}`);
  const questions: QuestionSet = JSON.parse(await readFile(path.join(ROOT, "src/lib/questions", `${version}.json`), "utf8"));
  const cases: Case[] = (await readFile(path.join(ROOT, "evals", `${set}.jsonl`), "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  console.log(`${cases.length} questions, question set ${version}\n`);
  const rows: Row[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < cases.length) {
        const i = next++;
        const c = cases[i];
        try {
          const { result, steps } = await runQuestion(c.question, [], team(c.team), questions);
          rows[i] = score(c, result, steps);
        } catch (err) {
          rows[i] = {
            id: c.id, question: c.question, expected: c.expect.outcome.join(" or "), got: "error",
            outcomeOk: false, familyOk: c.expect.family ? false : null, productOk: c.expect.product ? false : null,
            queueOk: c.expect.queue ? false : null, pageFound: null, pageKept: null, factsOk: c.expect.facts ? false : null,
            pass: false, family: null, familyConfidence: null, product: null, claimsWritten: 0, claimsKept: 0,
            flags: [], ms: 0, cost: 0, decisionCalls: 0, answer: null,
            notes: [`run failed: ${err instanceof Error ? err.message : err}`],
          };
        }
        const r = rows[i];
        console.log(`${r.pass ? "pass" : "MISS"}  ${r.id}  ${r.got.padEnd(8)}  ${r.question.slice(0, 70)}${r.notes.length ? `\n      ${r.notes.join("; ")}` : ""}`);
      }
    }),
  );

  const answerable = rows.filter((_, i) => cases[i].expect.outcome.includes("answer"));
  const sendOn = rows.filter((_, i) => !cases[i].expect.outcome.includes("answer"));
  const routed = rows.filter((r) => r.familyOk !== null && r.familyConfidence !== null);
  const confident = routed.filter((r) => (r.familyConfidence ?? 0) >= CONFIDENT);
  const unsure = routed.filter((r) => (r.familyConfidence ?? 0) < CONFIDENT);
  const written = rows.reduce((n, r) => n + r.claimsWritten, 0);
  const kept = rows.reduce((n, r) => n + r.claimsKept, 0);

  const summary = {
    label,
    set,
    questionSet: version,
    ranAt: new Date().toISOString(),
    questions: rows.length,
    overall: rate(rows.map((r) => r.pass)),
    outcome: rate(rows.map((r) => r.outcomeOk)),
    family: rate(rows.map((r) => r.familyOk)),
    product: rate(rows.map((r) => r.productOk)),
    queue: rate(rows.map((r) => r.queueOk)),
    answerable: {
      answeredCorrectly: rate(answerable.map((r) => r.outcomeOk && r.factsOk === true)),
      pageFound: rate(answerable.map((r) => r.pageFound)),
      pageKept: rate(answerable.filter((r) => r.pageFound).map((r) => r.pageKept)),
    },
    sendOn: { correct: rate(sendOn.map((r) => r.outcomeOk && r.queueOk !== false)), wronglyAnswered: sendOn.filter((r) => r.got === "answer").length },
    familyWhenConfident: rate(confident.map((r) => r.familyOk)),
    familyWhenUnsure: rate(unsure.map((r) => r.familyOk)),
    sentences: { written, kept, removed: written - kept },
    medianMs: Math.round(median(rows.filter((r) => r.ms).map((r) => r.ms))),
    medianMsAnswered: Math.round(median(rows.filter((r) => r.got === "answer").map((r) => r.ms))),
    meanCost: rows.reduce((n, r) => n + r.cost, 0) / rows.length,
    totalCost: rows.reduce((n, r) => n + r.cost, 0),
  };

  const show = (name: string, r: { n: number; right: number; rate: number | null }) =>
    console.log(`${name.padEnd(34)} ${r.rate === null ? "n/a" : `${Math.round(r.rate * 100)}%`.padEnd(5)} (${r.right} of ${r.n})`);
  console.log(`\n${label}`);
  show("Did the right thing, said it right", summary.overall);
  show("Right outcome", summary.outcome);
  show("Right product family", summary.family);
  show("Right product", summary.product);
  show("Right owner, when sent on", summary.queue);
  show("Answerable: answered correctly", summary.answerable.answeredCorrectly);
  show("Answerable: search found the page", summary.answerable.pageFound);
  show("  ...and evidence check kept it", summary.answerable.pageKept);
  show("Should send on: did", summary.sendOn.correct);
  console.log(`${"Should send on: answered anyway".padEnd(34)} ${summary.sendOn.wronglyAnswered}`);
  show(`Family right when >= ${CONFIDENT * 100}% sure`, summary.familyWhenConfident);
  show("Family right when less sure", summary.familyWhenUnsure);
  console.log(`${"Sentences written / kept".padEnd(34)} ${written} / ${kept}`);
  console.log(`${"Median time, all / answered".padEnd(34)} ${summary.medianMs} ms / ${summary.medianMsAnswered} ms`);
  console.log(`${"Mean cost per question".padEnd(34)} $${summary.meanCost.toFixed(4)}`);

  await mkdir(path.join(ROOT, "evals", "results"), { recursive: true });
  const out = path.join(ROOT, "evals", "results", `${label}.json`);
  await writeFile(out, JSON.stringify({ summary, rows }, null, 2));
  console.log(`\nsaved ${path.relative(ROOT, out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
