// POST {code, teacherToken} → {ok, teacherToken}
// Used by the dashboard login screen so the client can confirm a pasted
// token is valid before caching it.
import type { Context } from "@netlify/functions";
import type { VerifyTeacherRequest } from "../../shared/session.ts";
import { checkTeacher, errorResponse, json, loadMeta } from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as VerifyTeacherRequest;
  const meta = await loadMeta(body.code);
  if (!meta) return errorResponse("Unknown session", 404);
  if (!checkTeacher(meta, body.teacherToken)) {
    return errorResponse("Teacher authentication failed", 401);
  }
  return json({ ok: true, teacherToken: meta.teacherToken });
};

export const config = { path: "/api/session/verify-teacher" };
