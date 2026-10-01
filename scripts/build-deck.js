// node scripts/build-deck.js   Builds deck/frontdoor.pptx.
// Counts are read from the repo (knowledge/, corpus/, evals/results/), so a slide cannot drift from the build.
const fs = require("node:fs");
const path = require("node:path");
const PptxGenJS = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "deck", "shots");

// ---- numbers, read from the build
const mdIn = (dir) => fs.readdirSync(path.join(ROOT, "knowledge", dir)).filter((f) => f.endsWith(".md")).length;
const mapDirs = fs.readdirSync(path.join(ROOT, "knowledge")).filter((d) => fs.statSync(path.join(ROOT, "knowledge", d)).isDirectory());
const N = {
  files: mapDirs.reduce((n, d) => n + mdIn(d), 0),
  offerings: mdIn("products") + mdIn("agents"),
  pages: JSON.parse(fs.readFileSync(path.join(ROOT, "ingest", "url-list.json"), "utf8")).length,
  pageFound: JSON.parse(fs.readFileSync(path.join(ROOT, "evals", "results", "golden-v3.json"), "utf8")).summary.answerable.pageFound,
};
// These two come from corpus/, which is not in git. Fall back to the last measured values.
const corpus = (file, fallback) => {
  const p = path.join(ROOT, "corpus", file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")).length : fallback;
};
N.pages = corpus("pages.json", 221);
N.sections = corpus("passages.json", 1323);
const sections = N.sections.toLocaleString("en-US");

// Fonts that ship with every copy of Keynote, PowerPoint, and Google Slides.
const SERIF = "Georgia";
const SANS = "Arial";
const MONO = "Courier New";

// Light theme, from the light palette on hamza-saraswat.com.
const C = {
  bg: "FFFFFF",
  panel: "F6F9FC",
  line: "D9DFE8",
  text: "30313D",
  muted: "5F6675",
  faint: "9AA1AE",
  accent: "635BFF",
  accentSoft: "F0F0FF",
};

const W = 13.333;
const H = 7.5;
const M = 0.7; // side margin

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Hamza Saraswat";
pptx.title = "Frontdoor";

let count = 0;
function slide({ kicker, title, notes, titleSize = 32 }) {
  const s = pptx.addSlide();
  count += 1;
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.08, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
  if (kicker) {
    s.addText(kicker.toUpperCase(), { x: M, y: 0.45, w: W - 2 * M, h: 0.3, fontFace: MONO, fontSize: 11, bold: true, color: C.accent, charSpacing: 3, margin: 0 });
  }
  if (title) {
    s.addText(title, { x: M, y: 0.78, w: W - 2 * M, h: 0.8, fontFace: SERIF, fontSize: titleSize, color: C.text, margin: 0, valign: "top" });
  }
  s.addText(`Hamza Saraswat  ·  Frontdoor  ·  ${count}`, { x: M, y: H - 0.4, w: W - 2 * M, h: 0.25, fontFace: MONO, fontSize: 9, color: C.faint, margin: 0 });
  if (notes) s.addNotes(notes);
  return s;
}

/** A bold label, then one sentence. */
function bullets(s, items, { x = M, y = 1.95, w = 6.2, size = 16, gap = 0.98 } = {}) {
  items.forEach(([label, text], i) => {
    s.addShape(pptx.ShapeType.rect, { x, y: y + i * gap + 0.05, w: 0.05, h: gap - 0.26, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    s.addText(
      [
        { text: `${label}  `, options: { bold: true, color: C.text } },
        { text, options: { color: C.muted } },
      ],
      { x: x + 0.22, y: y + i * gap, w: w - 0.22, h: gap - 0.1, fontFace: SANS, fontSize: size, valign: "top", margin: 0, lineSpacingMultiple: 1.12 },
    );
  });
}

function card(s, { x, y, w, h, head, body, headSize = 15, bodySize = 12.5, strong = false }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: strong ? C.accentSoft : C.panel }, line: { color: strong ? C.accent : C.line, width: strong ? 1.25 : 0.75 } });
  s.addText(head, { x: x + 0.22, y: y + 0.14, w: w - 0.44, h: 0.34, fontFace: SANS, fontSize: headSize, bold: true, color: C.text, margin: 0, valign: "top" });
  s.addText(body, { x: x + 0.22, y: y + 0.5, w: w - 0.44, h: h - 0.6, fontFace: SANS, fontSize: bodySize, color: C.muted, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
}

function tile(s, { x, y, w, h = 2.0, big, label, note, tone = C.text }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
  s.addText(big, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.8, fontFace: SERIF, fontSize: 40, color: tone, margin: 0, valign: "middle" });
  s.addText(label, { x: x + 0.25, y: y + 0.98, w: w - 0.5, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, color: C.text, margin: 0 });
  if (note) s.addText(note, { x: x + 0.25, y: y + 1.28, w: w - 0.5, h: h - 1.36, fontFace: SANS, fontSize: 11, color: C.muted, margin: 0, valign: "top" });
}

/** Boxes joined by arrows. Each box may carry a caption underneath. */
function chips(s, items, { x = M, y, w = W - 2 * M, h = 0.6, size = 14, captions = false } = {}) {
  const arrow = 0.42;
  const each = (w - arrow * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const [label, caption] = Array.isArray(item) ? item : [item, null];
    const cx = x + i * (each + arrow);
    s.addShape(pptx.ShapeType.roundRect, { x: cx, y, w: each, h, rectRadius: 0.1, fill: { color: C.accentSoft }, line: { color: C.accent, width: 1 } });
    s.addText(label, { x: cx, y, w: each, h, fontFace: SANS, fontSize: size, bold: true, color: C.text, align: "center", valign: "middle", margin: 0 });
    if (captions && caption) {
      s.addText(caption, { x: cx, y: y + h + 0.05, w: each, h: 0.28, fontFace: SANS, fontSize: 11, italic: true, color: C.muted, align: "center", margin: 0 });
    }
    if (i < items.length - 1) {
      s.addText("→", { x: cx + each, y, w: arrow, h, fontFace: SANS, fontSize: 18, bold: true, color: C.accent, align: "center", valign: "middle", margin: 0 });
    }
  });
}

