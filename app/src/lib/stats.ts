import type { Assignment, DistrictStats, Grid, Party } from "./types";
import { UNASSIGNED } from "./types";
import type { VoterMap } from "./voters";
import { blocksByDistrict } from "./grid";

export function computeStats(
  _grid: Grid,
  assignment: Assignment,
  voters: VoterMap,
): DistrictStats[] {
  const byDist = blocksByDistrict(assignment);
  byDist.delete(UNASSIGNED);

  const out: DistrictStats[] = [];
  for (const [district, blocks] of byDist) {
    let votesA = 0, votesB = 0;
    for (const b of blocks) {
      const v = voters.get(b);
      if (v === "A") votesA++;
      else if (v === "B") votesB++;
    }
    const winner: Party | "tie" =
      votesA > votesB ? "A" : votesB > votesA ? "B" : "tie";
    out.push({ district, population: blocks.length, votesA, votesB, winner });
  }
  out.sort((a, b) => a.district - b.district);
  return out;
}

export function seatCount(stats: DistrictStats[]): { A: number; B: number; ties: number } {
  let A = 0, B = 0, ties = 0;
  for (const s of stats) {
    if (s.winner === "A") A++;
    else if (s.winner === "B") B++;
    else ties++;
  }
  return { A, B, ties };
}
