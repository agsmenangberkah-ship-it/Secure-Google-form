import type { StudentEntryInput } from './examConfig';

export interface StudentExamSession {
  examId: string;
  studentName: string;
  studentId: string;
  studentClass: string;
  startedAt: string;
}

const SESSION_KEY_PREFIX = 'stansa_exam_session_';

export function getStudentSessionStorageKey(examId: string): string {
  return `${SESSION_KEY_PREFIX}${examId}`;
}

export function createStudentSession(
  examId: string,
  input: StudentEntryInput,
  startedAt: string = new Date().toISOString()
): StudentExamSession {
  return {
    examId,
    studentName: input.fullName.trim(),
    studentId: input.studentId.trim(),
    studentClass: input.selectedClass,
    startedAt,
  };
}

export function parseStudentSession(
  raw: string | null,
  expectedExamId: string,
  allowedClasses: readonly string[]
): StudentExamSession | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const { examId, studentName, studentId, studentClass, startedAt } = record;

    if (
      typeof examId !== 'string' ||
      examId !== expectedExamId ||
      typeof studentName !== 'string' ||
      !studentName.trim() ||
      typeof studentId !== 'string' ||
      !studentId.trim() ||
      typeof studentClass !== 'string' ||
      !allowedClasses.includes(studentClass) ||
      typeof startedAt !== 'string' ||
      !startedAt.trim()
    ) {
      return null;
    }

    return {
      examId,
      studentName: studentName.trim(),
      studentId: studentId.trim(),
      studentClass,
      startedAt,
    };
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentExamSession): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }
  try {
    window.sessionStorage.setItem(
      getStudentSessionStorageKey(session.examId),
      JSON.stringify(session)
    );
    return true;
  } catch {
    return false;
  }
}

export function loadStudentSession(
  examId: string,
  allowedClasses: readonly string[]
): StudentExamSession | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(getStudentSessionStorageKey(examId));
    return parseStudentSession(raw, examId, allowedClasses);
  } catch {
    return null;
  }
}