/** Numbered steps joined by arrows: a title and one plain sentence each. */
function steps(s, items, { x = M, y, w = W - 2 * M, h = 1.45 } = {}) {
  const arrow = 0.4;
  const each = (w - arrow * (items.length - 1)) / items.length;
  items.forEach(([head, body], i) => {
    const cx = x + i * (each + arrow);
    s.addShape(pptx.ShapeType.roundRect, { x: cx, y, w: each, h, rectRadius: 0.06, fill: { color: C.accentSoft }, line: { color: C.accent, width: 1 } });
    s.addText(`${i + 1}. ${head}`, { x: cx + 0.18, y: y + 0.14, w: each - 0.36, h: 0.36, fontFace: SANS, fontSize: 16, bold: true, color: C.text, margin: 0 });
    s.addText(body, { x: cx + 0.18, y: y + 0.54, w: each - 0.36, h: h - 0.64, fontFace: SANS, fontSize: 12.5, color: C.muted, margin: 0, valign: "top", lineSpacingMultiple: 1.1 });
    if (i < items.length - 1) {
      s.addText("→", { x: cx + each, y, w: arrow, h, fontFace: SANS, fontSize: 18, bold: true, color: C.accent, align: "center", valign: "middle", margin: 0 });
    }
  });
}

/** A framed screenshot. `px` is the image's pixel size, so any crop keeps its shape. */
function shot(s, file, { x, y, w, h, px = [2880, 1800] }) {
  const ratio = px[1] / px[0];
  if (h) w = h / ratio;
  else h = w * ratio;
  s.addShape(pptx.ShapeType.rect, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: C.line }, line: { color: C.line, width: 0 } });
  s.addImage({ path: path.join(SHOTS, file), x, y, w, h });
  return { w, h };
}

