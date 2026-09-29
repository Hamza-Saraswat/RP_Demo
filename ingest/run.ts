// pnpm ingest            read the sitemaps, fetch pages politely, build passages
// pnpm ingest --offline  rebuild passages from pages already on disk
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { buildUrlList, fetchNav, USER_AGENT, type UrlEntry } from "./urls";
import { cleanHtml, slugFor, toPassages, type Passage } from "./clean";

const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(ROOT, "corpus", "raw");
const PAGES = path.join(ROOT, "corpus", "pages");
const URL_LIST = path.join(ROOT, "ingest", "url-list.json");
const DELAY_MS = 1_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const exists = (p: string) => access(p).then(() => true, () => false);

async function main() {
  const offline = process.argv.includes("--offline");
  await mkdir(RAW, { recursive: true });
  await mkdir(PAGES, { recursive: true });

  let urls: UrlEntry[];
  if (offline && (await exists(URL_LIST))) {
    urls = JSON.parse(await readFile(URL_LIST, "utf8"));
  } else {
    const nav = await fetchNav();
    await writeFile(path.join(ROOT, "corpus", "nav.json"), JSON.stringify(nav, null, 2));
    console.log(
      `menu: ${nav.families.length} families, ${nav.platforms.length} platforms, ` +
        `${nav.markets.length} markets, ${nav.products.length} products`,
    );
    urls = await buildUrlList(nav);
    await writeFile(URL_LIST, JSON.stringify(urls, null, 2) + "\n");
  }
  console.log(`${urls.length} URLs in the list`);

  const passages: Passage[] = [];
  const pageIndex: Record<string, unknown>[] = [];
  let fetched = 0;
  let failed = 0;

  for (const entry of urls) {
    const slug = slugFor(entry.url);
    const rawPath = path.join(RAW, `${slug}.html`);
    let html: string;

    if (await exists(rawPath)) {
      html = await readFile(rawPath, "utf8");
    } else if (offline) {
      continue;
    } else {
      try {
        const res = await fetch(entry.url, { headers: { "user-agent": USER_AGENT } });
        if (!res.ok) throw new Error(String(res.status));
        html = await res.text();
        await writeFile(rawPath, html);
        fetched++;
        if (fetched % 20 === 0) console.log(`  fetched ${fetched}`);
      } catch (err) {
        failed++;
        console.warn(`  skipped ${entry.url} (${err instanceof Error ? err.message : err})`);
        continue;
      } finally {
        await sleep(DELAY_MS);
      }
    }

    const page = cleanHtml(entry.url, html);
    if (page.markdown.length < 200) continue;
    await writeFile(
      path.join(PAGES, `${slug}.md`),
      `---\nurl: ${page.url}\ntitle: ${JSON.stringify(page.title)}\nkind: ${entry.kind}\n---\n\n${page.markdown}\n`,
    );
    const pagePassages = toPassages(page, entry.kind);
    passages.push(...pagePassages);
    pageIndex.push({
      slug,
      url: page.url,
      title: page.title,
      description: page.description,
      breadcrumb: page.breadcrumb,
      kind: entry.kind,
      chars: page.markdown.length,
      passages: pagePassages.length,
    });
  }

  await writeFile(path.join(ROOT, "corpus", "passages.json"), JSON.stringify(passages));
  await writeFile(path.join(ROOT, "corpus", "pages.json"), JSON.stringify(pageIndex, null, 2));

  const byKind = pageIndex.reduce<Record<string, number>>((acc, p) => {
    const kind = String(p.kind);
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`pages: ${pageIndex.length}`, byKind);
  console.log(`passages: ${passages.length}`);
  console.log(`fetched now: ${fetched}, failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
