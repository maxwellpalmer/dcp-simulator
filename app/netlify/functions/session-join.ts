import type { Context } from "@netlify/functions";
import type {
  JoinSessionRequest,
  JoinSessionResponse,
} from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadMeta,
  loadStudents,
  randomId,
  saveStudents,
} from "./_lib.ts";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") return errorResponse("POST only", 405);
  const body = (await req.json()) as JoinSessionRequest;
  if (!body.code || !body.name) return errorResponse("code and name required");

  const meta = await loadMeta(body.code);
  if (!meta) return errorResponse("Unknown session code", 404);
  if (meta.status === "ended") return errorResponse("Session ended");

  const students = await loadStudents(body.code);
  if (students.some((s) => s.name.toLowerCase() === body.name.toLowerCase())) {
    return errorResponse("Name already taken in this session");
  }
  const id = randomId();
  students.push({ id, name: body.name, joinedAt: Date.now() });
  await saveStudents(body.code, students);

  const resp: JoinSessionResponse = { studentId: id };
  return json(resp);
};

export const config = { path: "/api/session/join" };