/** Stacked rows, each a label with its parts. Used for the production foundation. */
function layers(s, rows, { x = M, y = 1.85, w = W - 2 * M } = {}) {
  const rowH = 1.02;
  const labelW = 2.75;
  rows.forEach((row, i) => {
    const ry = y + i * (rowH + 0.14);
    s.addShape(pptx.ShapeType.roundRect, { x, y: ry, w, h: rowH, rectRadius: 0.06, fill: { color: row.strong ? C.accentSoft : C.panel }, line: { color: row.strong ? C.accent : C.line, width: row.strong ? 1.25 : 0.75 } });
    s.addText(row.name, { x: x + 0.25, y: ry, w: labelW, h: rowH, fontFace: SERIF, fontSize: 17, color: C.text, margin: 0, valign: "middle" });
    const pw = (w - labelW - 0.55) / row.parts.length;
    row.parts.forEach((part, j) => {
      const px = x + labelW + 0.35 + j * pw;
      s.addShape(pptx.ShapeType.roundRect, { x: px, y: ry + 0.17, w: pw - 0.12, h: rowH - 0.34, rectRadius: 0.06, fill: { color: C.bg }, line: { color: C.line, width: 0.75 } });
      s.addText(part, { x: px + 0.05, y: ry + 0.17, w: pw - 0.22, h: rowH - 0.34, fontFace: SANS, fontSize: 12, color: C.text, align: "center", valign: "middle", margin: 0 });
    });
  });
}

/** A comparison table. The chosen row is tinted. */
function table(s, header, rows, { x = M, y, w = W - 2 * M, colW, rowH = 0.5, size = 11, chosen = 0 } = {}) {
  const head = header.map((text) => ({ text, options: { bold: true, color: C.accent, fontFace: MONO, fontSize: 10, fill: { color: C.bg }, valign: "middle" } }));
  const body = rows.map((row, i) =>
    row.map((text, j) => ({
      text,
      options: {
        color: j === 0 || i === chosen ? C.text : C.muted,
        bold: j === 0,
        fontFace: SANS,
        fontSize: size,
        fill: { color: i === chosen ? C.accentSoft : C.panel },
        valign: "middle",
      },
    })),
  );
  s.addTable([head, ...body], { x, y, w, colW, rowH, border: { type: "solid", color: C.line, pt: 0.75 }, margin: [0.03, 0.12, 0.03, 0.12] });
}

function label(s, text, { x = M, y }) {
  s.addText(text.toUpperCase(), { x, y, w: W - 2 * M, h: 0.26, fontFace: MONO, fontSize: 10, bold: true, color: C.muted, charSpacing: 3, margin: 0 });
}

// ------------------------------------------------------------------ 1. Title
{
  const s = slide({
    notes:
      "Hi, I'm Hamza. You asked for something built with AI that helps RealPage scale. I built this in one day, from your public website. I'll show you what it is, how it works, and why I made each choice.",
  });
  s.addText("Frontdoor", { x: M, y: 1.9, w: 9, h: 1.3, fontFace: SERIF, fontSize: 80, color: C.text, margin: 0 });
  s.addText("Ask about any RealPage product.\nGet an answer with sources, or get sent to the right team.", { x: M, y: 3.25, w: 11.5, h: 0.9, fontFace: SANS, fontSize: 21, color: C.muted, margin: 0, valign: "top" });
  s.addText("Built in one day from RealPage's public website.", { x: M, y: 4.25, w: 9.5, h: 0.4, fontFace: SANS, fontSize: 15, color: C.faint, margin: 0 });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 5.05, w: 0.6, h: 0.05, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
  s.addText("Hamza Saraswat", { x: M, y: 5.2, w: 6, h: 0.4, fontFace: SANS, fontSize: 18, bold: true, color: C.text, margin: 0 });
  s.addText("AI Engineer  ·  hamza-saraswat.com  ·  github.com/Hamza-Saraswat/RP_Demo", { x: M, y: 5.6, w: 9, h: 0.3, fontFace: MONO, fontSize: 11, color: C.muted, margin: 0 });
}

// ------------------------------------------------------------------ 2. What I built
{
  const s = slide({
    kicker: "What I built",
    title: "One place to ask about any RealPage product.",
    notes:
      `Here is what I built. It is one place to ask about any RealPage product. You type a question. It answers from RealPage's own public pages, and it shows you which pages it used. And if it's a question it shouldn't answer, like something about one customer's account, it sends that question to the right team instead. I picked this because RealPage has ${N.offerings} products and has acquired more than fifty companies. With that many products, knowing who owns a question is hard.`,
  });
  bullets(
    s,
    [
      ["You ask a question.", "About any product, in your own words."],
      ["It answers, and shows its sources.", "Only from RealPage's own public pages."],
      ["Or it sends it to the right team.", "When the question needs a person, it says who, and passes along what it found."],
    ],
    { y: 1.95, w: 5.0, gap: 1.2, size: 16 },
  );
  shot(s, "answer.png", { x: 6.05, y: 1.95, w: 6.55 });
  s.addShape(pptx.ShapeType.roundRect, { x: M, y: 6.2, w: W - 2 * M, h: 0.62, rectRadius: 0.06, fill: { color: C.accentSoft }, line: { color: C.accent, width: 1 } });
  s.addText(
    [
      { text: "Why this:  ", options: { bold: true, color: C.text } },
      { text: `RealPage has ${N.offerings} products and has acquired more than 50 companies. Knowing who owns a question is hard.`, options: { color: C.text } },
    ],
    { x: M + 0.25, y: 6.2, w: W - 2 * M - 0.5, h: 0.62, fontFace: SANS, fontSize: 15, margin: 0, valign: "middle" },
  );
}

