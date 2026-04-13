export type BlockId = number;
export type DistrictId = number;
export type Party = "A" | "B";
export const UNASSIGNED: DistrictId = 0;

export interface Block {
  id: BlockId;
  cx: number;
  cy: number;
  vertices: [number, number][];
}

export interface InnerLine {
  a: BlockId;
  b: BlockId;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type OuterRing = [number, number][];

export interface Grid {
  size: number;
  label: string;
  districtOptions: number[];
  blocks: Block[];
  adjacency: [BlockId, BlockId][];
  innerLines: InnerLine[];
  outerRing: OuterRing;
  randomPlans: Record<string, DistrictId[][]>;
}

export type Assignment = Map<BlockId, DistrictId>;

export interface ValidationError {
  code:
    | "UNASSIGNED_BLOCKS"
    | "WRONG_DISTRICT_COUNT"
    | "POPULATION_IMBALANCE"
    | "NOT_CONTIGUOUS"
    | "DOUGHNUT";
  message: string;
  details?: Record<string, unknown>;
}

export interface DistrictStats {
  district: DistrictId;
  population: number;
  votesA: number;
  votesB: number;
  winner: Party | "tie";
}
