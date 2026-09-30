import { describe, expect, it } from "vitest";
import { routeGate, evidenceGate, claimGate, type Thresholds } from "../src/lib/gate";
import v3 from "../src/lib/questions/v3.json";

const t = v3.thresholds as Thresholds;
const sure = { choice: "spend-and-vendor-management", confidence: 0.95, probabilities: { "spend-and-vendor-management": 0.95, "property-management": 0.03, none: 0.02 } };
const quiet = { resident_or_vendor: 0.1, needs_account_data: 0.1, billing_or_contract: 0.1, asks_for_person: 0.1, reports_broken: 0.1, wants_how_to: 0.9 };

describe("routeGate", () => {
  it("lets a clear product question through to search", () => {
    const d = routeGate({ family: sure, checks: quiet }, t);
    expect(d.outcome).toBe("search");
    expect(d.queue).toBe("queues/spend-and-vendor-management");
  });

  it("sends residents and vendors to their own desk before anything else", () => {
    const d = routeGate({ family: sure, checks: { ...quiet, resident_or_vendor: 0.9, asks_for_person: 0.9 } }, t);
    expect(d.outcome).toBe("handoff");
    expect(d.queue).toBe("queues/resident-and-vendor-desk");
  });

  it("hands off when the answer needs account records", () => {
    const d = routeGate({ family: sure, checks: { ...quiet, needs_account_data: 0.9 } }, t);
    expect(d.outcome).toBe("handoff");
    expect(d.queue).toBe("queues/spend-and-vendor-management");
  });

  it("lists every reason for a handoff", () => {
    const d = routeGate({ family: sure, checks: { ...quiet, asks_for_person: 0.8, billing_or_contract: 0.8 } }, t);
    expect(d.reasons).toHaveLength(2);
  });

  const vague = { ...quiet, wants_how_to: 0.2 };

  it("escalates when no family fits and it is not a how-it-works question", () => {
    const d = routeGate({ family: { choice: "none", confidence: 0.9, probabilities: { none: 0.9 } }, checks: vague }, t);
    expect(d.outcome).toBe("escalate");
    expect(d.queue).toBe("queues/human-triage");
  });

  it("escalates when the family is a coin flip", () => {
    const d = routeGate(
      { family: { choice: "a", confidence: 0.7, probabilities: { a: 0.5, b: 0.45, none: 0.05 } }, checks: vague },
      t,
    );
    expect(d.outcome).toBe("escalate");
  });

  it("still searches a how-it-works question when the family is unclear", () => {
    const d = routeGate({ family: { choice: "none", confidence: 0.5, probabilities: { none: 0.5, a: 0.3 } }, checks: quiet }, t);
    expect(d.outcome).toBe("search");
    expect(d.flags).toContain("family unclear");
  });

  it("never searches on an unclear family when the writer wants a person", () => {
    const d = routeGate(
      { family: { choice: "none", confidence: 0.9, probabilities: { none: 0.9 } }, checks: { ...quiet, asks_for_person: 0.9 } },
      t,
    );
    expect(d.outcome).toBe("escalate");
  });

  it("flags a broken-thing report without blocking the answer", () => {
    const d = routeGate({ family: sure, checks: { ...quiet, reports_broken: 0.9 } }, t);
    expect(d.outcome).toBe("search");
    expect(d.flags).toContain("reports something broken");
  });
});

describe("evidenceGate", () => {
  it("hands off and logs a gap when nothing holds evidence", () => {
    const d = evidenceGate(0, "queues/x");
    expect(d.outcome).toBe("handoff");
    expect(d.flags).toContain("docs gap");
  });
  it("escalates instead when the family was never clear", () => {
    const d = evidenceGate(0, "queues/human-triage", true);
    expect(d.outcome).toBe("escalate");
    expect(d.flags).not.toContain("docs gap");
  });
  it("answers when at least one passage holds evidence", () => {
    expect(evidenceGate(1, "queues/x").outcome).toBe("answer");
  });
});

describe("claimGate", () => {
  const supports = { verdict: "supports" as const, confidence: 0.95 };
  const silent = { verdict: "says_nothing" as const, confidence: 0.95 };
  const against = { verdict: "contradicts" as const, confidence: 0.95 };

  it("keeps supported sentences and drops the rest", () => {
    const d = claimGate([[supports], [silent], [supports]], t);
    expect(d.keep).toEqual([true, false, true]);
    expect(d.withhold).toBe(false);
  });

  it("drops a sentence that cites nothing", () => {
    expect(claimGate([[supports], []], t).keep).toEqual([true, false]);
  });

  it("keeps a sentence when any one of its sources supports it", () => {
    expect(claimGate([[silent, supports]], t).keep).toEqual([true]);
  });

  it("withholds the whole answer on a contradiction", () => {
    const d = claimGate([[supports], [against]], t);
    expect(d.withhold).toBe(true);
  });

  it("withholds when most sentences fail", () => {
    expect(claimGate([[supports], [silent], [silent]], t).withhold).toBe(true);
  });

  it("does not count a low-confidence 'supports' as support", () => {
    expect(claimGate([[{ verdict: "supports", confidence: 0.3 }]], t).withhold).toBe(true);
  });

  it("withholds when the writer produced nothing", () => {
    expect(claimGate([], t).withhold).toBe(true);
  });
});
