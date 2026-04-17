import type { Context } from "@netlify/functions";
import type { EndSessionRequest } from "../../shared/session.ts";
import { deleteSession, errorResponse, json, requireTeacher } from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as EndSessionRequest;
  const metaOrErr = await requireTeacher(body.code, body.teacherToken);
  if (metaOrErr instanceof Response) return metaOrErr;
  await deleteSession(body.code);
  return json({ ok: true });
};

export const config = { path: "/api/session/end" };
