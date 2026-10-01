# Demo script

Six questions, three per team. Each is also a sample chip under the chat box, in this order, so you can click instead of paste.

Answers are written fresh each time, so wording will vary. The outcome, the sources, and the numbers below are what came back when these were last run.

## Support team

### 1. An answer

```
What does the AI Operations Agent check in a lease audit?
```

| | |
|---|---|
| Outcome | **Answer**, about 4 seconds |
| What it says | It compares leases against ledgers. It flags discrepancies in rent, fees, concessions, deposits, and charge schedules. It surfaces renewal and move-in charge issues. |
| Source | The AI Operations Agent product page |
| Worth pointing at | "Not in the sources" under the answer. Usually one sentence is struck out in the Sentence check on the right: the source did not support it, so it was removed. |

Type this one instead of pasting, and pause after "Agent". The right side fills in before you send.

### 2. A handoff

```
Our Oak Street property shows the wrong ledger balance after move-out. Can you fix it?
```

| | |
|---|---|
| Outcome | **Handed off** to the Financial & Accounting queue, under half a second |
| Why | "Answering needs their account records, which public pages cannot supply." |
| Worth pointing at | No writing model was called. Two decision calls. The card shows what was passed along. |

### 3. A different desk

```
My rent payment was charged twice this month. Who do I contact?
```

| | |
|---|---|
| Outcome | **Handed off** to the Resident and vendor desk, about half a second |
| Why | The writer is a resident, not property management staff. |
| Worth pointing at | On the right, "Writer is a resident or vendor" is lit. It still worked out the product (Payments). |

## Sales team

Click **Sales** in the header first.

### 4. Customer results

```
What results did Summit get with the AI Operations Agent?
```

| | |
|---|---|
| Outcome | **Answer**, about 4 to 5 seconds |
| What it says | 789 lease audits in three weeks. 131 staff hours saved. Up to $110,000 in potential revenue across seven properties. Audit time from days to about 1.5 hours per property. |
| Sources | The Summit case study, and the product page |
| Worth pointing at | "Not in the sources" says the $110,000 is potential, not recovered. Support does not search case studies; Sales does. |

### 5. A sales prep question

```
What can I say about how the AI Leasing Agent performs?
```

| | |
|---|---|
| Outcome | **Answer**, about 9 seconds. The slowest of the six |
| What it says | Carter-Haston: 211% more tour bookings, 165% more completed contact records, 11 hours saved per leasing agent per month. The Lynd Company: zero missed calls, 246 hours saved. |
| Sources | The Carter-Haston case study, and the product page |
| Worth pointing at | It warns that the sources give no time periods or baselines. One or two sentences are usually removed by the Sentence check. |

### 6. A comparison

```
What is the difference between Lumina Ascent and Lumina Connect?
```

| | |
|---|---|
| Outcome | **Answer**, about 4 seconds |
| What it says | Ascent is operational intelligence: it prioritizes the signals that move NOI and guides the next action. Connect is governed data access: it delivers data into the customer's own cloud and opens it to outside AI models through MCP. |
| Sources | The Lumina AI Suite press release, and two platform pages |
| Worth pointing at | No product was named outright in a single family, so Jev placed it. It says plainly that there are no customer numbers to quote. |

## A 90-second path through the demo

1. Type question 1 slowly. Point at the right side before sending. Send. (35 s)
2. Click question 2. (15 s)
3. Switch to Sales. Click question 4. (30 s)
4. Optional: click **Company map** in the header. "This is the map behind the routing." (10 s)

Use 3, 5, and 6 if you have more time or want a second take.

## Before you record

- [ ] `pnpm dev --port 3210` is running and `http://localhost:3210` loads.
- [ ] Ask one throwaway question first, then reload. The first question after a restart is slower.
- [ ] Browser at 100% zoom, window about 1440 wide, bookmarks bar hidden, other tabs closed.
- [ ] Team is set to **Support**.
- [ ] Notifications off.
- [ ] The deck is open on slide 3. After the demo you go to slide 4.
- [ ] Record a backup take of the demo alone. If a live call fails, cut to it.

## If something goes wrong

| What you see | What to do |
|---|---|
| A question that should be answered comes back as a handoff | Say "it failed closed, which is the rule", and ask it again. |
| The right side stays empty while typing | Keep going and send. The full trace still shows. |
| Anything hangs past 15 seconds | Cut to the backup take. |

## Leave this one out

"Which customers have published results from automated lease audits?" is a known miss. It goes to a person when it could have been answered. Name a product in the question and it works.
