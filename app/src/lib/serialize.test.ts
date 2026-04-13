import { describe, it, expect } from "vitest";
import { assignmentToFlat, assignmentFromFlat } from "./serialize";
import type { Grid } from "./types";
import grid70 from "../assets/grid_70.json";

const g = grid70 as unknown as Grid;

describe("assignment serialization", () => {
  it("round-trips a plan", () => {
    const plan = g.randomPlans["7"][0];
    const asg = assignmentFromFlat(g, plan);
    const flat = assignmentToFlat(g, asg);
    expect(flat).toEqual(plan);
  });

  it("empty assignment → all zeros", () => {
    const flat = assignmentToFlat(g, new Map());
    expect(flat.every((x) => x === 0)).toBe(true);
  });

  it("zero entries in flat are treated as unassigned", () => {
    const flat = new Array(g.blocks.length).fill(0);
    flat[0] = 1;
    const asg = assignmentFromFlat(g, flat);
    expect(asg.size).toBe(1);
    expect(asg.get(g.blocks[0].id)).toBe(1);
  });
});