// ------------------------------------------------------------------ 3. How it works
{
  const s = slide({
    kicker: "How it works",
    title: "What happens before you ask, and when you do.",
    notes:
      `Here is how it works. Two things happen before anyone asks a question. First, I read the public website: ${N.pages} pages. Product pages, customer case studies, press releases, and leadership bios. Second, I organized what I read in two ways. One is a company map: a short file for each product, product family, acquired company, customer, and executive. That is how it knows what exists and who owns it. The other is the page text itself, split at its headings into ${sections} sections, so it can be searched. Then, when you ask, four things happen. It works out which product you mean and whether this needs a person. It finds the sections that answer it. It writes the answer using only those sections. And it checks each sentence against its source before you see it. If it needs a person, or nothing answers it, the question goes to the owning team. Let me show you. [Switch to the app.]`,
  });
  label(s, "Before any question", { y: 1.78 });
  const cw = (W - 2 * M - 0.3) / 2;
  card(s, {
    x: M, y: 2.1, w: cw, h: 1.75,
    head: "1. I read the public website.",
    body: `${N.pages} pages: product pages, customer case studies, press releases, and leadership bios.`,
    bodySize: 13.5,
  });
  card(s, {
    x: M + cw + 0.3, y: 2.1, w: cw, h: 1.75,
    head: "2. I organized it two ways.",
    body: [
      { text: "A company map. ", options: { bold: true, color: C.text } },
      { text: `One short file for each product, family, acquired company, customer, and executive: ${N.files} files. It is how it knows what exists and who owns it.`, options: { breakLine: true } },
      { text: "Searchable text. ", options: { bold: true, color: C.text } },
      { text: `Every page, split at its headings into ${sections} sections.` },
    ],
    bodySize: 12.5,
  });
  label(s, "When you ask", { y: 4.1 });
  steps(
    s,
    [
      ["Understand", "Which product is this about? Does it need a person?"],
      ["Find", `Search the ${sections} sections for the ones that answer it.`],
      ["Write", "Write the answer using only those sections."],
      ["Check", "Compare each sentence to its source before showing it."],
    ],
    { y: 4.42, h: 1.4 },
  );
  s.addText("If it needs a person, or nothing answers it, the question goes to the owning team instead.", {
    x: M, y: 6.0, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 14, italic: true, color: C.muted, margin: 0,
  });
}

