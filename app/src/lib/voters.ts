import type { BlockId, Grid, Party } from "./types";
import { makeRng, seededShuffle } from "./random";

export type VoterMap = Map<BlockId, Party>;

export type DistributionMode =
  | "random"
  | "random5050"
  | "minorityClusteredA"
  | "majorityClusteredA"
  | "minorityClusteredB"
  | "majorityClusteredB";

export interface DistributionParams {
  mode: DistributionMode;
  seed: number;
}

// Fuzzy cluster: a target party is assigned with higher probability near a
// seed block, falling off with hex-distance. Noise ~15–20% so clusters are
// not perfectly homogeneous.
export function generateVoters(
  grid: Grid,
  params: DistributionParams,
): VoterMap {
  const n = grid.blocks.length;
  const pctMinority = 0.4;
  const nA =
    params.mode === "majorityClusteredA" || params.mode === "minorityClusteredB"
      ? Math.round(n * 0.6)
      : params.mode === "random5050"
        ? Math.round(n * 0.5)
        : Math.round(n * pctMinority);

  const nActualA = params.mode === "random" ? Math.round(n * pctMinority)
    : params.mode === "random5050" ? Math.round(n * 0.5)
    : nA;

  if (params.mode === "random" || params.mode === "random5050") {
    return randomAssign(grid, nActualA, params.seed);
  }

  const clusterTarget: Party =
    params.mode === "minorityClusteredA" || params.mode === "majorityClusteredA"
      ? "A"
      : "B";
  const targetCount =
    clusterTarget === "A" ? nActualA : n - nActualA;

  return clusterAssign(grid, clusterTarget, targetCount, params.seed);
}

function randomAssign(grid: Grid, nA: number, seed: number): VoterMap {
  const ids = grid.blocks.map((b) => b.id);
  const shuffled = seededShuffle(ids, seed);
  const aSet = new Set(shuffled.slice(0, nA));
  const out: VoterMap = new Map();
  for (const b of grid.blocks) out.set(b.id, aSet.has(b.id) ? "A" : "B");
  return out;
}

function clusterAssign(
  grid: Grid,
  target: Party,
  targetCount: number,
  seed: number,
): VoterMap {
  const rng = makeRng(seed);
  // Pick seed block deterministically from seeded rng
  const seedIdx = Math.floor(rng() * grid.blocks.length);
  const seedBlock = grid.blocks[seedIdx];

  // Score each block by distance from seed; add noise.
  // Lower score → more likely to be target party.
  const noise = 0.2;
  const scored = grid.blocks.map((b) => {
    const dx = b.cx - seedBlock.cx;
    const dy = b.cy - seedBlock.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const jitter = (rng() - 0.5) * 2 * noise * maxGridDist(grid);
    return { id: b.id, score: dist + jitter };
  });
  scored.sort((a, b) => a.score - b.score);
  const targetSet = new Set(scored.slice(0, targetCount).map((s) => s.id));

  const out: VoterMap = new Map();
  const other: Party = target === "A" ? "B" : "A";
  for (const b of grid.blocks) out.set(b.id, targetSet.has(b.id) ? target : other);
  return out;
}

function maxGridDist(grid: Grid): number {
  let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity;
  for (const b of grid.blocks) {
    if (b.cx > maxX) maxX = b.cx;
    if (b.cx < minX) minX = b.cx;
    if (b.cy > maxY) maxY = b.cy;
    if (b.cy < minY) minY = b.cy;
  }
  return Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
}
