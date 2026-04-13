import { useState } from "react";
import type { Grid } from "./lib/types";
import { UniMode } from "./modes/UniMode";
import { DCPMode } from "./modes/DCPMode";
import grid70 from "./assets/grid_70.json";
import grid140 from "./assets/grid_140.json";

const GRIDS: Record<string, Grid> = {
  "70": grid70 as unknown as Grid,
  "140": grid140 as unknown as Grid,
};

type Mode = "uni" | "dcp";

export default function App() {
  const [mode, setMode] = useState<Mode>("uni");
  const [gridKey, setGridKey] = useState<"70" | "140">("70");
  const grid = GRIDS[gridKey];
  const [nDistricts, setNDistricts] = useState<number>(grid.districtOptions[0]);

  const handleGridChange = (k: "70" | "140") => {
    setGridKey(k);
    setNDistricts(GRIDS[k].districtOptions[0]);
  };

  // In DCP mode, nDistricts = final districts. Sub-districts = 2N.
  // District options valid for DCP are those where 2N is also a supported
  // district count (so we have pre-generated random plans for sub-districts).
  const dcpOptions = grid.districtOptions.filter((n) =>
    grid.districtOptions.includes(n * 2),
  );

  const options = mode === "uni" ? grid.districtOptions : dcpOptions;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-4 px-4 py-2 border-b bg-gray-50 flex-wrap">
        <h1 className="font-semibold">DCP Simulator</h1>
        <div className="flex gap-1 text-sm">
          <button
            onClick={() => setMode("uni")}
            className={`px-3 py-1 rounded border ${mode === "uni" ? "bg-black text-white" : ""}`}
          >
            Uni
          </button>
          <button
            onClick={() => {
              setMode("dcp");
              if (!dcpOptions.includes(nDistricts)) setNDistricts(dcpOptions[0]);
            }}
            className={`px-3 py-1 rounded border ${mode === "dcp" ? "bg-black text-white" : ""}`}
          >
            DCP
          </button>
        </div>
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
          <label>{mode === "dcp" ? "Final districts:" : "Districts:"}</label>
          <select
            value={nDistricts}
            onChange={(e) => setNDistricts(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
                {mode === "dcp" ? ` (${n * 2} sub)` : ""}
              </option>
            ))}
          </select>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        {mode === "uni" ? (
          <UniMode grid={grid} nDistricts={nDistricts} />
        ) : (
          <DCPMode grid={grid} nDistricts={nDistricts} />
        )}
      </main>
    </div>
  );
}
