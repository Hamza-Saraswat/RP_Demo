# Demo script

About 90 seconds. Four questions, in this order. All four were run while building this and behaved as described, but answers are written fresh each time, so wording will vary.

## Before you record

- [ ] `pnpm dev --port 3210` is running and `http://localhost:3210` loads.
- [ ] Ask one throwaway question first, then reload. The first question after a restart is slower.
- [ ] Browser at 100% zoom, window about 1440 wide, bookmarks bar hidden, other tabs closed.
- [ ] Team is set to **Support**.
- [ ] Notifications off. Do Not Disturb on.
- [ ] The deck is open on slide 7, ready to switch back to slide 8.
- [ ] Record a backup take of the demo alone. If a live call fails, cut to it.

## 1. Routing while typing (20 s)

**Type slowly, do not paste:**

> What does the AI Operations Agent check in a lease audit?

**Pause after "Agent".** The right side fills in before you send.

Say:
- "I have not sent anything yet. It already knows which product this is."
- "The product name was caught by plain code. The family came from Jev, with how sure it is."

## 2. An answer (25 s)

**Press Enter.** Wait about four seconds.

Point at, in order:
1. The small numbers after each sentence. "Every sentence cites its source."
2. On the right, scroll to **Sentence check**. "Each sentence was checked against the passage it cites."
3. If a line is struck through: "This one the source did not support, so it was removed before I saw it."
4. **Not in the sources.** "And it tells me what it could not find."

## 3. A handoff (20 s)

**Click the sample:**

> Our Oak Street property shows the wrong ledger balance after move-out. Can you fix it?

**Press Enter.** It comes back in under a second.

Say:
- "This needs their account records. Public pages cannot answer it, so it does not try."
- "It says who owns this, and passes along what it already worked out."
- "No writing model was called. Look at the cost."

## 4. Same core, different team (25 s)

**Click Sales** in the header. **Click the sample:**

> What results did Summit get with the AI Operations Agent?

**Press Enter.** Wait about five seconds.

Say:
- "Same engine. The Sales profile also searches published case studies, and asks for customer results."
- "A team is one small file. That is the harness idea."

## Optional, if you have 15 seconds

Click **Evals** in the header. "These are the numbers on my results slide. The page reads them from the run files."

## If something goes wrong

| What you see | What to do |
|---|---|
| An answerable question comes back as a handoff saying the writer failed | Say "it failed closed, which is the rule", then ask it again. |
| The right side stays empty while typing | Keep going. Press Enter. The full trace still shows. |
| Anything hangs past 15 seconds | Cut to the backup take. |

## Questions to leave out

- "Which customers have published results from automated lease audits?" This is the known miss on the results slide. It goes to a person. Only use it if you want to show the miss on purpose.
