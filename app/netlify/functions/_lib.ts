import { getStore } from "@netlify/blobs";
import type {
  RoundState,
  SessionMeta,
  Student,
} from "../../shared/session.ts";

export function store() {
  return getStore({ name: "dcp-sessions", consistency: "strong" });
}

export async function loadMeta(code: string): Promise<SessionMeta | null> {
  return (await store().get(`session/${code}/meta`, { type: "json" })) as
    | SessionMeta
    | null;
}

export async function saveMeta(meta: SessionMeta): Promise<void> {
  await store().setJSON(`session/${meta.code}/meta`, meta);
}

export async function loadStudents(code: string): Promise<Student[]> {
  return ((await store().get(`session/${code}/students`, { type: "json" })) ??
    []) as Student[];
}

export async function saveStudents(code: string, list: Student[]): Promise<void> {
  await store().setJSON(`session/${code}/students`, list);
}

export async function loadRound(
  code: string,
  n: number,
): Promise<RoundState | null> {
  return (await store().get(`session/${code}/round/${n}`, { type: "json" })) as
    | RoundState
    | null;
}

export async function saveRound(
  code: string,
  round: RoundState,
): Promise<void> {
  await store().setJSON(`session/${code}/round/${round.round}`, round);
}

// Session code: 5 chars, unambiguous alphabet (no O/0/I/L/1).
export function randomCode(len = 5): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function randomToken(): string {
  // 24 random chars, URL-safe
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 24; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function requireTeacher(
  code: string,
  teacherToken: string | undefined,
): Promise<SessionMeta | Response> {
  const meta = await loadMeta(code);
  if (!meta) return errorResponse("Unknown session", 404);
  if (!teacherToken || teacherToken !== meta.teacherToken) {
    return errorResponse("Invalid teacher token", 401);
  }
  return meta;
}
