// Google Form is cross-origin.
// STANSA SECURE FORM controls the exam session wrapper, timer, and lock state
// using browser timestamps (Date.now) and sessionStorage.
// It never accesses iframe.contentDocument or attempts DOM auto-submit on Google Form.

export type ExamControlStatus =
  | 'READY'
  | 'EXAM_STARTED'
  | 'EXAM_LOCKED'
  | 'EXAM_EXPIRED'
  | 'EXAM_FINISHED';

export type TimerVisualStatus =
  | 'NORMAL'
  | 'WARNING'
  | 'CRITICAL'
  | 'LAST_MINUTE'
  | 'EXPIRED';

export type TimerWarningThreshold = 15 | 5 | 1;

export interface TimerWarningFlags {
  warning15Shown: boolean;
  warning5Shown: boolean;
  warning1Shown: boolean;
}

export interface ExamTimerStateRecord extends TimerWarningFlags {
  examId: string;
  startedAt: number;
  endAt: number;
  status: ExamControlStatus;
}

export interface TimerWarningContent {
  threshold: TimerWarningThreshold;
  title: string;
  primaryMessage: string;
  secondaryMessage: string;
  severity: 'warning' | 'critical' | 'last-minute';
}

export const WARNING_15_MS = 15 * 60 * 1000;
export const WARNING_5_MS = 5 * 60 * 1000;
export const WARNING_1_MS = 1 * 60 * 1000;

export function getTimerStorageKeys(examId: string) {
  return {
    startedAt: `stansa_exam_started_at_${examId}`,
    endAt: `stansa_exam_end_at_${examId}`,
    status: `stansa_exam_status_${examId}`,
    warning15: `stansa_exam_warning_15_${examId}`,
    warning5: `stansa_exam_warning_5_${examId}`,
    warning1: `stansa_exam_warning_1_${examId}`,
  };
}

export function isValidExamDuration(durationMinutes: number): boolean {
  return (
    typeof durationMinutes === 'number' &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0
  );
}

/**
 * Formats remaining milliseconds into HH:MM:SS (>= 1 hour) or MM:SS (< 1 hour).
 * Examples:
 * - 90 min (5,400,000 ms) -> "01:30:00"
 * - 45m 30s -> "45:30"
 * - 10m 05s -> "10:05"
 * - 0 ms -> "00:00"
 */
export function formatTimeRemaining(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.ceil(safeMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

export function getTimerVisualStatus(remainingMs: number): TimerVisualStatus {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'EXPIRED';
  }
  if (remainingMs <= WARNING_1_MS) {
    return 'LAST_MINUTE';
  }
  if (remainingMs <= WARNING_5_MS) {
    return 'CRITICAL';
  }
  if (remainingMs <= WARNING_15_MS) {
    return 'WARNING';
  }
  return 'NORMAL';
}

/**
 * Determines which single warning threshold (if any) should trigger next.
 * Checks most urgent threshold first so returning after a long absence never
 * spams multiple stacked modals. Only triggers thresholds strictly below
 * the configured durationMinutes so short exams do not open an immediate
 * modal at second 0.
 */
export function evaluateNextTimerWarning(options: {
  remainingMs: number;
  durationMinutes: number;
  flags: TimerWarningFlags;
}): {
  triggered: TimerWarningThreshold | null;
  nextFlags: TimerWarningFlags;
} {
  const { remainingMs, durationMinutes, flags } = options;

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { triggered: null, nextFlags: flags };
  }

  if (
    remainingMs <= WARNING_1_MS &&
    durationMinutes >= 1 &&
    !flags.warning1Shown
  ) {
    return {
      triggered: 1,
      nextFlags: {
        warning15Shown: true,
        warning5Shown: true,
        warning1Shown: true,
      },
    };
  }

  if (
    remainingMs <= WARNING_5_MS &&
    durationMinutes > 5 &&
    !flags.warning5Shown
  ) {
    return {
      triggered: 5,
      nextFlags: {
        ...flags,
        warning15Shown: true,
        warning5Shown: true,
      },
    };
  }

  if (
    remainingMs <= WARNING_15_MS &&
    durationMinutes > 15 &&
    !flags.warning15Shown
  ) {
    return {
      triggered: 15,
      nextFlags: {
        ...flags,
        warning15Shown: true,
      },
    };
  }

  return { triggered: null, nextFlags: flags };
}

export function getTimerWarningContent(
  threshold: TimerWarningThreshold
): TimerWarningContent {
  switch (threshold) {
    case 15:
      return {
        threshold: 15,
        title: 'WAKTU UJIAN TERSISA 15 MENIT',
        primaryMessage: 'Waktu pengerjaan ujian Anda tersisa 15 menit.',
        secondaryMessage:
          'Periksa kembali jawaban Anda secara berkala sebelum waktu habis.',
        severity: 'warning',
      };
    case 5:
      return {
        threshold: 5,
        title: 'PERHATIAN',
        primaryMessage: 'Waktu ujian tinggal 5 menit.',
        secondaryMessage: 'Segera selesaikan jawaban Anda.',
        severity: 'critical',
      };
    case 1:
      return {
        threshold: 1,
        title: 'WAKTU HAMPIR HABIS',
        primaryMessage: 'Waktu ujian tersisa kurang dari 1 menit.',
        secondaryMessage: 'Selesaikan jawaban Anda sekarang.',
        severity: 'last-minute',
      };
  }
}

