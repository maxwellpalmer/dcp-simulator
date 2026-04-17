import { useMemo } from "react";
import type { Grid } from "../../lib/types";
import { computeScoreboard } from "../../lib/scoreboard";
import type { SessionStateResponse } from "../../../shared/session";

interface Props {
  grid: Grid;
  state: SessionStateResponse;
  student: { id: string; name: string };
}

export function SessionSummary({ grid, state, student }: Props) {
  const { students: scoreboard } = useMemo(
    () => computeScoreboard(grid, state.students, state.allRounds),
    [grid, state.students, state.allRounds],
  );

  const me = scoreboard.find((r) => r.studentId === student.id);
  const rank = me ? scoreboard.findIndex((r) => r.studentId === student.id) + 1 : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h2 className="text-2xl font-semibold">Session complete</h2>
      <p className="text-sm text-gray-600">
        You were scored on the maps <span className="font-medium">you drew</span> as
        Party A, after each partner combined them to maximize B. Higher is better.
      </p>
      {me && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-1">
          <div className="text-sm text-gray-600">Your total over {me.roundsScored} round{me.roundsScored === 1 ? "" : "s"}:</div>
          <div className="flex gap-6 text-lg items-baseline">
            <span>
              <span className="font-semibold text-2xl">{fmtSeats(me.totalSeatsA)}</span>
              <span className="text-gray-500"> A seats</span>
            </span>
            <span className="text-sm text-gray-600">
              {me.wins}W · {me.ties}T · {me.losses}L
            </span>
          </div>
          {rank !== null && (
            <div className="text-sm text-gray-600">
              Rank #{rank} of {scoreboard.length}.
            </div>
          )}
        </div>
      )}

      <section>
        <h3 className="font-semibold mb-2">Final scoreboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-1">#</th>
                <th className="py-1">Student</th>
                <th className="py-1 text-right">Rounds</th>
                <th className="py-1 text-right">A seats</th>
                <th className="py-1 text-right">W</th>
                <th className="py-1 text-right">T</th>
                <th className="py-1 text-right">L</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.map((r, i) => (
                <tr key={r.studentId}
                    className={`border-b ${r.studentId === student.id ? "bg-blue-50 font-medium" : ""}`}>
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">{r.name}</td>
                  <td className="py-1 text-right">{r.roundsScored}</td>
                  <td className="py-1 text-right">{fmtSeats(r.totalSeatsA)}</td>
                  <td className="py-1 text-right text-gray-500">{r.wins}</td>
                  <td className="py-1 text-right text-gray-500">{r.ties}</td>
                  <td className="py-1 text-right text-gray-500">{r.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-gray-500">
        Thanks for playing. The instructor can review per-round details on the dashboard.
      </p>
    </div>
  );
}

function fmtSeats(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(1);
}
