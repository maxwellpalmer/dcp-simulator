import { describe, it, expect } from "vitest";
import { validatePlan } from "./validate";
import type { Assignment, Grid } from "./types";
import grid70 from "../assets/grid_70.json";

const g = grid70 as unknown as Grid;

function assignmentFromPlan(plan: number[]): Assignment {
  const m = new Map<number, number>();
  plan.forEach((d, i) => m.set(g.blocks[i].id, d));
  return m;
}

describe("validatePlan", () => {
  it("accepts a pre-generated 7-district plan", () => {
    const a = assignmentFromPlan(g.randomPlans["7"][0]);
    const errs = validatePlan(g, a, { nDistricts: 7 });
    expect(errs).toEqual([]);
  });

  it("flags unassigned blocks", () => {
    const a = assignmentFromPlan(g.randomPlans["7"][0]);
    a.delete(g.blocks[0].id);
    const errs = validatePlan(g, a, { nDistricts: 7 });
    expect(errs.some((e) => e.code === "UNASSIGNED_BLOCKS")).toBe(true);
  });

  it("flags population imbalance", () => {
    const a = assignmentFromPlan(g.randomPlans["7"][0]);
    // Move one block from district 1 into district 2
    for (const b of g.blocks) {
      if (a.get(b.id) === 1) {
        a.set(b.id, 2);
        break;
      }
    }
    const errs = validatePlan(g, a, { nDistricts: 7 });
    expect(errs.some((e) => e.code === "POPULATION_IMBALANCE")).toBe(true);
  });

  it("flags non-contiguous districts", () => {
    // Swap two distant blocks between districts
    const a = assignmentFromPlan(g.randomPlans["7"][0]);
    const first = g.blocks[0].id;
    const last = g.blocks[g.blocks.length - 1].id;
    const d1 = a.get(first)!;
    const d2 = a.get(last)!;
    if (d1 !== d2) {
      a.set(first, d2);
      a.set(last, d1);
      const errs = validatePlan(g, a, { nDistricts: 7 });
      expect(errs.some((e) => e.code === "NOT_CONTIGUOUS")).toBe(true);
    }
  });
});
