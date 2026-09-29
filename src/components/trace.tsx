"use client";

// The side panel: every decision behind an answer, in the order it was made.
import type { Step, Result, Bar } from "@/lib/pipeline";
import type { MapNode } from "@/lib/okf";

export type Preview = Extract<Step, { kind: "family" }> & { named: { id: string; title: string }[] };

const pct = (p: number) => `${Math.round(p * 100)}%`;
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`);

function Section({
  n,
  title,
  by,
  meta,
  children,
}: {
  n: string;
  title: string;
  by?: "code" | "jev" | "claude";
  meta?: string;
  children?: React.ReactNode;
}) {
  const tone = by === "jev" ? "text-cyan border-cyan/30" : by === "claude" ? "text-amber border-amber/30" : "text-muted border-line-strong";
  return (
    <section className="rise border-b border-line px-5 py-4">
      <header className="mb-2.5 flex items-baseline gap-2.5">
        <span className="font-mono text-[11px] text-faint">{n}</span>
        <h3 className="text-[13.5px] font-medium text-text">{title}</h3>
        {by && (
          <span className={`rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider ${tone}`}>{by}</span>
        )}
        {meta && <span className="ml-auto font-mono text-[11px] text-faint">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

function Bars({ bars, threshold }: { bars: Bar[]; threshold?: number }) {
  return (
    <div className="space-y-1.5">
      {bars.map((bar, i) => (
        <div key={bar.id} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
          <div className="relative h-7 overflow-hidden rounded bg-high">
            <div
              className={`bar-fill absolute inset-y-0 left-0 ${i === 0 ? "bg-accent" : "bg-line-strong"}`}
              style={{ width: `${Math.max(bar.p * 100, 1.5)}%` }}
            />
            {threshold !== undefined && (
              <div className="absolute inset-y-0 w-px bg-white/25" style={{ left: `${threshold * 100}%` }} />
            )}
            <span className="absolute inset-y-0 left-2.5 flex items-center truncate pr-2 text-[12.5px] text-text">
              {bar.title}
            </span>
          </div>
          <span className={`text-right font-mono text-[12.5px] ${i === 0 ? "text-text" : "text-faint"}`}>{pct(bar.p)}</span>
        </div>
      ))}
    </div>
  );
}

function Checks({ checks, cutoff = 0.6 }: { checks: { id: string; label: string; p: number }[]; cutoff?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {checks.map((c) => {
        const on = c.p >= cutoff;
        return (
          <span
            key={c.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
              on ? "border-cyan/40 bg-cyan/10 text-text" : "border-line text-faint"
            }`}
          >
            {c.label}
            <span className={`font-mono text-[11px] ${on ? "text-cyan" : "text-faint"}`}>{pct(c.p)}</span>
          </span>
        );
      })}
    </div>
  );
}

const OUTCOME_STYLE: Record<string, { label: string; className: string }> = {
  answer: { label: "Answer", className: "border-green/40 bg-green-soft text-green" },
  handoff: { label: "Hand off", className: "border-amber/40 bg-amber-soft text-amber" },
  escalate: { label: "Escalate to a person", className: "border-red/40 bg-red-soft text-red" },
  search: { label: "Clear to search", className: "border-line-strong bg-high text-muted" },
};

