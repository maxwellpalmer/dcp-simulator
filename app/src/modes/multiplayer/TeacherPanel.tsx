import { useMemo, useState } from "react";
import type { Grid } from "../../lib/types";
import { api } from "../../lib/api";
import type {
  DistributionMode,
  SessionStateResponse,
} from "../../../shared/session";
import { generateVoters } from "../../lib/voters";
import { assignmentFromFlat } from "../../lib/serialize";
import { computeFinalStats } from "../../lib/combine";
import { seatCount } from "../../lib/stats";

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

  const joinUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?code=${code}`,
    [code],
  );

  const studentsById = new Map(state.students.map((s) => [s.id, s.name]));

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

  const round = state.round;
  const canStart = (state.session.status === "lobby"
                    || round?.status === "done"
                    || state.session.status === "results")
                  && state.session.currentRound < state.session.totalRounds
                  && state.students.length >= 2;

  return (
    <div className="p-4 space-y-4">
      <header className="pb-2 border-b">
        <h2 className="text-xl font-semibold">Teacher dashboard</h2>
        <div className="text-sm text-gray-600">
          Session code: <span className="font-mono font-semibold">{code}</span> ·
          Join URL: <a className="text-blue-600 underline break-all" href={joinUrl}>{joinUrl}</a>
        </div>
        <div className="text-xs text-gray-500">Teacher token: <span className="font-mono">{teacherToken}</span> (bookmark to stay logged in)</div>
      </header>

      <section>
        <h3 className="font-semibold mb-1">Students ({state.students.length})</h3>
        <ul className="text-sm list-disc pl-6">
          {state.students.map((s) => <li key={s.id}>{s.name}</li>)}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Round control</h3>
        <div className="text-sm">
          Round {state.session.currentRound}/{state.session.totalRounds} · status: {round?.status ?? state.session.status}
        </div>
        <label className="block text-sm">Voter distribution for next round
          <select value={voterDist} onChange={(e) => setVoterDist(e.target.value as DistributionMode)}
                  className="ml-2 border rounded px-2 py-1">
            <option value="random">Random</option>
            <option value="minorityClusteredA">Minority A clustered</option>
            <option value="majorityClusteredA">Majority A clustered</option>
            <option value="minorityClusteredB">Minority B clustered</option>
            <option value="majorityClusteredB">Majority B clustered</option>
          </select>
        </label>
        <button onClick={startRound} disabled={!canStart || busy}
                className="px-3 py-2 rounded bg-black text-white text-sm">
          {busy ? "Working..." : state.session.currentRound === 0 ? "Start round 1" : `Start round ${state.session.currentRound + 1}`}
        </button>
        <button onClick={async () => {
          setBusy(true);
          try { await api.advance({ code, teacherToken }); refresh(); }
          catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
          finally { setBusy(false); }
        }} className="ml-2 px-3 py-2 rounded border text-sm">
          Force end current round
        </button>
        {err && <div className="text-red-600 text-sm">{err}</div>}
      </section>

      {round && round.status === "define" && (
        <section>
          <h3 className="font-semibold mb-1">Progress</h3>
          <ul className="text-sm">
            {(round.pairings ?? []).flatMap(([a, b]) => [a, b]).map((id) => (
              <li key={id}>
                {studentsById.get(id)} — {round.defines[id] ? "defined ✓" : "defining..."}
              </li>
            ))}
          </ul>
        </section>
      )}

      {round && round.status === "combine" && (
        <section>
          <h3 className="font-semibold mb-1">Progress</h3>
          <ul className="text-sm">
            {(round.pairings ?? []).flatMap(([a, b]) => [a, b]).map((id) => (
              <li key={id}>
                {studentsById.get(id)} — {round.combines[id] ? "combined ✓" : "combining..."}
              </li>
            ))}
          </ul>
        </section>
      )}

      {round && round.status === "done" && (
        <RoundResultsTeacher round={round} grid={grid} studentsById={studentsById} state={state} />
      )}
    </div>
  );
}

function RoundResultsTeacher({
  round,
  grid,
  studentsById,
  state,
}: {
  round: NonNullable<SessionStateResponse["round"]>;
  grid: Grid;
  studentsById: Map<string, string>;
  state: SessionStateResponse;
}) {
  const voters = useMemo(
    () => generateVoters(grid, { mode: round.voterDist, seed: round.voterSeed }),
    [grid, round.voterDist, round.voterSeed],
  );
  return (
    <section>
      <h3 className="font-semibold mb-1">Round {round.round} results</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-1">Student</th>
            <th className="py-1">Combined map of</th>
            <th className="py-1">Seats A</th>
            <th className="py-1">Seats B</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(round.combines).map(([who, c]) => {
            const definerAssign = assignmentFromFlat(grid, round.defines[c.definerId] ?? []);
            const stats = computeFinalStats(grid, definerAssign, c.pairing, voters);
            const seats = seatCount(stats);
            return (
              <tr key={who} className="border-t">
                <td className="py-1">{studentsById.get(who) ?? who}</td>
                <td className="py-1">{studentsById.get(c.definerId) ?? c.definerId}</td>
                <td className="py-1">{seats.A}</td>
                <td className="py-1">{seats.B}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">
        {state.session.currentRound >= state.session.totalRounds
          ? "Last round done. You can end the session."
          : "Pick next round's distribution above and click Start round."}
      </p>
    </section>
  );
}
