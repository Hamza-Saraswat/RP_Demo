# Talk track

Target 6 minutes. Hard cap 7. Beats, not a script: say them your way.
Each slide has one **bold line to land**. If you only say that line, the slide still works.

| Part | Slides | Time |
|---|---|---|
| How I work, and what I built | 1 to 4 | 1:45 |
| RealPage, and the same approach | 5 to 6 | 0:50 |
| Demo | 7, then the app | 1:30 |
| Why I made each choice | 8 to 10 | 1:15 |
| Results and day one | 11 to 12 | 0:50 |

## 1. Title (0:15)

- You asked for something built with AI that helps RealPage scale.
- I built this in one day, from your public website.
- **The build is the small part. I want to show you how I work and what I would bring.**

## 2. How I work (0:25)

- Ship a small first version fast. Put it in front of the team that will use it.
- Let them break it. Fix what they hit.
- **There is no point building for problems nobody has.**
- You will see this same loop again in the results.

## 3. The foundation (0:35)

- At FieldPulse I spent the past year building a foundation, bottom to top.
- Connectors: the data warehouse through the Metabase API. Slack history, backfilled, so years of tribal knowledge is searchable. Jira and Linear tickets. The wiki and help center.
- One knowledge layer on top: one search source, every answer cited.
- One agent harness on top of that: one core, and each team gets its own tools, prompt, and evals.
- **I built the foundation once. Now every team builds on it.**

## 4. What it made possible (0:30)

- **A new team is a connector and a prompt, not a new project.**
- One Slack bot became 14 tools across eight departments since January.
- The Slack assistant: 2,200 questions, 94% without pulling in product or engineering.
- The email agent: 200 support emails a week. The onboarding app: 183 customers, median nine minutes.

Say one number per tool. Do not stack them.

## 5. RealPage from the outside (0:25)

- I am on the outside, so I used only what is public.
- Over 50 companies acquired. 64 products and agents on your own site menu.
- Public support splits by who you are, not by product.
- **So every question has to find its owner.**
- I do not know how you handle that inside. It is the same shape of problem I have been solving.

## 6. The same approach (0:25)

- Same four layers, in miniature.
- 221 public pages in. A company map of 166 files. One agent core. Two teams.
- **On day one inside RealPage, only the bottom layer changes.**

## 7. Demo (1:30)

Follow `demo-script.md`. Four things, about 20 seconds each.

- **Watch the right side. Every decision shows up as it is made.**

## 8. Jev decides, Claude writes, code owns the rules (0:30)

- Three jobs, three owners.
- Code owns the rules. If you type OneSite, no model is needed to notice.
- Jev makes each judgment and tells me how sure it is, in a quarter of a second.
- Claude only writes, and only from passages that passed.
- **It fails closed. A sentence with no source gets deleted.**

## 9. Retrieval (0:25)

- Your job description mentions vector databases. I use them in production. Here I did not, on purpose.
- There is a ladder, and every rung fits a real situation.
- For 200 pages, keyword search plus an evidence check found the right page every time.
- **I set the trigger to move up before I ran anything. It never fired.**

## 10. Knowledge store (0:20)

- You asked for a knowledge graph. This is one. It is 166 markdown files, and the links are the graph.
- A person can open one, read it, and fix it.
- **The structure is never guessed. It comes from your own site menu.**

## 11. Results (0:35)

- 30 questions to tune on. First run 28. Then 29, because one of my fixes broke something. Then 30.
- That is the loop from slide 2.
- A tuning score flatters. So I wrote ten fresh questions, committed them, and ran them once.
- **Nine of ten. And it never answered a question it should have sent to a person.**
- I know how to catch the miss. I have not, because changing it and quoting the same score would make the score meaningless.

## 12. Day one (0:15)

- Swap the sources. Pick one team. Ship that week. Measure with their questions.
- Next, the same foundation takes on document workflows.
- **That is what I would bring. Thank you.**

## If you are running long

Cut in this order:
1. Slide 10, down to its bold line.
2. The per-tool numbers on slide 4. Keep "14 tools, eight departments".
3. The fourth demo item (team switch).

## Do not say

- Internal tool names. Say "knowledge layer" and "agent harness".
- Anything about how RealPage works internally.
- "Accuracy" as a single percentage. Say "nine of ten".
- That the queues or teams in the demo are real. They are stand-ins, and the screen says so.
