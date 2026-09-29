// "Flag a gap": the start of the feedback loop. A person says an answer was wrong or missing.
import { z } from "zod";
import { appendFile } from "node:fs/promises";
import path from "node:path";

const Body = z.object({
  question: z.string().max(2000),
  outcome: z.string().max(40),
  team: z.string().max(40),
  family: z.string().max(80).nullable(),
  product: z.string().max(120).nullable(),
  note: z.string().max(1000).default(""),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid flag." }, { status: 400 });
  await appendFile(
    path.join(process.cwd(), "feedback.jsonl"),
    `${JSON.stringify({ type: "flag", at: new Date().toISOString(), ...parsed.data })}\n`,
  );
  return Response.json({ ok: true });
}
