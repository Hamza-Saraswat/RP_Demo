// The site's own menu is the taxonomy: families, platforms, markets, and products A-Z.
// Reading it from the markup means the company map's structure is never guessed.
import * as cheerio from "cheerio";

export type NavItem = {
  name: string;
  path: string;
  blurb: string; // their wording; used as extraction input only, never committed
  products: { name: string; path: string }[];
};

export type Nav = {
  families: NavItem[];
  platforms: NavItem[];
  markets: NavItem[];
  products: NavItem[];
};

const GROUPS: Record<keyof Nav, string> = {
  families: "solutions-by-need-",
  platforms: "solutions-by-platform-",
  markets: "solutions-by-market-",
  products: "solutions-solutions-a-z-",
};

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export function extractNav(html: string): Nav {
  const $ = cheerio.load(html);
  const panels = new Map<string, ReturnType<typeof $>>();
  $("div.nav-hidden-content").each((_, el) => {
    const id = $(el).attr("id");
    if (id) panels.set(id, $(el));
  });

  const nav: Nav = { families: [], platforms: [], markets: [], products: [] };
  $("a.nav-list-button").each((_, el) => {
    const target = $(el).attr("data-hidden-content-target") ?? "";
    const path = $(el).attr("href");
    if (!path) return;
    const group = (Object.keys(GROUPS) as (keyof Nav)[]).find((g) => target.startsWith(GROUPS[g]));
    if (!group) return;
    const panel = panels.get(target);
    const products =
      panel
        ?.find("ul.product-list a")
        .map((__, a) => ({ name: tidy($(a).text()), path: $(a).attr("href") ?? "" }))
        .get()
        .filter((p) => p.name && p.path) ?? [];
    const item: NavItem = {
      name: tidy($(el).text()),
      path,
      blurb: tidy(panel?.find("a.content-link p").first().text() ?? ""),
      products,
    };
    if (!nav[group].some((existing) => existing.path === item.path && existing.name === item.name)) {
      nav[group].push(item);
    }
  });
  return nav;
}
