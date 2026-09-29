import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadBundle, parseLinks, namedIn, mapPath, offeringsIn } from "../src/lib/okf";
import { loadTeams } from "../src/lib/teams";
import { buildIndex, search, type Passage } from "../src/lib/search";

const b = loadBundle(path.resolve(__dirname, "..", "knowledge"));

describe("OKF bundle", () => {
  it("reads links and the phrase that explains each one", () => {
    const links = parseLinks("- Part of the [Spend](/families/spend.md) family.\n- Came from [Acme](/acquisitions/acme.md).");
    expect(links).toEqual([
      { to: "families/spend", text: "Spend", relation: "part of" },
      { to: "acquisitions/acme", text: "Acme", relation: "came from" },
    ]);
  });

  it("has no link that points at a missing file", () => {
    const broken = [...b.entities.values()].flatMap((e) => e.links.filter((l) => !b.entities.has(l.to)).map((l) => `${e.id} -> ${l.to}`));
    expect(broken).toEqual([]);
  });

  it("places every product and agent in a family that exists", () => {
    const orphans = [...b.byType("Product"), ...b.byType("Agent")].filter((e) => !b.entities.has(`families/${e.family}`));
    expect(orphans.map((e) => e.id)).toEqual([]);
  });

  it("marks every queue as illustrative", () => {
    expect(b.byType("Queue").every((q) => q.illustrative)).toBe(true);
  });

  it("finds a product named in a sentence, by name or by earlier name", () => {
    expect(namedIn("does OneSite handle move-outs?", b).map((e) => e.title)).toContain("OneSite");
    expect(namedIn("we still call it compliance depot", b).map((e) => e.title)).toContain("Vendor Credentialing");
    expect(namedIn("is it working?", b)).toEqual([]);
  });

  it("draws the path from where a product came from to who owns it", () => {
    const notes = mapPath({ productId: "products/vendor-credentialing" }, b).map((n) => n.note);
    expect(notes[0]).toBe("came from");
    expect(notes.at(-1)).toBe("owner");
    expect(notes).toContain("family");
  });

  it("lists the products of a family", () => {
    expect(offeringsIn("spend-and-vendor-management", b).length).toBeGreaterThan(3);
  });
});

describe("teams", () => {
  const teams = loadTeams(path.resolve(__dirname, "..", "teams"));
  it("loads every team file and checks its shape", () => {
    expect([...teams.keys()].sort()).toEqual(["sales", "support"]);
  });
  it("gives Sales the case studies that Support does not search", () => {
    expect(teams.get("sales")!.sources.kinds).toContain("case-study");
    expect(teams.get("support")!.sources.kinds).not.toContain("case-study");
  });
});

describe("keyword search", () => {
  const passage = (id: string, kind: string, url: string, heading: string, text: string): Passage => ({
    id, kind, url, heading, text, pageTitle: heading, segment: "x",
  });
  const idx = buildIndex([
    passage("a", "page", "https://x/vendor", "Vendor insurance", "We validate certificates of insurance for vendors."),
    passage("b", "case-study", "https://x/story", "Customer story", "A customer cut vendor insurance review time."),
    passage("c", "page", "https://x/leasing", "Leasing", "Self-guided tours for prospects."),
  ]);

  it("finds passages by their words", () => {
    expect(search("vendor insurance certificates", {}, idx)[0].id).toBe("a");
  });
  it("searches only the page kinds a team allows", () => {
    expect(search("vendor insurance", { kinds: ["page"] }, idx).map((h) => h.id)).toEqual(["a"]);
  });
  it("lifts the chosen product's own page", () => {
    const score = (hits: ReturnType<typeof search>) => hits.find((h) => h.id === "b")!.score;
    const plain = score(search("vendor insurance", {}, idx));
    const lifted = score(search("vendor insurance", { boostUrls: ["https://x/story"] }, idx));
    expect(lifted).toBeCloseTo(plain * 2);
  });
  it("returns nothing for words the corpus does not contain", () => {
    expect(search("zebra", {}, idx)).toEqual([]);
  });
});
