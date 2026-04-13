import { useState } from "react";
import type { Grid } from "./lib/types";
import { UniMode } from "./modes/UniMode";
import grid70 from "./assets/grid_70.json";
import grid140 from "./assets/grid_140.json";

const GRIDS: Record<string, Grid> = {
  "70": grid70 as unknown as Grid,
  "140": grid140 as unknown as Grid,
};

export default function App() {
  const [gridKey, setGridKey] = useState<"70" | "140">("70");
  const grid = GRIDS[gridKey];
  const [nDistricts, setNDistricts] = useState<number>(grid.districtOptions[0]);

  const handleGridChange = (k: "70" | "140") => {
    setGridKey(k);
    setNDistricts(GRIDS[k].districtOptions[0]);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50">
        <h1 className="font-semibold">DCP Simulator</h1>
        <div className="flex items-center gap-2 text-sm">
          <label>Grid:</label>
          <select
            value={gridKey}
            onChange={(e) => handleGridChange(e.target.value as "70" | "140")}
            className="border rounded px-2 py-1"
          >
            <option value="70">70 blocks</option>
            <option value="140">140 blocks</option>
          </select>
          <label>Districts:</label>
          <select
            value={nDistricts}
            onChange={(e) => setNDistricts(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {grid.districtOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-gray-500">Uni mode</div>
      </header>
      <main className="flex-1 min-h-0">
        <UniMode grid={grid} nDistricts={nDistricts} />
      </main>
    </div>
  );
}
