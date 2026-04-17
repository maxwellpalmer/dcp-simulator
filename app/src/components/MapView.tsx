import { useEffect, useMemo, useRef, useState } from "react";
import type { BlockId, DistrictId, Grid } from "../lib/types";
import { UNASSIGNED } from "../lib/types";
import type { VoterMap } from "../lib/voters";
import { districtColor, VOTER_COLORS } from "../lib/palette";

type PaintAction = "set" | "clear";

export interface SubLabel {
  district: DistrictId;
  cx: number;
  cy: number;
  lines: string[]; // one or more lines; rendered centered and stacked
}

interface Props {
  grid: Grid;
  // Block-level coloring: block id -> color (must be explicit, so combine
  // stage can color by final district while keeping sub-district labels).
  blockColors: Map<BlockId, string>;
  voters: VoterMap;
  showVoters: boolean;
  // Paint-mode props (for define stages). If both provided, drag-paint is on.
  paintCurrent?: DistrictId;
  onSetBlock?: (block: BlockId, district: DistrictId | null) => void;
  // Click-mode fallback (combine stage). Called on single click; no drag.
  onBlockClick?: (block: BlockId) => void;
  // Fired once at pointerdown before any set/click event. Use to snapshot
  // history so the entire interaction (e.g., a drag stroke) can be undone
  // as one step.
  onInteractionStart?: () => void;
  // Optional overlays for combine stage.
  labels?: SubLabel[];
  highlightedBlocks?: Set<BlockId>;
  dimmedBlocks?: Set<BlockId>;
  // Draw inner boundaries between different values of a per-block grouping.
  // Defaults to blockColors (so borders appear between differently colored blocks).
  boundaryGroup?: Map<BlockId, DistrictId>;
  // Optional: draw a thick outline around the perimeter of blocks whose
  // membership set matches. Used in combine stage to outline the selected
  // sub-district without drawing internal hex edges.
  perimeterBlocks?: Set<BlockId>;
}

