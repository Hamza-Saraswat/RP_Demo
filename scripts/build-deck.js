// node scripts/build-deck.js   Builds deck/frontdoor.pptx.
// Eval numbers are read from evals/results/*.json, so a slide can never disagree with a run.
const fs = require("node:fs");
const path = require("node:path");
const PptxGenJS = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "deck", "shots");
const read = (label) => JSON.parse(fs.readFileSync(path.join(ROOT, "evals", "results", `${label}.json`), "utf8")).summary;
const held = read("heldout-v3");
const tuning = ["golden-v1", "golden-v2", "golden-v3"].map(read);
const neededAPerson = held.sendOn.correct.n + tuning[2].sendOn.correct.n;
const wronglyAnswered = held.sendOn.wronglyAnswered + tuning[2].sendOn.wronglyAnswered;

// Fonts that ship with every copy of Keynote, PowerPoint, and Google Slides.
const SERIF = "Georgia";
const SANS = "Arial";
const MONO = "Courier New";

const C = {
  ink: "14151C",
  raised: "1C1E29",
  high: "242735",
  line: "3A3E52",
  text: "E8EAF2",
  muted: "9DA1B7",
  faint: "6B6F86",
  accent: "635BFF",
  cyan: "80E9FF",
  green: "00D4AA",
  amber: "FFB547",
  red: "FF6B81",
};

const W = 13.333;
const H = 7.5;
const M = 0.7; // side margin

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Hamza Saraswat";
pptx.title = "Frontdoor";

let count = 0;
function slide({ kicker, title, notes }) {
  const s = pptx.addSlide();
  count += 1;
  s.background = { color: C.ink };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
  if (kicker) {
    s.addText(kicker.toUpperCase(), { x: M, y: 0.45, w: W - 2 * M, h: 0.3, fontFace: MONO, fontSize: 11, color: C.cyan, charSpacing: 3, margin: 0 });
  }
  if (title) {
    s.addText(title, { x: M, y: 0.78, w: W - 2 * M, h: 0.85, fontFace: SERIF, fontSize: 34, color: C.text, margin: 0, valign: "top" });
  }
  s.addText(`Hamza Saraswat  ·  Frontdoor  ·  ${count}`, { x: M, y: H - 0.42, w: W - 2 * M, h: 0.25, fontFace: MONO, fontSize: 9, color: C.faint, margin: 0 });
  if (notes) s.addNotes(notes);
  return s;
}

/** Bullets in his house style: a bold label, then one sentence. */
function bullets(s, items, { x = M, y = 1.95, w = 6.2, size = 16, gap = 0.98 } = {}) {
  items.forEach(([label, text], i) => {
    s.addShape(pptx.ShapeType.rect, { x, y: y + i * gap + 0.07, w: 0.05, h: gap - 0.3, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
    s.addText(
      [
        { text: `${label}  `, options: { bold: true, color: C.text } },
        { text, options: { color: C.muted } },
      ],
      { x: x + 0.22, y: y + i * gap, w: w - 0.22, h: gap - 0.12, fontFace: SANS, fontSize: size, valign: "top", margin: 0, lineSpacingMultiple: 1.12 },
    );
  });
}

function tile(s, { x, y, w, h = 1.75, big, label, note, tone = C.text, bigSize = 40 }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.raised }, line: { color: C.line, width: 0.75 } });
  s.addText(big, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.8, fontFace: SERIF, fontSize: bigSize, color: tone, margin: 0, valign: "middle" });
  s.addText(label, { x: x + 0.25, y: y + 0.98, w: w - 0.5, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, color: C.text, margin: 0 });
  if (note) s.addText(note, { x: x + 0.25, y: y + 1.26, w: w - 0.5, h: h - 1.34, fontFace: SANS, fontSize: 10.5, color: C.muted, margin: 0, valign: "top" });
}

function chips(s, labels, { x = M, y, w = W - 2 * M, h = 0.55, fill = C.high, color = C.text, size = 13 } = {}) {
  const arrow = 0.38;
  const each = (w - arrow * (labels.length - 1)) / labels.length;
  labels.forEach((label, i) => {
    const cx = x + i * (each + arrow);
    s.addShape(pptx.ShapeType.roundRect, { x: cx, y, w: each, h, rectRadius: 0.1, fill: { color: fill }, line: { color: C.line, width: 0.75 } });
    s.addText(label, { x: cx, y, w: each, h, fontFace: SANS, fontSize: size, bold: true, color, align: "center", valign: "middle", margin: 0 });
    if (i < labels.length - 1) {
      s.addText("→", { x: cx + each, y, w: arrow, h, fontFace: SANS, fontSize: 16, color: C.cyan, align: "center", valign: "middle", margin: 0 });
    }
  });
}

