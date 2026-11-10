// Exam rules shown to students. Grading itself happens in the database (submit_exam).
export const EXAM_MINUTES = 20;
export const QUESTIONS_PER_EXAM = 30;
export const POINTS_PER_CORRECT = 2;
export const MAX_SCORE = QUESTIONS_PER_EXAM * POINTS_PER_CORRECT;
export const PIN_LENGTH = 11;

export type ExamOption = "A" | "B" | "C";

/** Seconds left before `expiresAtMs`, using the server clock (client time + offset). */
export function remainingSeconds(expiresAtMs: number, clientNowMs: number, clockOffsetMs = 0) {
  return Math.max(0, Math.ceil((expiresAtMs - (clientNowMs + clockOffsetMs)) / 1000));
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatPin(pin: string) {
  return pin.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");
}

const SESSION_KEY = "rsu-cbt-session";
export type StoredSession = { token: string; slug: string };

export function saveExamSession(session: StoredSession) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readExamSession(): StoredSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function clearExamSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}
