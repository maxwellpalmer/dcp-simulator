// Teacher forcibly advances session status.
// Used to end a round early, or to move from "results" back to a new round.
import type { Context } from "@netlify/functions";
import type { AdvanceRequest } from "../../shared/session.ts";
import { errorResponse, json, loadRound, requireTeacher, saveMeta, saveRound } from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as AdvanceRequest;
  const metaOrErr = await requireTeacher(body.code, body.teacherToken);
  if (metaOrErr instanceof Response) return metaOrErr;
  const meta = metaOrErr;

  if (meta.currentRound > 0) {
    const round = await loadRound(body.code, meta.currentRound);
    if (round && round.status !== "done") {
      round.status = "done";
      await saveRound(body.code, round);
    }
  }
  meta.status = "results";
  await saveMeta(meta);
  return json({ ok: true, session: meta });
};

export const config = { path: "/api/session/advance" };
