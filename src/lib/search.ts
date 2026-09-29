// Plain keyword search over passages. No embeddings, no vector database.
// At about 1,300 passages this builds in memory in well under a second.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";

export type Passage = {
  id: string;
  url: string;
  pageTitle: string;
  kind: string; // page | person | case-study | news
  segment: string; // first part of the URL path
  heading: string;
  text: string;
};

export type Hit = Passage & { score: number };

export type SearchOptions = {
  limit?: number;
  kinds?: string[]; // only these page kinds
  boostUrls?: string[]; // pages that belong to the chosen product or family
  boostKinds?: Record<string, number>; // team preference, e.g. case studies for Sales
};

const STOPWORDS = new Set(
  ("a an and are as at be but by can do does for from has have how i if in into is it its me my of on or " +
    "our so that the their them then there these they this to us was we what when where which who why will with you your " +
    "please thanks hello hi need want get help about any would could should").split(" "),
);

const PASSAGES_FILE = path.join(process.cwd(), "corpus", "passages.json");

type Index = { mini: MiniSearch<Passage>; passages: Map<string, Passage> };
let cached: Index | null = null;

export function buildIndex(passages: Passage[]): Index {
  const mini = new MiniSearch<Passage>({
    fields: ["pageTitle", "heading", "text"],
    storeFields: ["id"],
    processTerm: (term) => {
      const t = term.toLowerCase();
      return STOPWORDS.has(t) || t.length < 2 ? null : t;
    },
    searchOptions: {
      boost: { pageTitle: 2.5, heading: 2 },
      prefix: (term) => term.length > 4,
      fuzzy: (term) => (term.length > 5 ? 0.15 : false),
      combineWith: "OR",
    },
  });
  mini.addAll(passages);
  return { mini, passages: new Map(passages.map((p) => [p.id, p])) };
}

function index(): Index {
  if (cached) return cached;
  if (!existsSync(PASSAGES_FILE)) {
    throw new Error("corpus/passages.json is missing. Run `pnpm ingest` first.");
  }
  cached = buildIndex(JSON.parse(readFileSync(PASSAGES_FILE, "utf8")));
  return cached;
}

export function search(query: string, options: SearchOptions = {}, idx: Index = index()): Hit[] {
  const { limit = 20, kinds, boostUrls = [], boostKinds = {} } = options;
  const favored = new Set(boostUrls);
  const results = idx.mini.search(query, {
    filter: kinds ? (r) => kinds.includes(idx.passages.get(r.id as string)?.kind ?? "") : undefined,
    boostDocument: (id) => {
      const passage = idx.passages.get(id as string);
      if (!passage) return 1;
      return (favored.has(passage.url) ? 2 : 1) * (boostKinds[passage.kind] ?? 1);
    },
  });

  // No more than three passages from one page, so one long page cannot crowd out the rest.
  const perPage = new Map<string, number>();
  const hits: Hit[] = [];
  for (const r of results) {
    const passage = idx.passages.get(r.id as string);
    if (!passage) continue;
    const used = perPage.get(passage.url) ?? 0;
    if (used >= 3) continue;
    perPage.set(passage.url, used + 1);
    hits.push({ ...passage, score: r.score });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function passageCount(): number {
  return index().passages.size;
}
