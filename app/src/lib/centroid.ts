import type { Assignment, DistrictId, Grid } from "./types";
import { UNASSIGNED } from "./types";

export function districtCentroids(
  grid: Grid,
  assignment: Assignment,
): Map<DistrictId, { cx: number; cy: number }> {
  const sums = new Map<DistrictId, { sx: number; sy: number; n: number }>();
  const byId = new Map(grid.blocks.map((b) => [b.id, b]));
  for (const [blkId, d] of assignment) {
    if (d === UNASSIGNED) continue;
    const b = byId.get(blkId);
    if (!b) continue;
    const cur = sums.get(d) ?? { sx: 0, sy: 0, n: 0 };
    cur.sx += b.cx;
    cur.sy += b.cy;
    cur.n += 1;
    sums.set(d, cur);
  }
  const out = new Map<DistrictId, { cx: number; cy: number }>();
  for (const [d, s] of sums) out.set(d, { cx: s.sx / s.n, cy: s.sy / s.n });
  return out;
}
