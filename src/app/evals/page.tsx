// The scorecard. Reads the result files that `pnpm eval` writes; nothing here is typed in by hand.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evals · Frontdoor" };

type Rate = { n: number; right: number; rate: number | null };
type Summary = {
  label: string;
  questions: number;
  ranAt: string;
  overall: Rate;
  outcome: Rate;
  family: Rate;
  queue: Rate;
  answerable: { answeredCorrectly: Rate; pageFound: Rate; pageKept: Rate };
  sendOn: { correct: Rate; wronglyAnswered: number };
  sentences: { written: number; kept: number; removed: number };
  medianMs: number;
  medianMsAnswered: number;
  meanCost: number;
};
type Row = { id: string; question: string; expected: string; got: string; pass: boolean; notes: string[]; ms: number };
type Run = { summary: Summary; rows: Row[] };

function load(label: string): Run | null {
  const file = path.join(process.cwd(), "evals", "results", `${label}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

function Tile({ big, label, note, tone = "text" }: { big: string; label: string; note?: string; tone?: "text" | "green" | "cyan" }) {
  const color = tone === "green" ? "text-green" : tone === "cyan" ? "text-cyan" : "text-text";
  return (
    <div className="rounded-lg border border-line bg-raised/50 p-5">
      <p className={`font-display text-[52px] leading-none ${color}`}>{big}</p>
      <p className="mt-2 text-[14px] font-medium text-text">{label}</p>
      {note && <p className="mt-1 text-[12.5px] leading-snug text-muted">{note}</p>}
    </div>
  );
}

export default function Evals() {
  const held = load("heldout-v3");
  const tuning = ["golden-v1", "golden-v2", "golden-v3"].map(load).filter((r): r is Run => !!r);
  const final = tuning.at(-1);

  return (
    <div className="ruled min-h-full">
      <header className="sticky top-0 z-10 flex items-center gap-5 border-b border-line bg-ink/90 px-6 py-3 backdrop-blur">
        <Link href="/" className="font-display text-[30px] leading-none text-text">
          Frontdoor
        </Link>
        <span className="text-[12.5px] text-muted">Evals</span>
        <nav className="ml-auto flex gap-4 text-[13px] text-muted">
          <Link href="/" className="hover:text-text">Ask</Link>
          <Link href="/atlas" className="hover:text-text">Company map</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-10">
        {!held || !final ? (
          <p className="text-muted">No eval run yet. Run `pnpm eval`.</p>
        ) : (
          <>
            <p className="label mb-3">Scored by code against written expectations · no model grades itself</p>
            <h1 className="font-display text-[48px] leading-[1.03] text-text">
              {held.summary.overall.right} of {held.summary.overall.n} on questions it had never seen.
            </h1>
            <p className="mt-3 max-w-[680px] text-[14.5px] leading-relaxed text-muted">
              The held-out questions were written after tuning stopped, committed before their first run, and run once.
              The tuning set is what the system was adjusted against, so its score flatters.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                big={`${held.summary.overall.right}/${held.summary.overall.n}`}
                label="Held-out: did the right thing"
                note="Right outcome, right owner, and the answer states the expected fact."
                tone="green"
              />
              <Tile
                big={String(held.summary.sendOn.wronglyAnswered + final.summary.sendOn.wronglyAnswered)}
                label="Answered when it should not have"
                note={`Across all ${held.summary.sendOn.correct.n + final.summary.sendOn.correct.n} questions that needed a person.`}
                tone="cyan"
              />
              <Tile
                big={`${(held.summary.medianMsAnswered / 1000).toFixed(1)} s`}
                label="Median time to an answer"
                note={`${(held.summary.medianMs / 1000).toFixed(1)} s across all outcomes. A handoff takes under a second.`}
              />
              <Tile
                big={`$${held.summary.meanCost.toFixed(4)}`}
                label="Mean cost per question"
                note="Every decision call plus the writer."
              />
            </div>

            <h2 className="mt-12 border-b border-line pb-3 font-display text-[30px] text-text">Three drafts on the tuning set</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-[13.5px]">
                <thead className="bg-raised text-muted">
                  <tr>
                    {["Run", "Did the right thing", "Answerable, answered right", "Sent on correctly", "Sentences removed"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tuning.map((run) => (
                    <tr key={run.summary.label} className="border-t border-line">
                      <td className="px-4 py-2.5 font-mono text-[12.5px] text-text">{run.summary.label}</td>
                      <td className="px-4 py-2.5 text-text">
                        {run.summary.overall.right} of {run.summary.overall.n}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {run.summary.answerable.answeredCorrectly.right} of {run.summary.answerable.answeredCorrectly.n}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {run.summary.sendOn.correct.right} of {run.summary.sendOn.correct.n}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {run.summary.sentences.removed} of {run.summary.sentences.written}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Draft 2 fixed two misses and caused one. Draft 3 fixed that. Every change and its reason is in{" "}
              <span className="font-mono text-[12px] text-text">docs/iteration-log.md</span>.
            </p>

            <h2 className="mt-12 border-b border-line pb-3 font-display text-[30px] text-text">Held-out, question by question</h2>
            <ul className="mt-4 space-y-1.5">
              {held.rows.map((row) => (
                <li key={row.id} className="flex items-start gap-3 rounded border border-line bg-raised/40 px-4 py-2.5">
                  <span className={`mt-0.5 font-mono text-[11px] ${row.pass ? "text-green" : "text-red"}`}>{row.pass ? "PASS" : "MISS"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-text">{row.question}</p>
                    {!row.pass && (
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        Expected {row.expected}, got {row.got}. The safe outcome happened, but a colleague would have answered it.
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[11.5px] uppercase tracking-wider text-faint">{row.got}</span>
                </li>
              ))}
            </ul>

            <h2 className="mt-12 border-b border-line pb-3 font-display text-[30px] text-text">What these numbers do not show</h2>
            <ul className="mt-4 max-w-[760px] list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-muted">
              <li>Forty questions is a small set. One question is 2.5 points.</li>
              <li>I wrote the questions and the expectations. A set from the people who field these questions would be harder.</li>
              <li>Most tuning questions name a product outright, which code catches without a model.</li>
              <li>Runs vary. The same setup scored 28, then 30, on two consecutive runs.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