export function MapView({
  grid,
  blockColors,
  voters,
  showVoters,
  paintCurrent,
  onSetBlock,
  onBlockClick,
  labels,
  highlightedBlocks,
  dimmedBlocks,
  boundaryGroup,
  perimeterBlocks,
  onInteractionStart,
}: Props) {
  const bbox = useMemo(() => computeBbox(grid), [grid]);

  const [dragAction, setDragAction] = useState<PaintAction | null>(null);
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

  const paintEnabled = paintCurrent !== undefined && onSetBlock !== undefined;

  const applyAction = (id: BlockId, action: PaintAction) => {
    if (!paintEnabled) return;
    if (touchedRef.current.has(id)) return;
    touchedRef.current.add(id);
    // In paint mode, we don't know current assignment — but caller sees it.
    // We always emit the action; caller can short-circuit if block is already
    // in that state. Simpler: we ask caller to idempotently handle it.
    if (action === "set") onSetBlock!(id, paintCurrent!);
    else onSetBlock!(id, null);
  };

  const handlePointerDown = (id: BlockId) => (e: React.PointerEvent) => {
    e.preventDefault();
    onInteractionStart?.();
    if (paintEnabled) {
      // Determine action by looking at the current color: if already "current",
      // clear; else set. We don't have assignment here, so use a separate API:
      // caller has to pass a predicate. Keep it simple: emit "set" always on
      // initial down, the caller can toggle by re-dragging to clear.
      // To match the prior behavior, we keep toggling: ask caller via API.
      const action: PaintAction = initialAction(id);
      setDragAction(action);
      touchedRef.current = new Set();
      applyAction(id, action);
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } else if (onBlockClick) {
      onBlockClick(id);
    }
  };

  // Heuristic to determine initial paint action: if the block's color
  // matches the "current district" color, this is a clear; else set.
  const initialAction = (id: BlockId): PaintAction => {
    if (!paintEnabled) return "set";
    const cur = blockColors.get(id);
    const currentColor = districtColor(paintCurrent!);
    return cur === currentColor ? "clear" : "set";
  };

  const handlePointerEnter = (id: BlockId) => () => {
    if (dragAction) applyAction(id, dragAction);
  };

  const groupFor = (id: BlockId): DistrictId => {
    if (boundaryGroup) return boundaryGroup.get(id) ?? UNASSIGNED;
    // Fallback: use color identity as group key via a simple hash
    return 0;
  };

  const padding = 0.3;
  const vbW = bbox.maxX - bbox.minX + padding * 2;
  const vbH = bbox.maxY - bbox.minY + padding * 2;

  return (
    <svg
      viewBox={`${bbox.minX - padding} ${bbox.minY - padding} ${vbW} ${vbH}`}
      className="w-full h-full select-none"
      style={{ transform: "scaleY(-1)", touchAction: "none" }}
      role="img"
      aria-label={`District map with ${grid.blocks.length} blocks.`}
    >
      <title>District map ({grid.blocks.length} blocks)</title>
      {grid.blocks.map((b) => {
        const fill = blockColors.get(b.id) ?? "#f3f4f6";
        const points = b.vertices.map(([x, y]) => `${x},${y}`).join(" ");
        const highlighted = highlightedBlocks?.has(b.id) ?? false;
        const dimmed = dimmedBlocks?.has(b.id) ?? false;
        return (
          <polygon
            key={b.id}
            points={points}
            fill={fill}
            stroke={highlighted ? "#000" : "#999"}
            strokeWidth={highlighted ? 0.04 : 0.01}
            style={{
              cursor: paintEnabled || onBlockClick ? "pointer" : "default",
              opacity: dimmed ? 0.35 : 1,
            }}
            onPointerDown={handlePointerDown(b.id)}
            onPointerEnter={handlePointerEnter(b.id)}
          />
        );
      })}

      {boundaryGroup &&
        grid.innerLines.map((ln, i) => {
          const ga = groupFor(ln.a);
          const gb = groupFor(ln.b);
          if (ga === gb) return null;
          return (
            <line
              key={i}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke="#111"
              strokeWidth={0.04}
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

      {perimeterBlocks &&
        grid.innerLines.map((ln, i) => {
          const inA = perimeterBlocks.has(ln.a);
          const inB = perimeterBlocks.has(ln.b);
          if (inA === inB) return null;
          return (
            <line
              key={`perim-${i}`}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke="#111"
              strokeWidth={0.08}
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })}

      {showVoters &&
        grid.blocks.map((b) => {
          const v = voters.get(b.id);
          if (!v) return null;
          if (v === "A") {
            return (
              <circle
                key={b.id}
                cx={b.cx}
                cy={b.cy}
                r={0.12}
                fill={VOTER_COLORS.A}
                stroke="#000"
                strokeWidth={0.015}
                pointerEvents="none"
              />
            );
          }
          // Party B: upward-pointing triangle (apex at larger y, which renders
          // as "up" because the SVG is flipped with scaleY(-1)).
          const r = 0.16;
          const dx = r * Math.sqrt(3) / 2;
          const dy = r / 2;
          const points = `${b.cx},${b.cy + r} ${b.cx - dx},${b.cy - dy} ${b.cx + dx},${b.cy - dy}`;
          return (
            <polygon
              key={b.id}
              points={points}
              fill={VOTER_COLORS.B}
              stroke="#000"
              strokeWidth={0.02}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          );
        })}

      {labels &&
        labels.map((l, i) => {
          const fontSize = 0.24;
          const lineHeight = 0.28;
          const approxCharW = 0.15; // bold glyph avg at fontSize 0.24
          const n = l.lines.length;
          const maxChars = Math.max(...l.lines.map((s) => s.length));
          const boxW = maxChars * approxCharW + 0.12;
          const boxH = n * lineHeight + 0.04;
          return (
            <g key={i} transform="scale(1,-1)" pointerEvents="none">
              <rect
                x={l.cx - boxW / 2}
                y={-l.cy - boxH / 2}
                width={boxW}
                height={boxH}
                fill="#fff"
                rx={0.06}
                ry={0.06}
              />
              <text
                x={l.cx}
                y={-l.cy}
                fontSize={fontSize}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#111"
              >
                {l.lines.map((ln, j) => (
                  <tspan
                    key={j}
                    x={l.cx}
                    dy={j === 0 ? -((n - 1) / 2) * lineHeight : lineHeight}
                  >
                    {ln}
                  </tspan>
                ))}
              </text>
            </g>
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