// ------------------------------------------------------------------ 4. Why Jev
{
  const s = slide({
    kicker: "Why I made each choice  ·  1 of 3",
    title: "Jev makes the decisions. Claude does the writing.",
    notes:
      "I used two models, and they do different jobs. Claude writes. Jev decides. Jev is a decision model. It does not write text. I give it a question with fixed answers, like 'which product family is this about', and it tells me how likely each answer is. I chose it for four reasons. One: it gives me a number, not a paragraph. So my code can set a rule: under sixty percent sure, a person decides. Two: it is fast, about a quarter of a second. That is why you saw the routing change while I was still typing. Three: it is cheap. The seventeen decisions behind one answer cost about a tenth of what the one writing call costs. Four: it lets me break one fuzzy question, 'should we answer this', into small clear ones. Is the writer a resident? Does this need account records? Is it about billing? My rule of thumb: if a person could decide it in under ten seconds, it is a Jev question. If it needs writing or reasoning, it goes to Claude.",
  });
  s.addText("Jev is a decision model. It does not write text. You give it a question with fixed answers, and it tells you how likely each one is.", {
    x: M, y: 1.62, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 14.5, color: C.muted, margin: 0,
  });
  const PANEL = [880, 1060]; // pixel size of the cropped side panel
  const ih = 4.25;
  const ix = W - M - ih / (PANEL[1] / PANEL[0]);
  shot(s, "jev-panel.png", { x: ix, y: 2.2, h: ih, px: PANEL });
  const lw = ix - M - 0.35;
  const reasons = [
    ["It returns a number, not a paragraph.", "\"Property Management: 100%.\" My code sets the cutoff: under 60% sure, a person decides."],
    ["It is fast.", "About a quarter of a second per decision. That is why the routing updates while you are still typing."],
    ["It is cheap.", "One answer uses about 17 decisions. Together they cost about a tenth of the one writing call."],
    ["It turns one fuzzy question into small clear ones.", "\"Should we answer this?\" becomes: Is the writer a resident? Does it need account records? Is it about billing?"],
  ];
  reasons.forEach(([head, body], i) => {
    const y = 2.2 + i * 0.94;
    s.addShape(pptx.ShapeType.roundRect, { x: M, y, w: lw, h: 0.84, rectRadius: 0.06, fill: { color: C.panel }, line: { color: C.line, width: 0.75 } });
    s.addText(String(i + 1), { x: M + 0.12, y, w: 0.4, h: 0.84, fontFace: SERIF, fontSize: 24, color: C.accent, align: "center", valign: "middle", margin: 0 });
    s.addText(
      [
        { text: head, options: { bold: true, color: C.text, breakLine: true } },
        { text: body, options: { color: C.muted, fontSize: 12 } },
      ],
      { x: M + 0.6, y, w: lw - 0.75, h: 0.84, fontFace: SANS, fontSize: 13.5, margin: 0, valign: "middle", lineSpacingMultiple: 1.08 },
    );
  });
  s.addText(
    [
      { text: "Where I used it:  ", options: { bold: true, color: C.text } },
      { text: "which product  ·  what kind of question  ·  does this page answer it  ·  does this sentence match its source", options: { color: C.muted } },
    ],
    { x: M, y: 6.06, w: lw, h: 0.42, fontFace: SANS, fontSize: 12, margin: 0, valign: "middle" },
  );
}

// ------------------------------------------------------------------ 5. Why keyword search
{
  const s = slide({
    kicker: "Why I made each choice  ·  2 of 3",
    title: "The simplest search that worked. And what I would use next.",
    notes:
      `For search, I picked the simplest option that worked: keyword search. It matches the words in the question to the words on the page. Three reasons. It is small: ${N.pages} pages, searched in seven milliseconds, for free. People name the product when they ask, so the words in the question are the words on the page. And I checked: it found the right page for all ${N.pageFound.n} test questions that had an answer. That does not make it the right choice everywhere. If staff type 'COI' and the page says 'certificate of insurance', I would add query rewriting. If people describe a problem in their own words, I would add embeddings, so it matches by meaning. If content changes every hour, I would work that out at question time. And at millions of documents and thousands of searches a day, a full vector database earns its cost. I would move up when people start asking in words the pages do not use. And the next step up is query rewriting, not a vector database.`,
  });
  const cw = (W - 2 * M - 0.5) / 3;
  const why = [
    ["It is small.", `${N.pages} pages. A keyword search over them takes 7 milliseconds and costs nothing.`],
    ["People name the product.", "\"Does Vendor Credentialing check workers' comp?\" The words asked are the words on the page."],
    ["I checked.", `It found the right page for all ${N.pageFound.n} test questions that had an answer.`],
  ];
  why.forEach(([head, body], i) => card(s, { x: M + i * (cw + 0.25), y: 1.66, w: cw, h: 1.28, head, body, headSize: 14, bodySize: 11.5 }));
  table(
    s,
    ["OPTION", "WHAT IT IS", "USE IT WHEN", "EXAMPLE"],
    [
      ["Keyword search  (chosen)", "Match the words in the question to words on the page", "People use the same words the pages use", "A product help site. This project"],
      ["Query rewriting", "A model rewrites the question into better search words first", "People use shorthand the pages do not", "Staff type \"COI\". The page says \"certificate of insurance\""],
      ["Keyword plus embeddings", "Also match by meaning, not only by words", "People describe a problem in their own words", "\"My tenant can't pay online\" has to find \"resident payment portal errors\""],
      ["Embed at question time", "Work out meaning on the spot. Nothing is stored", "Content changes every hour", "A live ticket queue, or a news feed"],
      ["Pre-embed popular pages", "Store meaning for the busiest pages only", "A few pages get most of the traffic", "A large wiki where 20% of pages get 80% of visits"],
      ["Full vector database", "Store meaning for everything", "Very high volume, and content rarely changes", "Millions of past support chats, searched thousands of times a day"],
    ],
    { y: 3.1, colW: [2.45, 3.25, 2.85, 3.383], rowH: 0.47, size: 10.5 },
  );
  s.addText(
    [
      { text: "When I would move up:  ", options: { bold: true, color: C.text } },
      { text: "when people start asking in words the pages do not use. The next step is query rewriting, not a vector database.", options: { color: C.muted } },
    ],
    { x: M, y: 6.52, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 13.5, margin: 0, valign: "middle" },
  );
}

