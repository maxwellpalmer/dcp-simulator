import { useMemo } from "react";
import type { Grid } from "../../lib/types";
import { generateVoters } from "../../lib/voters";
import { assignmentFromFlat } from "../../lib/serialize";
import { computeFinalStats } from "../../lib/combine";
import { scoreA, seatCount } from "../../lib/stats";
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
  const nDistricts = state.session.nDistricts;

  const pairs = round.pairings ?? [];

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <h2 className="text-xl font-semibold">Round {round.round} results</h2>
      <p className="text-sm text-gray-600">
        Each card shows a definer's map after their adversarial combiner paired it.
        Score = A seats won.
      </p>
      {pairs.map(([a, b], i) => {
        const cards: React.ReactNode[] = [];
        // Two potential scoreable outcomes per pair
        for (const [definer, combiner] of [[a, b], [b, a]] as const) {
          const definerFlat = round.defines[definer];
          const combineRec = round.combines[combiner];
          if (!definerFlat || !combineRec || combineRec.definerId !== definer) continue;
          const definerAsg = assignmentFromFlat(grid, definerFlat);
          const stats = computeFinalStats(grid, definerAsg, combineRec.pairing, voters);
          const seats = seatCount(stats);
          const score = scoreA(stats);
          const isMine = definer === student.id;
          cards.push(
            <div key={definer}
                 className={`border rounded p-3 ${isMine ? "ring-2 ring-blue-500" : ""}`}>
              <div className="text-sm font-medium mb-1">
                {isMine ? "Your map" : `${studentsById.get(definer) ?? definer}'s map`}
                <span className="font-normal text-gray-500">
                  {" "}— combined by {studentsById.get(combiner) ?? combiner}
                </span>
              </div>
              <div className="text-sm mb-2">
                A score: <span className="font-semibold">{fmtSeats(score)}</span>
                <span className="text-gray-500">
                  {" "}({seats.A}W · {seats.ties}T · {seats.B}L)
                </span>
              </div>
              <StatsTable stats={stats} expectedPop={grid.blocks.length / nDistricts} />
            </div>
          );
        }
        return (
          <div key={i}>
            <h3 className="font-semibold mb-2">
              Pair {i + 1}: {studentsById.get(a)} ↔ {studentsById.get(b)}
            </h3>
            <div className="grid md:grid-cols-2 gap-3">{cards}</div>
          </div>
        );
      })}
      <p className="text-sm text-gray-500">
        Waiting for teacher to start the next round...
      </p>
    </div>
  );
}

function fmtSeats(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(1);
}
