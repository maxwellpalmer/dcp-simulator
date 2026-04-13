// Thin client for Netlify Functions session API.
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  SessionStateResponse,
  StartRoundRequest,
  SubmitCombineRequest,
  SubmitDefineRequest,
  AdvanceRequest,
  EndSessionRequest,
  VerifyTeacherRequest,
} from "../../shared/session";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createSession: (body: CreateSessionRequest) =>
    call<CreateSessionResponse>("/api/session/create", body),

  joinSession: (body: JoinSessionRequest) =>
    call<JoinSessionResponse>("/api/session/join", body),

  getState: (code: string, studentId?: string) => {
    const q = new URLSearchParams({ code });
    if (studentId) q.set("studentId", studentId);
    return call<SessionStateResponse>(`/api/session/state?${q}`);
  },

  startRound: (body: StartRoundRequest) =>
    call<{ ok: true }>("/api/session/start-round", body),

  submitDefine: (body: SubmitDefineRequest) =>
    call<{ ok: true; roundStatus: string }>("/api/session/submit-define", body),

  submitCombine: (body: SubmitCombineRequest) =>
    call<{ ok: true; roundStatus: string }>("/api/session/submit-combine", body),

  advance: (body: AdvanceRequest) =>
    call<{ ok: true }>("/api/session/advance", body),

  endSession: (body: EndSessionRequest) =>
    call<{ ok: true }>("/api/session/end", body),

  verifyTeacher: (body: VerifyTeacherRequest) =>
    call<{ ok: true; teacherToken: string }>("/api/session/verify-teacher", body),
};
