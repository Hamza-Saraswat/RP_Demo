// pnpm knowledge:build
//
// Builds the company map as an OKF bundle: one markdown file per entity.
//   Structure (families, platforms, markets, products) comes from the site's own menu. Code only.
//   Descriptions are written by Claude in our own words, one page at a time.
//   Family for a product the menu does not place is decided by Jev, with its confidence recorded.
//   "Formerly X" claims are kept only when the quoted evidence is found in the page text.
import { mkdir, readFile, writeFile, readdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { decide, write, choice, type Question } from "../src/lib/openrouter";
import type { Nav, NavItem } from "../ingest/nav";
import { slugFor } from "../ingest/clean";

const ROOT = path.resolve(__dirname, "..");
const CORPUS = path.join(ROOT, "corpus");
const CACHE = path.join(CORPUS, "extract");
const OUT = path.join(ROOT, "knowledge");
const SITE = "https://www.realpage.com";
const TODAY = new Date().toISOString().slice(0, 10);
const MARKER = "<!-- okf:generated -->";
const CONCURRENCY = 6;
const FAMILY_SURE = 0.6;

// Product pages the site has but its menu does not list by name.
const EXTRA_PRODUCTS = [{ name: "OneSite", path: "/property-management-software/onesite/" }];

// Our own grouping, for offerings the site's by-need menu has no place for. Labeled as ours in the file.
const CROSS = {
  slug: "platform-data-and-integrations",
  name: "Platform, data and integrations",
  path: "/platforms/lumina-ai/",
  blurb: "AI suite, governed data access, and the integration marketplace: offerings that sit across the product families.",
};

const exists = (p: string) => access(p).then(() => true, () => false);
const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const fullUrl = (p: string) => `${SITE}${p.endsWith("/") ? p : `${p}/`}`;

// ---------- extraction schemas ----------
// Long strings are trimmed, not rejected: one wordy field should not lose a whole page.
const text = (max: number, min = 0) =>
  z
    .string()
    .transform((v) => v.trim().slice(0, max))
    .refine((v) => v.length >= min, { message: `shorter than ${min}` });
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item)
    .transform((v) => v.slice(0, max))
    .default([]);

const ProductFacts = z.object({
  description: text(400, 20),
  what_it_does: list(text(200), 6),
  who_uses_it: text(240).default(""),
  aliases: list(text(60), 6),
  formerly: list(z.object({ name: text(60), evidence: text(160) }), 4),
  related_products: list(text(80), 12),
});
type ProductFacts = z.infer<typeof ProductFacts>;

const PersonFacts = z.object({
  name: text(80, 3),
  title: text(160, 2),
  summary: text(320).default(""),
});

const CustomerFacts = z.object({
  customer: text(100, 2),
  summary: text(400).default(""),
  products_used: list(text(80), 10),
  results: list(text(220), 5),
});

const NewsFacts = z.object({
  summary: text(400).default(""),
  date: text(40).default(""),
  acquisitions: list(
    z.object({
      company: text(60),
      what_it_does: text(240),
      evidence: text(160),
      related_products: list(text(80), 8),
    }),
    3,
  ),
});

const OWN_WORDS =
  "Write in your own words. Do not copy sentences or distinctive phrases from the page. " +
  "State only what the page says; leave a field empty rather than guess. " +
  "Do not repeat marketing claims such as 'industry-leading'. Reply with JSON only.";

// ---------- helpers ----------

