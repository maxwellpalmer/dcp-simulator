import { describe, it, expect } from "vitest";
import { computeScoreboard } from "./scoreboard";
import { scoreA } from "./stats";
import type { DistrictStats, Grid } from "./types";
import grid70 from "../assets/grid_70.json";
import type { RoundState, Student } from "../../shared/session";

const g = grid70 as unknown as Grid;

const students: Student[] = [
  { id: "s1", name: "Alice", joinedAt: 0 },
  { id: "s2", name: "Bob", joinedAt: 0 },
];

describe("scoreboard (A-only, definer-scored)", () => {
  it("empty rounds → zero seats", () => {
    const { students: rows } = computeScoreboard(g, students, []);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.totalSeatsA).toBe(0);
      expect(r.roundsScored).toBe(0);
    }
  });

  it("credits each student with seats A from the map they defined", () => {
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
      // Both students defined the same plan; combined by their partner.
      defines: { s1: plan14, s2: plan14 },
      combines: {
        // s1 combined s2's map, s2 combined s1's map
        s1: { definerId: "s2", pairing },
        s2: { definerId: "s1", pairing },
      },
    };
    const { students: rows, rounds } = computeScoreboard(g, students, [round]);
    // Each student's score is from their own define + partner's combine
    for (const r of rows) {
      expect(r.roundsScored).toBe(1);
      expect(r.totalDistricts).toBe(7);
    }
    // Round summary should have two outcomes
    expect(rounds[0].results).toHaveLength(2);
  });

  it("ties count as half a seat for A", () => {
    const mk = (winner: DistrictStats["winner"]): DistrictStats => ({
      district: 1, population: 10, votesA: 5, votesB: 5, winner,
    });
    // 2 A wins + 1 B + 1 tie → 2 + 0.5 = 2.5
    expect(scoreA([mk("A"), mk("A"), mk("B"), mk("tie")])).toBe(2.5);
    // 2 ties → 1.0
    expect(scoreA([mk("tie"), mk("tie")])).toBe(1);
    // All B → 0
    expect(scoreA([mk("B"), mk("B"), mk("B")])).toBe(0);
  });

  it("skips partially-played rounds", () => {
    const plan14 = g.randomPlans["14"][0];
    const round: RoundState = {
      round: 1,
      status: "combine",
      voterDist: "random",
      voterSeed: 1,
      pairings: [["s1", "s2"]],
      defines: { s1: plan14, s2: plan14 },
      combines: {
        // Only s2 has combined (s1's map); s1 hasn't combined yet.
        s2: { definerId: "s1", pairing: [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14]] },
      },
    };
    const { students: rows, rounds } = computeScoreboard(g, students, [round]);
    // s1 has a score (their map was combined), s2 does not
    expect(rows.find((r) => r.studentId === "s1")!.roundsScored).toBe(1);
    expect(rows.find((r) => r.studentId === "s2")!.roundsScored).toBe(0);
    expect(rounds[0].results).toHaveLength(1);
  });
});
