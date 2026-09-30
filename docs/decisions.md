# Decisions

Each one records what was chosen, what else was on the table, and when the other option is the right one.

## 1. Retrieval: keyword search plus an evidence check

**Chosen:** plain keyword search (BM25) pulls 12 passages. Jev then answers one question per passage: does this hold evidence for the question? Up to five survive.

**Why:** the corpus is 221 pages and 1,323 passages. It builds in memory in under a second, costs nothing to query, and needs no chunking strategy or second provider. The eval found the right page for every answerable question where a search ran.

| Option | What it adds | Use it when |
|---|---|---|
| Keyword search | Nothing to run. Exact terms, product names, IDs. | Small or medium corpus, people use the same words as the docs. **Chosen here.** |
| Query rewriting | A model turns a messy question into search terms. | People use different words than the docs, or internal jargon. |
| Hybrid: keyword, then embeddings rerank | Meaning, not just words. Brings back chunking decisions. | Questions are conceptual and the corpus is stable. |
| Embed on the fly | Embeds candidates at query time. Always fresh. | Content changes daily. |
| Hot and cold tiers | Pre-embed the popular 20%, embed the rest on demand. | Large corpus with clear traffic patterns. |
| Full pre-embedding in a vector database | Fastest at scale. Re-embedding on a model change is expensive. | Over 10,000 queries a day on a stable corpus. |

**What would change this:** the right page missing from search results for more than 15% of answerable questions. The first step up is query rewriting, not embeddings.

## 2. Knowledge store: markdown files

**Chosen:** one markdown file per entity, in the Open Knowledge Format. A small header block, plain links between files, and a sentence of prose around each link saying what the relationship is. The map on screen is drawn from those links.

**Why:** 166 entities. Files live in git, so every change has an author and a diff. A person can read and correct one without a tool. Anything a script generates sits above a marker line; hand-written notes below it survive a rebuild.

| Option | Use it when |
|---|---|
| Markdown files (OKF) | Hundreds to a few thousand entities, and people need to read and correct them. **Chosen here.** |
| Generated graph (graphify) | You have a pile of mixed material and want to discover structure you do not know yet. Good for exploring, noisy for routing. |
| Graph database | You need multi-hop queries at scale, such as "every customer affected by this change", across millions of relationships. |
| Managed knowledge platform | Many live sources with permissions, such as chat history, tickets, and a wiki, that must stay in sync. This is what runs under my production tools. |

**Structure is never guessed.** Families, platforms, markets, and products come from the site's own menu, read by code. Where the menu does not place a product, Jev chooses the family and its confidence is written on the file. Two products came in under 60% and are marked for a person to check.

## 3. Who decides: Jev decides, Claude writes, code owns the rules

| Job | Done by | Why |
|---|---|---|
| Notice a product name in a sentence | Code | An exact match needs no model. |
| Which family, which product, what kind of question | Jev | Returns a probability for every option, in about 250 ms. |
| Does this passage hold evidence | Jev | One small request per passage, all at once. |
| What happens next | Code | Every outcome can be explained and unit tested. |
| Write the answer | Claude | Only from passages that passed. |
| Does each sentence match its source | Jev | A sentence stays only if a cited passage supports it. |

Jev cannot write, count, or explain itself, and it reads instructions literally. Change 5 in the iteration log is that literal reading in action.

## 4. Fail closed

- A sentence with no citation is deleted.
- A sentence its source does not support is deleted, and the answer says so.
- A contradiction, or more than half the sentences removed, withholds the whole answer.
- A check that errors counts as "no".
- A question that needs account records, a price, or a person is never answered from public pages.

## 5. Handoff summaries are built by code

The plan had Claude writing the handoff summary. Code builds it instead, from the decisions already made: what was asked, the family and product, why it was handed off, and which sources were tried. It costs nothing, takes no time, and cannot say anything the trace does not show.

## 6. A team is a file

`teams/support.json` and `teams/sales.json` run on the same core. A team file sets which kinds of pages it searches, how much weight each gets, and a short note on how answers should read. It cannot loosen the base rules. Adding a team is adding a file.

## 7. What is illustrative

RealPage's internal team structure is not public. Queues and team profiles are stand-ins and are labeled that way in the files and on screen. Sample questions are synthetic.
