import { useCallback, useEffect, useMemo, useState } from "react";
import type { Grid } from "../lib/types";
import grid70 from "../assets/grid_70.json";
import grid140 from "../assets/grid_140.json";
import { api } from "../lib/api";
import {
  getStudent,
  getTeacherToken,
  saveStudent,
  saveTeacherToken,
} from "../lib/sessionStorage";
import { useSession } from "../lib/useSession";
import { DefineStage } from "./multiplayer/DefineStage";
import { CombineStage } from "./multiplayer/CombineStage";
import { ResultsView } from "./multiplayer/ResultsView";
import { TeacherPanel } from "./multiplayer/TeacherPanel";
import type { DistributionMode } from "../../shared/session";

const GRIDS: Record<string, Grid> = {
  "70": grid70 as unknown as Grid,
  "140": grid140 as unknown as Grid,
};

function useQuery() {
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const onPop = () => setQ(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return q;
}

function setQuery(updates: Record<string, string | null>) {
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  }
  window.history.pushState({}, "", u);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function MultiplayerMode() {
  const q = useQuery();
  const code = q.get("code");
  const roleParam = q.get("role");
  const isTeacher = roleParam === "teacher";

  const [student, setStudent] = useState(() =>
    code ? getStudent(code) : null,
  );
  const [teacherToken, setTeacherTokenState] = useState(() =>
    code ? getTeacherToken(code) : null,
  );

  const { state, error, refresh } = useSession({
    code,
    studentId: student?.id ?? null,
  });

  if (!code) {
    return (
      <Landing
        onCreated={(c, token) => {
          saveTeacherToken(c, token);
          setTeacherTokenState(token);
          setQuery({ code: c, role: "teacher" });
        }}
        onJoined={(c, id, name) => {
          saveStudent(c, id, name);
          setStudent({ id, name });
          setQuery({ code: c });
        }}
      />
    );
  }

  // Have a code. If teacher, show teacher dashboard; else require student join.
  if (isTeacher) {
    return (
      <TeacherView
        code={code}
        teacherToken={teacherToken}
        onToken={(t) => {
          saveTeacherToken(code, t);
          setTeacherTokenState(t);
        }}
        state={state}
        refresh={refresh}
        error={error}
      />
    );
  }

  if (!student) {
    return <JoinForm code={code} onJoined={(id, name) => {
      saveStudent(code, id, name);
      setStudent({ id, name });
    }} />;
  }

  return (
    <StudentView
      code={code}
      student={student}
      state={state}
      refresh={refresh}
      error={error}
    />
  );
}

// ---- Landing: pick role ----
function Landing({
  onCreated,
  onJoined,
}: {
  onCreated: (code: string, token: string) => void;
  onJoined: (code: string, id: string, name: string) => void;
}) {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-8">
      <h2 className="text-2xl font-semibold">Classroom session</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <CreateForm onCreated={onCreated} />
        <JoinByCode onJoined={onJoined} />
      </div>
    </div>
  );
}

