import type { Context } from "@netlify/functions";
import type {
  RoundState,
  StartRoundRequest,
} from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadStudents,
  requireTeacher,
  saveMeta,
  saveRound,
  shuffle,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as StartRoundRequest;
  const metaOrErr = await requireTeacher(body.code, body.teacherToken);
  if (metaOrErr instanceof Response) return metaOrErr;
  const meta = metaOrErr;

  const students = await loadStudents(body.code);
  if (students.length < 2) return errorResponse("Need at least 2 students");

  const ids = shuffle(students.map((s) => s.id));
  const pairings: [string, string][] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) {
    pairings.push([ids[i], ids[i + 1]]);
  }

  const nextRound = meta.currentRound + 1;
  const round: RoundState = {
    round: nextRound,
    status: "define",
    voterDist: body.voterDist ?? meta.voterDist,
    voterSeed: body.voterSeed ?? meta.voterSeed + nextRound,
    pairings,
    defines: {},
    combines: {},
  };
  await saveRound(body.code, round);

  meta.currentRound = nextRound;
  meta.status = "round";
  await saveMeta(meta);

  return json({ ok: true, round });
};

export const config = { path: "/api/session/start-round" };
