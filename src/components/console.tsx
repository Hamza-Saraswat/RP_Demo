"use client";

// The chat, with the work shown beside it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Step, Result } from "@/lib/pipeline";
import { LivePanel, TracePanel, type Preview } from "./trace";

export type TeamInfo = { slug: string; name: string; description: string; samples: string[] };

type UserItem = { id: string; role: "user"; text: string };
type AssistantItem = {
  id: string;
  role: "assistant";
  question: string;
  team: string;
  steps: Step[];
  result: Result | null;
  error: string | null;
  flagged: boolean;
};
type Item = UserItem | AssistantItem;

const PREVIEW_PAUSE_MS = 400;
const PREVIEW_MIN_CHARS = 8;

const uid = () => Math.random().toString(36).slice(2, 10);

function Cites({ cites }: { cites: number[] }) {
  return (
    <>
      {cites.map((n) => (
        <sup key={n} className="ml-0.5 rounded bg-accent-soft px-1 py-px font-mono text-[10.5px] text-cyan">
          {n}
        </sup>
      ))}
    </>
  );
}

function AnswerCard({ result }: { result: Result }) {
  const answer = result.answer!;
  return (
    <div>
      <div className="space-y-2.5 text-[15.5px] leading-relaxed text-text">
        {answer.claims.map((c, i) => (
          <p key={i}>
            {c.text}
            <Cites cites={c.cites} />
          </p>
        ))}
      </div>
      {answer.notCovered && (
        <p className="mt-3.5 border-l-2 border-line-strong pl-3 text-[13.5px] leading-relaxed text-muted">
          <span className="label mr-2">Not in the sources</span>
          {answer.notCovered}
        </p>
      )}
      {answer.removed > 0 && (
        <p className="mt-3 font-mono text-[11.5px] text-amber">
          {answer.removed} sentence{answer.removed > 1 ? "s" : ""} removed: not supported by a source.
        </p>
      )}
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {answer.sources.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-[340px] items-center gap-1.5 rounded border border-line bg-raised px-2 py-1 text-[12px] text-muted hover:border-accent hover:text-text"
            >
              <span className="font-mono text-cyan">{s.n}</span>
              <span className="truncate">
                {s.page} / {s.heading}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HandoffCard({ result }: { result: Result }) {
  const handoff = result.handoff!;
  const escalate = result.outcome === "escalate";
  return (
    <div className={`rounded-lg border ${escalate ? "border-red/35 bg-red-soft" : "border-amber/35 bg-amber-soft"} p-4`}>
      <p className={`label ${escalate ? "!text-red" : "!text-amber"}`}>{escalate ? "Sent to a person" : "Handed off"}</p>
      <p className="mt-1 font-display text-[26px] leading-tight text-text">
        {handoff.queue.title}
        {handoff.queue.illustrative && <span className="ml-2 align-middle font-mono text-[10.5px] uppercase tracking-wider text-faint">illustrative</span>}
      </p>
      <div className="mt-3 space-y-1">
        {handoff.reasons.map((r) => (
          <p key={r} className="text-[14px] leading-snug text-text">
            {r}
          </p>
        ))}
      </div>
      <div className="mt-3.5 rounded border border-line bg-ink/60 p-3">
        <p className="label mb-1.5">Passed along</p>
        <ul className="space-y-0.5 text-[13px] leading-snug text-muted">
          {handoff.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {handoff.tried.length > 0 && <li>Sources already tried: {handoff.tried.map((t) => t.page).join("; ")}</li>}
        </ul>
      </div>
    </div>
  );
}

export function Console({ teams }: { teams: TeamInfo[] }) {
  const [teamSlug, setTeamSlug] = useState(teams[0]?.slug ?? "support");
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const team = teams.find((t) => t.slug === teamSlug) ?? teams[0];
  const assistants = items.filter((i): i is AssistantItem => i.role === "assistant");
  const shown = assistants.find((a) => a.id === selected) ?? assistants.at(-1) ?? null;
  const lastUserText = useMemo(() => [...items].reverse().find((i) => i.role === "user")?.text ?? null, [items]);

  const typing = input.trim().length >= PREVIEW_MIN_CHARS && !busy;

  // Live routing: run the first decision whenever typing pauses.
  useEffect(() => {
    if (!typing) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/route-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: input, previous: lastUserText }),
          signal: controller.signal,
        });
        if (res.ok) setPreview(await res.json());
      } catch {
        // A cancelled or failed preview is not worth showing.
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, PREVIEW_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, typing, lastUserText]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const history = items.slice(-6).map((i) =>
        i.role === "user"
          ? { role: "user" as const, text: i.text }
          : { role: "assistant" as const, text: i.result?.answer?.claims.map((c) => c.text).join(" ") ?? "" },
      );
      const replyId = uid();
      setItems((prev) => [
        ...prev,
        { id: uid(), role: "user", text: message },
        { id: replyId, role: "assistant", question: message, team: teamSlug, steps: [], result: null, error: null, flagged: false },
      ]);
      setSelected(replyId);
      setInput("");
      setPreview(null);
      setBusy(true);

      const patch = (change: (a: AssistantItem) => AssistantItem) =>
        setItems((prev) => prev.map((i) => (i.id === replyId && i.role === "assistant" ? change(i) : i)));

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, team: teamSlug, history }),
        });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "The request failed.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines.filter(Boolean)) {
            const step = JSON.parse(line) as Step | { kind: "error"; message: string };
            if (step.kind === "error") patch((a) => ({ ...a, error: step.message }));
            else if (step.kind === "final") patch((a) => ({ ...a, result: step.result }));
            else patch((a) => ({ ...a, steps: [...a.steps, step] }));
          }
        }
      } catch (err) {
        patch((a) => ({ ...a, error: err instanceof Error ? err.message : "Something went wrong." }));
      } finally {
        setBusy(false);
        field.current?.focus();
      }
    },
    [busy, items, teamSlug],
  );

  const flag = async (item: AssistantItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id && i.role === "assistant" ? { ...i, flagged: true } : i)));
    await fetch("/api/flag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: item.question,
        outcome: item.result?.outcome ?? "error",
        team: item.team,
        family: item.result?.family?.slug ?? null,
        product: item.result?.product?.id ?? null,
      }),
    }).catch(() => {});
  };

  return (
    <div className="ruled flex h-full flex-col">
      <header className="flex items-center gap-5 border-b border-line px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[30px] leading-none text-text">Frontdoor</span>
          <span className="hidden text-[12.5px] text-muted lg:inline">
            One question in. A cited answer, or the right owner.
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="label">Team</span>
            <div className="flex rounded-md border border-line bg-raised p-0.5">
              {teams.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => setTeamSlug(t.slug)}
                  disabled={busy}
                  className={`rounded px-3 py-1 text-[13px] transition-colors ${
                    t.slug === teamSlug ? "bg-accent text-white" : "text-muted hover:text-text"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <nav className="flex gap-4 text-[13px] text-muted">
            <Link href="/atlas" className="hover:text-text">
              Company map
            </Link>
            <Link href="/evals" className="hover:text-text">
              Evals
            </Link>
          </nav>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px]">
        {/* Chat */}
        <main className="flex min-h-0 flex-col">
          <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-8 py-7">
            <div className="mx-auto max-w-[760px] space-y-6">
              {items.length === 0 && (
                <div className="rise pt-10">
                  <p className="label mb-3">{team.name} team · built from 221 public pages</p>
                  <h1 className="font-display text-[52px] leading-[1.02] text-text">
                    Ask about any
                    <br />
                    RealPage product.
                  </h1>
                  <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
                    It answers only from sources it can cite. When it should not answer, it says who should, and passes
                    along what it found. Every decision shows on the right.
                  </p>
                </div>
              )}

              {items.map((item) =>
                item.role === "user" ? (
                  <div key={item.id} className="rise flex justify-end">
                    <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-[15px] leading-relaxed text-white">
                      {item.text}
                    </p>
                  </div>
                ) : (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                    className={`rise cursor-pointer rounded-xl border p-5 transition-colors ${
                      shown?.id === item.id ? "border-line-strong bg-raised/70" : "border-line bg-raised/30 hover:border-line-strong"
                    }`}
                  >
                    {item.error ? (
                      <p className="text-[14px] text-red">{item.error}</p>
                    ) : !item.result ? (
                      <div className="flex items-center gap-2.5">
                        <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
                        <span className="text-[14px] text-muted">
                          {item.steps.some((s) => s.kind === "evidence") ? "Writing from the sources, then checking each sentence" : "Deciding where this goes"}
                        </span>
                      </div>
                    ) : item.result.answer ? (
                      <AnswerCard result={item.result} />
                    ) : (
                      <HandoffCard result={item.result} />
                    )}
                    {item.result && (
                      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                        <span className="font-mono text-[11px] text-faint">
                          {item.team} team · {(item.result.totals.ms / 1000).toFixed(1)} s
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!item.flagged) flag(item);
                          }}
                          className={`rounded border px-2.5 py-1 text-[12px] transition-colors ${
                            item.flagged ? "border-green/40 text-green" : "border-line text-muted hover:border-amber hover:text-amber"
                          }`}
                        >
                          {item.flagged ? "Flagged for review" : "Flag a gap"}
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="border-t border-line bg-ink/80 px-8 py-4 backdrop-blur">
            <div className="mx-auto max-w-[760px]">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {team.samples.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      field.current?.focus();
                    }}
                    disabled={busy}
                    className="max-w-[49%] truncate rounded-full border border-line px-3 py-1 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40"
                    title="Sample question (synthetic)"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input);
                }}
                className="flex items-end gap-2.5 rounded-xl border border-line-strong bg-raised px-4 py-3 focus-within:border-accent"
              >
                <textarea
                  ref={field}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask about any RealPage product"
                  className="min-h-[48px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-text outline-none placeholder:text-faint"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white transition-opacity disabled:opacity-30"
                >
                  Ask
                </button>
              </form>
              <p className="mt-2 text-[11.5px] text-faint">
                Sample questions are synthetic. Queues and team profiles are illustrative. Sources are public pages.
              </p>
            </div>
          </div>
        </main>

        {/* The work */}
        <aside className="scroll-thin min-h-0 overflow-y-auto border-l border-line bg-raised/40">
          <div className="sticky top-0 z-10 flex items-center border-b border-line bg-raised/95 px-5 py-3 backdrop-blur">
            <p className="font-display text-[21px] leading-none text-text">How it decided</p>
            <span className="ml-auto flex gap-2 font-mono text-[10px] uppercase tracking-wider">
              <span className="text-muted">code</span>
              <span className="text-cyan">jev</span>
              <span className="text-amber">claude</span>
            </span>
          </div>
          {typing ? (
            <LivePanel preview={preview} loading={previewLoading} />
          ) : shown ? (
            <TracePanel steps={shown.steps} result={shown.result} busy={busy && !shown.result} />
          ) : (
            <div className="px-5 py-6 text-[13.5px] leading-relaxed text-muted">
              <p>Start typing. The routing decision runs on every pause, before you send.</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted">code</span> owns the rules and
                  the lookups.
                </li>
                <li>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-cyan">jev</span> makes each
                  judgment and says how sure it is.
                </li>
                <li>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-amber">claude</span> writes, only
                  from passages that passed.
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
