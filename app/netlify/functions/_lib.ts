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

// Round storage is split across multiple blob keys so concurrent student
// submissions don't clobber each other:
//   session/{code}/round/{n}/meta       → metadata only (no defines/combines)
//   session/{code}/round/{n}/define/{studentId}   → single student's define
//   session/{code}/round/{n}/combine/{studentId}  → single student's combine
//
// loadRound() reassembles the full RoundState from these pieces.

interface RoundMeta {
  round: number;
  status: RoundState["status"];
  voterDist: RoundState["voterDist"];
  voterSeed: number;
  pairings: [string, string][] | null;
}

export async function loadRound(
  code: string,
  n: number,
): Promise<RoundState | null> {
  const s = store();
  const meta = (await s.get(`session/${code}/round/${n}/meta`, { type: "json" })) as
    | RoundMeta
    | null;
  if (!meta) return null;

  const defines: Record<string, number[]> = {};
  const combines: Record<string, { definerId: string; pairing: [number, number][] }> = {};
  const pairedIds = (meta.pairings ?? []).flatMap(([a, b]) => [a, b]);
  await Promise.all(
    pairedIds.map(async (id) => {
      const d = (await s.get(`session/${code}/round/${n}/define/${id}`, { type: "json" })) as
        | number[]
        | null;
      if (d) defines[id] = d;
      const c = (await s.get(`session/${code}/round/${n}/combine/${id}`, { type: "json" })) as
        | { definerId: string; pairing: [number, number][] }
        | null;
      if (c) combines[id] = c;
    }),
  );

  // Recompute status from contents (cheap, and robust to races).
  let status: RoundState["status"] = meta.status;
  if (pairedIds.length > 0) {
    const allDefined = pairedIds.every((id) => defines[id]);
    const allCombined = pairedIds.every((id) => combines[id]);
    if (allCombined) status = "done";
    else if (allDefined) status = "combine";
    else status = "define";
  }

  return {
    round: meta.round,
    status,
    voterDist: meta.voterDist,
    voterSeed: meta.voterSeed,
    pairings: meta.pairings,
    defines,
    combines,
  };
}

export async function saveRoundMeta(
  code: string,
  round: RoundState,
): Promise<void> {
  const meta: RoundMeta = {
    round: round.round,
    status: round.status,
    voterDist: round.voterDist,
    voterSeed: round.voterSeed,
    pairings: round.pairings,
  };
  await store().setJSON(`session/${code}/round/${round.round}/meta`, meta);
}

export async function saveStudentDefine(
  code: string,
  n: number,
  studentId: string,
  assignment: number[],
): Promise<void> {
  await store().setJSON(
    `session/${code}/round/${n}/define/${studentId}`,
    assignment,
  );
}

export async function saveStudentCombine(
  code: string,
  n: number,
  studentId: string,
  combine: { definerId: string; pairing: [number, number][] },
): Promise<void> {
  await store().setJSON(
    `session/${code}/round/${n}/combine/${studentId}`,
    combine,
  );
}

// Allowed chars for instructor-chosen session codes: A-Z and 0-9.
// Client + server should uppercase before validating / storing.
const CODE_ALPHABET = /^[A-Z0-9]{3,12}$/;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCode(code: string): boolean {
  return CODE_ALPHABET.test(code);
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

export function checkTeacher(
  meta: SessionMeta,
  teacherToken: string | undefined,
): boolean {
  return !!teacherToken && teacherToken === meta.teacherToken;
}

export async function requireTeacher(
  code: string,
  teacherToken: string | undefined,
): Promise<SessionMeta | Response> {
  const meta = await loadMeta(code);
  if (!meta) return errorResponse("Unknown session", 404);
  if (!checkTeacher(meta, teacherToken)) {
    return errorResponse("Teacher authentication failed", 401);
  }
  return meta;
}

export async function loadAllRounds(
  code: string,
  upTo: number,
) {
  const out = [];
  for (let i = 1; i <= upTo; i++) {
    const r = await loadRound(code, i);
    if (r) out.push(r);
  }
  return out;
}

export async function deleteSession(code: string): Promise<void> {
  const s = store();
  const prefix = `session/${code}/`;
  // Use list() to clean up every key under the session prefix.
  try {
    const { blobs } = await s.list({ prefix });
    await Promise.all(blobs.map((b) => s.delete(b.key).catch(() => void 0)));
  } catch {
    // Fallback: delete common known keys
    const keys = [`${prefix}meta`, `${prefix}students`];
    for (let i = 1; i <= 20; i++) keys.push(`${prefix}round/${i}/meta`);
    await Promise.all(keys.map((k) => s.delete(k).catch(() => void 0)));
  }
}
