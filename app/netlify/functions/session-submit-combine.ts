import type { Context } from "@netlify/functions";
import type { SubmitCombineRequest } from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadMeta,
  loadRound,
  saveRoundMeta,
  saveStudentCombine,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as SubmitCombineRequest;
  const meta = await loadMeta(body.code);
  if (!meta) return errorResponse("Unknown session", 404);
  const round = await loadRound(body.code, meta.currentRound);
  if (!round) return errorResponse("No active round", 400);
  if (round.status !== "combine") return errorResponse("Not in combine stage", 400);

  let partnerId: string | null = null;
  for (const [a, b] of round.pairings ?? []) {
    if (a === body.studentId) { partnerId = b; break; }
    if (b === body.studentId) { partnerId = a; break; }
  }
  if (!partnerId) return errorResponse("Not in a pairing this round", 400);

  await saveStudentCombine(body.code, meta.currentRound, body.studentId, {
    definerId: partnerId,
    pairing: body.pairing,
  });

  const fresh = await loadRound(body.code, meta.currentRound);
  if (fresh && fresh.status !== round.status) {
    await saveRoundMeta(body.code, fresh);
  }
  return json({ ok: true, roundStatus: fresh?.status ?? round.status });
};

export const config = { path: "/api/session/submit-combine" };