async function pool<T, R>(items: T[], worker: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

let spend = 0;

async function extract<T>(
  key: string,
  schema: z.ZodType<T>,
  system: string,
  user: string,
): Promise<T | null> {
  const cachePath = path.join(CACHE, `${key}.json`);
  if (await exists(cachePath)) {
    const cached = schema.safeParse(JSON.parse(await readFile(cachePath, "utf8")));
    if (cached.success) return cached.data;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await write({
        json: true,
        maxTokens: 900,
        temperature: 0,
        messages: [
          { role: "system", content: `${system}\n\n${OWN_WORDS}` },
          { role: "user", content: user },
        ],
      });
      spend += out.cost;
      const text = out.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) {
        await writeFile(cachePath, JSON.stringify(parsed.data, null, 2));
        return parsed.data;
      }
      if (attempt === 2) {
        const issue = parsed.error.issues[0];
        // A case study that never names its customer is expected; it stays searchable as passages.
        if (issue?.path.join(".") !== "customer") {
          console.warn(`  ${key}: did not match the schema (${issue?.path.join(".")}: ${issue?.message})`);
        }
      }
    } catch (err) {
      if (attempt === 2) console.warn(`  ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return null;
}

async function pageText(p: string): Promise<string | null> {
  const file = path.join(CORPUS, "pages", `${slugFor(fullUrl(p))}.md`);
  if (!(await exists(file))) return null;
  const raw = await readFile(file, "utf8");
  return raw.replace(/^---[\s\S]*?---\s*/, "").slice(0, 14_000);
}

function frontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : typeof v === "string" ? JSON.stringify(v) : v}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

async function save(rel: string, fields: Record<string, unknown>, body: string) {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  // Keep anything a person wrote below the marker.
  let notes = "";
  if (await exists(file)) {
    const old = await readFile(file, "utf8");
    const at = old.indexOf(MARKER);
    if (at >= 0) notes = old.slice(at + MARKER.length).trim();
  }
  const text = `${frontmatter(fields)}\n${body.trim()}\n\n${MARKER}\n${notes ? `\n${notes}\n` : ""}`;
  await writeFile(file, text);
}

const link = (title: string, rel: string) => `[${title}](/${rel})`;
const isAgent = (name: string) => /^AI\b.*\bAgent$/i.test(name);

// ---------- main ----------

type Product = {
  name: string;
  slug: string;
  rel: string;
  path: string;
  blurb: string;
  family: string;
  familyConfidence: number | null;
  familyHow: "menu" | "jev";
  platforms: string[];
  facts: ProductFacts | null;
  formerly: string[];
};

async function main() {
  const nav: Nav = JSON.parse(await readFile(path.join(CORPUS, "nav.json"), "utf8"));
  const urlList: { url: string; kind: string }[] = JSON.parse(
    await readFile(path.join(ROOT, "ingest", "url-list.json"), "utf8"),
  );
  await mkdir(CACHE, { recursive: true });
  for (const dir of await readdir(OUT).catch(() => [])) {
    // Generated folders are rebuilt; hand notes are re-attached by save().
    if (dir.endsWith(".md")) continue;
  }

  const families = nav.families.map((f) => ({ ...f, slug: kebab(f.name), rel: `families/${kebab(f.name)}.md` }));
  const platforms = nav.platforms.map((p) => ({ ...p, slug: kebab(p.name), rel: `platforms/${kebab(p.name)}.md` }));
  const markets = nav.markets.map((m) => ({ ...m, slug: kebab(m.name), rel: `markets/${kebab(m.name)}.md` }));

  // Products: the A-Z list, plus anything a family or platform panel names that A-Z misses.
  // External links in the menu (a company with its own site) are not products we can read.
  const onSite = (p: { path: string }) => p.path.startsWith("/");
  const byPath = new Map<string, NavItem>();
  for (const p of nav.products.filter(onSite)) byPath.set(p.path, p);
  const groupPaths = new Set([...families, ...platforms].map((g) => g.path));
  for (const group of [...nav.families, ...nav.platforms]) {
    for (const p of group.products.filter(onSite)) {
      // A panel may link to a family's own landing page; that is the family, not a new product.
      if (!byPath.has(p.path) && !groupPaths.has(p.path)) {
        byPath.set(p.path, { name: p.name, path: p.path, blurb: "", products: [] });
      }
    }
  }
  for (const extra of EXTRA_PRODUCTS) {
    if (!byPath.has(extra.path)) byPath.set(extra.path, { ...extra, blurb: "", products: [] });
  }
  // A family's or platform's own landing page is that family or platform, not a separate product.
  const productItems = [...byPath.values()].filter((p) => !groupPaths.has(p.path));
  console.log(`menu gives ${families.length} families, ${platforms.length} platforms, ${markets.length} markets, ${productItems.length} products`);

  // ----- family for each product -----
  const sharedPrefix = (a: string, b: string) => {
    const x = a.split("/").filter(Boolean);
    const y = b.split("/").filter(Boolean);
    let n = 0;
    while (n < x.length && n < y.length && x[n] === y[n]) n++;
    return n;
  };
  const depth = (p: string) => p.split("/").filter(Boolean).length;
  const luminaPanel = platforms.find((pl) => pl.slug === "lumina-ai-suite");
  const menuFamily = (p: NavItem): string | null => {
    // 1. A family panel lists this exact page.
    const listed = families.filter((f) => f.products.some((x) => x.path === p.path));
    // 2. The page sits under a family's landing page, or beside a product that a family panel lists.
    const near = families.filter(
      (f) =>
        sharedPrefix(f.path, p.path) >= depth(f.path) ||
        f.products.some((x) => sharedPrefix(x.path, p.path) >= 2 && depth(x.path) >= 2),
    );
    const candidates = listed.length ? listed : near;
    if (candidates.length) {
      const closeness = (f: (typeof families)[number]) =>
        Math.max(sharedPrefix(f.path, p.path), ...f.products.map((x) => sharedPrefix(x.path, p.path)));
      return [...candidates].sort((a, b) => closeness(b) - closeness(a) || a.products.length - b.products.length)[0].slug;
    }
    // 3. The Lumina AI Suite panel lists it and no family does.
    if (luminaPanel?.products.some((x) => x.path === p.path)) return CROSS.slug;
    return null;
  };

  const knownNames = productItems.map((p) => p.name);

  console.log("reading product pages...");
  const products: Product[] = await pool(productItems, async (item) => {
    const slug = kebab(item.name);
    const text = await pageText(item.path);
    const facts = text
      ? await extract(
          `product-${slug}`,
          ProductFacts,
          "You are documenting one product of a property technology company from its public product page. " +
            "Return JSON with keys: description (1-2 sentences), what_it_does (3-5 short bullets), who_uses_it (one sentence), " +
            "aliases (other names this page uses for this same product), " +
            "formerly (earlier names or acquired companies this product came from, ONLY if the page says so, each with `evidence`: " +
            "an exact quote of at most 12 words copied from the page), " +
            "related_products (names from the known product list that this page mentions).",
          `Product: ${item.name}\nKnown product list: ${knownNames.join("; ")}\n\nPage:\n${text}`,
        )
      : null;

    // Keep a "formerly" claim only if its evidence is really on the page.
    const haystack = norm(text ?? "");
    const formerly = (facts?.formerly ?? [])
      .filter((f) => f.evidence && haystack.includes(norm(f.evidence)) && haystack.includes(norm(f.name)))
      .map((f) => f.name)
      .filter((name) => norm(name) !== norm(item.name));

    let family = menuFamily(item);
    let familyConfidence: number | null = null;
    let familyHow: Product["familyHow"] = "menu";
    if (!family) {
      const question: Question = {
        type: "choice",
        instructions:
          "Which product family does `product` belong to? Use `product.name` and `product.about`.",
        criteria: {
          ...Object.fromEntries(families.map((f) => [f.slug, `${f.name}. ${f.blurb}`])),
          [CROSS.slug]: `${CROSS.name}. ${CROSS.blurb}`,
        },
      };
      const d = await decide({ product: { name: item.name, about: facts?.description ?? item.blurb } }, { family: question });
      spend += d.cost;
      const answer = choice(d.answers.family);
      family = answer?.choice ?? families[0].slug;
      familyConfidence = answer?.confidence ?? 0;
      familyHow = "jev";
    }

    return {
      name: item.name,
      slug,
      rel: `${isAgent(item.name) ? "agents" : "products"}/${slug}.md`,
      path: item.path,
      blurb: item.blurb,
      family,
      familyConfidence,
      familyHow,
      platforms: platforms.filter((pl) => pl.products.some((x) => x.path === item.path)).map((pl) => pl.slug),
      facts,
      formerly,
    };
  });

  const productByName = new Map(products.map((p) => [norm(p.name), p]));
  for (const p of products) for (const a of p.facts?.aliases ?? []) if (!productByName.has(norm(a))) productByName.set(norm(a), p);
  const findProducts = (names: string[]) =>
    [...new Set(names.map((n) => productByName.get(norm(n))).filter((p): p is Product => !!p))];

  // ----- news: acquisitions -----
  console.log("reading news pages...");
  type Acquisition = { company: string; slug: string; about: string; source: string; products: Product[] };
  const acquisitions = new Map<string, Acquisition>();
  await pool(urlList.filter((u) => u.kind === "news"), async (u) => {
    const text = await pageText(new URL(u.url).pathname);
    if (!text) return;
    const facts = await extract(
      `news-${slugFor(u.url)}`,
      NewsFacts,
      "You are reading one press release from a property technology company. " +
        "Return JSON with keys: summary (1-2 sentences), date (as printed, or empty), " +
        "acquisitions (companies THIS company acquired according to this page; each with company, what_it_does, " +
        "`evidence`: an exact quote of at most 12 words copied from the page, and related_products from the known product list).",
      `Known product list: ${knownNames.join("; ")}\n\nPage:\n${text}`,
    );
    const haystack = norm(text);
    for (const a of facts?.acquisitions ?? []) {
      if (!haystack.includes(norm(a.evidence)) || !haystack.includes(norm(a.company))) continue;
      if (/^real\s?page$/i.test(a.company.trim())) continue;
      const slug = kebab(a.company);
      if (!acquisitions.has(slug)) {
        acquisitions.set(slug, { company: a.company, slug, about: a.what_it_does, source: u.url, products: findProducts(a.related_products) });
      }
    }
  });
  // Earlier names found on product pages.
  for (const p of products) {
    for (const name of p.formerly) {
      const slug = kebab(name);
      const existing = acquisitions.get(slug);
      if (existing) {
        if (!existing.products.includes(p)) existing.products.push(p);
      } else {
        acquisitions.set(slug, {
          company: name,
          slug,
          about: `Earlier name or company behind ${p.name}, as stated on the product page.`,
          source: fullUrl(p.path),
          products: [p],
        });
      }
    }
  }

  // ----- people -----
  console.log("reading leadership pages...");
  const people = (
    await pool(urlList.filter((u) => u.kind === "person"), async (u) => {
      const text = await pageText(new URL(u.url).pathname);
      if (!text) return null;
      const facts = await extract(
        `person-${slugFor(u.url)}`,
        PersonFacts,
        "You are reading one executive's public leadership page. Return JSON with keys: name, title (as printed), " +
          "summary (one sentence on what they are responsible for).",
        `Page:\n${text.slice(0, 6000)}`,
      );
      return facts ? { ...facts, url: u.url, slug: kebab(facts.name) } : null;
    })
  ).filter((p): p is NonNullable<typeof p> => !!p);

  // ----- customers -----
  console.log("reading case studies...");
  const customers = (
    await pool(urlList.filter((u) => u.kind === "case-study"), async (u) => {
      const text = await pageText(new URL(u.url).pathname);
      if (!text) return null;
      const facts = await extract(
        `customer-${slugFor(u.url)}`,
        CustomerFacts,
        "You are reading one published customer case study. Return JSON with keys: customer (the customer company's name), " +
          "summary (1-2 sentences on what they did), products_used (names from the known product list), " +
          "results (up to 4 outcomes with their numbers exactly as the page states them).",
        `Known product list: ${knownNames.join("; ")}\n\nPage:\n${text}`,
      );
      return facts ? { ...facts, url: u.url, slug: slugFor(u.url).replace(/^case-studies-/, "") } : null;
    })
  ).filter((c): c is NonNullable<typeof c> => !!c);

  // ----- write the bundle -----
  for (const dir of ["families", "platforms", "markets", "products", "agents", "acquisitions", "people", "customers", "queues"]) {
    // Remove files from an earlier build that no longer exist, keeping hand notes on the ones that do.
    const folder = path.join(OUT, dir);
    await mkdir(folder, { recursive: true });
  }
  const written = new Set<string>();
  const put = async (rel: string, fields: Record<string, unknown>, body: string) => {
    written.add(rel);
    await save(rel, fields, body);
  };

  families.push({ ...CROSS, products: [], rel: `families/${CROSS.slug}.md` });
  const familyBySlug = new Map(families.map((f) => [f.slug, f]));
  const platformBySlug = new Map(platforms.map((p) => [p.slug, p]));
  const queueRel = (familySlug: string) => `queues/${familySlug}.md`;

  for (const f of families) {
    const members = products.filter((p) => p.family === f.slug);
    const facts = await extract(
      `family-${f.slug}`,
      z.object({ description: text(400, 20) }),
      "You are describing one product family of a property technology company. Return JSON with key: description (1-2 sentences).",
      `Family: ${f.name}\nTheir one-line summary: ${f.blurb}\nProducts in it: ${members.map((m) => m.name).join("; ")}`,
    );
    await put(
      f.rel,
      { type: "Family", title: f.name, description: facts?.description ?? "", resource: fullUrl(f.path), derived: f.slug === CROSS.slug ? true : undefined, tags: ["family"], timestamp: TODAY },
      `# ${f.name}\n\n${facts?.description ?? ""}${f.slug === CROSS.slug ? "\n\n**This grouping is ours.** The site's by-need menu has no place for these offerings, so they are collected here for routing." : ""}\n\n## Products\n\n${members.map((m) => `- ${link(m.name, m.rel)}`).join("\n") || "- None placed yet."}\n\n## Related\n\n- Questions about this family go to the ${link(`${f.name} queue`, queueRel(f.slug))} (illustrative).\n\n## Sources\n\n- ${fullUrl(f.path)}`,
    );
    await put(
      queueRel(f.slug),
      { type: "Queue", title: `${f.name} queue`, description: `Illustrative support queue for ${f.name} products.`, resource: `${SITE}/support/`, illustrative: true, family: f.slug, tags: ["queue", "illustrative"], timestamp: TODAY },
      `# ${f.name} queue\n\n**Illustrative.** RealPage's internal team structure is not public. This queue stands in for whichever team owns ${link(f.name, f.rel)}.\n\nThe public support page splits help by customer type, not by product.\n\n## Sources\n\n- ${SITE}/support/`,
    );
  }

  await put(
    "queues/resident-and-vendor-desk.md",
    { type: "Queue", title: "Resident and vendor desk", description: "Illustrative queue for residents and vendors, who are served separately from property management companies.", resource: `${SITE}/support/`, illustrative: true, tags: ["queue", "illustrative"], timestamp: TODAY },
    `# Resident and vendor desk\n\n**Illustrative.** The public support page sends residents and vendors down a separate path from property management companies. This queue stands in for that path.\n\n## Sources\n\n- ${SITE}/support/`,
  );
  await put(
    "queues/human-triage.md",
    { type: "Queue", title: "Human triage", description: "Illustrative queue for questions the assistant is not confident enough to route.", resource: `${SITE}/support/`, illustrative: true, tags: ["queue", "illustrative"], timestamp: TODAY },
    `# Human triage\n\n**Illustrative.** When the assistant cannot tell which product a question is about, a person decides. Nothing is guessed.\n\n## Sources\n\n- ${SITE}/support/`,
  );

  for (const pl of platforms) {
    const members = products.filter((p) => p.platforms.includes(pl.slug));
    const facts = await extract(
      `platform-${pl.slug}`,
      z.object({ description: text(400, 20) }),
      "You are describing one platform of a property technology company. Return JSON with key: description (1-2 sentences).",
      `Platform: ${pl.name}\nTheir one-line summary: ${pl.blurb}\nProducts on it: ${members.map((m) => m.name).join("; ")}`,
    );
    await put(
      pl.rel,
      { type: "Platform", title: pl.name, description: facts?.description ?? "", resource: fullUrl(pl.path), tags: ["platform"], timestamp: TODAY },
      `# ${pl.name}\n\n${facts?.description ?? ""}\n\n## Products\n\n${members.map((m) => `- ${link(m.name, m.rel)}`).join("\n") || "- None listed in the menu."}\n\n## Sources\n\n- ${fullUrl(pl.path)}`,
    );
  }

  for (const m of markets) {
    const facts = await extract(
      `market-${m.slug}`,
      z.object({ description: text(400, 20) }),
      "You are describing one market segment a property technology company serves. Return JSON with key: description (1-2 sentences).",
      `Market: ${m.name}\nTheir one-line summary: ${m.blurb}`,
    );
    await put(
      m.rel,
      { type: "Market", title: m.name, description: facts?.description ?? "", resource: fullUrl(m.path), tags: ["market"], timestamp: TODAY },
      `# ${m.name}\n\n${facts?.description ?? ""}\n\n## Sources\n\n- ${fullUrl(m.path)}`,
    );
  }

  const acquisitionsFor = (p: Product) => [...acquisitions.values()].filter((a) => a.products.includes(p));
  const customersFor = (p: Product) => customers.filter((c) => findProducts(c.products_used).includes(p));

  for (const p of products) {
    const family = familyBySlug.get(p.family)!;
    const related = findProducts(p.facts?.related_products ?? []).filter((r) => r !== p).slice(0, 8);
    const needsCheck = !p.facts || (p.familyHow === "jev" && (p.familyConfidence ?? 0) < FAMILY_SURE);
    const relatedLines = [
      `- Part of the ${link(family.name, family.rel)} family.`,
      ...p.platforms.map((s) => `- Runs on the ${link(platformBySlug.get(s)!.name, platformBySlug.get(s)!.rel)} platform.`),
      ...acquisitionsFor(p).map((a) => `- Came from ${link(a.company, `acquisitions/${a.slug}.md`)}.`),
      ...related.map((r) => `- Mentioned alongside ${link(r.name, r.rel)}.`),
      ...customersFor(p).slice(0, 5).map((c) => `- Used by ${link(c.customer, `customers/${c.slug}.md`)} (published case study).`),
      `- Questions go to the ${link(`${family.name} queue`, queueRel(family.slug))} (illustrative).`,
    ];
    await put(
      p.rel,
      {
        type: isAgent(p.name) ? "Agent" : "Product",
        title: p.name,
        description: p.facts?.description ?? "",
        resource: fullUrl(p.path),
        family: p.family,
        family_source: p.familyHow === "menu" ? "site menu" : "jev",
        family_confidence: p.familyConfidence === null ? undefined : Number(p.familyConfidence.toFixed(2)),
        platforms: p.platforms,
        aliases: (p.facts?.aliases ?? []).filter((a) => norm(a) !== norm(p.name)),
        formerly: p.formerly,
        needs_verification: needsCheck,
        tags: [isAgent(p.name) ? "agent" : "product", p.family],
        timestamp: TODAY,
      },
      `# ${p.name}\n\n${p.facts?.description ?? "_No description yet: the product page could not be read._"}\n\n## What it does\n\n${(p.facts?.what_it_does ?? []).map((b) => `- ${b}`).join("\n") || "- Not captured."}\n\n## Who uses it\n\n${p.facts?.who_uses_it || "Not stated."}\n\n## Related\n\n${relatedLines.join("\n")}\n\n## Sources\n\n- ${fullUrl(p.path)}`,
    );
  }

  for (const a of acquisitions.values()) {
    await put(
      `acquisitions/${a.slug}.md`,
      { type: "Acquisition", title: a.company, description: a.about, resource: a.source, tags: ["acquisition"], timestamp: TODAY },
      `# ${a.company}\n\n${a.about}\n\n## Related\n\n${a.products.map((p) => `- Became or feeds ${link(p.name, p.rel)}.`).join("\n") || "- No product link stated on the source page."}\n\n## Sources\n\n- ${a.source}`,
    );
  }

  for (const person of people) {
    await put(
      `people/${person.slug}.md`,
      { type: "Person", title: person.name, description: person.title, resource: person.url, role: person.title, tags: ["person", "leadership"], timestamp: TODAY },
      `# ${person.name}\n\n**${person.title}**\n\n${person.summary}\n\nListed on the public leadership page.\n\n## Sources\n\n- ${person.url}`,
    );
  }

  for (const c of customers) {
    const used = findProducts(c.products_used);
    await put(
      `customers/${c.slug}.md`,
      { type: "Customer", title: c.customer, description: c.summary, resource: c.url, tags: ["customer", "case-study"], timestamp: TODAY },
      `# ${c.customer}\n\n${c.summary}\n\n## Results as published\n\n${c.results.map((r) => `- ${r}`).join("\n") || "- None stated."}\n\n## Related\n\n${used.map((p) => `- Uses ${link(p.name, p.rel)}.`).join("\n") || "- No product from the menu is named."}\n\n## Sources\n\n- ${c.url}`,
    );
  }

  // Drop files left over from an earlier build.
  for (const dir of ["families", "platforms", "markets", "products", "agents", "acquisitions", "people", "customers", "queues"]) {
    for (const file of await readdir(path.join(OUT, dir))) {
      if (!written.has(`${dir}/${file}`)) await rm(path.join(OUT, dir, file));
    }
  }

  // ----- index and log -----
  const section = (title: string, rows: { title: string; rel: string; note?: string }[]) =>
    `## ${title} (${rows.length})\n\n${rows
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((r) => `- ${link(r.title, r.rel)}${r.note ? `: ${r.note}` : ""}`)
      .join("\n")}\n`;
  const agents = products.filter((p) => isAgent(p.name));
  const plain = products.filter((p) => !isAgent(p.name));
  const index = [
    "# Company map: RealPage, from public pages",
    "",
    "One markdown file per entity. Structure comes from the site's own menu. Descriptions are written in our own words, each with its source.",
    "",
    section("Families", families.map((f) => ({ title: f.name, rel: f.rel }))),
    section("Platforms", platforms.map((p) => ({ title: p.name, rel: p.rel }))),
    section("Products", plain.map((p) => ({ title: p.name, rel: p.rel, note: familyBySlug.get(p.family)!.name }))),
    section("Agents", agents.map((p) => ({ title: p.name, rel: p.rel, note: familyBySlug.get(p.family)!.name }))),
    section("Acquisitions and earlier names", [...acquisitions.values()].map((a) => ({ title: a.company, rel: `acquisitions/${a.slug}.md` }))),
    section("Markets", markets.map((m) => ({ title: m.name, rel: m.rel }))),
    section("People", people.map((p) => ({ title: p.name, rel: `people/${p.slug}.md`, note: p.title }))),
    section("Customers", customers.map((c) => ({ title: c.customer, rel: `customers/${c.slug}.md` }))),
    section("Queues (illustrative)", [
      ...families.map((f) => ({ title: `${f.name} queue`, rel: queueRel(f.slug) })),
      { title: "Resident and vendor desk", rel: "queues/resident-and-vendor-desk.md" },
      { title: "Human triage", rel: "queues/human-triage.md" },
    ]),
  ].join("\n");
  await writeFile(path.join(OUT, "index.md"), `${frontmatter({ type: "Index", title: "Company map", timestamp: TODAY })}\n${index}`);

  const counts = `${families.length} families, ${platforms.length} platforms, ${markets.length} markets, ${plain.length} products, ${agents.length} agents, ${acquisitions.size} acquisitions or earlier names, ${people.length} people, ${customers.length} customers`;
  const logPath = path.join(OUT, "log.md");
  const entry = `## ${TODAY}\n\n- Built from the public site menu and ${urlList.length} public pages: ${counts}.\n- ${products.filter((p) => p.familyHow === "jev").length} products were not placed by the menu; Jev chose their family and the confidence is recorded on each file.\n`;
  const previous = (await exists(logPath)) ? (await readFile(logPath, "utf8")).replace(/^---[\s\S]*?---\s*/, "").replace(/^# Log\s*/, "") : "";
  const kept = previous.split(/(?=^## )/m).filter((block) => block.trim() && !block.startsWith(`## ${TODAY}`)).join("");
  await writeFile(logPath, `${frontmatter({ type: "Log", title: "Change log", timestamp: TODAY })}\n# Log\n\n${entry}\n${kept}`);

  console.log(counts);
  console.log(`family decided by Jev for: ${products.filter((p) => p.familyHow === "jev").map((p) => `${p.name} -> ${p.family} (${p.familyConfidence?.toFixed(2)})`).join("; ") || "none"}`);
  console.log(`pages that could not be read: ${products.filter((p) => !p.facts).map((p) => p.name).join("; ") || "none"}`);
  console.log(`model spend this run: $${spend.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
