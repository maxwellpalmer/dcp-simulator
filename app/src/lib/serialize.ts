import type { Assignment, BlockId, DistrictId, Grid } from "./types";

export function assignmentToFlat(grid: Grid, a: Assignment): number[] {
  return grid.blocks.map((b) => a.get(b.id) ?? 0);
}

export function assignmentFromFlat(grid: Grid, flat: number[]): Assignment {
  const m = new Map<BlockId, DistrictId>();
  grid.blocks.forEach((b, i) => {
    const d = flat[i] ?? 0;
    if (d > 0) m.set(b.id, d);
  });
  return m;
}
