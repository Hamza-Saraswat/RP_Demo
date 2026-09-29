// The rules. Jev supplies probabilities; this file decides what happens.
// Nothing here calls a model, so every outcome can be explained and tested.

export type Thresholds = {
  familySure: number;
  familyCloseGap: number;
  productSure: number;
  checkYes: number;
  evidenceKeep: number;
  evidenceMax: number;
  claimSupported: number;
  maxRemovedShare: number;
};

export type Outcome = "answer" | "handoff" | "escalate";

export type RouteInput = {
  family: { choice: string; confidence: number; probabilities: Record<string, number> };
  checks: Record<string, number>;
};

export type RouteDecision = {
  outcome: Outcome | "search"; // "search" means nothing blocks an answer yet
  queue: string | null;
  reasons: string[];
  flags: string[];
};

export const NONE = "none";

function topTwoGap(probabilities: Record<string, number>): number {
  const sorted = Object.entries(probabilities)
    .filter(([key]) => key !== NONE)
    .map(([, p]) => p)
    .sort((a, b) => b - a);
  return sorted.length > 1 ? sorted[0] - sorted[1] : 1;
}

/** First gate: runs on the routing decisions, before any search. */
export function routeGate(input: RouteInput, t: Thresholds): RouteDecision {
  const { family, checks } = input;
  const yes = (id: string) => (checks[id] ?? 0) >= t.checkYes;

  if (yes("resident_or_vendor")) {
    return {
      outcome: "handoff",
      queue: "queues/resident-and-vendor-desk",
      reasons: ["The writer is a resident or a vendor, who are served by a separate desk."],
      flags: [],
    };
  }

  if (family.choice === NONE) {
    return {
      outcome: "escalate",
      queue: "queues/human-triage",
      reasons: ["The question does not match any product family."],
      flags: [],
    };
  }
  if (family.confidence < t.familySure) {
    return {
      outcome: "escalate",
      queue: "queues/human-triage",
      reasons: ["Not sure enough which product family this is about."],
      flags: [],
    };
  }
  if (topTwoGap(family.probabilities) <= t.familyCloseGap) {
    return {
      outcome: "escalate",
      queue: "queues/human-triage",
      reasons: ["Two product families were too close to call."],
      flags: [],
    };
  }

  const queue = `queues/${family.choice}`;
  const reasons: string[] = [];
  if (yes("asks_for_person")) reasons.push("The writer asked for a person.");
  if (yes("needs_account_data")) reasons.push("Answering needs their account records, which public pages cannot supply.");
  if (yes("billing_or_contract")) reasons.push("Billing and contract questions go to the owning team.");
  if (reasons.length) return { outcome: "handoff", queue, reasons, flags: [] };

  return { outcome: "search", queue, reasons: [], flags: yes("reports_broken") ? ["reports something broken"] : [] };
}

/** Second gate: runs after the evidence check. */
export function evidenceGate(kept: number, queue: string | null): RouteDecision {
  if (kept === 0) {
    return {
      outcome: "handoff",
      queue,
      reasons: ["No source passage holds evidence for this question. Logged as a documentation gap."],
      flags: ["docs gap"],
    };
  }
  return { outcome: "answer", queue, reasons: [], flags: [] };
}

export type ClaimVerdict = { verdict: "supports" | "contradicts" | "says_nothing"; confidence: number };

export type ClaimDecision = { keep: boolean[]; withhold: boolean; reason: string | null };

/**
 * Third gate: runs on the written answer. Each claim was checked against the passages it cites.
 * A claim stays only if at least one cited passage supports it.
 * A contradiction, or too many removed claims, withholds the whole answer.
 */
export function claimGate(perClaim: ClaimVerdict[][], t: Thresholds): ClaimDecision {
  if (!perClaim.length) return { keep: [], withhold: true, reason: "The writer produced no claims." };

  const contradicted = perClaim.some((verdicts) =>
    verdicts.some((v) => v.verdict === "contradicts" && v.confidence >= t.claimSupported),
  );
  if (contradicted) {
    return {
      keep: perClaim.map(() => false),
      withhold: true,
      reason: "A sentence contradicted the source it cited.",
    };
  }

  const keep = perClaim.map((verdicts) =>
    verdicts.some((v) => v.verdict === "supports" && v.confidence >= t.claimSupported),
  );
  const removed = keep.filter((k) => !k).length;
  if (removed / keep.length > t.maxRemovedShare) {
    return { keep, withhold: true, reason: "Too many sentences were not supported by their sources." };
  }
  return { keep, withhold: false, reason: null };
}