// ------------------------------------------------------------------ 6. Why a company map, and why markdown
{
  const s = slide({
    kicker: "Why I made each choice  ·  3 of 3",
    title: "The company map is how a question finds its owner.",
    notes:
      `Your brief asked for a company knowledge graph. This is mine. I call it the company map. It is a list of every product, the family it belongs to, the company it came from, the customers who published results with it, and who owns it. So Vendor Credentialing came from Compliance Depot, sits in Spend and Vendor Management, and goes to that team. I built it because without it, the assistant can answer a question but cannot say whose question it is. And I did not invent the structure. The families come from RealPage's own website menu. I stored it as plain linked files, one per entry, ${N.files} of them, because at this size a person can open one and fix it. If I had a pile of documents and did not know what was in it, I would generate a graph automatically. If I needed to follow long chains across millions of records, I would use a graph database. And with many live sources that need permissions, I would use a managed platform.`,
  });
  chips(
    s,
    [
      ["Compliance Depot", "the company it came from"],
      ["Vendor Credentialing", "the product"],
      ["Spend & Vendor Management", "its family"],
      ["Owning team", "who to send it to"],
    ],
    { y: 1.68, h: 0.55, size: 13, captions: true },
  );
  bullets(
    s,
    [
      ["What it is.", "The \"company knowledge graph\" from your brief: every product, its family, where it came from, and who owns it."],
      ["Why I built it.", "Without it, the assistant can answer a question but cannot say whose question it is."],
      ["Where the structure comes from.", "RealPage's own website menu. I did not invent the families."],
    ],
    { y: 2.78, w: W - 2 * M, gap: 0.54, size: 13.5 },
  );
  table(
    s,
    ["HOW TO STORE IT", "USE IT WHEN", "EXAMPLE"],
    [
      ["Linked markdown files  (chosen)", "A few hundred to a few thousand entries that people need to read and fix", `This project: ${N.files} entries. Anyone can open a file and correct it`],
      ["Auto-generated graph", "You have a pile of documents and do not know what is in it yet", "Drop in 500 mixed files and ask \"what are the main topics here?\""],
      ["Graph database", "You need to follow long chains across millions of records", "\"Which customers are affected if we retire this product?\""],
      ["Managed knowledge platform", "Many live sources that must stay in sync, with permissions", "Chat history, a wiki, and a ticket system, searched together"],
    ],
    { y: 4.58, colW: [2.9, 4.4, 4.633], rowH: 0.45, size: 10.5 },
  );
}

// ------------------------------------------------------------------ 7. The pattern I run in production
{
  const s = slide({
    kicker: "Where this pattern comes from",
    title: "This is the pattern I run in production.",
    notes:
      "This was not a one-off. It is a small version of what I built at FieldPulse over the past year. At the bottom are connectors into the company's systems: the data warehouse through the Metabase API, Slack history that I backfilled so years of tribal knowledge is searchable, Jira and Linear tickets, the wiki, and the help center. On top of that is one knowledge layer: one place to search, and every answer cited. On top of that is one agent harness: a single core, where each team gets its own tools, its own prompt, and its own tests. And then the teams it serves.",
  });
  layers(s, [
    { name: "Teams it serves", parts: ["IT support", "Customer support", "Customer success", "Sales (next)"] },
    { name: "Company-wide agent harness", parts: ["One agent core", "Per-team tools", "Versioned prompts", "Tests on real transcripts"], strong: true },
    { name: "Universal knowledge layer", parts: ["One place to search", "Every answer cited", "Verified answers saved"], strong: true },
    { name: "Connectors into company systems", parts: ["Data warehouse (Metabase API)", "Slack history, backfilled", "Jira and Linear tickets", "Wiki and help center"] },
  ]);
}