function shot(s, file, { x, y, w }) {
  const h = (w * 1800) / 2880;
  s.addShape(pptx.ShapeType.rect, { x: x - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: C.line }, line: { color: C.line, width: 0 } });
  s.addImage({ path: path.join(SHOTS, file), x, y, w, h });
  return h;
}

/** The layered picture used twice: once for what he built, once for today's build. */
function layers(s, rows, { x = M, y = 1.95, w = W - 2 * M } = {}) {
  const rowH = 1.02;
  const labelW = 2.55;
  rows.forEach((row, i) => {
    const ry = y + i * (rowH + 0.14);
    s.addShape(pptx.ShapeType.roundRect, { x, y: ry, w, h: rowH, rectRadius: 0.06, fill: { color: row.strong ? C.high : C.raised }, line: { color: row.strong ? C.accent : C.line, width: row.strong ? 1.25 : 0.75 } });
    s.addText(row.label.toUpperCase(), { x: x + 0.25, y: ry + 0.14, w: labelW, h: 0.25, fontFace: MONO, fontSize: 9.5, color: C.cyan, charSpacing: 2, margin: 0 });
    s.addText(row.name, { x: x + 0.25, y: ry + 0.4, w: labelW, h: 0.5, fontFace: SERIF, fontSize: 17, color: C.text, margin: 0, valign: "top" });
    const pw = (w - labelW - 0.55) / row.parts.length;
    row.parts.forEach((part, j) => {
      const px = x + labelW + 0.35 + j * pw;
      s.addShape(pptx.ShapeType.roundRect, { x: px, y: ry + 0.17, w: pw - 0.12, h: rowH - 0.34, rectRadius: 0.06, fill: { color: C.ink }, line: { color: C.line, width: 0.5 } });
      s.addText(part, { x: px + 0.05, y: ry + 0.17, w: pw - 0.22, h: rowH - 0.34, fontFace: SANS, fontSize: 11.5, color: C.text, align: "center", valign: "middle", margin: 0 });
    });
  });
}

function table(s, header, rows, { x = M, y = 1.9, w = W - 2 * M, colW, rowH = 0.62, chosen = 0 } = {}) {
  const head = header.map((text) => ({ text, options: { bold: true, color: C.cyan, fontFace: MONO, fontSize: 10, fill: { color: C.ink }, valign: "middle" } }));
  const body = rows.map((row, i) =>
    row.map((text, j) => ({
      text,
      options: {
        color: i === chosen ? C.text : j === 0 ? C.text : C.muted,
        bold: j === 0,
        fontFace: SANS,
        fontSize: 12,
        fill: { color: i === chosen ? "2A2860" : C.raised },
        valign: "middle",
      },
    })),
  );
  s.addTable([head, ...body], { x, y, w, colW, rowH, border: { type: "solid", color: C.line, pt: 0.5 }, margin: [0.04, 0.14, 0.04, 0.14] });
}

// ------------------------------------------------------------------ 1. Title
{
  const s = slide({
    notes:
      "Hi, I'm Hamza. You asked for something built with AI that helps RealPage scale. I built this in one day from your public website. I'll show you what it does, how it works, and why I made each choice. Then I'll show you where the pattern comes from.",
  });
  s.addText("Frontdoor", { x: M, y: 2.0, w: 8, h: 1.3, fontFace: SERIF, fontSize: 80, color: C.text, margin: 0 });
  s.addText("One question in. A cited answer, or the right owner.", { x: M, y: 3.35, w: 9, h: 0.5, fontFace: SANS, fontSize: 22, color: C.muted, margin: 0 });
  s.addText("A company knowledge layer and assistant, built in one day from RealPage's public pages.", { x: M, y: 3.95, w: 9.5, h: 0.4, fontFace: SANS, fontSize: 15, color: C.faint, margin: 0 });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 5.05, w: 0.6, h: 0.04, fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
  s.addText("Hamza Saraswat", { x: M, y: 5.2, w: 6, h: 0.4, fontFace: SANS, fontSize: 18, bold: true, color: C.text, margin: 0 });
  s.addText("AI Engineer  ·  hamza-saraswat.com  ·  github.com/Hamza-Saraswat/RP_Demo", { x: M, y: 5.6, w: 9, h: 0.3, fontFace: MONO, fontSize: 11, color: C.muted, margin: 0 });
}

