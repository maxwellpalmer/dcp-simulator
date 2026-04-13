import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { SessionStateResponse } from "../../shared/session";

const POLL_MS = 2000;

export interface UseSessionArgs {
  code: string | null;
  studentId: string | null;
}

export function useSession({ code, studentId }: UseSessionArgs) {
  const [state, setState] = useState<SessionStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const s = await api.getState(code, studentId ?? undefined);
      setState(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [code, studentId]);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    refresh();
    timerRef.current = window.setInterval(refresh, POLL_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [code, refresh]);

  return { state, error, loading, refresh };
}
