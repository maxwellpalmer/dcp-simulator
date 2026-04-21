import { useCallback, useMemo, useState } from "react";
import { useHistoryState, useUndoShortcuts } from "../../lib/useHistoryState";
import type { Assignment, BlockId, DistrictId, Grid, ValidationError } from "../../lib/types";
import { UNASSIGNED } from "../../lib/types";
import { MapView } from "../../components/MapView";
import { StatsTable } from "../../components/StatsTable";
import { districtColor } from "../../lib/palette";
import { generateVoters } from "../../lib/voters";
import {
  adjacentSubDistricts,
  computeFinalStats,
  subDistrictLabel,
  subDistrictLabelLines,
  subDistrictSummaries,
  validatePairing,
  type Pairing,
} from "../../lib/combine";
import { assignmentFromFlat } from "../../lib/serialize";
import { api } from "../../lib/api";
import type { SessionStateResponse } from "../../../shared/session";

interface Props {
  grid: Grid;
  state: SessionStateResponse;
  student: { id: string; name: string };
  onSubmitted: () => void;
}

export function CombineStage({ grid, state, student, onSubmitted }: Props) {
  const round = state.round!;
  const nDistricts = state.session.nDistricts;
  const nSub = nDistricts * 2;
  const partnerDefine = state.combineTarget!.assignment;
  const alreadySubmitted = !!round.combines[student.id];

  const assignment: Assignment = useMemo(
    () => assignmentFromFlat(grid, partnerDefine),
    [grid, partnerDefine],
  );

  const voters = useMemo(
    () => generateVoters(grid, { mode: round.voterDist, seed: round.voterSeed }),
    [grid, round.voterDist, round.voterSeed],
  );

  const pairHistory = useHistoryState<Pairing>([]);
  const pairing = pairHistory.state;
  const setPairing = pairHistory.set;
  useUndoShortcuts(pairHistory);
  const [pendingPick, setPendingPick] = useState<DistrictId | null>(null);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setErrors([{ code: "NOT_CONTIGUOUS", message: `${subDistrictLabel(pendingPick)} and ${subDistrictLabel(sub)} are not adjacent.` }]);
        return;
      }
      pairHistory.commit();
      setPairing((p) => [...p, [pendingPick, sub]]);
      setPendingPick(null);
      setErrors(null);
    },
    [pairing, pendingPick, candidateSubs, pairHistory, setPairing],
  );

  const onBlockClick = useCallback(
    (block: BlockId) => handleSubClick(assignment.get(block) ?? UNASSIGNED),
    [assignment, handleSubClick],
  );

  const finalStats = useMemo(
    () => computeFinalStats(grid, assignment, pairing, voters),
    [grid, assignment, pairing, voters],
  );

  const expectedPop = grid.blocks.length / nDistricts;

  const blockColors = useMemo(() => {
    const m = new Map<BlockId, string>();
    for (const b of grid.blocks) {
      const sub = assignment.get(b.id) ?? UNASSIGNED;
      const finalD = subToFinal.get(sub);
      // Paired sub-districts take the final district's color; unpaired sub-
      // districts stay at their own hue. The pending-pick sub is distinguished
      // by the thick perimeter outline (perimeterBlocks), not by fill tint.
      m.set(b.id, finalD ? districtColor(finalD) : districtColor(sub));
    }
    return m;
  }, [grid, assignment, subToFinal]);

  // Always group by sub-district so the seam between two paired sub-districts
  // stays visible. Final-district identity is conveyed by shared block color.
  const boundaryGroup = useMemo(() => {
    const m = new Map<BlockId, DistrictId>();
    for (const b of grid.blocks) {
      m.set(b.id, assignment.get(b.id) ?? UNASSIGNED);
    }
    return m;
  }, [grid, assignment]);

  const labels = useMemo(() => {
    const sums = subDistrictSummaries(grid, assignment, voters);
    return sums.map((s) => ({
      district: s.district,
      cx: s.cx,
      cy: s.cy,
      lines: subDistrictLabelLines(s),
    }));
  }, [grid, assignment, voters]);

  const perimeterBlocks = useMemo(() => {
    if (pendingPick === null) return undefined;
    const s = new Set<BlockId>();
    for (const [blk, d] of assignment) if (d === pendingPick) s.add(blk);
    return s;
  }, [pendingPick, assignment]);

  const submit = async () => {
    const errs = validatePairing(grid, assignment, pairing, { nSubDistricts: nSub });
    setErrors(errs);
    if (errs.length > 0) return;
    setSubmitting(true);
    try {
      await api.submitCombine({
        code: state.session.code,
        studentId: student.id,
        pairing,
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
          Combine submitted. Waiting for round to end...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 h-full">
      <div className="flex-1 min-h-[320px] md:min-h-0 flex flex-col">
        <div className="flex gap-2 flex-wrap pb-2">
          <button onClick={submit} disabled={submitting}
                  className="px-3 py-2 rounded bg-black text-white text-sm">
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button onClick={pairHistory.undo} disabled={!pairHistory.canUndo}
                  title="Undo (⌘/Ctrl+Z)"
                  className="px-3 py-2 rounded border text-sm disabled:opacity-40">Undo</button>
          <button onClick={pairHistory.redo} disabled={!pairHistory.canRedo}
                  title="Redo (⌘/Ctrl+Shift+Z)"
                  className="px-3 py-2 rounded border text-sm disabled:opacity-40">Redo</button>
          <button onClick={() => { pairHistory.commit(); setPairing([]); setPendingPick(null); }}
                  className="px-3 py-2 rounded border text-sm">Clear</button>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <MapView
            grid={grid}
            blockColors={blockColors}
            boundaryGroup={boundaryGroup}
            voters={voters}
            showVoters={false}
            onBlockClick={onBlockClick}
            labels={labels}
            perimeterBlocks={perimeterBlocks}
          />
        </div>
      </div>
      <aside className="w-full md:w-96 flex flex-col gap-4">
        <section className="rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm">
          <div className="font-semibold flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-white border border-black" />
            You are Party B
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Pair your partner's sub-districts to maximize B's seats. B's
            voters are the <span className="font-medium">light dots</span>.
          </div>
        </section>
        <section>
          <h3 className="font-semibold mb-1">
            Combine partner's sub-districts
          </h3>
          <p className="text-xs text-gray-500">
            {pairing.length}/{nDistricts} pairs made.
          </p>
        </section>
        <section>
          <h3 className="font-semibold mb-1">Final district stats</h3>
          <StatsTable stats={finalStats} expectedPop={expectedPop} voters={voters} />
        </section>
        {errors && errors.length > 0 && (
          <section role="alert" aria-live="polite" className="p-3 rounded text-sm bg-red-100 text-red-900">
            <ul className="list-disc pl-5 space-y-1">
              {errors.map((e, i) => <li key={i}>{e.message}</li>)}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
