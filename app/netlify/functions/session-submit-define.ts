import type { Context } from "@netlify/functions";
import type { SubmitDefineRequest } from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadMeta,
  loadRound,
  saveRound,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as SubmitDefineRequest;
  const meta = await loadMeta(body.code);
  if (!meta) return errorResponse("Unknown session", 404);
  const round = await loadRound(body.code, meta.currentRound);
  if (!round) return errorResponse("No active round", 400);
  if (round.status !== "define") return errorResponse("Define stage closed", 400);

  // Student must be in a pairing for this round
  const paired =
    round.pairings?.some(
      ([a, b]) => a === body.studentId || b === body.studentId,
    ) ?? false;
  if (!paired) return errorResponse("You are not paired this round", 400);

  round.defines[body.studentId] = body.assignment;

  // If every paired student has submitted, advance to combine stage.
  const pairedIds = round.pairings
    ? round.pairings.flatMap(([a, b]) => [a, b])
    : [];
  const allSubmitted = pairedIds.every((id) => round.defines[id]);
  if (allSubmitted) round.status = "combine";

  await saveRound(body.code, round);
  return json({ ok: true, roundStatus: round.status });
};

export const config = { path: "/api/session/submit-define" };
