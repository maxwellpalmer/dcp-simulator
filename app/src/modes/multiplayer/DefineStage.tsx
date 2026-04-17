import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistoryState, useUndoShortcuts } from "../../lib/useHistoryState";
import type { Assignment, BlockId, DistrictId, Grid, ValidationError } from "../../lib/types";
import { UNASSIGNED } from "../../lib/types";
import { MapView } from "../../components/MapView";
import { DistrictPicker } from "../../components/DistrictPicker";
import { StatsTable } from "../../components/StatsTable";
import { districtColor } from "../../lib/palette";
import { generateVoters } from "../../lib/voters";
import { validatePlan } from "../../lib/validate";
import { computeStats } from "../../lib/stats";
import { subDistrictLabel } from "../../lib/combine";
import { assignmentToFlat } from "../../lib/serialize";
import { api } from "../../lib/api";
import type { SessionStateResponse } from "../../../shared/session";

interface Props {
  grid: Grid;
  state: SessionStateResponse;
  student: { id: string; name: string };
  onSubmitted: () => void;
}

export function DefineStage({ grid, state, student, onSubmitted }: Props) {
  const round = state.round!;
  const nSub = state.session.nDistricts * 2;
  const alreadySubmitted = !!round.defines[student.id];
  const history = useHistoryState<Assignment>(new Map());
  const assignment = history.state;
  const setAssignment = history.set;
  useUndoShortcuts(history);
  const [current, setCurrent] = useState<DistrictId>(1);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const voters = useMemo(
    () => generateVoters(grid, { mode: round.voterDist, seed: round.voterSeed }),
    [grid, round.voterDist, round.voterSeed],
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

  const stats = useMemo(
    () => computeStats(grid, assignment, voters),
    [grid, assignment, voters],
  );

  const expectedPop = grid.blocks.length / nSub;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "]") setCurrent((d) => (d % nSub) + 1);
      else if (e.key === "ArrowLeft" || e.key === "[") setCurrent((d) => ((d - 2 + nSub) % nSub) + 1);
      else if (e.key === "v" || e.key === "V") runValidate();
      else if (e.key === "Escape") setErrors(null);
      else if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        if (n <= nSub) setCurrent(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nSub]);

  const runValidate = () => {
    const errs = validatePlan(grid, assignment, {
      nDistricts: nSub,
      requireDoughnutFree: true,
    });
    setErrors(errs);
    return errs.length === 0;
  };

  const loadRandom = () => {
    const plans = grid.randomPlans[String(nSub)];
    if (!plans || plans.length === 0) return;
    const plan = plans[Math.floor(Math.random() * plans.length)];
    const m: Assignment = new Map();
    plan.forEach((d, i) => m.set(grid.blocks[i].id, d));
    history.commit();
    setAssignment(m);
    setErrors(null);
  };

  const submit = async () => {
    if (!runValidate()) return;
    setSubmitting(true);
    try {
      await api.submitDefine({
        code: state.session.code,
        studentId: student.id,
        assignment: assignmentToFlat(grid, assignment),
      });
      onSubmitted();
    } catch (e) {
      setErrors([{ code: "UNASSIGNED_BLOCKS", message: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadySubmitted) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center text-lg">
          Submitted. Waiting for other students to finish...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-full">
      <div className="flex-1 min-h-[320px] md:min-h-0 flex items-center justify-center">
        <MapView
          grid={grid}
          blockColors={new Map(grid.blocks.map((b) => [b.id, districtColor(assignment.get(b.id) ?? UNASSIGNED)]))}
          boundaryGroup={new Map(grid.blocks.map((b) => [b.id, assignment.get(b.id) ?? UNASSIGNED]))}
          voters={voters}
          showVoters
          paintCurrent={current}
          onSetBlock={handleSetBlock}
          onInteractionStart={history.commit}
        />
      </div>
      <aside className="w-full md:w-80 flex flex-col gap-4">
        <section className="rounded border border-gray-800 bg-gray-900 text-white px-3 py-2 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-black border border-white" />
            You are Party A
          </div>
          <div className="text-xs text-gray-300 mt-1">
            Draw sub-districts that maximize A's seats after your partner
            pairs them. A's voters are the <span className="font-medium">dark dots</span>.
          </div>
        </section>
        <section>
          <h3 className="font-semibold mb-1">Define {nSub} sub-districts</h3>
          <DistrictPicker nDistricts={nSub} current={current} onPick={setCurrent} labels={subDistrictLabel} />
        </section>
        <section>
          <h3 className="font-semibold mb-1">Sub-district stats</h3>
          <StatsTable stats={stats} expectedPop={expectedPop} />
        </section>
        <section className="flex gap-2 flex-wrap">
          <button onClick={runValidate}
                  className="px-3 py-2 rounded border text-sm">Validate (v)</button>
          <button onClick={submit} disabled={submitting}
                  className="px-3 py-2 rounded bg-black text-white text-sm">
            {submitting ? "Submitting..." : "Submit for combine"}
          </button>
          <button onClick={history.undo} disabled={!history.canUndo}
                  title="Undo (⌘/Ctrl+Z)"
                  className="px-3 py-2 rounded border text-sm disabled:opacity-40">Undo</button>
          <button onClick={history.redo} disabled={!history.canRedo}
                  title="Redo (⌘/Ctrl+Shift+Z)"
                  className="px-3 py-2 rounded border text-sm disabled:opacity-40">Redo</button>
          <button onClick={loadRandom}
                  className="px-3 py-2 rounded border text-sm">Random plan</button>
          <button onClick={() => { history.commit(); setAssignment(new Map()); }}
                  className="px-3 py-2 rounded border text-sm">Reset</button>
        </section>
        {errors && (
          <section role="alert" aria-live="polite" className={`p-3 rounded text-sm ${errors.length === 0 ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
            {errors.length === 0 ? (
              <div className="font-semibold">Plan is valid ✓</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {errors.map((e, i) => <li key={i}>{e.message}</li>)}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
