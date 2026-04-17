import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// E2E test for the full multiplayer classroom flow.
// Uses the teacher dashboard UI + direct API calls for student actions
// (faster than opening separate browser contexts for each student).

const GRID = "70";
const N_DISTRICTS = 7;
const N_SUB = 14;

interface SessionInfo {
  code: string;
  teacherToken: string;
}

function uniqueCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "TEST";
  for (let i = 0; i < 4; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

async function createSession(request: APIRequestContext): Promise<SessionInfo> {
  const res = await request.post("/api/session/create", {
    data: {
      code: uniqueCode(),
      gridSize: GRID,
      nDistricts: N_DISTRICTS,
      totalRounds: 2,
      voterDist: "random",
      voterSeed: 42,
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function joinStudent(
  request: APIRequestContext,
  code: string,
  name: string,
): Promise<string> {
  const res = await request.post("/api/session/join", {
    data: { code, name },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.studentId;
}

async function getState(request: APIRequestContext, code: string, studentId?: string) {
  const q = new URLSearchParams({ code });
  if (studentId) q.set("studentId", studentId);
  const res = await request.get(`/api/session/state?${q}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function submitDefine(
  request: APIRequestContext,
  code: string,
  studentId: string,
  plan: number[],
) {
  const res = await request.post("/api/session/submit-define", {
    data: { code, studentId, assignment: plan },
  });
  expect(res.ok()).toBeTruthy();
}

async function submitCombine(
  request: APIRequestContext,
  code: string,
  studentId: string,
  pairing: [number, number][],
) {
  const res = await request.post("/api/session/submit-combine", {
    data: { code, studentId, pairing },
  });
  expect(res.ok()).toBeTruthy();
}

// Load grid data directly from the JSON assets (same as the dry-run script).
import grid70 from "../src/assets/grid_70.json" with { type: "json" };
const grid = grid70 as any;

function buildSubAdjacency(plan: number[]): Map<number, Set<number>> {
  const blockSub = new Map<number, number>();
  grid.blocks.forEach((b: any, i: number) => blockSub.set(b.id, plan[i]));
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

function findPairing(plan: number[]): [number, number][] {
  const adj = buildSubAdjacency(plan);
  const subs = Array.from(new Set(plan)).sort((a, b) => a - b);
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  const search = (): boolean => {
    const first = subs.find((s) => !used.has(s));
    if (first === undefined) return true;
    used.add(first);
    for (const n of adj.get(first) ?? []) {
      if (used.has(n)) continue;
      used.add(n);
      pairs.push([first, n]);
      if (search()) return true;
      pairs.pop();
      used.delete(n);
    }
    used.delete(first);
    return false;
  };
  search();
  return pairs;
}

test.describe("Multiplayer classroom flow", () => {
  let session: SessionInfo;
  let aliceId: string;
  let bobId: string;
  const plan14 = grid.randomPlans["14"][0] as number[];
  const pairing = findPairing(plan14);

  test.beforeAll(async ({ request }) => {
    session = await createSession(request);
    aliceId = await joinStudent(request, session.code, "Alice");
    bobId = await joinStudent(request, session.code, "Bob");
  });

  async function teacherLogin(page: Page) {
    await page.goto(`/?code=${session.code}&role=teacher`);
    // Wait for loading to complete (initial poll may take a moment)
    const dashboard = page.getByText("Teacher dashboard");
    const tokenField = page.locator("input[placeholder='teacher token']");
    // Poll until either the dashboard or login form is visible
    for (let i = 0; i < 20; i++) {
      if (await dashboard.isVisible().catch(() => false)) break;
      if (await tokenField.isVisible().catch(() => false)) {
        await tokenField.fill(session.teacherToken);
        await page.getByRole("button", { name: /log in/i }).click();
        break;
      }
      await page.waitForTimeout(500);
    }
    await expect(dashboard).toBeVisible({ timeout: 15000 });
  }

  test("teacher dashboard shows session code and students", async ({ page }) => {
    await teacherLogin(page);
    await expect(page.getByText(session.code, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test("full round flow: define → combine → done", async ({ page, request }) => {
    await teacherLogin(page);
    await page.getByRole("button", { name: /start round/i }).click();
    // Verify round 1 started
    await expect(page.getByRole("heading", { name: /round 1/i })).toBeVisible();

    // Both students submit define via API
    await submitDefine(request, session.code, aliceId, plan14);
    await submitDefine(request, session.code, bobId, plan14);

    // Wait for state to advance to combine
    let state: any;
    for (let i = 0; i < 15; i++) {
      state = await getState(request, session.code);
      if (state.round?.status === "combine") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(state.round.status).toBe("combine");

    // Both students submit combine via API
    await submitCombine(request, session.code, aliceId, pairing);
    await submitCombine(request, session.code, bobId, pairing);

    for (let i = 0; i < 15; i++) {
      state = await getState(request, session.code);
      if (state.round?.status === "done") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(state.round.status).toBe("done");

    // Teacher page should show round results after refresh
    await teacherLogin(page);
    await expect(page.getByText("Alice").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Cumulative scoreboard")).toBeVisible({ timeout: 10000 });
  });

  test("student define UI shows role banner and submit flow", async ({ page, request }) => {
    // Start round 2 via API
    await request.post("/api/session/start-round", {
      data: {
        code: session.code,
        teacherToken: session.teacherToken,
        voterDist: "minorityClusteredA",
        voterSeed: 999,
      },
    });

    // Open as Alice — manually set localStorage
    await page.goto(`/?code=${session.code}`);
    await page.evaluate(
      ([code, id]) => {
        localStorage.setItem(`dcp:session:${code}:studentId`, id);
        localStorage.setItem(`dcp:session:${code}:name`, "Alice");
      },
      [session.code, aliceId],
    );
    await page.reload();

    // Should see define UI with role banner
    await expect(page.getByText("You are Party A")).toBeVisible({ timeout: 10000 });
    // Click Random plan
    await page.getByRole("button", { name: "Random plan" }).click();
    // Click Submit
    await page.getByRole("button", { name: /submit for combine/i }).click();
    // Should see "Submitted" waiting message
    await expect(page.getByText(/submitted/i)).toBeVisible({ timeout: 5000 });
  });

  test.afterAll(async ({ request }) => {
    // Cleanup
    await request.post("/api/session/end", {
      data: { code: session.code, teacherToken: session.teacherToken },
    });
  });
});
