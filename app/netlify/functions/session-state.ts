import type { Context } from "@netlify/functions";
import type { SessionStateResponse } from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadAllRounds,
  loadMeta,
  loadRound,
  loadStudents,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const studentId = url.searchParams.get("studentId") ?? null;
  if (!code) return errorResponse("code required");

  const meta = await loadMeta(code);
  if (!meta) return errorResponse("Unknown session code", 404);

  const students = await loadStudents(code);
  const round =
    meta.currentRound > 0 ? await loadRound(code, meta.currentRound) : null;

  let partnerId: string | null = null;
  let combineTarget: SessionStateResponse["combineTarget"] = null;

  if (round && studentId) {
    for (const [a, b] of round.pairings ?? []) {
      if (a === studentId) { partnerId = b; break; }
      if (b === studentId) { partnerId = a; break; }
    }
    if (
      (round.status === "combine" || round.status === "done") &&
      partnerId &&
      round.defines[partnerId]
    ) {
      combineTarget = {
        definerId: partnerId,
        assignment: round.defines[partnerId],
      };
    }
  }

  const allRounds = meta.currentRound > 0
    ? await loadAllRounds(code, meta.currentRound)
    : [];

  // Strip teacher auth material before sending to any client
  const { teacherToken: _tt, ...sessionSafe } = meta;
  void _tt;

  const resp: SessionStateResponse = {
    session: sessionSafe,
    students,
    round,
    partnerId,
    combineTarget,
    allRounds,
  };
  return json(resp);
};

export const config = { path: "/api/session/state" };
