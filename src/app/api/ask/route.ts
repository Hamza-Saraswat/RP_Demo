// Streams the pipeline's steps as newline-delimited JSON, so the chat can show each decision as it lands.
import { z } from "zod";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { run, type Step } from "@/lib/pipeline";
import { team } from "@/lib/teams";

export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  team: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(12)
    .default([]),
});

const FEEDBACK_FILE = path.join(process.cwd(), "feedback.jsonl");

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send a message between 1 and 2000 characters." }, { status: 400 });
  const { message, history, team: teamSlug } = parsed.data;
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, value: unknown) =>
    controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const step of run(message, history.slice(-6), team(teamSlug))) {
          send(controller, step satisfies Step);
          if (step.kind === "final" && step.result.flags.includes("docs gap")) {
            // A question the sources could not answer is a gap worth fixing. Keep a record.
            await appendFile(
              FEEDBACK_FILE,
              `${JSON.stringify({ type: "docs_gap", at: new Date().toISOString(), team: step.result.team, family: step.result.family?.slug ?? null, product: step.result.product?.id ?? null, question: message })}\n`,
            ).catch(() => {});
          }
        }
      } catch (err) {
        send(controller, { kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
