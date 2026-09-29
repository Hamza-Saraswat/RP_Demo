// One core, many teams. A team is a small file: which sources it searches,
// how answers should read, and a few sample questions. It cannot loosen the base rules.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const TeamSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  illustrative: z.boolean().default(true),
  description: z.string(),
  sources: z.object({
    kinds: z.array(z.enum(["page", "news", "case-study", "person"])).min(1),
    boostKinds: z.record(z.string(), z.number().min(0.1).max(5)).default({}),
  }),
  guidance: z.string().max(600),
  samples: z.array(z.string()).default([]),
});

export type Team = z.infer<typeof TeamSchema>;

const TEAMS_DIR = path.join(process.cwd(), "teams");
export const DEFAULT_TEAM = "support";

let cached: Map<string, Team> | null = null;

export function loadTeams(dir: string = TEAMS_DIR): Map<string, Team> {
  const teams = new Map<string, Team>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const team = TeamSchema.parse(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
    teams.set(team.slug, team);
  }
  return teams;
}

export function teams(): Map<string, Team> {
  if (!cached) cached = loadTeams();
  return cached;
}

export function team(slug: string | undefined): Team {
  const all = teams();
  return all.get(slug ?? DEFAULT_TEAM) ?? all.get(DEFAULT_TEAM) ?? [...all.values()][0];
}
