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
      {me && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-1">
          <div className="text-sm text-gray-600">Your total over {me.roundsPlayed} round{me.roundsPlayed === 1 ? "" : "s"}:</div>
          <div className="flex gap-6 text-lg">
            <span><span className="font-semibold">{me.totalSeatsA}</span> seats A</span>
            <span><span className="font-semibold">{me.totalSeatsB}</span> seats B</span>
            <span className="text-gray-500">wins: A {me.wins.A} · B {me.wins.B} · ties {me.wins.ties}</span>
          </div>
          {rank !== null && (
            <div className="text-sm text-gray-600">
              Rank #{rank} of {scoreboard.length} by total seats.
            </div>
          )}
        </div>
      )}

      <section>
        <h3 className="font-semibold mb-2">Final scoreboard</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-1">#</th>
              <th className="py-1">Student</th>
              <th className="py-1 text-right">Rounds</th>
              <th className="py-1 text-right">Seats A</th>
              <th className="py-1 text-right">Seats B</th>
              <th className="py-1 text-right">Wins A</th>
              <th className="py-1 text-right">Wins B</th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map((r, i) => (
              <tr key={r.studentId}
                  className={`border-b ${r.studentId === student.id ? "bg-blue-50 font-medium" : ""}`}>
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{r.name}</td>
                <td className="py-1 text-right">{r.roundsPlayed}</td>
                <td className="py-1 text-right">{r.totalSeatsA}</td>
                <td className="py-1 text-right">{r.totalSeatsB}</td>
                <td className="py-1 text-right">{r.wins.A}</td>
                <td className="py-1 text-right">{r.wins.B}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-gray-500">
        Thanks for playing. The instructor can review per-round details on the dashboard.
      </p>
    </div>
  );
}
