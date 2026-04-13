// localStorage helpers for session identity.

const KEY_STUDENT = (code: string) => `dcp:session:${code}:studentId`;
const KEY_NAME = (code: string) => `dcp:session:${code}:name`;
const KEY_TEACHER = (code: string) => `dcp:session:${code}:teacherToken`;

export function getStudent(code: string): { id: string; name: string } | null {
  const id = localStorage.getItem(KEY_STUDENT(code));
  const name = localStorage.getItem(KEY_NAME(code));
  if (!id || !name) return null;
  return { id, name };
}

export function saveStudent(code: string, id: string, name: string): void {
  localStorage.setItem(KEY_STUDENT(code), id);
  localStorage.setItem(KEY_NAME(code), name);
}

export function clearStudent(code: string): void {
  localStorage.removeItem(KEY_STUDENT(code));
  localStorage.removeItem(KEY_NAME(code));
}

export function getTeacherToken(code: string): string | null {
  return localStorage.getItem(KEY_TEACHER(code));
}

export function saveTeacherToken(code: string, token: string): void {
  localStorage.setItem(KEY_TEACHER(code), token);
}
