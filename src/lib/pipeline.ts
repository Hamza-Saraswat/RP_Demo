// The agent core. One path for every team:
//   code finds product names -> Jev routes -> code gates -> keyword search -> Jev keeps evidence
//   -> Claude writes from that evidence -> Jev checks each sentence -> code decides what ships.
// It yields each step as it happens, so the chat can show its work and the eval can score it.
import { z } from "zod";
import { decide, write, choice, noul, type Question } from "./openrouter";
import { bundle, offeringsIn, namedIn, mapPath, type Entity, type MapNode } from "./okf";
import { search, type Hit } from "./search";
import { routeGate, evidenceGate, claimGate, NONE, type Outcome, type Thresholds, type ClaimVerdict } from "./gate";
import type { Team } from "./teams";
import v3 from "./questions/v3.json";

export type QuestionSet = typeof v3;
export const DEFAULT_QUESTIONS: QuestionSet = v3;

export type Turn = { role: "user" | "assistant"; text: string };

export type Source = {
  n: number;
  id: string;
  url: string;
  page: string;
  heading: string;
  text: string;
  kind: string;
  p: number;
};

export type Claim = { text: string; cites: number[] };
export type CheckedClaim = Claim & { verdict: ClaimVerdict["verdict"]; confidence: number; kept: boolean };

export type Bar = { id: string; title: string; p: number };

export type Step =
  | { kind: "lookup"; named: { id: string; title: string }[]; ms: number }
  | {
      kind: "family";
      choice: string;
      title: string;
      confidence: number;
      bars: Bar[];
      checks: { id: string; label: string; p: number }[];
      followUp: boolean;
      ms: number;
      cost: number;
    }
  | {
      kind: "product";
      decidedBy: "code" | "jev";
      choice: string | null;
      title: string;
      confidence: number;
      bars: Bar[];
      ms: number;
      cost: number;
    }
  | { kind: "gate"; stage: "route" | "evidence" | "claims"; outcome: Outcome | "search"; queue: string | null; reasons: string[]; flags: string[] }
  | { kind: "search"; query: string; candidates: number; urls: string[]; ms: number }
  | { kind: "evidence"; considered: number; kept: Source[]; ms: number; cost: number; calls: number }
  | { kind: "write"; model: string; ms: number; cost: number }
  | { kind: "check"; claims: CheckedClaim[]; removed: number; ms: number; cost: number; calls: number }
  | { kind: "final"; result: Result };

export type Result = {
  outcome: Outcome;
  team: string;
  family: { slug: string; title: string; confidence: number } | null;
  product: { id: string; title: string; confidence: number } | null;
  answer: { claims: Claim[]; notCovered: string | null; sources: Source[]; removed: number } | null;
  handoff: {
    queue: { id: string; title: string; illustrative: boolean };
    reasons: string[];
    summary: string[];
    tried: { url: string; page: string }[];
  } | null;
  flags: string[];
  map: MapNode[];
  totals: { decisionCalls: number; writerCalls: number; ms: number; cost: number };
};

const WrittenAnswer = z.object({
  claims: z
    .array(z.object({ text: z.string().min(3).transform((v) => v.slice(0, 700)), cites: z.array(z.number().int()) }))
    .transform((v) => v.slice(0, 8)),
  // Trimmed, never rejected: a long note must not throw away a good answer.
  not_covered: z
    .string()
    .transform((v) => (v.length > 420 ? `${v.slice(0, 420).replace(/\s+\S*$/, "")}…` : v))
    .nullable()
    .optional(),
});

const BASE_RULES = `You answer questions about RealPage products for an internal team, using only the numbered source passages you are given.

Rules. These always win over team guidance:
1. Use only facts stated in the passages. No outside knowledge, no guesses.
2. Every claim cites the passage numbers that state it. A claim with no citation is deleted before anyone sees it.
3. If the passages answer only part of the question, answer that part and say in "not_covered", in one or two sentences, what they do not cover.
4. Write in your own words: short, plain sentences. No marketing language.
5. Never promise an action, a timeline, or a price.

Reply with JSON only:
{"claims":[{"text":"one or two sentences","cites":[1]}],"not_covered":"what the passages do not cover, or null"}
Give 2 to 5 claims, each under 50 words. Put the direct answer first. Each claim states facts from one or two passages, not a summary of all of them.`;