// ------------------------------------------------------------------ 2. The problem
{
  const s = slide({
    kicker: "The problem",
    title: "Many products. One front door.",
    notes:
      "Start with the problem. I'm on the outside, so I used only what is public. Over fifty companies acquired in two decades. Sixty-four products and agents on your own website menu. Forty-two thousand customers. And the public support page splits by who you are, not by which product you're asking about. So every question has to find its owner. I don't know how you handle that internally. That is the problem I picked.",
  });
  const tw = (W - 2 * M - 3 * 0.25) / 4;
  const tiles = [
    { big: "50+", label: "Companies acquired", note: "Over two decades. Multifamily Executive, interview with the CEO." },
    { big: "64", label: "Products and agents", note: "In ten families, counted from the menu on realpage.com." },
    { big: "42,000", label: "Customers", note: "And 24 million units. RealPage press release, Cherre acquisition." },
    { big: "2", label: "Public support paths", note: "Split by who is asking, not by product. realpage.com/support.", tone: C.amber },
  ];
  tiles.forEach((t, i) => tile(s, { x: M + i * (tw + 0.25), y: 1.95, w: tw, h: 2.0, ...t }));
  s.addText("So every question has to find its owner.", { x: M, y: 4.45, w: W - 2 * M, h: 0.6, fontFace: SERIF, fontSize: 28, color: C.text, margin: 0 });
  s.addText(
    "I do not know how RealPage handles this internally. Everything here is built from public pages, and says so.",
    { x: M, y: 5.15, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 15, color: C.muted, margin: 0 },
  );
}

// ------------------------------------------------------------------ 3. What I built
{
  const s = slide({
    kicker: "What I built",
    title: "One front door, in four layers, built in one day.",
    notes:
      "Here is what I built. I call it Frontdoor. You ask about any product, and you get a cited answer or you get sent to the right owner. It has four layers. At the bottom, a connector reads two hundred and twenty-one public pages. Above that, a knowledge layer: a company map of a hundred and sixty-six markdown files, plus thirteen hundred searchable passages. Above that, one agent core that decides, finds, writes, and checks. On top, two team profiles on that one core. Let me show you.",
  });
  layers(s, [
    { label: "Teams", name: "Two profiles, one core", parts: ["Support", "Sales", "Adding a team is adding a file"] },
    { label: "Layer 2", name: "Agent core", parts: ["Decide", "Find", "Write", "Check"], strong: true },
    { label: "Layer 1", name: "Knowledge layer", parts: ["Company map: 166 markdown files", "1,323 searchable passages", "Every entity has its source"], strong: true },
    { label: "Connector", name: "Public site, today", parts: ["221 public pages", "Read from the site's own menu", "Day one: swap in internal sources"] },
  ]);
}

// ------------------------------------------------------------------ 4. Demo
{
  const s = slide({
    kicker: "Demo",
    title: "Four things to watch.",
    notes:
      "Let me show you. Watch four things. One: the routing runs while I'm still typing. Two: an answer, where every sentence is checked against its source. Three: a question it should not answer, so it hands off and passes along what it knows. Four: I switch teams, and the same core answers differently. [Switch to the app.]",
  });
  shot(s, "answer-trace.png", { x: 5.55, y: 1.85, w: 7.1 });
  bullets(
    s,
    [
      ["Routing as I type.", "The first decision runs on every pause, before I send."],
      ["An answer.", "Each sentence is checked against the source it cites."],
      ["A handoff.", "It says who owns this, and passes along what it found."],
      ["A team switch.", "Same core. Different sources and guidance."],
    ],
    { y: 1.95, w: 4.6, gap: 1.08, size: 15 },
  );
}

