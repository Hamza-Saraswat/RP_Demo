// One client, two jobs: Jev decides, Claude writes.
// Request bodies are never logged: they can carry user text.

const BASE = "https://openrouter.ai/api";
export const JEV_MODEL = "typesafe/jev-1.13";
export const WRITER_MODEL = "anthropic/claude-sonnet-5.5";

const TIMEOUT_MS = 15_000;
const WRITE_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);

type Rich = string | Record<string, unknown> | unknown[];

export type ChoiceQuestion = {
  type: "choice";
  instructions: Rich;
  criteria: Record<string, Rich | null>;
};
export type NoulQuestion = { type: "noul"; instructions: Rich; criteria?: Rich };
export type ScoreQuestion = { type: "score"; instructions: Rich; criteria: Rich[] };
export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type NoulAnswer = { type: "noul"; noul: number };
export type ScoreAnswer = {
  type: "score";
  score: number;
  probabilities: Record<string, number>;
  confidence: number;
};
export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export type Decision = {
  answers: Record<string, Answer>;
  model: string;
  inputTokens: number;
  cost: number;
  latencyMs: number;
};

export type Written = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latencyMs: number;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set. Copy .env.example to .env.local.");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal) {
  const payload = JSON.stringify(body);
  let lastFailure = "no attempt made";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey()}`,
          "x-title": "Frontdoor demo",
        },
        body: payload,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      lastFailure = err instanceof Error ? err.name : "network error";
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      continue;
    }
    if (res.ok) return res.json();
    lastFailure = `openrouter ${res.status}`;
    if (!RETRY_STATUSES.has(res.status)) break;
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  throw new Error(`Request to ${path} failed: ${lastFailure}`);
}

/** Ask Jev one or more typed questions about `state`. Questions run in parallel. */
export async function decide(
  state: unknown,
  questions: Record<string, Question>,
  signal?: AbortSignal,
): Promise<Decision> {
  const startedAt = Date.now();
  const json = await post("/alpha/decisions", { model: JEV_MODEL, state, questions }, TIMEOUT_MS, signal);
  const answers = json?.answers as Record<string, Answer> | undefined;
  if (!answers) throw new Error("Jev returned no answers");
  for (const id of Object.keys(questions)) {
    if (!answers[id]) throw new Error(`Jev did not answer "${id}"`);
  }
  return {
    answers,
    model: json.model ?? JEV_MODEL,
    inputTokens: json.usage?.input_tokens ?? 0,
    cost: json.usage?.cost ?? 0,
    latencyMs: Date.now() - startedAt,
  };
}

/** Ask Claude to write. Used for answers, handoff summaries, and knowledge extraction. */
export async function write(opts: {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  model?: string;
}): Promise<Written> {
  const startedAt = Date.now();
  const json = await post(
    "/v1/chat/completions",
    {
      model: opts.model ?? WRITER_MODEL,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 900,
      temperature: opts.temperature ?? 0.2,
      usage: { include: true },
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    },
    WRITE_TIMEOUT_MS,
  );
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Writer returned no text");
  return {
    text,
    model: json.model ?? WRITER_MODEL,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
    cost: json.usage?.cost ?? 0,
    latencyMs: Date.now() - startedAt,
  };
}

export const noul = (a: Answer | undefined): number => (a && a.type === "noul" ? a.noul : 0);
export const choice = (a: Answer | undefined): ChoiceAnswer | undefined =>
  a && a.type === "choice" ? a : undefined;
