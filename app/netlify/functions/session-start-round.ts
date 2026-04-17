import type { Context } from "@netlify/functions";
import type {
  RoundState,
  StartRoundRequest,
} from "../../shared/session.ts";
import {
  errorResponse,
  json,
  loadAllRounds,
  loadStudents,
  requireTeacher,
  saveMeta,
  saveRoundMeta,
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

  // Build pairings that avoid re-pairing any previous partners and rotate
  // the "sitter" (odd-one-out) to a student who has sat out least.
  const priorRounds = await loadAllRounds(body.code, meta.currentRound);
  const sitCounts = new Map<string, number>();
  const partnerHistory = new Map<string, Set<string>>();
  for (const s of students) {
    sitCounts.set(s.id, 0);
    partnerHistory.set(s.id, new Set());
  }
  const participatedInRound = new Set<string>();
  for (const r of priorRounds) {
    participatedInRound.clear();
    for (const [a, b] of r.pairings ?? []) {
      partnerHistory.get(a)?.add(b);
      partnerHistory.get(b)?.add(a);
      participatedInRound.add(a);
      participatedInRound.add(b);
    }
    for (const s of students) {
      if (!participatedInRound.has(s.id)) {
        sitCounts.set(s.id, (sitCounts.get(s.id) ?? 0) + 1);
      }
    }
  }

  const ids = students.map((s) => s.id);
  let sitter: string | null = null;
  let activeIds = ids;
  if (ids.length % 2 === 1) {
    // Pick sitter with min sitCount; break ties randomly.
    const minSits = Math.min(...ids.map((id) => sitCounts.get(id) ?? 0));
    const candidates = ids.filter((id) => (sitCounts.get(id) ?? 0) === minSits);
    sitter = shuffle(candidates)[0];
    activeIds = ids.filter((id) => id !== sitter);
  }

  // Try to find a perfect matching that avoids every prior partnering.
  // If no such matching exists (enough rounds have passed that the
  // anti-repeat constraint is unsatisfiable), fall back to a random shuffle.
  const finalPairings: [string, string][] =
    findPairings(activeIds, partnerHistory) ?? fallbackPairings(activeIds);

  const nextRound = meta.currentRound + 1;
  const round: RoundState = {
    round: nextRound,
    status: "define",
    voterDist: body.voterDist ?? meta.voterDist,
    voterSeed: body.voterSeed ?? meta.voterSeed + nextRound,
    pairings: finalPairings,
    defines: {},
    combines: {},
  };
  void sitter;
  await saveRoundMeta(body.code, round);

  meta.currentRound = nextRound;
  meta.status = "round";
  await saveMeta(meta);

  return json({ ok: true, round });
};

export const config = { path: "/api/session/start-round" };

// Try to find a perfect matching on `ids` that avoids every pair in history.
// Randomized backtracking search — fine for classroom-scale (≤ ~20 ids).
function findPairings(
  ids: string[],
  history: Map<string, Set<string>>,
): [string, string][] | null {
  if (ids.length === 0) return [];
  if (ids.length % 2 !== 0) return null;
  const shuffled = shuffle(ids);
  const pairs: [string, string][] = [];
  const used = new Set<string>();

  const backtrack = (): boolean => {
    const first = shuffled.find((id) => !used.has(id));
    if (!first) return true;
    used.add(first);
    const candidates = shuffle(
      shuffled.filter(
        (id) => id !== first && !used.has(id) && !history.get(first)?.has(id),
      ),
    );
    for (const c of candidates) {
      used.add(c);
      pairs.push([first, c]);
      if (backtrack()) return true;
      pairs.pop();
      used.delete(c);
    }
    used.delete(first);
    return false;
  };
  return backtrack() ? pairs : null;
}

function fallbackPairings(ids: string[]): [string, string][] {
  const shuffled = shuffle(ids);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) out.push([shuffled[i], shuffled[i + 1]]);
  return out;
}
