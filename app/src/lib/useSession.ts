import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { SessionStateResponse } from "../../shared/session";

const POLL_MS = 2000;

export interface UseSessionArgs {
  code: string | null;
  studentId: string | null;
}

export interface UseSessionResult {
  state: SessionStateResponse | null;
  error: string | null;
  loading: boolean;
  // True if server said the session doesn't exist or ended. Client should
  // clear local identity and offer to return to landing.
  sessionGone: boolean;
  // True if polling is currently failing (transient) but we still have
  // last-known state.
  offline: boolean;
  refresh: () => Promise<void>;
}

export function useSession({ code, studentId }: UseSessionArgs): UseSessionResult {
  const [state, setState] = useState<SessionStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionGone, setSessionGone] = useState(false);
  const [offline, setOffline] = useState(false);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const s = await api.getState(code, studentId ?? undefined);
      setState(s);
      setError(null);
      setOffline(false);
      setSessionGone(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Treat "Unknown session" as session gone (server already ended/deleted).
      if (/unknown session|not found|404/i.test(msg)) {
        setSessionGone(true);
        setError(msg);
        setOffline(false);
      } else {
        // Transient error: keep last state, show offline indicator.
        setOffline(true);
        setError(msg);
      }
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

  return { state, error, loading, sessionGone, offline, refresh };
}