// ------------------------------------------------------------------ 8. What that has produced
{
  const s = slide({
    kicker: "What that has produced",
    title: "One foundation. Fourteen tools.",
    notes:
      "Here is what that foundation has produced. One Slack bot became fourteen tools across eight departments since January. The Slack assistant has answered over twenty-two hundred product questions. The email agent triages two hundred support emails a week. The onboarding app has set up a hundred and eighty-three customers. Each new team reuses the same knowledge and the same rules. And this is how I work: ship a small version, let the team test it, and fix what they hit.",
  });
  const tw = (W - 2 * M - 3 * 0.25) / 4;
  const tiles = [
    { big: "14", label: "AI tools in production", note: "Across eight departments. Up from one Slack bot in January.", tone: C.accent },
    { big: "2,200+", label: "Questions answered", note: "In Slack, for 110+ employees. 94% without pulling in product or engineering." },
    { big: "200+", label: "Support emails a week", note: "Triaged by the email support agent." },
    { big: "183", label: "Customer accounts set up", note: "Through the onboarding app since June. Median nine minutes." },
  ];
  tiles.forEach((t, i) => tile(s, { x: M + i * (tw + 0.25), y: 1.85, w: tw, ...t }));
  s.addText("Each new team reuses the same knowledge and the same rules.", { x: M, y: 4.2, w: W - 2 * M, h: 0.5, fontFace: SERIF, fontSize: 24, color: C.text, margin: 0 });
  label(s, "How I work", { y: 5.05 });
  chips(s, ["Ship a small version", "The team tests it", "They tell me what broke", "I fix that"], { y: 5.38, h: 0.65, size: 14 });
}

// ------------------------------------------------------------------ 9. Day one
{
  const s = slide({
    kicker: "Day one inside RealPage",
    title: "Swap the sources. Pick one team. Measure.",
    notes:
      "So here is day one inside RealPage. Swap the public pages for internal sources. Everything else stays as it is. Pick one team, and ship them a first version that week. Let them break it, and fix what they hit. Measure with their questions, not mine. After that, the same foundation takes on document workflows: read the document, check it against the requirements, explain every gap at once, and send the unclear ones to a person. That is what I would bring. Thank you.",
  });
  bullets(
    s,
    [
      ["Swap the sources.", "Replace public pages with internal ones. Everything else stays as it is."],
      ["Pick one team.", "Ship them a first version that week, and let them break it."],
      ["Measure with their questions.", "A test set written by the people who field them."],
      ["Then document workflows.", "Read, check against requirements, explain every gap at once, send unclear ones to a person."],
    ],
    { y: 1.95, w: 7.2, gap: 1.0, size: 16 },
  );
  s.addShape(pptx.ShapeType.roundRect, { x: 8.5, y: 1.95, w: W - M - 8.5, h: 3.85, rectRadius: 0.06, fill: { color: C.accentSoft }, line: { color: C.accent, width: 1.25 } });
  s.addText("HAMZA SARASWAT", { x: 8.8, y: 2.2, w: 3.6, h: 0.3, fontFace: MONO, fontSize: 11, bold: true, color: C.accent, charSpacing: 3, margin: 0 });
  s.addText("AI Engineer", { x: 8.8, y: 2.5, w: 3.6, h: 0.5, fontFace: SERIF, fontSize: 26, color: C.text, margin: 0 });
  s.addText(
    [
      { text: "hamza-saraswat.com", options: { breakLine: true } },
      { text: "github.com/Hamza-Saraswat/RP_Demo", options: { breakLine: true } },
      { text: "hamza.saraswat@gmail.com", options: {} },
    ],
    { x: 8.8, y: 3.2, w: 3.7, h: 1.2, fontFace: MONO, fontSize: 11, color: C.muted, margin: 0, valign: "top", paraSpaceAfter: 6 },
  );
  s.addText("The code and every test are in the repo.", { x: 8.8, y: 4.6, w: 3.6, h: 0.9, fontFace: SANS, fontSize: 13, color: C.text, margin: 0, valign: "top" });
}

pptx.writeFile({ fileName: path.join(ROOT, "deck", "frontdoor.pptx") }).then((file) => console.log(`saved ${path.relative(ROOT, file)} (${count} slides)`));
