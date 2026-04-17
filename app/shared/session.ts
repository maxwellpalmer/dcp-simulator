// Shared types between the frontend and Netlify Functions.

import type { DistrictId } from "../src/lib/types";

export type SessionStatus = "lobby" | "round" | "results" | "ended";
export type RoundStatus = "define" | "combine" | "done";

export type DistributionMode =
  | "random"
  | "random5050"
  | "minorityClusteredA"
  | "majorityClusteredA"
  | "minorityClusteredB"
  | "majorityClusteredB";

export interface SessionMeta {
  code: string;
  gridSize: "70" | "140";
  nDistricts: number;
  teacherToken: string; // random; used for teacher auth
  status: SessionStatus;
  currentRound: number;
  totalRounds: number;
  voterDist: DistributionMode;
  voterSeed: number;
  createdAt: number;
}

export interface Student {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoundState {
  round: number;
  status: RoundStatus;
  voterDist: DistributionMode;
  voterSeed: number;
  pairings: [string, string][] | null;
  defines: Record<string, number[]>;
  combines: Record<string, { definerId: string; pairing: [number, number][] }>;
}

export interface SessionStateResponse {
  session: Omit<SessionMeta, "teacherToken">;
  students: Student[];
  round: RoundState | null;
  partnerId: string | null;
  combineTarget: { definerId: string; assignment: number[] } | null;
  // Compact summaries of all rounds so far (define+combine assignments +
  // voter params). Used by the teacher dashboard to compute the cumulative
  // scoreboard. Students ignore this.
  allRounds: RoundState[];
}

export interface DistrictResultStat {
  district: DistrictId;
  population: number;
  votesA: number;
  votesB: number;
  winner: "A" | "B" | "tie";
}

// --- Request / response bodies ---

export interface CreateSessionRequest {
  code: string; // instructor-chosen; must be unique
  gridSize: "70" | "140";
  nDistricts: number;
  totalRounds: number;
  voterDist: DistributionMode;
  voterSeed: number;
}

export interface CreateSessionResponse {
  code: string;
  teacherToken: string;
}

export interface JoinSessionRequest {
  code: string;
  name: string;
}

export interface JoinSessionResponse {
  studentId: string;
}

// Teacher-auth: teacherToken (saved locally / URL-bookmarked).
export interface TeacherAuth {
  teacherToken?: string;
}

export interface StartRoundRequest extends TeacherAuth {
  code: string;
  voterDist?: DistributionMode;
  voterSeed?: number;
}

export interface SubmitDefineRequest {
  code: string;
  studentId: string;
  assignment: number[];
}

export interface SubmitCombineRequest {
  code: string;
  studentId: string;
  pairing: [number, number][];
}

export interface AdvanceRequest extends TeacherAuth {
  code: string;
}

export interface EndSessionRequest extends TeacherAuth {
  code: string;
}

export interface VerifyTeacherRequest extends TeacherAuth {
  code: string;
}
