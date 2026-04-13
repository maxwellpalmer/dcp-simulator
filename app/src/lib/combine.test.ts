import { describe, it, expect } from "vitest";
import {
  subDistrictLabel,
  subDistrictsAdjacent,
  adjacentSubDistricts,
  validatePairing,
  applyPairing,
  computeFinalStats,
  type Pairing,
} from "./combine";
import type { Assignment, Grid } from "./types";
import grid70 from "../assets/grid_70.json";
import { generateVoters } from "./voters";

const g = grid70 as unknown as Grid;

function asgFromPlan(plan: number[]): Assignment {
  const m = new Map<number, number>();
  plan.forEach((d, i) => m.set(g.blocks[i].id, d));
  return m;
}

describe("subDistrictLabel", () => {
  it("maps 1..26 to A..Z", () => {
    expect(subDistrictLabel(1)).toBe("A");
    expect(subDistrictLabel(14)).toBe("N");
    expect(subDistrictLabel(26)).toBe("Z");
  });
  it("continues past Z", () => {
    expect(subDistrictLabel(27)).toBe("AA");
  });
});

describe("combine on 14 sub-district plan", () => {
  const subs = asgFromPlan(g.randomPlans["14"][0]);

  it("finds adjacent sub-districts", () => {
    // Every sub-district should be adjacent to at least one other.
    for (let d = 1; d <= 14; d++) {
      const nbrs = adjacentSubDistricts(g, subs, d);
      expect(nbrs.size).toBeGreaterThan(0);
    }
  });

  it("subDistrictsAdjacent matches adjacentSubDistricts", () => {
    const nbrs = adjacentSubDistricts(g, subs, 1);
    for (const n of nbrs) {
      expect(subDistrictsAdjacent(g, subs, 1, n)).toBe(true);
    }
    // At least one non-adjacent sub-district
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const d of all) {
      if (d !== 1 && !nbrs.has(d)) {
        expect(subDistrictsAdjacent(g, subs, 1, d)).toBe(false);
        return;
      }
    }
  });

  it("validatePairing flags missing sub-districts", () => {
    const bad: Pairing = [[1, 2]];
    const errs = validatePairing(g, subs, bad, { nSubDistricts: 14 });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("validatePairing flags non-adjacent pairs", () => {
    // Find a non-adjacent pair
    const nbrs1 = adjacentSubDistricts(g, subs, 1);
    let nonAdj: number | null = null;
    for (let d = 2; d <= 14; d++) if (!nbrs1.has(d)) { nonAdj = d; break; }
    if (nonAdj === null) return;
    // Build a "pairing" that mispairs 1 with a non-neighbor
    const pairing: Pairing = [[1, nonAdj]];
    const others = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].filter(
      (d) => d !== nonAdj,
    );
    for (let i = 0; i < others.length; i += 2) {
      pairing.push([others[i], others[i + 1]]);
    }
    const errs = validatePairing(g, subs, pairing, { nSubDistricts: 14 });
    expect(errs.some((e) => e.code === "NOT_CONTIGUOUS")).toBe(true);
  });

  it("applyPairing maps blocks to final district", () => {
    const pairing: Pairing = [
      [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14],
    ];
    const finalAssign = applyPairing(subs, pairing);
    // Block that was in sub-district 1 should be in final district 1
    for (const [blk, sub] of subs) {
      if (sub === 1) expect(finalAssign.get(blk)).toBe(1);
      if (sub === 4) expect(finalAssign.get(blk)).toBe(2);
    }
  });

  it("computeFinalStats returns N entries with correct populations", () => {
    const pairing: Pairing = [
      [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14],
    ];
    const voters = generateVoters(g, { mode: "random", seed: 1 });
    const stats = computeFinalStats(g, subs, pairing, voters);
    expect(stats.length).toBe(7);
    for (const s of stats) expect(s.population).toBe(10);
  });
});
