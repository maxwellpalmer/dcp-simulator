import type { Context } from "@netlify/functions";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionMeta,
} from "../../shared/session.ts";
import {
  errorResponse,
  json,
  randomCode,
  randomToken,
  saveMeta,
  sha256Hex,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as CreateSessionRequest;
  if (!body.gridSize || !body.nDistricts || !body.totalRounds) {
    return errorResponse("Missing gridSize, nDistricts, or totalRounds");
  }

  const code = randomCode();
  const teacherToken = randomToken();
  const teacherHash = body.teacherPassphrase
    ? await sha256Hex(`${code}:${body.teacherPassphrase}`)
    : null;

  const meta: SessionMeta = {
    code,
    gridSize: body.gridSize,
    nDistricts: body.nDistricts,
    teacherToken,
    teacherHash,
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
