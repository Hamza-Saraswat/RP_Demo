# Talk track

Target 6 minutes. Hard cap 7. Beats, not a script: say them your way.
Each slide has one **bold line to land**. If you only say that line, the slide still works.

The order: what I built, how it works, why I made each choice, what the results were. Then, briefly, where the pattern comes from.

| Part | Slides | Time |
|---|---|---|
| The problem and what I built | 1 to 3 | 1:05 |
| Demo | 4, then the app | 1:30 |
| Why I made each choice | 5 to 7 | 1:30 |
| Results | 8 | 0:40 |
| Where this comes from, and day one | 9 to 11 | 1:15 |

## 1. Title (0:15)

- You asked for something built with AI that helps RealPage scale.
- I built this in one day, from your public website.
- **I'll show you what it does, how it works, and why I made each choice.**

## 2. The problem (0:25)

- I am on the outside, so I used only what is public.
- Over 50 companies acquired. 64 products and agents on your own site menu.
- Public support splits by who you are, not by product.
- **So every question has to find its owner. That is the problem I picked.**

## 3. What I built (0:25)

- I call it Frontdoor. Ask about any product. You get a cited answer, or you get sent to the right owner.
- Four layers. A connector reads 221 public pages. A knowledge layer: a company map of 166 files. One agent core. Two teams on top.
- **Let me show you.**

## 4. Demo (1:30)

Follow `demo-script.md`, the 90-second path.

- **Watch the right side. Every decision shows up as it is made.**

## 5. Why Jev (0:35)

- Three jobs, three owners.
- Code owns the rules. If you type OneSite, no model is needed to notice.
- Jev makes each judgment and tells me how sure it is, in a quarter of a second. That is why it can route while I type.
- Claude only writes, and only from passages that passed.
- **It fails closed. A sentence with no source gets deleted.**

## 6. Why this retrieval (0:30)

- Your job description mentions vector databases. I use them in production. Here I did not, on purpose.
- There is a ladder, and every rung fits a real situation.
- For 200 pages, keyword search plus an evidence check found the right page every time.
- **I set the trigger to move up before I ran anything. It never fired.**

## 7. Why markdown files (0:25)

- You asked for a knowledge graph. This is one. It is 166 markdown files, and the links are the graph.
- A person can open one, read it, and fix it.
- **The structure is never guessed. It comes from your own site menu.**

## 8. Results (0:40)

- 30 questions to tune on. First run 28. Then 29, because one of my fixes broke something. Then 30.
- A tuning score flatters. So I wrote ten fresh questions, committed them, and ran them once.
- **Nine of ten. And it never answered a question it should have sent to a person.**
- I know how to catch the miss. I have not, because changing it and quoting the same score would make the score meaningless.

## 9. Where this comes from (0:30)

- This was not a one-off. It is a small version of what I built at FieldPulse over the past year.
- Connectors: the data warehouse through the Metabase API. Slack history, backfilled, so tribal knowledge is searchable. Jira and Linear tickets. The wiki and help center.
- One knowledge layer. One agent harness. Then the teams.
- **I built the foundation once. Now every team builds on it.**

## 10. How I work, and what it produced (0:30)

- **A new team is a connector and a prompt, not a new project.**
- One Slack bot became 14 tools across eight departments since January.
- 2,200 questions answered in Slack. 200 support emails a week. 183 customers set up.
- How I work is the loop you just saw: ship small, the team breaks it, I fix what they hit.

Say one number per tool. Do not stack them.

## 11. Day one (0:15)

- Swap the sources. Pick one team. Ship that week. Measure with their questions.
- Next, the same foundation takes on document workflows.
- **That is what I would bring. Thank you.**

## If you are running long

Cut in this order:
1. Slide 7, down to its bold line.
2. The per-tool numbers on slide 10. Keep "14 tools, eight departments".
3. The Evals click at the end of the demo.

## Do not say

- Internal tool names. Say "knowledge layer" and "agent harness".
- Anything about how RealPage works internally.
- "Accuracy" as a single percentage. Say "nine of ten".
- That the queues or teams in the demo are real. They are stand-ins, and the screen says so.
