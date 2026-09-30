// node scripts/shots.mjs   Takes the screenshots the deck uses. Needs the dev server on port 3210.
import puppeteer from "puppeteer-core";

const BASE = process.env.FRONTDOOR_URL ?? "http://localhost:3210";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = new URL("../deck/shots/", import.meta.url).pathname;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
const page = await browser.newPage();
const field = "textarea";

async function ask(question, { team, file, livePause = false }) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  if (team) {
    await page.evaluate((name) => [...document.querySelectorAll("header button")].find((b) => b.textContent.trim() === name)?.click(), team);
  }
  await page.click(field);
  await page.type(field, question, { delay: 8 });
  if (livePause) {
    await page.waitForFunction(() => document.body.innerText.includes("WHAT KIND OF QUESTION") || document.body.innerText.includes("What kind of question"), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: `${OUT}${file}-typing.png` });
  }
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.body.innerText.includes("decision calls"), { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}${file}.png` });
  // The lower half of the trace, where the evidence and sentence checks are.
  await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (aside) aside.scrollTop = aside.scrollHeight;
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}${file}-trace.png` });
  console.log(`saved ${file}`);
}

await ask("What does the AI Operations Agent check in a lease audit?", { file: "answer", livePause: true });
await ask("Our Oak Street property shows the wrong ledger balance after move-out. Can you fix it?", { file: "handoff" });
await ask("Is it working?", { file: "escalate" });
await ask("What results did Summit get with the AI Operations Agent?", { team: "Sales", file: "sales" });

await page.goto(`${BASE}/evals`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${OUT}evals.png` });
await page.goto(`${BASE}/atlas`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${OUT}atlas.png` });
await page.goto(`${BASE}/atlas#families/spend-and-vendor-management`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}atlas-family.png` });
console.log("saved evals and atlas");
await browser.close();
