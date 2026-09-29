// Loads the OKF bundle in knowledge/ and answers questions about it.
// The "graph" is just the links between markdown files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type EntityType =
  | "Family"
  | "Platform"
  | "Market"
  | "Product"
  | "Agent"
  | "Acquisition"
  | "Person"
  | "Customer"
  | "Queue";

export type Link = { to: string; text: string; relation: string };

export type Entity = {
  id: string; // path inside the bundle without ".md", e.g. "products/vendor-credentialing"
  type: EntityType;
  title: string;
  description: string;
  resource: string;
  family?: string;
  familySource?: string;
  familyConfidence?: number;
  platforms: string[];
  aliases: string[];
  formerly: string[];
  illustrative: boolean;
  needsVerification: boolean;
  role?: string;
  body: string;
  links: Link[];
};

export type Bundle = {
  entities: Map<string, Entity>;
  byType: (type: EntityType) => Entity[];
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const MARKER = "<!-- okf:generated -->";
const RESERVED = new Set(["index.md", "log.md"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".md") ? [full] : [];
  });
}

export function parseLinks(body: string): Link[] {
  const links: Link[] = [];
  for (const line of body.split("\n")) {
    for (const match of line.matchAll(/\[([^\]]+)\]\((\/[^)]+\.md)\)/g)) {
      const before = line.slice(0, match.index).replace(/^[-*\s]+/, "").trim();
      links.push({
        to: match[2].replace(/^\//, "").replace(/\.md$/, ""),
        text: match[1],
        relation: before.replace(/\bthe$/i, "").trim().toLowerCase() || "links to",
      });
    }
  }
  return links;
}

export function loadBundle(dir: string = KNOWLEDGE_DIR): Bundle {
  const entities = new Map<string, Entity>();
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file);
    if (RESERVED.has(rel)) continue;
    const { data, content } = matter(readFileSync(file, "utf8"));
    if (!data.type) continue; // OKF: `type` is the one required field
    const body = content.split(MARKER)[0].trim();
    const id = rel.replace(/\.md$/, "");
    entities.set(id, {
      id,
      type: data.type,
      title: data.title ?? id,
      description: data.description ?? "",
      resource: data.resource ?? "",
      family: data.family,
      familySource: data.family_source,
      familyConfidence: data.family_confidence,
      platforms: data.platforms ?? [],
      aliases: data.aliases ?? [],
      formerly: data.formerly ?? [],
      illustrative: data.illustrative === true,
      needsVerification: data.needs_verification === true,
      role: data.role,
      body,
      links: parseLinks(body),
    });
  }
  return {
    entities,
    byType: (type) =>
      [...entities.values()].filter((e) => e.type === type).sort((a, b) => a.title.localeCompare(b.title)),
  };
}

let cached: Bundle | null = null;
export function bundle(): Bundle {
  if (!cached) cached = loadBundle();
  return cached;
}

/** Products and agents are both things a question can be about. */
export function offerings(b: Bundle = bundle()): Entity[] {
  return [...b.byType("Product"), ...b.byType("Agent")];
}

export function offeringsIn(familySlug: string, b: Bundle = bundle()): Entity[] {
  return offerings(b).filter((e) => e.family === familySlug);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Exact-name lookup in code. No model needed to notice "OneSite" in a sentence. */
export function namedIn(text: string, b: Bundle = bundle()): Entity[] {
  const haystack = ` ${norm(text)} `;
  const hits = new Map<string, { entity: Entity; length: number }>();
  for (const entity of offerings(b)) {
    for (const name of [entity.title, ...entity.aliases]) {
      const needle = norm(name);
      if (needle.length < 4) continue;
      if (haystack.includes(` ${needle} `)) {
        const previous = hits.get(entity.id);
        if (!previous || needle.length > previous.length) hits.set(entity.id, { entity, length: needle.length });
      }
    }
  }
  // A longer name wins over a shorter one it contains ("AI Spend Agent" over "Spend Management").
  return [...hits.values()].sort((a, b) => b.length - a.length).map((h) => h.entity);
}

export type MapNode = { id: string; type: EntityType; title: string; note?: string; illustrative?: boolean };

/** The path shown beside an answer: where a product came from and who owns it. */
export function mapPath(opts: { familySlug?: string; productId?: string; queueId?: string }, b: Bundle = bundle()): MapNode[] {
  const nodes: MapNode[] = [];
  const product = opts.productId ? b.entities.get(opts.productId) : undefined;
  const familySlug = product?.family ?? opts.familySlug;
  const family = familySlug ? b.entities.get(`families/${familySlug}`) : undefined;
  const toNode = (e: Entity, note?: string): MapNode => ({
    id: e.id,
    type: e.type,
    title: e.title,
    note,
    illustrative: e.illustrative || undefined,
  });

  if (product) {
    for (const link of product.links.filter((l) => l.to.startsWith("acquisitions/"))) {
      const origin = b.entities.get(link.to);
      if (origin) nodes.push(toNode(origin, "came from"));
    }
    nodes.push(toNode(product, product.type === "Agent" ? "agent" : "product"));
  }
  if (family) nodes.push(toNode(family, "family"));
  for (const slug of product?.platforms ?? []) {
    const platform = b.entities.get(`platforms/${slug}`);
    // Some platforms share a name with a family; showing both adds nothing.
    if (platform && platform.title !== family?.title) nodes.push(toNode(platform, "platform"));
  }
  const queue = b.entities.get(opts.queueId ?? (familySlug ? `queues/${familySlug}` : "queues/human-triage"));
  if (queue) nodes.push(toNode(queue, "owner"));
  return nodes;
}
