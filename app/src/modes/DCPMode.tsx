import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistoryState } from "../lib/useHistoryState";
import type {
  Assignment,
  BlockId,
  DistrictId,
  Grid,
  ValidationError,
} from "../lib/types";
import { UNASSIGNED } from "../lib/types";
import { generateVoters } from "../lib/voters";
import type { DistributionMode } from "../lib/voters";
import { validatePlan } from "../lib/validate";
import { computeStats } from "../lib/stats";
import {
  adjacentSubDistricts,
  computeFinalStats,
  subDistrictLabel,
  subDistrictLabelLines,
  subDistrictSummaries,
  validatePairing,
  type Pairing,
} from "../lib/combine";
import { MapView, type SubLabel } from "../components/MapView";
import { DistrictPicker } from "../components/DistrictPicker";
import { StatsTable } from "../components/StatsTable";
import { districtColor } from "../lib/palette";

type Stage = "define" | "combine";

interface Props {
  grid: Grid;
  // Number of final districts (N). Sub-districts = 2N.
  nDistricts: number;
}

export function DCPMode({ grid, nDistricts }: Props) {
  const nSub = nDistricts * 2;
  const [stage, setStage] = useState<Stage>("define");

  // Two separate histories — one for the define-stage assignment, one for
  // the combine-stage pairing. The active stage gets keyboard undo.
  const asgHistory = useHistoryState<Assignment>(new Map());
  const assignment = asgHistory.state;
  const setAssignment = asgHistory.set;
  const pairHistory = useHistoryState<Pairing>([]);
  const pairing = pairHistory.state;
  const setPairing = pairHistory.set;
  const [current, setCurrent] = useState<DistrictId>(1);
  const [pendingPick, setPendingPick] = useState<DistrictId | null>(null);

  // ⌘/Ctrl+Z applies to the active stage's history.
  useEffect(() => {
    const h = stage === "define" ? asgHistory : pairHistory;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) h.redo(); else h.undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        h.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, asgHistory, pairHistory]);

  const [dist, setDist] = useState<DistributionMode>("random5050");
  const [seed, setSeed] = useState(1);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);

  useEffect(() => {
    asgHistory.reset(new Map());
    pairHistory.reset([]);
    setPendingPick(null);
    setCurrent(1);
    setErrors(null);
    setStage("define");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, nDistricts]);

  const voters = useMemo(
    () => generateVoters(grid, { mode: dist, seed }),
    [grid, dist, seed],
  );

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

  const resetAll = () => {
    asgHistory.commit();
    pairHistory.commit();
    setAssignment(new Map());
    setPairing([]);
    setPendingPick(null);
    setErrors(null);
  };

  const loadRandom = () => {
    const plans = grid.randomPlans[String(nSub)];
    if (!plans || plans.length === 0) return;
    const plan = plans[Math.floor(Math.random() * plans.length)];
    const m: Assignment = new Map();
    plan.forEach((d, i) => m.set(grid.blocks[i].id, d));
    asgHistory.commit();
    pairHistory.commit();
    setAssignment(m);
    setPairing([]);
    setPendingPick(null);
    setErrors(null);
  };

  const validateDefine = useCallback(() => {
    const errs = validatePlan(grid, assignment, {
      nDistricts: nSub,
      requireDoughnutFree: true,
    });
    setErrors(errs);
    return errs.length === 0;
  }, [grid, assignment, nSub]);

  const defineStats = useMemo(
    () => computeStats(grid, assignment, voters),
    [grid, assignment, voters],
  );

  const goToCombine = () => {
    if (validateDefine()) {
      setStage("combine");
      setErrors(null);
    }
  };

  // ---- Combine stage helpers ----
  const pairedSet = useMemo(() => {
    const s = new Set<DistrictId>();
    for (const [a, b] of pairing) { s.add(a); s.add(b); }
    return s;
  }, [pairing]);

  const subToFinal = useMemo(() => {
    const m = new Map<DistrictId, DistrictId>();
    pairing.forEach(([a, b], i) => { m.set(a, i + 1); m.set(b, i + 1); });
    return m;
  }, [pairing]);

  const candidateSubs = useMemo(() => {
    if (pendingPick == null) return new Set<DistrictId>();
    return adjacentSubDistricts(grid, assignment, pendingPick);
  }, [grid, assignment, pendingPick]);

  const handleSubClick = useCallback(
    (sub: DistrictId) => {
      if (sub === UNASSIGNED) return;
      const pairIdx = pairing.findIndex((p) => p[0] === sub || p[1] === sub);
      if (pairIdx >= 0) {
        pairHistory.commit();
        setPairing((p) => p.filter((_, i) => i !== pairIdx));
        setPendingPick(null);
        setErrors(null);
        return;
      }
      if (pendingPick === null) { setPendingPick(sub); return; }
      if (pendingPick === sub) { setPendingPick(null); return; }
      if (!candidateSubs.has(sub)) {
        setErrors([{
          code: "NOT_CONTIGUOUS",
          message: `${subDistrictLabel(pendingPick)} and ${subDistrictLabel(sub)} are not adjacent.`,
        }]);
        return;
      }
      pairHistory.commit();
      setPairing((p) => [...p, [pendingPick, sub]]);
      setPendingPick(null);
      setErrors(null);
    },
    [pairing, pendingPick, candidateSubs, pairHistory, setPairing],
  );

  const onBlockClickInCombine = useCallback(
    (block: BlockId) => {
      const sub = assignment.get(block) ?? UNASSIGNED;
      handleSubClick(sub);
    },
    [assignment, handleSubClick],
  );

  const validateCombine = useCallback(() => {
    const errs = validatePairing(grid, assignment, pairing, { nSubDistricts: nSub });
    setErrors(errs);
    return errs.length === 0;
  }, [grid, assignment, pairing, nSub]);

  const finalStats = useMemo(
    () => computeFinalStats(grid, assignment, pairing, voters),
    [grid, assignment, pairing, voters],
  );

  // ---- Hotkeys (define stage only) ----
  useEffect(() => {
    if (stage !== "define") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight" || e.key === "]") setCurrent((d) => (d % nSub) + 1);
      else if (e.key === "ArrowLeft" || e.key === "[") setCurrent((d) => ((d - 2 + nSub) % nSub) + 1);
      else if (e.key === "v" || e.key === "V") validateDefine();
      else if (e.key === "Escape") setErrors(null);
      else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n <= nSub) setCurrent(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, nSub, validateDefine]);

  // ---- Build MapView inputs per stage ----
  const blockColors = useMemo(() => {
    const m = new Map<BlockId, string>();
    for (const b of grid.blocks) {
      const sub = assignment.get(b.id) ?? UNASSIGNED;
      if (stage === "define") {
        m.set(b.id, districtColor(sub));
      } else {
        const finalD = subToFinal.get(sub);
        // Paired sub-districts take the final district's color; unpaired ones
        // stay at their own hue. Pending pick is shown via the thick perimeter
        // outline (perimeterBlocks), not by fill tint.
        m.set(b.id, finalD ? districtColor(finalD) : districtColor(sub));
      }
    }
    return m;
  }, [grid, assignment, stage, subToFinal]);

  const boundaryGroup = useMemo(() => {
    // Group by sub-district in both stages so the seam between two paired
    // sub-districts stays visible during combine. Final-district identity
    // is conveyed via shared block color.
    const m = new Map<BlockId, DistrictId>();
    for (const b of grid.blocks) {
      m.set(b.id, assignment.get(b.id) ?? UNASSIGNED);
    }
    return m;
  }, [grid, assignment]);

  const labels = useMemo<SubLabel[]>(() => {
    if (stage !== "combine") return [];
    const sums = subDistrictSummaries(grid, assignment, voters);
    return sums.map((s) => ({
      district: s.district,
      cx: s.cx,
      cy: s.cy,
      lines: subDistrictLabelLines(s),
    }));
  }, [stage, grid, assignment, voters]);

  const perimeterBlocks = useMemo(() => {
    if (stage !== "combine" || pendingPick === null) return undefined;
    const s = new Set<BlockId>();
    for (const [blk, d] of assignment) if (d === pendingPick) s.add(blk);
    return s;
  }, [stage, pendingPick, assignment]);

  const dimmedBlocks = useMemo(() => {
    if (stage !== "combine" || pendingPick === null) return undefined;
    const s = new Set<BlockId>();
    for (const [blk, d] of assignment) {
      if (d !== pendingPick && !candidateSubs.has(d) && !pairedSet.has(d)) {
        // leave unrelated blocks visible but dim
        s.add(blk);
      }
    }
    return s;
  }, [stage, pendingPick, assignment, candidateSubs, pairedSet]);

  const expectedPop = grid.blocks.length / nSub;

  // ---- Render ----
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-full">
      <div className="flex-1 min-h-[320px] md:min-h-0 flex flex-col">
        <div className="flex gap-2 flex-wrap pb-2">
          {stage === "define" ? (
            <>
              <button onClick={validateDefine} className="px-3 py-1 rounded bg-black text-white text-sm">Validate (v)</button>
              <button onClick={asgHistory.undo} disabled={!asgHistory.canUndo}
                      title="Undo (⌘/Ctrl+Z)"
                      className="px-3 py-1 rounded border text-sm disabled:opacity-40">Undo</button>
              <button onClick={asgHistory.redo} disabled={!asgHistory.canRedo}
                      title="Redo (⌘/Ctrl+Shift+Z)"
                      className="px-3 py-1 rounded border text-sm disabled:opacity-40">Redo</button>
              <button onClick={goToCombine} className="px-3 py-1 rounded border text-sm">Next: Combine →</button>
              <button onClick={loadRandom} className="px-3 py-1 rounded border text-sm">Random plan</button>
              <button onClick={resetAll} className="px-3 py-1 rounded border text-sm">Reset</button>
            </>
          ) : (
            <>
              <button onClick={validateCombine} className="px-3 py-1 rounded bg-black text-white text-sm">Validate</button>
              <button onClick={pairHistory.undo} disabled={!pairHistory.canUndo}
                      title="Undo (⌘/Ctrl+Z)"
                      className="px-3 py-1 rounded border text-sm disabled:opacity-40">Undo</button>
              <button onClick={pairHistory.redo} disabled={!pairHistory.canRedo}
                      title="Redo (⌘/Ctrl+Shift+Z)"
                      className="px-3 py-1 rounded border text-sm disabled:opacity-40">Redo</button>
              <button onClick={() => { pairHistory.commit(); setPairing([]); }}
                      className="px-3 py-1 rounded border text-sm">Clear pairings</button>
              <button onClick={() => setStage("define")} className="px-3 py-1 rounded border text-sm">← Back to define</button>
            </>
          )}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <MapView
            grid={grid}
            blockColors={blockColors}
            boundaryGroup={boundaryGroup}
            voters={voters}
            showVoters={stage === "define"}
            paintCurrent={stage === "define" ? current : undefined}
            onSetBlock={stage === "define" ? handleSetBlock : undefined}
            onBlockClick={stage === "combine" ? onBlockClickInCombine : undefined}
            onInteractionStart={stage === "define" ? asgHistory.commit : undefined}
            labels={labels}
            perimeterBlocks={perimeterBlocks}
            dimmedBlocks={dimmedBlocks}
          />
        </div>
      </div>

      <aside className="w-full md:w-96 flex flex-col gap-4">
        <nav role="tablist" aria-label="DCP stages" className="flex gap-2 text-sm">
          <button role="tab" aria-selected={stage === "define"}
            onClick={() => setStage("define")}
            className={`px-3 py-1 rounded border ${
              stage === "define" ? "bg-black text-white" : ""
            }`}
          >
            1. Define
          </button>
          <button role="tab" aria-selected={stage === "combine"}
            onClick={goToCombine}
            disabled={stage === "combine"}
            className={`px-3 py-1 rounded border ${
              stage === "combine" ? "bg-black text-white" : ""
            }`}
          >
            2. Combine
          </button>
        </nav>

        {stage === "define" && (
          <>
            <section>
              <h3 className="font-semibold mb-1">
                Sub-district ({nSub} total)
              </h3>
              <DistrictPicker
                nDistricts={nSub}
                current={current}
                onPick={setCurrent}
                labels={subDistrictLabel}
              />
              <p className="text-xs text-gray-500 mt-1">
                Draw {nSub} equal-population contiguous sub-districts. These
                will be paired in the Combine stage.
              </p>
            </section>

            <VoterSection dist={dist} setDist={setDist} seed={seed} setSeed={setSeed} />

            <section>
              <h3 className="font-semibold mb-1">Sub-district stats</h3>
              <StatsTable stats={defineStats} expectedPop={expectedPop} />
            </section>
          </>
        )}

        {stage === "combine" && (
          <>
            <section>
              <h3 className="font-semibold mb-1">Combine sub-districts</h3>
              <p className="text-xs text-gray-500">
                Click a sub-district, then click an adjacent sub-district to
                pair them into a final district. Click a paired sub-district
                to unpair. {pairing.length}/{nDistricts} pairs made.
              </p>
            </section>

            {finalStats.length > 0 && (
              <section>
                <h3 className="font-semibold mb-1">Final district stats</h3>
                <StatsTable stats={finalStats} expectedPop={expectedPop * 2} />
              </section>
            )}
          </>
        )}

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
              <div className="font-semibold">
                {stage === "define" ? "Sub-districts valid ✓" : "Pairing valid ✓"}
              </div>
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

function VoterSection({
  dist,
  setDist,
  seed,
  setSeed,
}: {
  dist: DistributionMode;
  setDist: (m: DistributionMode) => void;
  seed: number;
  setSeed: (f: (s: number) => number) => void;
}) {
  return (
    <section>
      <h3 className="font-semibold mb-1">Voters</h3>
      <select
        value={dist}
        onChange={(e) => setDist(e.target.value as DistributionMode)}
        className="border rounded px-2 py-1 w-full"
      >
        <option value="random5050">Random (50/50)</option>
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
  );
}
