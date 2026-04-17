import type { Context } from "@netlify/functions";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionMeta,
} from "../../shared/session.ts";
import {
  errorResponse,
  isValidCode,
  json,
  loadMeta,
  normalizeCode,
  randomToken,
  saveMeta,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as CreateSessionRequest;
  if (!body.gridSize || !body.nDistricts || !body.totalRounds) {
    return errorResponse("Missing gridSize, nDistricts, or totalRounds");
  }
  if (!body.code) return errorResponse("Missing session code");

  const code = normalizeCode(body.code);
  if (!isValidCode(code)) {
    return errorResponse(
      "Session code must be 3–12 characters, letters A–Z and digits 0–9 only",
    );
  }
  if (await loadMeta(code)) {
    return errorResponse(`Session code "${code}" is already in use`, 409);
  }

  const teacherToken = randomToken();
  const meta: SessionMeta = {
    code,
    gridSize: body.gridSize,
    nDistricts: body.nDistricts,
    teacherToken,
    status: "lobby",
    currentRound: 0,
    totalRounds: body.totalRounds,
    voterDist: body.voterDist,
    voterSeed: body.voterSeed,
    createdAt: Date.now(),
  };
  await saveMeta(meta);

  const resp: CreateSessionResponse = { code, teacherToken };
  return json(resp);
};

export const config = { path: "/api/session/create" };