// ------------------------------------------------------------------ 5. How I use Jev
{
  const s = slide({
    kicker: "Why I made each choice  ·  1 of 3",
    title: "Jev decides. Claude writes. Code owns the rules.",
    notes:
      "Here's why I built it this way. Three jobs, three owners. Code owns the rules and the lookups: if you type OneSite, I don't need a model to notice. Jev makes every judgment: which family, which product, does this passage hold evidence, does this sentence match its source. It comes back in about a quarter of a second with a probability, so code can decide what to do with it. Claude only writes, and only from passages that passed. I write Jev's questions from real misses, and I set the cutoffs from my own data. And it fails closed: a sentence with no source gets deleted.",
  });
  const cw = (W - 2 * M - 2 * 0.25) / 3;
  const cols = [
    { tag: "CODE", color: C.muted, name: "Owns the rules", lines: ["Notices product names", "Runs the keyword search", "Decides what ships", "Every outcome is unit tested"] },
    { tag: "JEV", color: C.cyan, name: "Makes each judgment", lines: ["Which family and product", "Does this passage hold evidence", "Does this sentence match its source", "Returns a probability, in about 250 ms"] },
    { tag: "CLAUDE", color: C.amber, name: "Writes", lines: ["Only from passages that passed", "Cites every sentence", "Says what the sources do not cover", "Never decides anything"] },
  ];
  cols.forEach((c, i) => {
    const x = M + i * (cw + 0.25);
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.95, w: cw, h: 2.75, rectRadius: 0.06, fill: { color: C.raised }, line: { color: C.line, width: 0.75 } });
    s.addText(c.tag, { x: x + 0.25, y: 2.1, w: cw - 0.5, h: 0.28, fontFace: MONO, fontSize: 11, bold: true, color: c.color, charSpacing: 3, margin: 0 });
    s.addText(c.name, { x: x + 0.25, y: 2.4, w: cw - 0.5, h: 0.45, fontFace: SERIF, fontSize: 21, color: C.text, margin: 0 });
    s.addText(
      c.lines.map((t) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: true } })),
      { x: x + 0.25, y: 2.95, w: cw - 0.5, h: 1.65, fontFace: SANS, fontSize: 13, color: C.muted, margin: 0, valign: "top", paraSpaceAfter: 5 },
    );
  });
  bullets(
    s,
    [
      ["Questions come from real misses.", "I rewrite a check when a real question fools it, not before."],
      ["It fails closed.", "A sentence with no source is deleted. A check that errors counts as no."],
    ],
    { y: 5.0, w: W - 2 * M, gap: 0.78, size: 15 },
  );
}

// ------------------------------------------------------------------ 6. Retrieval ladder
{
  const s = slide({
    kicker: "Why I made each choice  ·  2 of 3",
    title: "Retrieval: I picked the rung the numbers supported.",
    notes:
      "Second choice: retrieval. Your job description mentions vector databases, and I use them in production. Here I didn't, on purpose. There's a ladder. Keyword search. Then query rewriting. Then hybrid with embeddings. Then embedding on the fly, hot and cold tiers, and full pre-embedding in a vector database. Each one fits a real situation. For two hundred pages, keyword search plus an evidence check found the right page every time a search ran. I set the trigger to move up before I ran anything. It never fired.",
  });
  table(
    s,
    ["OPTION", "WHAT IT ADDS", "USE IT WHEN"],
    [
      ["1  Keyword search + evidence check", "Nothing to run. Exact names and terms.", "People use the words the docs use. Chosen here."],
      ["2  Query rewriting", "A model turns a messy question into search terms.", "People use different words, or internal jargon."],
      ["3  Hybrid: keyword, then embeddings", "Meaning, not only words.", "Questions are conceptual and content is stable."],
      ["4  Embed on the fly", "Always fresh. Slower per query.", "Content changes every day."],
      ["5  Hot and cold tiers", "Pre-embed the popular 20%.", "Large corpus with clear traffic patterns."],
      ["6  Full vector database", "Fastest at scale. Costly to re-embed.", "Over 10,000 queries a day, stable corpus."],
    ],
    { colW: [3.9, 3.9, 4.133], rowH: 0.56 },
  );
  s.addText(
    [
      { text: "My trigger to move up:  ", options: { bold: true, color: C.text } },
      { text: "the right page missing for more than 15% of answerable questions. Set before the first run. It did not fire.", options: { color: C.muted } },
    ],
    { x: M, y: 6.05, w: W - 2 * M, h: 0.6, fontFace: SANS, fontSize: 14, margin: 0, valign: "top" },
  );
}

