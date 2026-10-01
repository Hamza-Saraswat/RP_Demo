# Talk track

Target about 6 minutes. Hard cap 7.

The three "why" slides (4, 5, 6) are written out word for word, so you can read them. Every other slide is short beats with one **bold line to land**. The same text is in each slide's speaker notes.

| Part | Slides | Time |
|---|---|---|
| What I built and how it works | 1 to 3 | 1:10 |
| Demo | the app | 1:30 |
| Why I made each choice | 4 to 6 | 2:15 |
| Where it comes from, and day one | 7 to 9 | 1:05 |

## 1. Title (0:10)

- You asked for something built with AI that helps RealPage scale.
- I built this in one day, from your public website.
- **I'll show you what it is, how it works, and why I made each choice.**

## 2. What I built (0:25)

- It is one place to ask about any RealPage product.
- You type a question. It answers from RealPage's own public pages, and shows which pages it used.
- If it is a question it should not answer, like something about one customer's account, it sends it to the right team instead.
- **RealPage has 63 products and has acquired more than 50 companies. Knowing who owns a question is hard.**

## 3. How it works (0:35)

- Two things happen before anyone asks.
- One: I read the public website. 221 pages. Product pages, customer case studies, press releases, leadership bios.
- Two: I organized it two ways. A company map, which is a short file for each product, family, acquired company, customer, and executive. And the page text itself, split at its headings into 1,323 sections so it can be searched.
- Then, when you ask, four things happen: understand, find, write, check.
- If it needs a person, or nothing answers it, it goes to the owning team.
- **Let me show you.**

## Demo (1:30)

Switch to the app. Follow `demo-script.md`, the 90-second path.

- **Watch the right side. Every decision shows up as it is made.**

Switch back to the deck on slide 4.

## 4. Why Jev (0:45) — read this one

> I used two models, and they do different jobs. Claude writes. Jev decides.
>
> Jev is a decision model. It does not write text. I give it a question with fixed answers, like "which product family is this about", and it tells me how likely each answer is.
>
> I chose it for four reasons.
>
> One: it gives me a number, not a paragraph. So my code can set a rule: under sixty percent sure, a person decides.
>
> Two: it is fast. About a quarter of a second. That is why you saw the routing change while I was still typing.
>
> Three: it is cheap. The seventeen decisions behind one answer cost about a tenth of what the one writing call costs.
>
> Four: it lets me break one fuzzy question, "should we answer this", into small clear ones. Is the writer a resident? Does this need account records? Is it about billing?
>
> **My rule of thumb: if a person could decide it in under ten seconds, it is a Jev question. If it needs writing or reasoning, it goes to Claude.**

## 5. Why keyword search (0:50) — read this one

> For search, I picked the simplest option that worked: keyword search. It matches the words in the question to the words on the page.
>
> Three reasons. It is small: 221 pages, searched in seven milliseconds, for free. People name the product when they ask, so the words in the question are the words on the page. And I checked: it found the right page for all eighteen test questions that had an answer.
>
> That does not make it the right choice everywhere.
>
> If staff type "COI" and the page says "certificate of insurance", I would add query rewriting.
>
> If people describe a problem in their own words, I would add embeddings, so it matches by meaning.
>
> If content changes every hour, I would work that out at question time.
>
> And at millions of documents and thousands of searches a day, a full vector database earns its cost.
>
> **I would move up when people start asking in words the pages do not use. And the next step is query rewriting, not a vector database.**

## 6. Why a company map, and why markdown (0:40) — read this one

> Your brief asked for a company knowledge graph. This is mine. I call it the company map.
>
> It is a list of every product, the family it belongs to, the company it came from, and who owns it. So Vendor Credentialing came from Compliance Depot, sits in Spend and Vendor Management, and goes to that team.
>
> I built it because without it, the assistant can answer a question but cannot say whose question it is.
>
> And I did not invent the structure. The families come from RealPage's own website menu.
>
> I stored it as plain linked files, one per entry, 157 of them, because at this size a person can open one and fix it.
>
> If I had a pile of documents and did not know what was in it, I would generate a graph automatically. If I needed to follow long chains across millions of records, I would use a graph database. With many live sources that need permissions, I would use a managed platform.
>
> **I pick the smallest thing the situation needs, and I know what the next size up is.**

## 7. The pattern I run in production (0:30)

- This was not a one-off. It is a small version of what I built at FieldPulse over the past year.
- Connectors at the bottom: the data warehouse through the Metabase API. Slack history, backfilled, so tribal knowledge is searchable. Jira and Linear tickets. The wiki and help center.
- One knowledge layer on top. One agent harness on top of that. Then the teams.
- **I built the foundation once. Now every team builds on it.**

## 8. What that has produced (0:20)

- One Slack bot became 14 tools across eight departments since January.
- 2,200 questions answered in Slack. 200 support emails a week. 183 customers set up.
- **Each new team reuses the same knowledge and the same rules.**
- How I work: ship a small version, the team tests it, I fix what they hit.

Say one number per tool. Do not stack them.

## 9. Day one inside RealPage (0:15)

- Swap the sources. Pick one team. Ship that week. Measure with their questions.
- Next, the same foundation takes on document workflows.
- **That is what I would bring. Thank you.**

## If you are running long

Cut in this order:
1. On slide 5, skip the middle four "I would add" lines. Keep the reasons and the last line.
2. On slide 6, skip the paragraph about the other storage options.
3. The per-tool numbers on slide 8. Keep "14 tools, eight departments".

## Do not say

- Internal tool names. Say "knowledge layer" and "agent harness".
- Anything about how RealPage works internally.
- That the teams or owners in the demo are real. They are stand-ins, and the screen says so.
