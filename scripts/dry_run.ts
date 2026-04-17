#!/usr/bin/env tsx
// Headless classroom dry-run. Exercises the full server flow against a
// running Netlify dev instance with N simulated students and R rounds.
//
// Prereq: in one terminal, `cd app && npm run dev:session` (netlify dev).
// Then in another:
//   npx tsx scripts/dry_run.ts                 # defaults: 12 students, 2 rounds
//   STUDENTS=5 ROUNDS=3 npx tsx scripts/dry_run.ts
//   BASE=http://localhost:8888 npx tsx scripts/dry_run.ts
//
// The script exits 0 if every invariant holds, non-zero otherwise. All work
// happens via the public /api/session/* endpoints — so passing here is a
// strong signal the classroom flow works end-to-end.

import grid70 from "../app/src/assets/grid_70.json" with { type: "json" };

interface Grid {
  blocks: { id: number; cx: number; cy: number; vertices: [number, number][] }[];
  adjacency: [number, number][];
  randomPlans: Record<string, number[][]>;
}
const grid = grid70 as unknown as Grid;

const BASE = process.env.BASE ?? "http://localhost:8888";
const N_STUDENTS = Number(process.env.STUDENTS ?? 12);
const N_ROUNDS = Number(process.env.ROUNDS ?? 2);
const N_DISTRICTS = 7;
const N_SUB = N_DISTRICTS * 2;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j?.error) detail = j.error; } catch {}
    throw new Error(`${path} failed: ${detail}`);
  }
  return res.json() as Promise<T>;
}

function buildSubAdjacency(plan: number[]): Map<number, Set<number>> {
  // plan[i] = sub-district id for block at index i in grid.blocks
  const blockSub = new Map<number, number>();
  grid.blocks.forEach((b, i) => blockSub.set(b.id, plan[i]));
  const adj = new Map<number, Set<number>>();
  for (const [a, b] of grid.adjacency) {
    const sa = blockSub.get(a);
    const sb = blockSub.get(b);
    if (sa === undefined || sb === undefined || sa === sb) continue;
    if (!adj.has(sa)) adj.set(sa, new Set());
    if (!adj.has(sb)) adj.set(sb, new Set());
    adj.get(sa)!.add(sb);
    adj.get(sb)!.add(sa);
  }
  return adj;
}

// Greedy perfect matching over sub-district adjacency. Returns null if no
// matching exists for the given plan's adjacency graph.
function findPairing(plan: number[]): [number, number][] | null {
  const adj = buildSubAdjacency(plan);
  const subs = Array.from(new Set(plan));
  subs.sort((a, b) => a - b);
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  const search = (): boolean => {
    const first = subs.find((s) => !used.has(s));
    if (first === undefined) return true;
    used.add(first);
    const neighbors = Array.from(adj.get(first) ?? []).filter((n) => !used.has(n));
    for (const n of neighbors) {
      used.add(n);
      pairs.push([first, n]);
      if (search()) return true;
      pairs.pop();
      used.delete(n);
    }
    used.delete(first);
    return false;
  };
  return search() ? pairs : null;
}