// ------------------------------------------------------------------ 7. Knowledge store ladder
{
  const s = slide({
    kicker: "Why I made each choice  ·  3 of 3",
    title: "Knowledge store: markdown files a person can read.",
    notes:
      "Third choice: where the company map lives. You asked for a knowledge graph. This is one, but it's not a graph database. It's a hundred and sixty-six markdown files in git. The links between files are the graph. A person can open one, read it, and fix it. If I had a pile of mixed material and wanted to discover structure, I'd generate a graph. If I needed multi-hop queries across millions of relationships, I'd use a graph database. And with many live internal sources with permissions, I'd use a managed platform, which is what I run in production. One more thing: the structure is never guessed. It comes from your own site menu.",
  });
  table(
    s,
    ["OPTION", "USE IT WHEN"],
    [
      ["1  Markdown files, linked", "Hundreds to a few thousand entities that people need to read and correct. Chosen here."],
      ["2  Generated graph", "You have mixed material and want to discover structure you do not know yet."],
      ["3  Graph database", "You need multi-hop queries across millions of relationships."],
      ["4  Managed knowledge platform", "Many live sources with permissions: chat, tickets, wiki. What I run in production."],
    ],
    { colW: [3.9, 8.033], rowH: 0.62 },
  );
  bullets(
    s,
    [
      ["Structure is never guessed.", "Families and products come from the site's own menu, read by code."],
      ["Uncertainty is written down.", "Where Jev placed a product, its confidence is on the file. Two are flagged for a person."],
    ],
    { y: 5.55, w: W - 2 * M, gap: 0.7, size: 14.5 },
  );
}

// ------------------------------------------------------------------ 8. Results
{
  const s = slide({
    kicker: "Results",
    title: `${held.overall.right} of ${held.overall.n} on questions it had never seen.`,
    notes:
      "Results. I wrote thirty questions and tuned against them. First run, twenty-eight of thirty. I read the misses, made fixes, got twenty-nine. One of my fixes had broken something. I fixed that and got thirty. That is how I work: ship it, test it, fix what broke. But a tuning score flatters, so I wrote ten fresh questions, committed them, and ran them once. Nine of ten. The one it missed, it sent to a person when it could have answered. And across every question that needed a person, it never answered when it shouldn't have. I know what I'd change to catch that miss. I haven't, because changing it and quoting the same number would make the number meaningless.",
  });
  const tw = (W - 2 * M - 3 * 0.25) / 4;
  const tiles = [
    { big: `${held.overall.right}/${held.overall.n}`, label: "Held-out questions", note: "Written after tuning stopped, committed, then run once.", tone: C.green },
    { big: String(wronglyAnswered), label: "Wrongly answered", note: `Across all ${neededAPerson} questions that needed a person.`, tone: C.cyan },
    { big: tuning.map((t) => t.overall.right).join(", "), label: `Of ${tuning[0].overall.n}, across three drafts`, note: "Tuning questions. Draft 2 fixed two misses and caused one.", bigSize: 34 },
    { big: `${(held.medianMsAnswered / 1000).toFixed(1)} s`, label: "Median time to an answer", note: `About $${held.meanCost.toFixed(3)} per question, all calls included.` },
  ];
  tiles.forEach((t, i) => tile(s, { x: M + i * (tw + 0.25), y: 1.95, w: tw, h: 2.0, ...t }));
  bullets(
    s,
    [
      ["The miss.", "A question about published customer results went to a person. Safe, but a colleague would have answered it."],
      ["What I did not do.", "Change the system after seeing that miss and then quote the same score."],
      ["What this does not show.", "Forty questions is small, and I wrote them. The people who field these questions would write harder ones."],
    ],
    { y: 4.3, w: W - 2 * M, gap: 0.78, size: 14.5 },
  );
}

// ------------------------------------------------------------------ 9. Where this comes from
{
  const s = slide({
    kicker: "Where this pattern comes from",
    title: "This is the pattern I run in production.",
    notes:
      "This was not a one-off. It is a small version of what I built at FieldPulse over the past year. Same four layers. Connectors into the company's systems: the data warehouse through the Metabase API, Slack history that I backfilled so years of tribal knowledge is searchable, Jira and Linear tickets, the wiki, the help center. One knowledge layer on top: one search source, every answer cited. One agent harness on top of that: a single core, where each team gets its own tools, prompt, and evals. Then the teams.",
  });
  layers(s, [
    { label: "Teams", name: "Who it serves", parts: ["IT support", "Customer support", "Customer success", "Sales (next)"] },
    { label: "Layer 2", name: "Company-wide agent harness", parts: ["One agent core", "Per-team tools", "Versioned prompts", "Transcript evals"], strong: true },
    { label: "Layer 1", name: "Universal knowledge layer", parts: ["One search source", "Every answer cited", "Verified answers saved"], strong: true },
    { label: "Connectors", name: "Into company systems", parts: ["Data warehouse (Metabase API)", "Slack history, backfilled", "Jira and Linear tickets", "Wiki and help center"] },
  ]);
}

