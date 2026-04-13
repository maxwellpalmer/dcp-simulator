import { describe, it, expect } from "vitest";
import { computeScoreboard } from "./scoreboard";
import type { Grid } from "./types";
import grid70 from "../assets/grid_70.json";
import type { RoundState, Student } from "../../shared/session";

const g = grid70 as unknown as Grid;

const students: Student[] = [
  { id: "s1", name: "Alice", joinedAt: 0 },
  { id: "s2", name: "Bob", joinedAt: 0 },
];

describe("scoreboard", () => {
  it("empty rounds → zero seats", () => {
    const { students: rows } = computeScoreboard(g, students, []);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.totalSeatsA + r.totalSeatsB).toBe(0);
      expect(r.roundsPlayed).toBe(0);
    }
  });

  it("counts seats from a completed round", () => {
    const plan14 = g.randomPlans["14"][0];
    const pairing: [number, number][] = [
      [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14],
    ];
    const round: RoundState = {
      round: 1,
      status: "done",
      voterDist: "random",
      voterSeed: 1,
      pairings: [["s1", "s2"]],
      defines: { s1: plan14, s2: plan14 },
      combines: {
        s1: { definerId: "s2", pairing },
        s2: { definerId: "s1", pairing },
      },
    };
    const { students: rows } = computeScoreboard(g, students, [round]);
    for (const r of rows) {
      expect(r.roundsPlayed).toBe(1);
      expect(r.totalSeatsA + r.totalSeatsB).toBeGreaterThan(0);
      expect(r.totalSeatsA + r.totalSeatsB).toBeLessThanOrEqual(7);
    }
  });
});