/**
 * Enforces strict exam status priority:
 * EXAM_EXPIRED (or EXAM_FINISHED once exited after expiry) -> EXAM_LOCKED -> EXAM_STARTED -> READY
 */
export function resolveExamControlStatus(options: {
  isExpired: boolean;
  isLocked: boolean;
  isStarted: boolean;
  isFinished?: boolean;
}): ExamControlStatus {
  if (options.isExpired && options.isFinished) return 'EXAM_FINISHED';
  if (options.isExpired) return 'EXAM_EXPIRED';
  if (options.isLocked) return 'EXAM_LOCKED';
  if (options.isStarted) return 'EXAM_STARTED';
  return 'READY';
}

/**
 * Exit button ("KELUAR DARI UJIAN") may ONLY be shown when status is EXAM_EXPIRED.
 * It must remain strictly hidden during EXAM_STARTED and EXAM_LOCKED.
 */
export function canShowExitButton(status: ExamControlStatus): boolean {
  return status === 'EXAM_EXPIRED';
}

function parsePositiveTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function loadExamTimerRecord(
  examId: string
): ExamTimerStateRecord | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const keys = getTimerStorageKeys(examId);
    const startedAt = parsePositiveTimestamp(
      window.sessionStorage.getItem(keys.startedAt)
    );
    const endAt = parsePositiveTimestamp(
      window.sessionStorage.getItem(keys.endAt)
    );

    if (startedAt === null || endAt === null || endAt <= startedAt) {
      return null;
    }

    const rawStatus = window.sessionStorage.getItem(keys.status);
    const status: ExamControlStatus =
      rawStatus === 'EXAM_EXPIRED' ||
      rawStatus === 'EXAM_LOCKED' ||
      rawStatus === 'EXAM_STARTED' ||
      rawStatus === 'EXAM_FINISHED'
        ? rawStatus
        : 'EXAM_STARTED';

    return {
      examId,
      startedAt,
      endAt,
      status,
      warning15Shown: window.sessionStorage.getItem(keys.warning15) === '1',
      warning5Shown: window.sessionStorage.getItem(keys.warning5) === '1',
      warning1Shown: window.sessionStorage.getItem(keys.warning1) === '1',
    };
  } catch {
    return null;
  }
}

export function initializeOrLoadExamTimer(
  examId: string,
  durationMinutes: number,
  nowMs: number = Date.now()
): ExamTimerStateRecord {
  const existing = loadExamTimerRecord(examId);
  if (existing) {
    if (existing.status === 'EXAM_FINISHED') {
      return existing;
    }
    if (nowMs >= existing.endAt && existing.status !== 'EXAM_EXPIRED') {
      const expiredRecord: ExamTimerStateRecord = {
        ...existing,
        status: 'EXAM_EXPIRED',
      };
      saveExamTimerRecord(expiredRecord);
      return expiredRecord;
    }
    return existing;
  }

  const startedAt = nowMs;
  const safeDuration = isValidExamDuration(durationMinutes)
    ? durationMinutes
    : 0;
  const endAt = startedAt + safeDuration * 60 * 1000;
  const status: ExamControlStatus =
    nowMs >= endAt ? 'EXAM_EXPIRED' : 'EXAM_STARTED';

  const fresh: ExamTimerStateRecord = {
    examId,
    startedAt,
    endAt,
    status,
    warning15Shown: false,
    warning5Shown: false,
    warning1Shown: false,
  };

  saveExamTimerRecord(fresh);
  return fresh;
}

export function saveExamTimerRecord(record: ExamTimerStateRecord): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    const keys = getTimerStorageKeys(record.examId);
    window.sessionStorage.setItem(keys.startedAt, String(record.startedAt));
    window.sessionStorage.setItem(keys.endAt, String(record.endAt));
    window.sessionStorage.setItem(keys.status, record.status);
    window.sessionStorage.setItem(
      keys.warning15,
      record.warning15Shown ? '1' : '0'
    );
    window.sessionStorage.setItem(
      keys.warning5,
      record.warning5Shown ? '1' : '0'
    );
    window.sessionStorage.setItem(
      keys.warning1,
      record.warning1Shown ? '1' : '0'
    );
    return true;
  } catch {
    return false;
  }
}

export function isPersistedExamExpired(
  examId: string,
  nowMs: number = Date.now()
): boolean {
  const record = loadExamTimerRecord(examId);
  if (!record) return false;
  return (
    record.status === 'EXAM_EXPIRED' ||
    record.status === 'EXAM_FINISHED' ||
    nowMs >= record.endAt
  );
}
