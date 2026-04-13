import type {
  Assignment,
  BlockId,
  DistrictId,
  Grid,
  ValidationError,
} from "./types";
import { UNASSIGNED } from "./types";
import { blocksByDistrict, buildAdjacencyMap, isContiguous } from "./grid";

export interface ValidateOptions {
  nDistricts: number;
  requireDoughnutFree?: boolean;
}

export function validatePlan(
  grid: Grid,
  assignment: Assignment,
  opts: ValidateOptions,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const unassigned: BlockId[] = [];
  for (const b of grid.blocks) {
    const d = assignment.get(b.id) ?? UNASSIGNED;
    if (d === UNASSIGNED) unassigned.push(b.id);
  }
  if (unassigned.length > 0) {
    errors.push({
      code: "UNASSIGNED_BLOCKS",
      message: `${unassigned.length} block${unassigned.length === 1 ? "" : "s"} unassigned.`,
      details: { blocks: unassigned },
    });
  }

  const byDist = blocksByDistrict(assignment);
  byDist.delete(UNASSIGNED);

  const nExpected = opts.nDistricts;
  if (byDist.size !== nExpected) {
    errors.push({
      code: "WRONG_DISTRICT_COUNT",
      message: `Expected ${nExpected} districts, got ${byDist.size}.`,
      details: { expected: nExpected, got: byDist.size },
    });
  }

  const target = grid.blocks.length / nExpected;
  const imbalanced: { district: DistrictId; size: number }[] = [];
  for (const [d, blocks] of byDist) {
    if (blocks.length !== target) imbalanced.push({ district: d, size: blocks.length });
  }
  if (imbalanced.length > 0) {
    errors.push({
      code: "POPULATION_IMBALANCE",
      message: `Each district must have exactly ${target} blocks. Off: ${imbalanced
        .map((i) => `district ${i.district} has ${i.size}`)
        .join("; ")}.`,
      details: { target, imbalanced },
    });
  }

  const adj = buildAdjacencyMap(grid);
  const nonContig: DistrictId[] = [];
  for (const [d, blocks] of byDist) {
    if (!isContiguous(blocks, adj)) nonContig.push(d);
  }
  if (nonContig.length > 0) {
    errors.push({
      code: "NOT_CONTIGUOUS",
      message: `District${nonContig.length === 1 ? "" : "s"} ${nonContig.join(", ")} not contiguous.`,
      details: { districts: nonContig },
    });
  }

  if (opts.requireDoughnutFree) {
    const dough = findDoughnuts(grid, byDist, adj);
    if (dough.length > 0) {
      errors.push({
        code: "DOUGHNUT",
        message: `District${dough.length === 1 ? "" : "s"} ${dough.join(", ")} fully enclosed by another district (doughnut).`,
        details: { districts: dough },
      });
    }
  }

  return errors;
}

// A district is a "doughnut" (fully enclosed) if all blocks adjacent to it
// (outside the district) belong to a single other district.
function findDoughnuts(
  _grid: Grid,
  byDist: Map<DistrictId, BlockId[]>,
  adj: Map<BlockId, Set<BlockId>>,
): DistrictId[] {
  const blockToDist = new Map<BlockId, DistrictId>();
  for (const [d, blocks] of byDist) for (const b of blocks) blockToDist.set(b, d);

  const out: DistrictId[] = [];
  for (const [d, blocks] of byDist) {
    const neighborDists = new Set<DistrictId>();
    let touchesBoundary = false;
    for (const b of blocks) {
      for (const n of adj.get(b) ?? []) {
        const nd = blockToDist.get(n);
        if (nd !== undefined && nd !== d) neighborDists.add(nd);
      }
      // If this block has fewer neighbors in the adjacency map than expected,
      // it sits on the outer boundary. We detect that by counting: a block on
      // the grid edge has fewer than 6 neighbors.
      if ((adj.get(b)?.size ?? 0) < 6) touchesBoundary = true;
    }
    if (!touchesBoundary && neighborDists.size === 1) out.push(d);
  }
  return out;
}
