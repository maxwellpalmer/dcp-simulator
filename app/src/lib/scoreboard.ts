import type { Grid, Party } from "./types";
import { generateVoters } from "./voters";
import { computeFinalStats } from "./combine";
import { assignmentFromFlat } from "./serialize";
import { seatCount } from "./stats";
import type { RoundState, Student } from "../../shared/session";

export interface ScoreRow {
  studentId: string;
  name: string;
  totalSeatsA: number;
  totalSeatsB: number;
  roundsPlayed: number;
  wins: { A: number; B: number; ties: number };
}

export interface RoundRow {
  round: number;
  status: "define" | "combine" | "done";
  voterDist: string;
  participants: number;
  completed: number;
  results: {
    who: string; // student name
    definer: string; // student name
    seatsA: number;
    seatsB: number;
    winner: Party | "tie";
  }[];
}

export function computeScoreboard(
  grid: Grid,
  students: Student[],
  rounds: RoundState[],
): { students: ScoreRow[]; rounds: RoundRow[] } {
  const nameById = new Map(students.map((s) => [s.id, s.name]));
  const rows = new Map<string, ScoreRow>();
  for (const s of students) {
    rows.set(s.id, {
      studentId: s.id,
      name: s.name,
      totalSeatsA: 0,
      totalSeatsB: 0,
      roundsPlayed: 0,
      wins: { A: 0, B: 0, ties: 0 },
    });
  }

  const roundRows: RoundRow[] = [];

  for (const r of rounds) {
    const voters = generateVoters(grid, {
      mode: r.voterDist as Parameters<typeof generateVoters>[1]["mode"],
      seed: r.voterSeed,
    });
    const pairedIds = (r.pairings ?? []).flatMap(([a, b]) => [a, b]);
    const results: RoundRow["results"] = [];
    for (const who of pairedIds) {
      const row = rows.get(who);
      if (!row) continue;
      row.roundsPlayed++;
      const combine = r.combines[who];
      if (!combine) continue;
      const definerAssign = assignmentFromFlat(grid, r.defines[combine.definerId] ?? []);
      const stats = computeFinalStats(grid, definerAssign, combine.pairing, voters);
      const seats = seatCount(stats);
      row.totalSeatsA += seats.A;
      row.totalSeatsB += seats.B;
      const winner: Party | "tie" =
        seats.A > seats.B ? "A" : seats.B > seats.A ? "B" : "tie";
      if (winner === "A") row.wins.A++;
      else if (winner === "B") row.wins.B++;
      else row.wins.ties++;
      results.push({
        who: row.name,
        definer: nameById.get(combine.definerId) ?? combine.definerId,
        seatsA: seats.A,
        seatsB: seats.B,
        winner,
      });
    }
    roundRows.push({
      round: r.round,
      status: r.status,
      voterDist: r.voterDist,
      participants: pairedIds.length,
      completed: Object.keys(r.combines).length,
      results,
    });
  }

  const ranked = Array.from(rows.values()).sort(
    (a, b) =>
      b.totalSeatsA + b.totalSeatsB - (a.totalSeatsA + a.totalSeatsB) ||
      b.roundsPlayed - a.roundsPlayed,
  );
  return { students: ranked, rounds: roundRows };
}