/** Reads the writer's JSON. If the reply was cut off mid-way, keeps the claims that arrived whole. */
export function readJson(text: string): unknown {
  const body = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(body);
  } catch {
    const claims = [...body.matchAll(/\{\s*"text"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"cites"\s*:\s*\[[\d,\s]*\]\s*\}/g)].map((m) =>
      JSON.parse(m[0]),
    );
    if (!claims.length) throw new Error("no complete claim in the reply");
    return { claims, not_covered: null };
  }
}

function familyQuestion(q: QuestionSet): Question {
  const b = bundle();
  const criteria: Record<string, string> = {};
  for (const family of b.byType("Family")) {
    const slug = family.id.replace("families/", "");
    const products = offeringsIn(slug, b).map((e) => e.title);
    criteria[slug] = `${family.title}. ${family.description} Products: ${products.join(", ")}.`;
  }
  criteria[NONE] = q.family.none;
  return { type: "choice", instructions: q.family.instructions, criteria };
}

function checkQuestions(q: QuestionSet, hasPrevious: boolean): Record<string, Question> {
  const questions: Record<string, Question> = {};
  for (const [id, c] of Object.entries(q.checks)) {
    questions[id] = { type: "noul", instructions: c.instructions, criteria: c.criteria };
  }
  if (hasPrevious) {
    questions.follow_up = {
      type: "noul",
      instructions: "Does `message` depend on `previous_message` to be understood?",
      criteria: {
        true: "The message uses words like 'it', 'that', 'they', or 'what about', and the subject is only named in the previous message.",
        false: "The message names its own subject and can be understood alone.",
      },
    };
  }
  return questions;
}

