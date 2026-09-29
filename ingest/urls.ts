// Builds the list of public pages to read. Sitemaps only, plus a few news pages.
import * as cheerio from "cheerio";
import { extractNav, type Nav } from "./nav";

export const USER_AGENT =
  "FrontdoorDemo/0.1 (personal portfolio demo; contact hamza.saraswat@gmail.com)";

const SITE = "https://www.realpage.com";
const SITEMAPS = ["pages", "management-team", "case-studies"].map(
  (name) => `${SITE}/storage/${name}-sitemap.xml`,
);

// Top-level path segments that are not about products, people, or customers.
const EXCLUDED_SEGMENTS = new Set([
  "legal",
  "residentlegal",
  "client-login",
  "careers",
  "sitemap",
  "podcasts",
  "user-group",
  "search",
  "thank-you",
  "unsubscribe",
]);

// Product pages that neither the menu nor a sitemap lists.
const EXTRA_PAGES = [`${SITE}/property-management-software/onesite/`];

const NEWS_KEYWORDS = /acqui|lumina|cherre|rexera|chief-executive|exchange|ai-/i;
const MAX_NEWS = 12;

export type UrlEntry = { url: string; kind: "page" | "person" | "case-study" | "news" };

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function segment(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
}

export async function fetchNav(): Promise<Nav> {
  return extractNav(await get(`${SITE}/`));
}

export async function buildUrlList(nav: Nav): Promise<UrlEntry[]> {
  const entries = new Map<string, UrlEntry>();

  // Every page the site's own menu points at, whether or not a sitemap lists it.
  for (const item of [...nav.families, ...nav.platforms, ...nav.markets, ...nav.products]) {
    for (const p of [item.path, ...item.products.map((x) => x.path)]) {
      if (!p.startsWith("/")) continue;
      const url = `${SITE}${p.endsWith("/") ? p : `${p}/`}`;
      entries.set(url, { url, kind: "page" });
    }
  }

  for (const url of EXTRA_PAGES) entries.set(url, { url, kind: "page" });

  for (const sitemap of SITEMAPS) {
    const kind: UrlEntry["kind"] = sitemap.includes("management-team")
      ? "person"
      : sitemap.includes("case-studies")
        ? "case-study"
        : "page";
    for (const url of locs(await get(sitemap))) {
      if (!url.startsWith(SITE)) continue;
      if (EXCLUDED_SEGMENTS.has(segment(url))) continue;
      if (!entries.has(url)) entries.set(url, { url, kind });
    }
  }

  const $ = cheerio.load(await get(`${SITE}/news/`));
  const news = [
    ...new Set(
      $('a[href*="/news/"]')
        .map((_, el) => $(el).attr("href") ?? "")
        .get()
        .filter((href) => href.startsWith(SITE) && NEWS_KEYWORDS.test(href)),
    ),
  ];
  // Announcements the index may have rotated off its first page.
  news.push(
    `${SITE}/news/realpage-unveils-next-generation-ai-workforce-at-realworld-2025/`,
    `${SITE}/news/realpage-acquires-rexera-to-accelerate-ai-innovation/`,
    `${SITE}/news/realpage-announces-the-evolution-of-realpage-exchange/`,
    `${SITE}/news/realpage-announces-ai-revenue-management/`,
  );
  for (const url of [...new Set(news)].slice(0, MAX_NEWS)) entries.set(url, { url, kind: "news" });

  return [...entries.values()].sort((a, b) => a.url.localeCompare(b.url));
}
