import type { Grid } from "./types";
import { generateVoters } from "./voters";
import { computeFinalStats } from "./combine";
import { assignmentFromFlat } from "./serialize";
import { seatCount } from "./stats";
import type { RoundState, Student } from "../../shared/session";

// In competitive mode, every student plays Party A during Define and Party B
// during Combine. A student's score is the number of Party A seats in the
// map they DREW (after their partner — an adversarial B combiner — paired
// their sub-districts). The combiner's work is a test of the definer's
// gerrymander, not a score for the combiner.

export interface ScoreRow {
  studentId: string;
  name: string;
  totalSeatsA: number;
  roundsScored: number;
  // Total districts across all rounds this student defined — denominator
  // to read totalSeatsA against (so a 4/7 vs 6/10 is apparent).
  totalDistricts: number;
}

export interface RoundResultRow {
  // The student whose map was scored (the definer).
  definerId: string;
  definer: string;
  // The student who combined against them.
  combinerId: string;
  combiner: string;
  seatsA: number;
  nDistricts: number;
}

export interface RoundSummary {
  round: number;
  status: "define" | "combine" | "done";
  voterDist: string;
  participants: number;
  completed: number;
  results: RoundResultRow[];
}

export function computeScoreboard(
  grid: Grid,
  students: Student[],
  rounds: RoundState[],
): { students: ScoreRow[]; rounds: RoundSummary[] } {
  const nameById = new Map(students.map((s) => [s.id, s.name]));
  const rows = new Map<string, ScoreRow>();
  for (const s of students) {
    rows.set(s.id, {
      studentId: s.id,
      name: s.name,
      totalSeatsA: 0,
      roundsScored: 0,
      totalDistricts: 0,
    });
  }

  const roundSummaries: RoundSummary[] = [];

  for (const r of rounds) {
    const voters = generateVoters(grid, {
      mode: r.voterDist as Parameters<typeof generateVoters>[1]["mode"],
      seed: r.voterSeed,
    });
    const results: RoundResultRow[] = [];
    const pairs = r.pairings ?? [];

    for (const [a, b] of pairs) {
      // For each pair, there are up to two scoreable outcomes:
      //   - a defined + b combined → scores a
      //   - b defined + a combined → scores b
      for (const [definer, combiner] of [[a, b], [b, a]] as const) {
        const definerFlat = r.defines[definer];
        const combineRec = r.combines[combiner];
        if (!definerFlat || !combineRec || combineRec.definerId !== definer) continue;
        const definerAsg = assignmentFromFlat(grid, definerFlat);
        const stats = computeFinalStats(grid, definerAsg, combineRec.pairing, voters);
        const seats = seatCount(stats);
        const row = rows.get(definer);
        if (row) {
          row.totalSeatsA += seats.A;
          row.totalDistricts += stats.length;
          row.roundsScored++;
        }
        results.push({
          definerId: definer,
          definer: nameById.get(definer) ?? definer,
          combinerId: combiner,
          combiner: nameById.get(combiner) ?? combiner,
          seatsA: seats.A,
          nDistricts: stats.length,
        });
      }
    }

    roundSummaries.push({
      round: r.round,
      status: r.status,
      voterDist: r.voterDist,
      participants: pairs.length * 2,
      completed: Object.keys(r.combines).length,
      results,
    });
  }

  const ranked = Array.from(rows.values()).sort(
    (a, b) => b.totalSeatsA - a.totalSeatsA || b.roundsScored - a.roundsScored,
  );
  return { students: ranked, rounds: roundSummaries };
}