function bars(probabilities: Record<string, number>, title: (id: string) => string, top = 4): Bar[] {
  return Object.entries(probabilities)
    .map(([id, p]) => ({ id, title: title(id), p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, top);
}

export type RoutePreview = Extract<Step, { kind: "family" }>;

/** The first decision on its own. Cheap enough to run while someone is still typing. */
export async function routePreview(
  message: string,
  previous: string | null,
  q: QuestionSet = DEFAULT_QUESTIONS,
  signal?: AbortSignal,
): Promise<RoutePreview> {
  const b = bundle();
  const named = namedIn(message, b);
  const d = await decide(
    { message, previous_message: previous, products_named: named.map((e) => e.title) },
    { family: familyQuestion(q), ...checkQuestions(q, !!previous) },
    signal,
  );
  const family = choice(d.answers.family)!;
  const titleOf = (slug: string) => (slug === NONE ? "None of these" : b.entities.get(`families/${slug}`)?.title ?? slug);
  return {
    kind: "family",
    choice: family.choice,
    title: titleOf(family.choice),
    confidence: family.confidence,
    bars: bars(family.probabilities, titleOf),
    checks: Object.entries(q.checks).map(([id, c]) => ({ id, label: c.label, p: noul(d.answers[id]) })),
    followUp: noul(d.answers.follow_up) >= q.thresholds.checkYes,
    ms: d.latencyMs,
    cost: d.cost,
  };
}

export async function* run(
  message: string,
  history: Turn[],
  team: Team,
  q: QuestionSet = DEFAULT_QUESTIONS,
): AsyncGenerator<Step, Result> {
  const startedAt = Date.now();
  const t = q.thresholds as Thresholds;
  const b = bundle();
  let cost = 0;
  let decisionCalls = 0;
  let writerCalls = 0;
  const flags: string[] = [];
  let followUp = false;
  const previous = [...history].reverse().find((turn) => turn.role === "user")?.text ?? null;

  const finish = function* (partial: Omit<Result, "team" | "totals" | "flags" | "map"> & { queue?: string | null }): Generator<Step, Result> {
    const { queue, ...rest } = partial;
    const result: Result = {
      ...rest,
      team: team.slug,
      flags,
      map: mapPath({ familySlug: rest.family?.slug, productId: rest.product?.id, queueId: queue ?? undefined }, b),
      totals: { decisionCalls, writerCalls, ms: Date.now() - startedAt, cost },
    };
    yield { kind: "final", result };
    return result;
  };

  const handoffTo = (queueId: string | null, reasons: string[], tried: Hit[] | Source[], family: Result["family"], product: Result["product"]) => {
    const queue = b.entities.get(queueId ?? "queues/human-triage") ?? b.entities.get("queues/human-triage")!;
    const pages = new Map<string, string>();
    for (const s of tried) pages.set(s.url, "page" in s ? s.page : s.pageTitle);
    return {
      queue: { id: queue.id, title: queue.title, illustrative: queue.illustrative },
      reasons,
      // Built by code from the decisions above, so it cannot say anything the trace does not show.
      summary: [
        `Asked: ${message.trim()}`,
        ...(followUp && previous ? [`Follows on from: ${previous.trim()}`] : []),
        `Product family: ${family ? `${family.title} (${Math.round(family.confidence * 100)}% sure)` : "not determined"}`,
        `Product: ${product ? product.title : "not determined"}`,
      ],
      tried: [...pages].slice(0, 5).map(([url, page]) => ({ url, page })),
    };
  };

  // 1. Code lookup: product names that appear in the message.
  const lookupAt = Date.now();
  const named = namedIn(message, b);
  yield { kind: "lookup", named: named.map((e) => ({ id: e.id, title: e.title })), ms: Date.now() - lookupAt };

  // 2. Jev: family, plus the yes/no checks, in one request.
  const route = await routePreview(message, previous, q);
  cost += route.cost;
  decisionCalls += 1;
  followUp = route.followUp;
  yield route;
  const checks = Object.fromEntries(route.checks.map((c) => [c.id, c.p]));
  const familyEntity = route.choice === NONE ? undefined : b.entities.get(`families/${route.choice}`);
  let family: Result["family"] = familyEntity
    ? { slug: route.choice, title: familyEntity.title, confidence: route.confidence }
    : null;

  // 3. Gate on the routing decisions.
  const routed = routeGate(
    { family: { choice: route.choice, confidence: route.confidence, probabilities: Object.fromEntries(route.bars.map((x) => [x.id, x.p])) }, checks },
    t,
  );
  flags.push(...routed.flags);

  // 4. Product. Code decides when the message names exactly one product in the chosen family.
  let product: Result["product"] = null;
  let productEntity: Entity | undefined;
  if (family && !routed.flags.includes("family unclear")) {
    const familySlug = family.slug;
    const familyTitle = family.title;
    const inFamily = offeringsIn(familySlug, b);
    const namedHere = named.filter((e) => e.family === familySlug);
    if (namedHere.length === 1) {
      productEntity = namedHere[0];
      product = { id: productEntity.id, title: productEntity.title, confidence: 1 };
      yield { kind: "product", decidedBy: "code", choice: product.id, title: product.title, confidence: 1, bars: [{ id: product.id, title: product.title, p: 1 }], ms: 0, cost: 0 };
    } else if (inFamily.length) {
      const criteria: Record<string, string> = {};
      for (const e of inFamily) criteria[e.id.replace(/\//g, "__")] = `${e.title}. ${e.description}`;
      criteria.general = q.product.general;
      criteria[NONE] = q.product.none;
      const d = await decide(
        { message, previous_message: previous, products_named: named.map((e) => e.title), family: familyTitle },
        { product: { type: "choice", instructions: q.product.instructions, criteria } },
      );
      cost += d.cost;
      decisionCalls += 1;
      const answer = choice(d.answers.product)!;
      const idOf = (key: string) => key.replace(/__/g, "/");
      const titleOf = (key: string) =>
        key === "general" ? "The family in general" : key === NONE ? "None of these" : b.entities.get(idOf(key))?.title ?? key;
      const chosen = b.entities.get(idOf(answer.choice));
      if (chosen && answer.confidence >= t.productSure) {
        productEntity = chosen;
        product = { id: chosen.id, title: chosen.title, confidence: answer.confidence };
      } else if (chosen) {
        flags.push("product unclear");
      }
      yield {
        kind: "product",
        decidedBy: "jev",
        choice: chosen?.id ?? null,
        title: titleOf(answer.choice),
        confidence: answer.confidence,
        bars: bars(answer.probabilities, titleOf),
        ms: d.latencyMs,
        cost: d.cost,
      };
    }
  }

  yield { kind: "gate", stage: "route", outcome: routed.outcome, queue: routed.queue, reasons: routed.reasons, flags: routed.flags };
  if (routed.outcome === "handoff" || routed.outcome === "escalate") {
    return yield* finish({
      outcome: routed.outcome,
      family,
      product,
      answer: null,
      handoff: handoffTo(routed.queue, routed.reasons, [], family, product),
      queue: routed.queue,
    });
  }

  // 5. Keyword search, scoped by team and weighted toward the chosen product.
  const searchAt = Date.now();
  const query = route.followUp && previous ? `${previous} ${message}` : message;
  const hits = search(query, {
    limit: 12,
    kinds: team.sources.kinds,
    boostKinds: team.sources.boostKinds,
    boostUrls: routed.flags.includes("family unclear")
      ? named.map((e) => e.resource)
      : [productEntity?.resource, familyEntity?.resource].filter((u): u is string => !!u),
  });
  yield { kind: "search", query, candidates: hits.length, urls: [...new Set(hits.map((h) => h.url))], ms: Date.now() - searchAt };

  // 6. Jev: one small request per passage, all at once.
  const evidenceAt = Date.now();
  const judged = await Promise.all(
    hits.map(async (hit) => {
      try {
        const d = await decide(
          { question: query, passage: { page: hit.pageTitle, heading: hit.heading, text: hit.text } },
          { evidence: { type: "noul", instructions: q.evidence.instructions, criteria: q.evidence.criteria } },
        );
        return { hit, p: noul(d.answers.evidence), cost: d.cost };
      } catch {
        return { hit, p: 0, cost: 0 }; // a failed check never counts as evidence
      }
    }),
  );
  cost += judged.reduce((sum, j) => sum + j.cost, 0);
  decisionCalls += judged.length;
  const sources: Source[] = judged
    .filter((j) => j.p >= t.evidenceKeep)
    .sort((a, b) => b.p - a.p)
    .slice(0, t.evidenceMax)
    .map((j, i) => ({
      n: i + 1,
      id: j.hit.id,
      url: j.hit.url,
      page: j.hit.pageTitle,
      heading: j.hit.heading,
      text: j.hit.text,
      kind: j.hit.kind,
      p: j.p,
    }));
  yield { kind: "evidence", considered: hits.length, kept: sources, ms: Date.now() - evidenceAt, cost: judged.reduce((s, j) => s + j.cost, 0), calls: judged.length };

  // When routing could not place the question, the best source can: its page belongs to a product.
  if (!product && sources.length && (!family || routed.flags.includes("family unclear"))) {
    const owner = [...b.entities.values()].find(
      (e) => (e.type === "Product" || e.type === "Agent" || e.type === "Family") && e.resource === sources[0].url,
    );
    const placedFamily = owner?.type === "Family" ? owner : owner?.family ? b.entities.get(`families/${owner.family}`) : undefined;
    if (placedFamily) {
      family = { slug: placedFamily.id.replace("families/", ""), title: placedFamily.title, confidence: sources[0].p };
      if (owner && owner.type !== "Family") product = { id: owner.id, title: owner.title, confidence: sources[0].p };
      routed.queue = `queues/${family.slug}`;
      flags.push("placed by its source");
    }
  }

  const evidence = evidenceGate(sources.length, routed.queue, routed.flags.includes("family unclear"));
  flags.push(...evidence.flags);
  yield { kind: "gate", stage: "evidence", outcome: evidence.outcome, queue: evidence.queue, reasons: evidence.reasons, flags: evidence.flags };
  if (evidence.outcome !== "answer") {
    return yield* finish({
      outcome: evidence.outcome === "escalate" ? "escalate" : "handoff",
      family: routed.flags.includes("family unclear") ? null : family,
      product,
      answer: null,
      handoff: handoffTo(evidence.queue, evidence.reasons, hits, family, product),
      queue: evidence.queue,
    });
  }

  // 7. Claude writes, from the kept passages only. One retry: a dropped call should not cost an answer.
  let written: z.infer<typeof WrittenAnswer> | null = null;
  for (let attempt = 1; attempt <= 2 && !written; attempt++) {
    try {
      const out = await write({
        json: true,
        maxTokens: 1400,
        messages: [
          { role: "system", content: `${BASE_RULES}\n\nTeam guidance (${team.name}): ${team.guidance}` },
          {
            role: "user",
            content:
              `${route.followUp && previous ? `Earlier question: ${previous}\n` : ""}Question: ${message}\n\nSource passages:\n` +
              sources.map((s) => `[${s.n}] ${s.page} / ${s.heading}\n${s.text}`).join("\n\n"),
          },
        ],
      });
      cost += out.cost;
      writerCalls += 1;
      yield { kind: "write", model: out.model, ms: out.latencyMs, cost: out.cost };
      if (process.env.FRONTDOOR_DEBUG) console.error(`[writer] ${out.text}`);
      const parsed = WrittenAnswer.safeParse(readJson(out.text));
      if (parsed.success) written = parsed.data;
      else if (process.env.FRONTDOOR_DEBUG) console.error(`[writer] did not match: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
    } catch (err) {
      if (process.env.FRONTDOOR_DEBUG) console.error(`[writer] failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!written) flags.push("writer failed");

  const claims: Claim[] = (written?.claims ?? [])
    .map((c) => ({ text: c.text.trim(), cites: [...new Set(c.cites)].filter((n) => n >= 1 && n <= sources.length) }))
    .filter((c) => c.text);

  // 8. Jev checks every sentence against every passage it cites.
  const checkAt = Date.now();
  let checkCost = 0;
  let checkCalls = 0;
  const verdicts: ClaimVerdict[][] = await Promise.all(
    claims.map((claim) =>
      Promise.all(
        claim.cites.map(async (n): Promise<ClaimVerdict> => {
          try {
            const d = await decide(
              { claim: claim.text, passage: sources[n - 1].text },
              { relation: { type: "choice", instructions: q.citation.instructions, criteria: q.citation.criteria } },
            );
            checkCost += d.cost;
            checkCalls += 1;
            const a = choice(d.answers.relation)!;
            return { verdict: a.choice as ClaimVerdict["verdict"], confidence: a.confidence };
          } catch {
            return { verdict: "says_nothing", confidence: 1 }; // a failed check never counts as support
          }
        }),
      ),
    ),
  );
  cost += checkCost;
  decisionCalls += checkCalls;

  const decision = claimGate(verdicts, t);
  const checked: CheckedClaim[] = claims.map((claim, i) => {
    const best =
      verdicts[i].find((v) => v.verdict === "contradicts") ??
      verdicts[i].find((v) => v.verdict === "supports") ??
      verdicts[i][0] ?? { verdict: "says_nothing" as const, confidence: 1 };
    return { ...claim, verdict: best.verdict, confidence: best.confidence, kept: decision.keep[i] ?? false };
  });
  const removed = checked.filter((c) => !c.kept).length;
  yield { kind: "check", claims: checked, removed, ms: Date.now() - checkAt, cost: checkCost, calls: checkCalls };

  if (decision.withhold) {
    const reasons = [`The answer was written, then withheld: ${decision.reason}`];
    flags.push("answer withheld");
    yield { kind: "gate", stage: "claims", outcome: "handoff", queue: routed.queue, reasons, flags: ["answer withheld"] };
    return yield* finish({
      outcome: "handoff",
      family,
      product,
      answer: null,
      handoff: handoffTo(routed.queue, reasons, sources, family, product),
      queue: routed.queue,
    });
  }
  if (removed) flags.push(`${removed} unsupported sentence${removed > 1 ? "s" : ""} removed`);
  yield { kind: "gate", stage: "claims", outcome: "answer", queue: routed.queue, reasons: [], flags: removed ? ["sentences removed"] : [] };

  // Keep only the sources the surviving sentences cite, and renumber them in order of use.
  const kept = checked.filter((c) => c.kept);
  const order = [...new Set(kept.flatMap((c) => c.cites))];
  const renumber = new Map(order.map((n, i) => [n, i + 1]));
  return yield* finish({
    outcome: "answer",
    family,
    product,
    answer: {
      claims: kept.map((c) => ({ text: c.text, cites: c.cites.map((n) => renumber.get(n)!).sort((a, b) => a - b) })),
      notCovered: written?.not_covered?.trim() || null,
      sources: order.map((n) => ({ ...sources[n - 1], n: renumber.get(n)! })),
      removed,
    },
    handoff: null,
    queue: routed.queue,
  });
}

/** Runs the whole path and returns every step. Used by the eval. */
export async function runQuestion(message: string, history: Turn[], team: Team, q: QuestionSet = DEFAULT_QUESTIONS) {
  const steps: Step[] = [];
  const iterator = run(message, history, team, q);
  while (true) {
    const next = await iterator.next();
    if (next.done) return { result: next.value, steps };
    steps.push(next.value);
  }
}