// ------------------------------------------------------------------ 10. How I work, and what it produced
{
  const s = slide({
    kicker: "How I work, and what it produced",
    title: "A new team is a connector and a prompt.",
    notes:
      "Once that foundation exists, a new team is a connector and a prompt, not a new project. That is how one Slack bot became fourteen tools across eight departments since January. The Slack assistant has answered over twenty-two hundred product questions. The email agent triages two hundred support emails a week. The onboarding app has set up a hundred and eighty-three customers. And the way I work is the loop you just saw in my results: ship small, let the team break it, fix what they hit. I don't build for problems nobody has.",
  });
  const tw = (W - 2 * M - 3 * 0.25) / 4;
  const tiles = [
    { big: "14", label: "AI tools in production", note: "Across eight departments. Up from one Slack bot in January.", tone: C.cyan },
    { big: "2,200+", label: "Questions answered", note: "In Slack, for 110+ employees. 94% without pulling in product or engineering." },
    { big: "200+", label: "Support emails a week", note: "Triaged by the email support agent." },
    { big: "183", label: "Customer accounts set up", note: "Through the onboarding app since June. Median nine minutes." },
  ];
  tiles.forEach((t, i) => tile(s, { x: M + i * (tw + 0.25), y: 1.95, w: tw, h: 2.0, ...t }));
  chips(s, ["Ship small", "Team tests it", "They tell me what broke", "I fix that"], { y: 4.3, h: 0.6, size: 14, fill: C.high });
  bullets(
    s,
    [
      ["Fix what they hit.", "The first version reaches the team in days. I do not build for problems nobody has."],
      ["Shared rules.", "Answers come only from sources, always cited. No team can loosen that."],
    ],
    { y: 5.25, w: W - 2 * M, gap: 0.72, size: 15 },
  );
}

// ------------------------------------------------------------------ 11. Day one
{
  const s = slide({
    kicker: "Day one inside RealPage",
    title: "Swap the sources. Pick one team. Measure.",
    notes:
      "So here is day one inside RealPage. Swap the public pages for internal sources: that's the bottom layer, nothing else changes. Pick one team and ship them a first version that week. Let them break it, and fix what they hit. Measure with their questions, not mine. And after that, the same foundation takes on document workflows: read the document, check it against the requirements, explain every gap at once, and send the unclear ones to a person. That's what I'd bring. Thank you.",
  });
  bullets(
    s,
    [
      ["Swap the sources.", "Replace public pages with internal ones. The other three layers stay as they are."],
      ["Pick one team.", "Ship them a first version that week, and let them break it."],
      ["Measure with their questions.", "A test set written by the people who field them."],
      ["Then document workflows.", "Read, check against requirements, explain every gap at once, send unclear ones to a person."],
    ],
    { y: 1.95, w: 7.2, gap: 1.0, size: 16 },
  );
  s.addShape(pptx.ShapeType.roundRect, { x: 8.5, y: 1.95, w: W - M - 8.5, h: 3.85, rectRadius: 0.06, fill: { color: C.raised }, line: { color: C.accent, width: 1.25 } });
  s.addText("HAMZA SARASWAT", { x: 8.8, y: 2.2, w: 3.6, h: 0.3, fontFace: MONO, fontSize: 11, color: C.cyan, charSpacing: 3, margin: 0 });
  s.addText("AI Engineer", { x: 8.8, y: 2.5, w: 3.6, h: 0.5, fontFace: SERIF, fontSize: 26, color: C.text, margin: 0 });
  s.addText(
    [
      { text: "hamza-saraswat.com", options: { breakLine: true } },
      { text: "github.com/Hamza-Saraswat/RP_Demo", options: { breakLine: true } },
      { text: "hamza.saraswat@gmail.com", options: {} },
    ],
    { x: 8.8, y: 3.2, w: 3.7, h: 1.2, fontFace: MONO, fontSize: 11, color: C.muted, margin: 0, valign: "top", paraSpaceAfter: 6 },
  );
  s.addText("The code, the test questions, and every eval run are in the repo.", { x: 8.8, y: 4.6, w: 3.6, h: 0.9, fontFace: SANS, fontSize: 13, color: C.text, margin: 0, valign: "top" });
}

pptx.writeFile({ fileName: path.join(ROOT, "deck", "frontdoor.pptx") }).then((file) => console.log(`saved ${path.relative(ROOT, file)} (${count} slides)`));
