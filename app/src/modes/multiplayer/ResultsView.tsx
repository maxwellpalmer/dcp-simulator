import { useMemo } from "react";
import type { Grid } from "../../lib/types";
import { generateVoters } from "../../lib/voters";
import { assignmentFromFlat } from "../../lib/serialize";
import { computeFinalStats } from "../../lib/combine";
import { seatCount } from "../../lib/stats";
import { StatsTable } from "../../components/StatsTable";
import type { SessionStateResponse } from "../../../shared/session";

interface Props {
  grid: Grid;
  state: SessionStateResponse;
  student: { id: string; name: string };
}

export function ResultsView({ grid, state, student }: Props) {
  const round = state.round!;
  const voters = useMemo(
    () => generateVoters(grid, { mode: round.voterDist, seed: round.voterSeed }),
    [grid, round.voterDist, round.voterSeed],
  );
  const studentsById = new Map(state.students.map((s) => [s.id, s.name]));

  const pairs = round.pairings ?? [];

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <h2 className="text-xl font-semibold">
        Round {round.round} results
      </h2>
      {pairs.map(([a, b], i) => {
        const rows: React.ReactNode[] = [];
        for (const who of [a, b]) {
          const combine = round.combines[who];
          if (!combine) continue;
          const definerAssignment = assignmentFromFlat(grid, round.defines[combine.definerId] ?? []);
          const stats = computeFinalStats(grid, definerAssignment, combine.pairing, voters);
          const seats = seatCount(stats);
          rows.push(
            <div key={who} className={`border rounded p-3 ${who === student.id ? "ring-2 ring-blue-500" : ""}`}>
              <div className="text-sm font-medium mb-1">
                {studentsById.get(who) ?? who} combined {studentsById.get(combine.definerId) ?? combine.definerId}'s map
              </div>
              <div className="text-sm mb-2">Seats: A {seats.A} · B {seats.B}{seats.ties > 0 ? ` · ties ${seats.ties}` : ""}</div>
              <StatsTable stats={stats} expectedPop={grid.blocks.length / state.session.nDistricts} />
            </div>
          );
        }
        return (
          <div key={i}>
            <h3 className="font-semibold mb-2">
              Pair {i + 1}: {studentsById.get(a)} ↔ {studentsById.get(b)}
            </h3>
            <div className="grid md:grid-cols-2 gap-3">{rows}</div>
          </div>
        );
      })}
      <p className="text-sm text-gray-500">
        Waiting for teacher to start the next round...
      </p>
    </div>
  );
}
