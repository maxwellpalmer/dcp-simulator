import { describe, it, expect } from "vitest";
import { buildAdjacencyMap, isContiguous } from "./grid";
import type { Grid } from "./types";
import grid70 from "../assets/grid_70.json";

const g = grid70 as unknown as Grid;

describe("grid adjacency", () => {
  it("builds symmetric adjacency map", () => {
    const adj = buildAdjacencyMap(g);
    for (const [a, b] of g.adjacency) {
      expect(adj.get(a)!.has(b)).toBe(true);
      expect(adj.get(b)!.has(a)).toBe(true);
    }
  });

  it("graph is a single connected component", () => {
    const adj = buildAdjacencyMap(g);
    const all = g.blocks.map((b) => b.id);
    expect(isContiguous(all, adj)).toBe(true);
  });
});

describe("isContiguous", () => {
  it("single block is contiguous", () => {
    const adj = buildAdjacencyMap(g);
    expect(isContiguous([g.blocks[0].id], adj)).toBe(true);
  });

  it("disconnected blocks are not contiguous", () => {
    const adj = buildAdjacencyMap(g);
    // Pick two blocks guaranteed to be far apart
    const a = g.blocks[0].id;
    const far = g.blocks[g.blocks.length - 1].id;
    expect(isContiguous([a, far], adj)).toBe(false);
  });

  it("pre-generated random plans have contiguous districts", () => {
    const adj = buildAdjacencyMap(g);
    for (const [, plans] of Object.entries(g.randomPlans)) {
      const plan = plans[0];
      const byDist = new Map<number, number[]>();
      plan.forEach((d, i) => {
        const id = g.blocks[i].id;
        (byDist.get(d) ?? byDist.set(d, []).get(d)!).push(id);
      });
      for (const [, blocks] of byDist) {
        expect(isContiguous(blocks, adj)).toBe(true);
      }
    }
  });
});
