import { useEffect, useMemo, useRef, useState } from "react";
import type { Assignment, BlockId, DistrictId, Grid } from "../lib/types";
import { UNASSIGNED } from "../lib/types";
import type { VoterMap } from "../lib/voters";
import { districtColor, VOTER_COLORS } from "../lib/palette";

type PaintAction = "set" | "clear";

interface Props {
  grid: Grid;
  assignment: Assignment;
  voters: VoterMap;
  currentDistrict: DistrictId;
  onSetBlock: (block: BlockId, district: DistrictId | null) => void;
  showVoters: boolean;
}

export function MapView({
  grid,
  assignment,
  voters,
  currentDistrict,
  onSetBlock,
  showVoters,
}: Props) {
  const bbox = useMemo(() => computeBbox(grid), [grid]);
  const getAssignment = (id: BlockId) => assignment.get(id) ?? UNASSIGNED;

  const [dragAction, setDragAction] = useState<PaintAction | null>(null);
  // Track which blocks we've touched during the current drag so we don't
  // flip a block twice if the cursor re-enters it.
  const touchedRef = useRef<Set<BlockId>>(new Set());

  useEffect(() => {
    const onUp = () => {
      setDragAction(null);
      touchedRef.current.clear();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const applyAction = (id: BlockId, action: PaintAction) => {
    if (touchedRef.current.has(id)) return;
    touchedRef.current.add(id);
    const cur = getAssignment(id);
    if (action === "set" && cur !== currentDistrict) {
      onSetBlock(id, currentDistrict);
    } else if (action === "clear" && cur === currentDistrict) {
      onSetBlock(id, null);
    }
  };

  const handlePointerDown = (id: BlockId) => (e: React.PointerEvent) => {
    e.preventDefault();
    const action: PaintAction =
      getAssignment(id) === currentDistrict ? "clear" : "set";
    setDragAction(action);
    touchedRef.current = new Set();
    applyAction(id, action);
    // Capture so pointerenter fires on other hexes even when held down
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handlePointerEnter = (id: BlockId) => () => {
    if (dragAction) applyAction(id, dragAction);
  };

  const padding = 0.3;
  const vbW = bbox.maxX - bbox.minX + padding * 2;
  const vbH = bbox.maxY - bbox.minY + padding * 2;

  return (
    <svg
      viewBox={`${bbox.minX - padding} ${bbox.minY - padding} ${vbW} ${vbH}`}
      className="w-full h-full select-none"
      style={{ transform: "scaleY(-1)", touchAction: "none" }}
    >
      {grid.blocks.map((b) => {
        const d = getAssignment(b.id);
        const fill = districtColor(d);
        const points = b.vertices.map(([x, y]) => `${x},${y}`).join(" ");
        const isCurrent = d === currentDistrict && d !== UNASSIGNED;
        return (
          <polygon
            key={b.id}
            points={points}
            fill={fill}
            stroke="#999"
            strokeWidth={0.01}
            style={{ cursor: "pointer", opacity: isCurrent ? 1 : 0.9 }}
            onPointerDown={handlePointerDown(b.id)}
            onPointerEnter={handlePointerEnter(b.id)}
          />
        );
      })}

      {grid.innerLines.map((ln, i) => {
        const da = getAssignment(ln.a);
        const db = getAssignment(ln.b);
        if (da === db) return null;
        return (
          <line
            key={i}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke="#111"
            strokeWidth={0.05}
            strokeLinecap="round"
            pointerEvents="none"
          />
        );
      })}

      <polygon
        points={grid.outerRing.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="#111"
        strokeWidth={0.08}
        pointerEvents="none"
      />

      {showVoters &&
        grid.blocks.map((b) => {
          const v = voters.get(b.id);
          if (!v) return null;
          return (
            <circle
              key={b.id}
              cx={b.cx}
              cy={b.cy}
              r={0.12}
              fill={VOTER_COLORS[v]}
              stroke="#000"
              strokeWidth={0.015}
              pointerEvents="none"
            />
          );
        })}
    </svg>
  );
}

function computeBbox(grid: Grid) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of grid.blocks) {
    for (const [x, y] of b.vertices) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}
