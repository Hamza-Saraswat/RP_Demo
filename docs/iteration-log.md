# Iteration log

Every change made after the first eval run, what prompted it, and what it did.
Numbers come from the files in `evals/results/`.

| Run | Questions | Did the right thing | File |
|---|---|---|---|
| v1, untuned | 30 tuning | 28 of 30 | `golden-v1.json` |
| v2 | 30 tuning | 29 of 30 | `golden-v2.json` |
| v3, first run | 30 tuning | 28 of 30 | overwritten by the next run |
| v3, with writer retry | 30 tuning | 30 of 30 | `golden-v3.json` |
| v3 | 10 held-out, run once | 9 of 10 | `heldout-v3.json` |

The held-out number is the one to quote. The tuning number is what the system was adjusted against, so it flatters.

## Round 1: v1 to v2

Two misses, plus one seen in hand testing.

**1. A good answer was thrown away by my own schema.**
- Question: "Is AI Revenue Management legally compliant?"
- What happened: the writer returned four cited sentences and a long "not covered" note. The note was over a 400-character limit, so validation rejected the whole reply and the answer was withheld.
- Cause: code, not the model.
- Change: long notes are trimmed, never rejected. The writer is also told to keep the note to one or two sentences.

**2. The word "resident" was read as "the writer is a resident".**
- Question: "Who pays for the points in the resident loyalty rewards program?"
- What happened: the resident-or-vendor check came back at 62%, just over the 60% cutoff, and the question went to the resident desk.
- Change: rewrote the check. It now asks whether the writer speaks about their own situation, with examples of staff questions that mention residents.

**3. Sentences with no citation.**
- What happened: in three answers the writer produced a sentence with no source number. The rule deleted each one, correctly, but the deleted sentence was often the direct answer.
- Change: the writer is told that an uncited sentence is deleted, and to put the direct answer first.
- Effect: sentences removed fell from 8 of 65 to 1 of 68.

**4. Seen in hand testing: a question that spans families went straight to a person.**
- Question: "Which customers have published results from automated lease audits?"
- Change: when the family is unclear but the question asks how something works, search every family and let the evidence check decide. If nothing holds evidence, escalate.
- This question was added to the held-out set.

## Round 2: v2 to v3

**5. My fix for item 2 caused a new miss.**
- Question: "I need to reset my OneSite password."
- What happened: "speaks about their own situation" matched a staff member talking about their own password. It went to the resident desk.
- Change: the check now asks whether the writer identifies as a renter, applicant, or vendor. "Using 'my' or 'I' is not enough" is written into the criteria, with this question as an example.

**6. Two answers were lost to failed writer calls.**
- What happened: on the first v3 run, two questions that had passed twice came back as handoffs. The writer call had failed both times under load. The rule did its job and showed nothing, but a working answer was lost.
- Change: one retry on the writer. The rule is unchanged: if the writer fails twice, nothing is shown.

## Held-out run

Ten questions, written after tuning stopped, committed before their first run, and run once.

**Result: 9 of 10. No question that should have gone to a person was answered.**

**The miss:** "Which customers have published results from automated lease audits?" It was escalated to a person. Fix 4 did not cover it: the question asks *which customers*, so the how-it-works check stayed under its cutoff and no search ran. The safe outcome happened, but a colleague would have answered it.

**What I would do next:** add a check for "asks for examples or customers" and treat it like a how-it-works question. I have not made that change, because changing the system after seeing a held-out miss and then quoting the same held-out number would make the number meaningless. It needs a fresh held-out set.

## Retrieval: was keyword search enough?

The rule set before the first run: if the right page is missing from the search results for more than 15% of answerable questions, add query rewriting.

- Tuning set: the right page was in the results for 18 of 18.
- Held-out set: 5 of 5 where a search ran. The sixth never reached search (the miss above).

Query rewriting was not added. Embeddings were not added.

## What these numbers do not show

- 40 questions is a small set. One question is 2.5 points.
- I wrote the questions and the expectations. A set written by the people who field these questions would be harder.
- Most tuning questions name a product outright, which code catches without a model. Product accuracy would be lower on questions that never name one.
- "Said it right" checks that the answer contains the expected fact. It does not grade tone or completeness.
- Runs vary. The same question set scored 28 and then 30 on two consecutive runs, before and after the writer retry.