function GateLine({ step }: { step: Extract<Step, { kind: "gate" }> }) {
  const style = OUTCOME_STYLE[step.outcome];
  const stage = step.stage === "route" ? "Routing rules" : step.stage === "evidence" ? "Evidence rule" : "Sentence rule";
  return (
    <div className="rise flex items-start gap-3 border-b border-line bg-raised/60 px-5 py-3">
      <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">{stage}</span>
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${style.className}`}>
          {style.label}
        </span>
        {step.reasons.map((r) => (
          <p key={r} className="mt-1.5 text-[12.5px] leading-snug text-muted">
            {r}
          </p>
        ))}
      </div>
      <span className="rounded border border-line-strong px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted">code</span>
    </div>
  );
}

export function CompanyMap({ nodes }: { nodes: MapNode[] }) {
  if (!nodes.length) return null;
  return (
    <div className="px-5 py-4">
      <p className="label mb-3">Company map</p>
      <ol>
        {nodes.map((node, i) => {
          const focus = node.type === "Product" || node.type === "Agent";
          return (
            <li key={`${node.id}-${i}`} className="rise relative pl-6" style={{ animationDelay: `${i * 70}ms` }}>
              {i < nodes.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line-strong" />}
              <span
                className={`absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2 ${
                  focus ? "border-accent bg-accent" : node.type === "Queue" ? "border-amber bg-ink" : "border-line-strong bg-ink"
                }`}
              />
              <a
                href={`/atlas#${node.id}`}
                target="_blank"
                rel="noreferrer"
                className="block pb-3.5 hover:opacity-80"
              >
                <span className="label !tracking-[0.1em]">
                  {node.note}
                  {node.illustrative ? " · illustrative" : ""}
                </span>
                <span className={`block text-[13.5px] leading-tight ${focus ? "font-medium text-text" : "text-muted"}`}>
                  {node.title}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LivePanel({ preview, loading }: { preview: Preview | null; loading: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span className={`h-2 w-2 rounded-full bg-cyan ${loading ? "pulse-dot" : ""}`} />
        <p className="label !text-cyan">Routing as you type</p>
        {preview && <span className="ml-auto font-mono text-[11px] text-faint">{ms(preview.ms)}</span>}
      </div>
      {!preview ? (
        <p className="px-5 py-5 text-[13px] leading-relaxed text-muted">Keep typing. The first decision runs on every pause.</p>
      ) : (
        <>
          {preview.named.length > 0 && (
            <Section n="01" title="Named in the question" by="code">
              <div className="flex flex-wrap gap-1.5">
                {preview.named.map((n) => (
                  <span key={n.id} className="rounded border border-accent/40 bg-accent-soft px-2 py-0.5 text-[12.5px] text-text">
                    {n.title}
                  </span>
                ))}
              </div>
            </Section>
          )}
          <Section n="02" title="Product family" by="jev" meta={`${pct(preview.confidence)} sure`}>
            <Bars bars={preview.bars} />
          </Section>
          <Section n="03" title="What kind of question" by="jev">
            <Checks checks={preview.checks} />
          </Section>
        </>
      )}
    </div>
  );
}

export function TracePanel({ steps, result, busy }: { steps: Step[]; result: Result | null; busy: boolean }) {
  let n = 0;
  const next = () => String(++n).padStart(2, "0");
  return (
    <div>
      {steps.map((step, i) => {
        switch (step.kind) {
          case "lookup":
            return (
              <Section key={i} n={next()} title="Named in the question" by="code">
                {step.named.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {step.named.map((x) => (
                      <span key={x.id} className="rounded border border-accent/40 bg-accent-soft px-2 py-0.5 text-[12.5px] text-text">
                        {x.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-faint">No product is named. The model decides.</p>
                )}
              </Section>
            );
          case "family":
            return (
              <div key={i}>
                <Section n={next()} title="Product family" by="jev" meta={`${pct(step.confidence)} sure · ${ms(step.ms)}`}>
                  <Bars bars={step.bars} />
                </Section>
                <Section n={next()} title="What kind of question" by="jev">
                  <Checks checks={step.checks} />
                </Section>
              </div>
            );
          case "product":
            return (
              <Section
                key={i}
                n={next()}
                title="Product"
                by={step.decidedBy}
                meta={step.decidedBy === "code" ? "named outright" : `${pct(step.confidence)} sure · ${ms(step.ms)}`}
              >
                <Bars bars={step.bars} />
              </Section>
            );
          case "gate":
            return <GateLine key={i} step={step} />;
          case "search":
            return (
              <Section key={i} n={next()} title="Keyword search" by="code" meta={ms(step.ms)}>
                <p className="text-[12.5px] text-muted">
                  <span className="font-mono text-text">{step.candidates}</span> passages pulled. No embeddings.
                </p>
              </Section>
            );
          case "evidence":
            return (
              <Section
                key={i}
                n={next()}
                title="Evidence check"
                by="jev"
                meta={`${step.kept.length} of ${step.considered} kept · ${ms(step.ms)}`}
              >
                <ul className="space-y-1.5">
                  {step.kept.map((s) => (
                    <li key={s.id} className="flex items-baseline gap-2 text-[12.5px]">
                      <span className="font-mono text-green">{pct(s.p)}</span>
                      <span className="min-w-0 truncate text-muted">
                        <span className="text-text">{s.page}</span> / {s.heading}
                      </span>
                    </li>
                  ))}
                  {!step.kept.length && <li className="text-[12.5px] text-faint">Nothing held an answer.</li>}
                </ul>
              </Section>
            );
          case "write":
            return (
              <Section key={i} n={next()} title="Writer" by="claude" meta={ms(step.ms)}>
                <p className="text-[12.5px] text-muted">Writes only from the passages that passed. <span className="font-mono text-[11.5px] text-faint">{step.model}</span></p>
              </Section>
            );
          case "check":
            return (
              <Section
                key={i}
                n={next()}
                title="Sentence check"
                by="jev"
                meta={`${step.claims.length - step.removed} kept · ${step.removed} removed`}
              >
                <ul className="space-y-2">
                  {step.claims.map((c, j) => (
                    <li key={j} className="flex gap-2 text-[12.5px] leading-snug">
                      <span className={`mt-px font-mono text-[11px] ${c.kept ? "text-green" : "text-red"}`}>
                        {c.kept ? "KEEP" : "DROP"}
                      </span>
                      <span className={c.kept ? "text-muted" : "text-faint line-through decoration-red/60"}>
                        {c.text.length > 120 ? `${c.text.slice(0, 120)}…` : c.text}
                        <span className="ml-1.5 font-mono text-[11px] text-faint no-underline">
                          {c.cites.length ? `${c.verdict.replace("_", " ")} ${pct(c.confidence)}` : "no source cited"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          default:
            return null;
        }
      })}

      {busy && (
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
          <span className="font-mono text-[11.5px] text-faint">working</span>
        </div>
      )}

      {result && (
        <>
          <CompanyMap nodes={result.map} />
          <footer className="sticky bottom-0 border-t border-line bg-raised/95 px-5 py-3 font-mono text-[11.5px] text-muted backdrop-blur">
            <span className="text-text">{result.totals.decisionCalls}</span> decision calls ·{" "}
            <span className="text-text">{result.totals.writerCalls}</span> writer ·{" "}
            <span className="text-text">{ms(result.totals.ms)}</span> · <span className="text-text">{usd(result.totals.cost)}</span>
          </footer>
        </>
      )}
    </div>
  );
}