function CreateForm({
  onCreated,
}: { onCreated: (code: string, token: string) => void }) {
  const [gridSize, setGridSize] = useState<"70" | "140">("70");
  const grid = GRIDS[gridSize];
  const dcpOptions = grid.districtOptions.filter((n) =>
    grid.districtOptions.includes(n * 2),
  );
  const [nDistricts, setNDistricts] = useState(dcpOptions[0]);
  const [totalRounds, setTotalRounds] = useState(3);
  const [voterDist, setVoterDist] = useState<DistributionMode>("random");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!dcpOptions.includes(nDistricts)) setNDistricts(dcpOptions[0]);
  }, [gridSize]);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.createSession({
        gridSize, nDistricts, totalRounds,
        voterDist, voterSeed: Math.floor(Math.random() * 1_000_000),
      });
      onCreated(r.code, r.teacherToken);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="border rounded p-4 space-y-2">
      <h3 className="font-semibold">Create session (teacher)</h3>
      <label className="block text-sm">Grid
        <select className="ml-2 border rounded px-2 py-1" value={gridSize}
                onChange={(e) => setGridSize(e.target.value as "70" | "140")}>
          <option value="70">70 blocks</option>
          <option value="140">140 blocks</option>
        </select>
      </label>
      <label className="block text-sm">Final districts
        <select className="ml-2 border rounded px-2 py-1" value={nDistricts}
                onChange={(e) => setNDistricts(Number(e.target.value))}>
          {dcpOptions.map((n) => (
            <option key={n} value={n}>{n} ({n * 2} sub)</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">Rounds
        <input type="number" min={1} max={10} value={totalRounds}
               onChange={(e) => setTotalRounds(Number(e.target.value))}
               className="ml-2 border rounded px-2 py-1 w-16" />
      </label>
      <label className="block text-sm">Default voter distribution
        <select className="ml-2 border rounded px-2 py-1" value={voterDist}
                onChange={(e) => setVoterDist(e.target.value as DistributionMode)}>
          <option value="random">Random</option>
          <option value="minorityClusteredA">Minority A clustered</option>
          <option value="majorityClusteredA">Majority A clustered</option>
          <option value="minorityClusteredB">Minority B clustered</option>
          <option value="majorityClusteredB">Majority B clustered</option>
        </select>
      </label>
      <button onClick={create} disabled={busy}
              className="w-full mt-2 px-3 py-2 rounded bg-black text-white text-sm">
        {busy ? "Creating..." : "Create session"}
      </button>
      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  );
}

function JoinByCode({
  onJoined,
}: { onJoined: (code: string, id: string, name: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const join = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.joinSession({ code: code.toUpperCase(), name });
      onJoined(code.toUpperCase(), r.studentId, name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  return (
    <div className="border rounded p-4 space-y-2">
      <h3 className="font-semibold">Join session (student)</h3>
      <label className="block text-sm">Session code
        <input value={code} onChange={(e) => setCode(e.target.value)}
               placeholder="ABCDE"
               className="ml-2 border rounded px-2 py-1 uppercase w-28" />
      </label>
      <label className="block text-sm">Your name
        <input value={name} onChange={(e) => setName(e.target.value)}
               className="ml-2 border rounded px-2 py-1 w-40" />
      </label>
      <button onClick={join} disabled={busy || !code || !name}
              className="w-full mt-2 px-3 py-2 rounded bg-black text-white text-sm">
        {busy ? "Joining..." : "Join"}
      </button>
      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  );
}

function JoinForm({
  code,
  onJoined,
}: { code: string; onJoined: (id: string, name: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const join = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.joinSession({ code, name });
      onJoined(r.studentId, name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  return (
    <div className="p-6 max-w-sm mx-auto space-y-2">
      <h2 className="text-xl font-semibold">Join session {code}</h2>
      <label className="block text-sm">Your name
        <input value={name} onChange={(e) => setName(e.target.value)}
               className="ml-2 border rounded px-2 py-1" autoFocus />
      </label>
      <button onClick={join} disabled={busy || !name}
              className="w-full mt-2 px-3 py-2 rounded bg-black text-white text-sm">
        {busy ? "Joining..." : "Join"}
      </button>
      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  );
}

// ---- Teacher view ----
function TeacherView({
  code,
  teacherToken,
  onToken,
  state,
  refresh,
  error,
}: {
  code: string;
  teacherToken: string | null;
  onToken: (t: string) => void;
  state: Parameters<typeof TeacherPanel>[0]["state"];
  refresh: () => void;
  error: string | null;
}) {
  const [tokenInput, setTokenInput] = useState("");
  if (!teacherToken) {
    return (
      <div className="p-6 max-w-sm mx-auto space-y-2">
        <h2 className="font-semibold">Enter teacher token for {code}</h2>
        <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
               className="border rounded px-2 py-1 w-full font-mono text-xs" />
        <button onClick={() => onToken(tokenInput)}
                className="px-3 py-1 rounded bg-black text-white text-sm">Use token</button>
      </div>
    );
  }
  if (!state) {
    return <div className="p-6">Loading session {code}... {error && <span className="text-red-600">{error}</span>}</div>;
  }
  const grid = GRIDS[state.session.gridSize];
  return (
    <TeacherPanel
      code={code}
      teacherToken={teacherToken}
      state={state}
      grid={grid}
      refresh={refresh}
    />
  );
}

// ---- Student view ----
function StudentView({
  code,
  student,
  state,
  refresh,
  error,
}: {
  code: string;
  student: { id: string; name: string };
  state: ReturnType<typeof useSession>["state"];
  refresh: () => void;
  error: string | null;
}) {
  if (!state) return <div className="p-6">Loading session {code}... {error && <span className="text-red-600">{error}</span>}</div>;
  const grid = GRIDS[state.session.gridSize];
  const round = state.round;

  return (
    <div className="p-4 h-full flex flex-col">
      <header className="flex items-center gap-4 pb-3 border-b text-sm">
        <span className="font-semibold">Session {code}</span>
        <span>You: {student.name}</span>
        <span>Round {state.session.currentRound}/{state.session.totalRounds}</span>
        <span className="text-gray-500">{round?.status ?? state.session.status}</span>
        {error && <span className="text-red-600 ml-auto">{error}</span>}
      </header>

      <main className="flex-1 min-h-0">
        {state.session.status === "lobby" && (
          <Lobby state={state} />
        )}
        {round && round.status === "define" && (
          <DefineStage grid={grid} state={state} student={student}
                       onSubmitted={refresh} />
        )}
        {round && round.status === "combine" && (
          state.combineTarget ? (
            <CombineStage grid={grid} state={state} student={student}
                          onSubmitted={refresh} />
          ) : (
            <Waiting message="Waiting for your partner to finish defining..." />
          )
        )}
        {round && round.status === "done" && (
          <ResultsView grid={grid} state={state} student={student} />
        )}
      </main>
    </div>
  );
}

function Lobby({ state }: { state: ReturnType<typeof useSession>["state"] }) {
  if (!state) return null;
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Waiting for the round to start</h2>
      <p className="text-sm text-gray-600 mb-4">
        {state.students.length} student{state.students.length === 1 ? "" : "s"} joined.
      </p>
      <ul className="list-disc pl-6 text-sm">
        {state.students.map((s) => <li key={s.id}>{s.name}</li>)}
      </ul>
    </div>
  );
}

function Waiting({ message }: { message: string }) {
  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-pulse text-lg">{message}</div>
      </div>
    </div>
  );
}
