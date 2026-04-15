import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistoryState, useUndoShortcuts } from "../lib/useHistoryState";
import type { Assignment, BlockId, DistrictId, Grid, ValidationError } from "../lib/types";
import { generateVoters } from "../lib/voters";
import type { DistributionMode } from "../lib/voters";
import { validatePlan } from "../lib/validate";
import { computeStats } from "../lib/stats";
import { MapView } from "../components/MapView";
import { DistrictPicker } from "../components/DistrictPicker";
import { StatsTable } from "../components/StatsTable";
import { districtColor } from "../lib/palette";
import { UNASSIGNED } from "../lib/types";

interface Props {
  grid: Grid;
  nDistricts: number;
}

export function UniMode({ grid, nDistricts }: Props) {
  const history = useHistoryState<Assignment>(new Map());
  const assignment = history.state;
  const setAssignment = history.set;
  useUndoShortcuts(history);
  const [current, setCurrent] = useState<DistrictId>(1);
  const [dist, setDist] = useState<DistributionMode>("random");
  const [seed, setSeed] = useState(1);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);

  // Reset assignment when grid or district count changes (prior plan is invalid).
  useEffect(() => {
    history.reset(new Map());
    setCurrent(1);
    setErrors(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, nDistricts]);

  const voters = useMemo(
    () => generateVoters(grid, { mode: dist, seed }),
    [grid, dist, seed],
  );

  const stats = useMemo(
    () => computeStats(grid, assignment, voters),
    [grid, assignment, voters],
  );

  const expectedPop = grid.blocks.length / nDistricts;

  const handleSetBlock = useCallback(
    (block: BlockId, district: DistrictId | null) => {
      setAssignment((prev) => {
        const next = new Map(prev);
        if (district === null) next.delete(block);
        else next.set(block, district);
        return next;
      });
      setErrors(null);
    },
    [],
  );

  const reset = () => {
    history.commit();
    setAssignment(new Map());
    setErrors(null);
  };

  const loadRandom = () => {
    const plans = grid.randomPlans[String(nDistricts)];
    if (!plans || plans.length === 0) return;
    const plan = plans[Math.floor(Math.random() * plans.length)];
    const m: Assignment = new Map();
    plan.forEach((d, i) => m.set(grid.blocks[i].id, d));
    history.commit();
    setAssignment(m);
    setErrors(null);
  };

  const validate = useCallback(() => {
    const errs = validatePlan(grid, assignment, {
      nDistricts,
      requireDoughnutFree: true,
    });
    setErrors(errs);
  }, [grid, assignment, nDistricts]);

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight" || e.key === "]") {
        setCurrent((d) => (d % nDistricts) + 1);
      } else if (e.key === "ArrowLeft" || e.key === "[") {
        setCurrent((d) => ((d - 2 + nDistricts) % nDistricts) + 1);
      } else if (e.key === "v" || e.key === "V") {
        validate();
      } else if (e.key === "Escape") {
        setErrors(null);
      } else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n <= nDistricts) setCurrent(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nDistricts, validate]);

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-full">
      <div className="flex-1 min-h-[320px] md:min-h-0 flex items-center justify-center">
        <MapView
          grid={grid}
          blockColors={
            new Map(
              grid.blocks.map((b) => [
                b.id,
                districtColor(assignment.get(b.id) ?? UNASSIGNED),
              ]),
            )
          }
          boundaryGroup={
            new Map(
              grid.blocks.map((b) => [b.id, assignment.get(b.id) ?? UNASSIGNED]),
            )
          }
          voters={voters}
          paintCurrent={current}
          onSetBlock={handleSetBlock}
          onInteractionStart={history.commit}
          showVoters
        />
      </div>

      <aside className="w-full md:w-80 flex flex-col gap-4">
        <section>
          <h3 className="font-semibold mb-1">District</h3>
          <DistrictPicker nDistricts={nDistricts} current={current} onPick={setCurrent} />
          <p className="text-xs text-gray-500 mt-1">
            Click a block to add/remove. Use ←/→ or 1–9 to switch districts.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-1">Voters</h3>
          <select
            value={dist}
            onChange={(e) => setDist(e.target.value as DistributionMode)}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="random">Random (40% A)</option>
            <option value="minorityClusteredA">Minority A clustered</option>
            <option value="majorityClusteredA">Majority A clustered</option>
            <option value="minorityClusteredB">Minority B clustered</option>
            <option value="majorityClusteredB">Majority B clustered</option>
          </select>
          <button
            onClick={() => setSeed((s) => s + 1)}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            Reshuffle (seed {seed})
          </button>
        </section>

        <section className="flex gap-2 flex-wrap">
          <button onClick={validate}
                  className="px-3 py-1 rounded bg-black text-white text-sm">
            Validate (v)
          </button>
          <button onClick={history.undo} disabled={!history.canUndo}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                  title="Undo (⌘/Ctrl+Z)">
            Undo
          </button>
          <button onClick={history.redo} disabled={!history.canRedo}
                  className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                  title="Redo (⌘/Ctrl+Shift+Z)">
            Redo
          </button>
          <button onClick={loadRandom}
                  className="px-3 py-1 rounded border text-sm">
            Random plan
          </button>
          <button onClick={reset}
                  className="px-3 py-1 rounded border text-sm">
            Reset
          </button>
        </section>

        <section>
          <h3 className="font-semibold mb-1">Stats</h3>
          <StatsTable stats={stats} expectedPop={expectedPop} />
        </section>

        {errors && (
          <section
            role="alert"
            aria-live="polite"
            className={`p-3 rounded text-sm ${
              errors.length === 0
                ? "bg-green-100 text-green-900"
                : "bg-red-100 text-red-900"
            }`}
          >
            {errors.length === 0 ? (
              <div className="font-semibold">Plan is valid ✓</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
