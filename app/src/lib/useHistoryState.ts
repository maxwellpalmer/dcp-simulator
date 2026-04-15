import { useCallback, useEffect, useRef, useState } from "react";

export interface HistoryState<T> {
  state: T;
  set: (next: T | ((prev: T) => T)) => void;
  // Snapshot current state as an undoable entry. Call BEFORE an edit (e.g.,
  // at the start of a drag) to save the pre-edit value.
  commit: () => void;
  undo: () => void;
  redo: () => void;
  reset: (value: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

// A simple past/present/future history stack. The caller explicitly marks
// commit points; set() overwrites the present without recording. This lets
// a drag-paint interaction collapse into a single undoable entry: parent
// calls commit() once at pointerdown, then emits many set() calls during
// the drag, and the undo returns to the pre-drag state.
export function useHistoryState<T>(initial: T): HistoryState<T> {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);
  // Keep a ref to present so commit() reads the live value even when the
  // caller wraps it in another hook's useCallback.
  const presentRef = useRef(present);
  presentRef.current = present;

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setPresent((prev) =>
      typeof next === "function" ? (next as (p: T) => T)(prev) : next,
    );
    setFuture([]);
  }, []);

  const commit = useCallback(() => {
    const cur = presentRef.current;
    setPast((p) => (p.length > 0 && p[p.length - 1] === cur ? p : [...p, cur]));
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [presentRef.current, ...f]);
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, presentRef.current]);
      setPresent(next);
      return f.slice(1);
    });
  }, []);

  const reset = useCallback((val: T) => {
    setPast([]);
    setFuture([]);
    setPresent(val);
  }, []);

  return {
    state: present,
    set,
    commit,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

// Wires Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) to a HistoryState.
// Skips when focus is in a text input.
export function useUndoShortcuts<T>(h: HistoryState<T>): void {
  const { undo, redo } = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}
