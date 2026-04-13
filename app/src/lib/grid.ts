import type { Grid, BlockId, DistrictId } from "./types";

export function buildAdjacencyMap(grid: Grid): Map<BlockId, Set<BlockId>> {
  const map = new Map<BlockId, Set<BlockId>>();
  for (const b of grid.blocks) map.set(b.id, new Set());
  for (const [a, b] of grid.adjacency) {
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
}

export function blocksByDistrict(
  assignment: Map<BlockId, DistrictId>,
): Map<DistrictId, BlockId[]> {
  const out = new Map<DistrictId, BlockId[]>();
  for (const [block, district] of assignment) {
    const arr = out.get(district);
    if (arr) arr.push(block);
    else out.set(district, [block]);
  }
  return out;
}

export function isContiguous(
  districtBlocks: BlockId[],
  adj: Map<BlockId, Set<BlockId>>,
): boolean {
  if (districtBlocks.length === 0) return true;
  const set = new Set(districtBlocks);
  const visited = new Set<BlockId>();
  const queue: BlockId[] = [districtBlocks[0]];
  visited.add(districtBlocks[0]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (set.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited.size === districtBlocks.length;
}
