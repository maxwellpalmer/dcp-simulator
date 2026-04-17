import { useMemo, useState } from "react";
import type { Grid } from "../../lib/types";
import { api } from "../../lib/api";
import type {
  DistributionMode,
  SessionStateResponse,
} from "../../../shared/session";
import { computeScoreboard } from "../../lib/scoreboard";

interface Props {
  code: string;
  teacherToken: string;
  state: SessionStateResponse;
  grid: Grid;
  refresh: () => void;
}

export function TeacherPanel({ code, teacherToken, state, grid, refresh }: Props) {
  const [voterDist, setVoterDist] = useState<DistributionMode>(state.session.voterDist);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?code=${code}`,
    [code],
  );

  const studentsById = new Map(state.students.map((s) => [s.id, s.name]));
  const round = state.round;
  const { students: scoreboard, rounds: roundRows } = useMemo(
    () => computeScoreboard(grid, state.students, state.allRounds),
    [grid, state.students, state.allRounds],
  );

  const canStart =
    (state.session.status === "lobby" ||
      round?.status === "done" ||
      state.session.status === "results") &&
    state.session.currentRound < state.session.totalRounds &&
    state.students.length >= 2;

  const startRound = async () => {
    setBusy(true); setErr(null);
    try {
      await api.startRound({
        code, teacherToken,
        voterDist,
        voterSeed: Math.floor(Math.random() * 1_000_000),
      });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const forceEnd = async () => {
    setBusy(true); setErr(null);
    try { await api.advance({ code, teacherToken }); refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const endSession = async () => {
    if (!confirm("End session and delete all data? This cannot be undone.")) return;
    setBusy(true); setErr(null);
    try {
      await api.endSession({ code, teacherToken });
      window.location.href = window.location.pathname;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="pb-3 border-b flex flex-wrap items-baseline gap-4">
        <h2 className="text-2xl font-semibold">Teacher dashboard</h2>
        <div className="text-sm flex items-baseline gap-2">
          <span className="text-gray-600">Code:</span>
          <span className="font-mono text-xl font-bold tracking-wider">{code}</span>
          <button onClick={() => copy(code)}
                  className="text-xs text-blue-600 hover:underline">
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Join URL: <a className="text-blue-600 underline break-all" href={joinUrl}>{joinUrl}</a>
        </div>
      </header>

      {/* Session settings summary */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Stat label="Grid" value={`${state.session.gridSize} blocks`} />
        <Stat label="Districts" value={`${state.session.nDistricts} (${state.session.nDistricts * 2} sub)`} />
        <Stat label="Round" value={`${state.session.currentRound} / ${state.session.totalRounds}`} />
        <Stat label="Status" value={round?.status ?? state.session.status} />
        <Stat label="Students" value={state.students.length.toString()} />
      </section>

      {/* Round control */}
      <section className="border rounded p-4 space-y-3 bg-gray-50">
        <h3 className="font-semibold">Round control</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label>Voter distribution next round:
            <select value={voterDist}
                    onChange={(e) => setVoterDist(e.target.value as DistributionMode)}
                    className="ml-2 border rounded px-2 py-1">
              <option value="random">Random (40/60)</option>
            <option value="random5050">Random (50/50)</option>
              <option value="minorityClusteredA">Minority A clustered</option>
              <option value="majorityClusteredA">Majority A clustered</option>
              <option value="minorityClusteredB">Minority B clustered</option>
              <option value="majorityClusteredB">Majority B clustered</option>
            </select>
          </label>
          <button onClick={startRound} disabled={!canStart || busy}
                  className="px-3 py-2 rounded bg-black text-white disabled:bg-gray-400">
            {busy ? "Working..." : state.session.currentRound === 0 ? "Start round 1" : `Start round ${state.session.currentRound + 1}`}
          </button>
          {round && round.status !== "done" && (
            <button onClick={forceEnd} className="px-3 py-2 rounded border text-sm">
              Force end current round
            </button>
          )}
          <button onClick={endSession} className="ml-auto px-3 py-2 rounded border border-red-500 text-red-600 text-sm">
            End session
          </button>
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
      </section>

      {/* Students list + progress */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h3 className="font-semibold mb-1">Students ({state.students.length})</h3>
          {state.students.length === 0 ? (
            <p className="text-sm text-gray-500">No one has joined yet.</p>
          ) : (
            <ul className="text-sm list-disc pl-5">
              {state.students.map((s) => <li key={s.id}>{s.name}</li>)}
            </ul>
          )}
        </div>
        {round && (round.status === "define" || round.status === "combine") && (
          <div className="border rounded p-3">
            <h3 className="font-semibold mb-1">Round {round.round} progress</h3>
            <ul className="text-sm space-y-1">
              {(round.pairings ?? []).flatMap(([a, b]) => [a, b]).map((id) => {
                const done = round.status === "define"
                  ? !!round.defines[id]
                  : !!round.combines[id];
                return (
                  <li key={id} className="flex items-center gap-2">
                    <span className={done ? "text-green-700" : "text-gray-500"}>
                      {done ? "✓" : "…"}
                    </span>
                    {studentsById.get(id)}
                    <span className="text-xs text-gray-400">
                      {round.status === "define" ? "defining" : "combining"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Cumulative scoreboard */}
      {state.session.currentRound > 0 && (
        <section>
          <h3 className="font-semibold mb-2">Cumulative scoreboard</h3>
          <p className="text-xs text-gray-500 mb-2">
            Each student scored on the A seats in the map they <em>drew</em>,
            after their partner (Party B) combined it adversarially.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-1">#</th>
                  <th className="py-1">Student</th>
                  <th className="py-1 text-right">Rounds</th>
                  <th className="py-1 text-right">A seats</th>
                  <th className="py-1 text-right">of</th>
                </tr>
              </thead>
              <tbody>
                {scoreboard.map((r, i) => (
                  <tr key={r.studentId} className="border-b">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1">{r.name}</td>
                    <td className="py-1 text-right">{r.roundsScored}</td>
                    <td className="py-1 text-right font-medium">{r.totalSeatsA}</td>
                    <td className="py-1 text-right text-gray-500">{r.totalDistricts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per-round results */}
      {roundRows.length > 0 && (
        <section>
          <h3 className="font-semibold mb-2">Round history</h3>
          <div className="space-y-3">
            {roundRows.map((r) => (
              <details key={r.round} open={r.status !== "done" || r.round === roundRows.length}
                       className="border rounded p-3">
                <summary className="cursor-pointer font-medium">
                  Round {r.round} · {r.voterDist} · {r.status}{" "}
                  ({r.completed}/{r.participants})
                </summary>
                {r.results.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-2">
                      <thead>
                        <tr className="text-left text-gray-600 border-b">
                          <th className="py-1">Definer (A)</th>
                          <th className="py-1">Combiner (B)</th>
                          <th className="py-1 text-right">A seats</th>
                          <th className="py-1 text-right">of</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.results.map((o, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-1">{o.definer}</td>
                            <td className="py-1">{o.combiner}</td>
                            <td className="py-1 text-right font-medium">{o.seatsA}</td>
                            <td className="py-1 text-right text-gray-500">{o.nDistricts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded px-3 py-2 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
