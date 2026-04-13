import type {
  Assignment,
  BlockId,
  DistrictId,
  DistrictStats,
  Grid,
  Party,
  ValidationError,
} from "./types";
import { UNASSIGNED } from "./types";
import type { VoterMap } from "./voters";
import { blocksByDistrict, buildAdjacencyMap } from "./grid";

// A pairing is an array of 2-tuples of sub-district IDs. Its index = final district.
export type Pairing = [DistrictId, DistrictId][];

export function subDistrictLabel(id: DistrictId): string {
  // 1 -> A, 26 -> Z, 27 -> AA, etc.
  if (id <= 0) return "?";
  let n = id;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Two sub-districts are adjacent if any block of one is adjacent to any block
// of the other (across the inter-block adjacency graph).
export function subDistrictsAdjacent(
  grid: Grid,
  assignment: Assignment,
  a: DistrictId,
  b: DistrictId,
): boolean {
  if (a === b) return false;
  const adj = buildAdjacencyMap(grid);
  const blocksA = new Set<BlockId>();
  for (const [blk, d] of assignment) if (d === a) blocksA.add(blk);
  for (const [blk, d] of assignment) {
    if (d !== b) continue;
    for (const n of adj.get(blk) ?? []) if (blocksA.has(n)) return true;
  }
  return false;
}

export interface ValidateCombineOptions {
  nSubDistricts: number;
}

export function validatePairing(
  grid: Grid,
  assignment: Assignment,
  pairing: Pairing,
  opts: ValidateCombineOptions,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const flat = pairing.flat();
  const used = new Set<DistrictId>();
  const duplicates: DistrictId[] = [];
  for (const d of flat) {
    if (used.has(d)) duplicates.push(d);
    used.add(d);
  }

  const nExpected = opts.nSubDistricts / 2;
  if (pairing.length !== nExpected) {
    errors.push({
      code: "WRONG_DISTRICT_COUNT",
      message: `Expected ${nExpected} pairs, got ${pairing.length}.`,
    });
  }

  const missing: DistrictId[] = [];
  for (let i = 1; i <= opts.nSubDistricts; i++) {
    if (!used.has(i)) missing.push(i);
  }
  if (missing.length > 0 || duplicates.length > 0) {
    errors.push({
      code: "UNASSIGNED_BLOCKS",
      message:
        missing.length > 0
          ? `Sub-district${missing.length === 1 ? "" : "s"} ${missing
              .map(subDistrictLabel)
              .join(", ")} not paired.`
          : `Sub-district${duplicates.length === 1 ? "" : "s"} ${duplicates
              .map(subDistrictLabel)
              .join(", ")} paired more than once.`,
      details: { missing, duplicates },
    });
  }

  // Each pair must be adjacent.
  const nonAdj: string[] = [];
  for (const [a, b] of pairing) {
    if (!subDistrictsAdjacent(grid, assignment, a, b)) {
      nonAdj.push(`${subDistrictLabel(a)}+${subDistrictLabel(b)}`);
    }
  }
  if (nonAdj.length > 0) {
    errors.push({
      code: "NOT_CONTIGUOUS",
      message: `Paired sub-districts must be adjacent. Bad pair${
        nonAdj.length === 1 ? "" : "s"
      }: ${nonAdj.join(", ")}.`,
    });
  }

  return errors;
}

// Build an assignment mapping blocks → final district (1..N) given a sub-district
// assignment and a pairing.
export function applyPairing(
  subAssignment: Assignment,
  pairing: Pairing,
): Assignment {
  const subToFinal = new Map<DistrictId, DistrictId>();
  pairing.forEach((pair, i) => {
    subToFinal.set(pair[0], i + 1);
    subToFinal.set(pair[1], i + 1);
  });
  const out: Assignment = new Map();
  for (const [blk, sub] of subAssignment) {
    const f = subToFinal.get(sub);
    if (f !== undefined) out.set(blk, f);
    else out.set(blk, UNASSIGNED);
  }
  return out;
}

export function computeFinalStats(
  grid: Grid,
  subAssignment: Assignment,
  pairing: Pairing,
  voters: VoterMap,
): DistrictStats[] {
  const finalAssign = applyPairing(subAssignment, pairing);
  const byDist = blocksByDistrict(finalAssign);
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

// Return the set of sub-district IDs that are adjacent to the given one,
// based on the current block-level assignment.
export function adjacentSubDistricts(
  grid: Grid,
  assignment: Assignment,
  sub: DistrictId,
): Set<DistrictId> {
  const adj = buildAdjacencyMap(grid);
  const out = new Set<DistrictId>();
  for (const [blk, d] of assignment) {
    if (d !== sub) continue;
    for (const n of adj.get(blk) ?? []) {
      const nd = assignment.get(n);
      if (nd !== undefined && nd !== sub && nd !== UNASSIGNED) out.add(nd);
    }
  }
  return out;
}
