// Turns a page's HTML into markdown and splits it into passages by heading.
import * as cheerio from "cheerio";
import TurndownService from "turndown";

export type Passage = {
  id: string;
  url: string;
  pageTitle: string;
  kind: string;
  segment: string;
  heading: string;
  text: string;
};

export type CleanPage = {
  url: string;
  title: string;
  description: string;
  breadcrumb: string[];
  markdown: string;
};

const MIN_PASSAGE_CHARS = 160;
const MAX_PASSAGE_CHARS = 1600;

// Sections that only link elsewhere, and button text that survives as its own line.
const SKIP_HEADINGS =
  /^(stay informed|related|resources|you may also like|request a demo|contact us|get started|ready to|let'?s talk|subscribe|share this)/i;
const CTA_LINE =
  /^(request a demo|download( the)? e?book|learn more|read( more)?|view|watch( the)? video|watch now|get started|contact( us| sales)?|see how|explore|schedule a demo|talk to( an)? expert|video|ebook|case study|testimonial|webcast|blog)\.?$/i;

const NOISE =
  "script, style, noscript, svg, iframe, form, nav, header, footer, button, picture, video, " +
  "[class*=cookie], [class*=modal], [class*=breadcrumb], [class*=share], [class*=newsletter], " +
  "[class*=related], [aria-hidden=true]";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.addRule("dropImages", { filter: "img", replacement: () => "" });
turndown.addRule("plainLinks", {
  filter: "a",
  replacement: (content) => content,
});

export function slugFor(url: string): string {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
  return (path || "home").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export function cleanHtml(url: string, html: string): CleanPage {
  const $ = cheerio.load(html);
  const title = ($("title").first().text() || "")
    .replace(/\s*\|\s*Real[Pp]age.*$/, "")
    .trim();
  const description = ($('meta[name="description"]').attr("content") ?? "").trim();
  const breadcrumb = $("[class*=breadcrumb] a, [class*=breadcrumb] li")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t, i, all) => t && all.indexOf(t) === i);

  const root = $("main").length ? $("main").first() : $("body");
  root.find(NOISE).remove();

  const markdown = turndown
    .turndown(root.html() ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return { url, title, description, breadcrumb, markdown };
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_PASSAGE_CHARS) return [text];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split(/\n\n+/)) {
    if (current && current.length + para.length > MAX_PASSAGE_CHARS) {
      parts.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function toPassages(page: CleanPage, kind: string): Passage[] {
  const segment = new URL(page.url).pathname.split("/").filter(Boolean)[0] ?? "";
  const slug = slugFor(page.url);

  // Walk the markdown; each heading starts a new section.
  const sections: { heading: string; body: string[] }[] = [{ heading: page.title, body: [] }];
  for (const raw of page.markdown.split("\n")) {
    const line = raw.trim();
    if (CTA_LINE.test(line.replace(/\s{2,}/g, " "))) continue;
    const split = /^#{1,3}\s+(.*)$/.exec(line);
    if (split) {
      sections.push({ heading: split[1].trim(), body: [] });
      continue;
    }
    // Deeper headings stay inside their section as plain labels.
    sections[sections.length - 1].body.push(line.replace(/^#{4,6}\s+/, ""));
  }

  // Fold sections too short to stand alone into the one before them.
  const merged: { heading: string; text: string }[] = [];
  for (const section of sections) {
    if (SKIP_HEADINGS.test(section.heading)) continue;
    const text = section.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text && !section.heading) continue;
    const previous = merged[merged.length - 1];
    if (previous && text.length < MIN_PASSAGE_CHARS) {
      previous.text += `\n\n${section.heading}${text ? `: ${text}` : ""}`;
    } else {
      merged.push({ heading: section.heading, text });
    }
  }

  const passages: Passage[] = [];
  if (page.description) {
    passages.push({
      id: `${slug}#summary`,
      url: page.url,
      pageTitle: page.title,
      kind,
      segment,
      heading: "Summary",
      text: page.description,
    });
  }
  let n = 0;
  for (const section of merged) {
    if (section.text.length < 40) continue;
    for (const chunk of splitLong(section.text)) {
      passages.push({
        id: `${slug}#${++n}`,
        url: page.url,
        pageTitle: page.title,
        kind,
        segment,
        heading: section.heading,
        text: chunk,
      });
    }
  }
  return passages;
}
