// The first decision only. Called while someone is still typing.
import { z } from "zod";
import { routePreview } from "@/lib/pipeline";
import { namedIn } from "@/lib/okf";

export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().trim().min(8).max(2000),
  previous: z.string().max(2000).nullable().default(null),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Message too short." }, { status: 400 });
  try {
    const preview = await routePreview(parsed.data.message, parsed.data.previous, undefined, request.signal);
    return Response.json({
      ...preview,
      named: namedIn(parsed.data.message).map((e) => ({ id: e.id, title: e.title })),
    });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ error: err instanceof Error ? err.message : "Preview failed." }, { status: 502 });
  }
}
