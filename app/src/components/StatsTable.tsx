import type { DistrictStats } from "../lib/types";
import { districtColor } from "../lib/palette";
import { seatCount } from "../lib/stats";

interface Props {
  stats: DistrictStats[];
  expectedPop: number;
}

export function StatsTable({ stats, expectedPop }: Props) {
  const seats = seatCount(stats);
  return (
    <div className="text-sm overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-1 pr-2">District</th>
            <th className="py-1 pr-2">Pop</th>
            <th className="py-1 pr-2">A</th>
            <th className="py-1 pr-2">B</th>
            <th className="py-1 pr-2">Winner</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const off = s.population !== expectedPop;
            return (
              <tr key={s.district} className="border-t">
                <td className="py-1 pr-2 flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm border border-gray-400"
                    style={{ background: districtColor(s.district) }}
                  />
                  {s.district}
                </td>
                <td className={`py-1 pr-2 ${off ? "text-red-600 font-medium" : ""}`}>
                  {s.population}
                </td>
                <td className="py-1 pr-2">{s.votesA}</td>
                <td className="py-1 pr-2">{s.votesB}</td>
                <td className="py-1 pr-2 font-medium">
                  {s.winner === "tie" ? "—" : s.winner}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 pt-2 border-t font-medium">
        Seats: A {seats.A} · B {seats.B}
        {seats.ties > 0 ? ` · ties ${seats.ties}` : ""}
      </div>
    </div>
  );
}