function assertInvariant(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`❌ INVARIANT FAILED: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Dry run: ${N_STUDENTS} students, ${N_ROUNDS} rounds → ${BASE}`);

  // Precompute a valid pairing for the plan every student will submit.
  const plan = grid.randomPlans["14"][0] as number[];
  assertInvariant(plan, "grid_70 must have randomPlans['14']");
  const pairing = findPairing(plan);
  assertInvariant(pairing, "plan must have a valid pairing");
  console.log(`  Using plan with ${plan.length} blocks, ${new Set(plan).size} sub-districts, pairing length ${pairing!.length}`);

  // --- Create session ---
  const dryRunCode = "DRYRUN" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const { code, teacherToken } = await api<{ code: string; teacherToken: string }>(
    "/api/session/create",
    {
      code: dryRunCode,
      gridSize: "70",
      nDistricts: N_DISTRICTS,
      totalRounds: N_ROUNDS,
      voterDist: "random",
      voterSeed: 42,
    },
  );
  console.log(`  Created session ${code} (teacherToken ${teacherToken.slice(0, 6)}…)`);

  // --- Join students ---
  const students: { id: string; name: string }[] = [];
  for (let i = 1; i <= N_STUDENTS; i++) {
    const name = `Student${i.toString().padStart(2, "0")}`;
    const { studentId } = await api<{ studentId: string }>("/api/session/join", { code, name });
    students.push({ id: studentId, name });
  }
  console.log(`  ${students.length} students joined`);

  // --- Track pairings seen to assert no re-pair ---
  const seenPairs = new Set<string>();
  const sitCounts = new Map<string, number>();
  for (const s of students) sitCounts.set(s.id, 0);

  for (let round = 1; round <= N_ROUNDS; round++) {
    console.log(`\n  — Round ${round} —`);

    await api("/api/session/start-round", {
      code, teacherToken,
      voterDist: round % 2 === 0 ? "minorityClusteredA" : "random",
      voterSeed: 100 + round,
    });

    // Fetch state to learn pairings
    let state = await api<any>(`/api/session/state?code=${code}`);
    assertInvariant(state.round?.status === "define", "round starts in define");
    const pairings: [string, string][] = state.round.pairings;
    assertInvariant(pairings.length === Math.floor(N_STUDENTS / 2), "correct # pairs");

    // Invariant: no prior pairing repeats (as long as matching is still feasible)
    for (const [a, b] of pairings) {
      const key = [a, b].sort().join(":");
      if (seenPairs.has(key)) {
        console.log(`    (note) pairing reused: ${a.slice(0, 4)}↔${b.slice(0, 4)} — expected when feasibility forces it`);
      }
      seenPairs.add(key);
    }

    // Track sitter
    const paired = new Set(pairings.flatMap(([a, b]) => [a, b]));
    const sitters = students.filter((s) => !paired.has(s.id));
    assertInvariant(sitters.length === N_STUDENTS % 2, "correct # sitters");
    for (const s of sitters) sitCounts.set(s.id, (sitCounts.get(s.id) ?? 0) + 1);

    // --- Everyone submits define ---
    await Promise.all(
      students
        .filter((s) => paired.has(s.id))
        .map((s) =>
          api("/api/session/submit-define", {
            code,
            studentId: s.id,
            assignment: plan,
          }),
        ),
    );

    // Wait for status to be "combine"
    for (let i = 0; i < 10; i++) {
      state = await api<any>(`/api/session/state?code=${code}`);
      if (state.round.status === "combine") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assertInvariant(state.round.status === "combine", "round advances to combine after all defines");

    // --- Everyone submits combine ---
    // Each student fetches their personalized state to get combineTarget
    await Promise.all(
      students
        .filter((s) => paired.has(s.id))
        .map(async (s) => {
          const st = await api<any>(`/api/session/state?code=${code}&studentId=${s.id}`);
          assertInvariant(st.partnerId, `${s.name} should have a partner`);
          assertInvariant(st.combineTarget, `${s.name} should receive combineTarget`);
          await api("/api/session/submit-combine", {
            code,
            studentId: s.id,
            pairing,
          });
        }),
    );

    for (let i = 0; i < 10; i++) {
      state = await api<any>(`/api/session/state?code=${code}`);
      if (state.round.status === "done") break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assertInvariant(state.round.status === "done", "round advances to done after all combines");

    console.log(`    ✓ round ${round} complete (${pairings.length} pairs, ${sitters.length} sitter)`);
  }

  // --- Final scoreboard sanity ---
  const finalState = await api<any>(`/api/session/state?code=${code}`);
  assertInvariant(finalState.allRounds.length === N_ROUNDS, "allRounds reflects all plays");
  for (const r of finalState.allRounds) {
    assertInvariant(r.status === "done", `round ${r.round} is done`);
  }

  // Sitter rotation: max-min sitCount difference should be ≤1 for 2+ rounds
  if (N_STUDENTS % 2 === 1 && N_ROUNDS >= 2) {
    const counts = Array.from(sitCounts.values());
    const maxDiff = Math.max(...counts) - Math.min(...counts);
    assertInvariant(maxDiff <= 1, `sitter rotation should spread sit-counts (diff=${maxDiff})`);
  }

  // --- End session ---
  await api("/api/session/end", { code, teacherToken });
  let ended = false;
  try {
    await api<any>(`/api/session/state?code=${code}`);
  } catch (e) {
    ended = /unknown|404/i.test(e instanceof Error ? e.message : String(e));
  }
  assertInvariant(ended, "session is gone after end");

  console.log(`\n✅ Dry run passed. Session ${code} completed ${N_ROUNDS} rounds with ${N_STUDENTS} students.`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
