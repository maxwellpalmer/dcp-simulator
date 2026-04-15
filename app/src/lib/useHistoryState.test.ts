import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistoryState } from "./useHistoryState";

describe("useHistoryState", () => {
  it("set does not push history; commit does", () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => { result.current.set(1); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(1);
    act(() => { result.current.commit(); });
    expect(result.current.canUndo).toBe(true);
  });

  it("undo restores pre-commit state; redo restores post", () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => { result.current.commit(); result.current.set(1); });
    act(() => { result.current.undo(); });
    expect(result.current.state).toBe(0);
    expect(result.current.canRedo).toBe(true);
    act(() => { result.current.redo(); });
    expect(result.current.state).toBe(1);
  });

  it("drag-style workflow: one commit, many sets, single undo step", () => {
    const { result } = renderHook(() => useHistoryState(new Map<number, number>()));
    // Start of drag: snapshot empty map
    act(() => { result.current.commit(); });
    // During drag: many sets
    act(() => {
      result.current.set((m) => { const n = new Map(m); n.set(1, 1); return n; });
      result.current.set((m) => { const n = new Map(m); n.set(2, 1); return n; });
      result.current.set((m) => { const n = new Map(m); n.set(3, 1); return n; });
    });
    expect(result.current.state.size).toBe(3);
    // Single undo returns to empty
    act(() => { result.current.undo(); });
    expect(result.current.state.size).toBe(0);
  });

  it("set after undo clears future", () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => { result.current.commit(); result.current.set(1); });
    act(() => { result.current.undo(); });
    expect(result.current.canRedo).toBe(true);
    act(() => { result.current.set(2); });
    expect(result.current.canRedo).toBe(false);
  });

  it("reset clears history", () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => { result.current.commit(); result.current.set(1); });
    act(() => { result.current.reset(99); });
    expect(result.current.state).toBe(99);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
