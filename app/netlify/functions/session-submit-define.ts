import type { Context } from "@netlify/functions";
import type { SubmitDefineRequest } from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadMeta,
  loadRound,
  saveRoundMeta,
  saveStudentDefine,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as SubmitDefineRequest;
  const meta = await loadMeta(body.code);
  if (!meta) return errorResponse("Unknown session", 404);
  const round = await loadRound(body.code, meta.currentRound);
  if (!round) return errorResponse("No active round", 400);
  if (round.status !== "define") return errorResponse("Define stage closed", 400);

  const paired =
    round.pairings?.some(
      ([a, b]) => a === body.studentId || b === body.studentId,
    ) ?? false;
  if (!paired) return errorResponse("You are not paired this round", 400);

  // Write this student's define under its own key — no read-modify-write
  // on the shared round blob, so concurrent submissions don't clobber.
  await saveStudentDefine(
    body.code,
    meta.currentRound,
    body.studentId,
    body.assignment,
  );

  // Re-load the round (cheap per-key fetch) to see if everyone has finished
  // and advance the stored status if so. loadRound also recomputes status
  // from contents, so this is just to persist the status transition.
  const fresh = await loadRound(body.code, meta.currentRound);
  if (fresh && fresh.status !== round.status) {
    await saveRoundMeta(body.code, fresh);
  }
  return json({ ok: true, roundStatus: fresh?.status ?? round.status });
};

export const config = { path: "/api/session/submit-define" };
