import { describe, it, expect } from "vitest";
import { generateVoters } from "./voters";
import type { Grid } from "./types";
import grid70 from "../assets/grid_70.json";

const g = grid70 as unknown as Grid;

function countA(voters: Map<number, "A" | "B">) {
  let n = 0;
  for (const v of voters.values()) if (v === "A") n++;
  return n;
}

describe("generateVoters", () => {
  it("random: 40% Party A", () => {
    const v = generateVoters(g, { mode: "random", seed: 1 });
    expect(countA(v)).toBe(Math.round(g.blocks.length * 0.4));
  });

  it("majorityClusteredA: 60% Party A", () => {
    const v = generateVoters(g, { mode: "majorityClusteredA", seed: 1 });
    expect(countA(v)).toBe(Math.round(g.blocks.length * 0.6));
  });

  it("minorityClusteredB: 60% Party A (B is minority, clustered)", () => {
    const v = generateVoters(g, { mode: "minorityClusteredB", seed: 1 });
    expect(countA(v)).toBe(Math.round(g.blocks.length * 0.6));
  });

  it("same seed → same assignment", () => {
    const v1 = generateVoters(g, { mode: "minorityClusteredA", seed: 42 });
    const v2 = generateVoters(g, { mode: "minorityClusteredA", seed: 42 });
    for (const b of g.blocks) expect(v1.get(b.id)).toBe(v2.get(b.id));
  });

  it("cluster mode shows spatial autocorrelation vs random", () => {
    // Crude check: nearest-neighbor party agreement rate.
    function agreement(voters: Map<number, "A" | "B">): number {
      let agree = 0, total = 0;
      for (const [a, b] of g.adjacency) {
        if (voters.get(a) === voters.get(b)) agree++;
        total++;
      }
      return agree / total;
    }
    const rand = agreement(generateVoters(g, { mode: "random", seed: 7 }));
    const clust = agreement(generateVoters(g, { mode: "minorityClusteredA", seed: 7 }));
    expect(clust).toBeGreaterThan(rand);
  });
});
