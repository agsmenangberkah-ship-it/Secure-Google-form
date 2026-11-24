import type { SecurityConfig, ViolationAction } from './examConfig';

// Google Form is cross-origin.
// Parent page cannot access or modify the iframe DOM.
// Security controls apply to the STANSA wrapper/browser-level events
// that are available to the page.
//
// Browser-based security is deterrence and detection only.
// Websites cannot block OS Home/Recent Apps buttons, OS screenshots,
// screen recording, external devices, or detect which external app was opened.

export type ViolationType =
  | 'APP_SWITCH'
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'COPY'
  | 'PASTE'
  | 'CUT'
  | 'CONTEXT_MENU'
  | 'TEXT_SELECTION'
  | 'DEVTOOLS_ATTEMPT'
  | 'PRINT_ATTEMPT';

export type ExamLockStatus = 'ACTIVE' | 'LOCKED';

export interface ViolationRecord {
  type: ViolationType;
  reason?: string;
  timestamp: number;
}

export interface ViolationHistory {
  examId: string;
  count: number;
  violationCount: number;
  examStatus: ExamLockStatus;
  violations: ViolationRecord[];
}

export interface LastViolationState {
  type: ViolationType | null;
  timestamp: number;
}

export interface ViolationEventInput {
  type: ViolationType;
  reason?: string;
}

export interface KeydownEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
}

export interface KeydownSecurityDecision {
  block: boolean;
  violationType: ViolationType | null;
}

export interface EscalatingWarningContent {
  title: string;
  primaryMessage: string;
  secondaryMessage: string;
  warningFooter?: string;
  isFullscreenExit: boolean;
}

export const VIOLATION_DEBOUNCE_MS = 1000;
export const EXIT_EVENT_COOLDOWN_MS = 2000;

export const EXIT_VIOLATION_TYPES: readonly ViolationType[] = [
  'APP_SWITCH',
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
];

export const VALID_VIOLATION_TYPES: readonly ViolationType[] = [
  'APP_SWITCH',
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'COPY',
  'PASTE',
  'CUT',
  'CONTEXT_MENU',
  'TEXT_SELECTION',
  'DEVTOOLS_ATTEMPT',
  'PRINT_ATTEMPT',
];

export const VIOLATION_LABELS: Record<ViolationType, string> = {
  APP_SWITCH: 'MENINGGALKAN HALAMAN UJIAN (APP_SWITCH)',
  TAB_SWITCH: 'PINDAH TAB (TAB_SWITCH)',
  WINDOW_BLUR: 'KELUAR JENDELA UJIAN (WINDOW_BLUR)',
  FULLSCREEN_EXIT: 'KELUAR LAYAR PENUH (FULLSCREEN_EXIT)',
  COPY: 'COPY',
  PASTE: 'PASTE',
  CUT: 'CUT',
  CONTEXT_MENU: 'KLIK KANAN (CONTEXT_MENU)',
  TEXT_SELECTION: 'SELEKSI TEKS (TEXT_SELECTION)',
  DEVTOOLS_ATTEMPT: 'DEVTOOLS / INSPECT (DEVTOOLS_ATTEMPT)',
  PRINT_ATTEMPT: 'CETAK HALAMAN (PRINT_ATTEMPT)',
};

const VIOLATION_STORAGE_PREFIX = 'stansa_secure_violation_';

export function getViolationStorageKey(examId: string): string {
  return `${VIOLATION_STORAGE_PREFIX}${examId}`;
}

export function isMobileDevice(
  userAgent?: string,
  hasCoarsePointer?: boolean
): boolean {
  const ua =
    typeof userAgent === 'string'
      ? userAgent
      : typeof navigator !== 'undefined'
        ? navigator.userAgent
        : '';

  const mobileUaMatch = /Android|iPhone|iPad|iPod/i.test(ua);

  const coarsePointer =
    typeof hasCoarsePointer === 'boolean'
      ? hasCoarsePointer
      : typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;

  return mobileUaMatch || coarsePointer;
}

export function isExitViolationType(type: ViolationType): boolean {
  return EXIT_VIOLATION_TYPES.includes(type);
}

export function hasAnyActiveSecurity(security: SecurityConfig): boolean {
  return Boolean(
    security.fullscreen ||
      security.blockCopy ||
      security.blockPaste ||
      security.blockCut ||
      security.blockContextMenu ||
      security.blockSelection ||
      security.detectTabSwitch ||
      security.detectFullscreenExit
  );
}

export function isViolationTypeEnabled(
  type: ViolationType,
  security: SecurityConfig
): boolean {
  switch (type) {
    case 'COPY':
      return security.blockCopy;
    case 'PASTE':
      return security.blockPaste;
    case 'CUT':
      return security.blockCut;
    case 'CONTEXT_MENU':
      return security.blockContextMenu;
    case 'TEXT_SELECTION':
      return security.blockSelection;
    case 'APP_SWITCH':
    case 'TAB_SWITCH':
    case 'WINDOW_BLUR':
      return security.detectTabSwitch;
    case 'FULLSCREEN_EXIT':
      return security.fullscreen && security.detectFullscreenExit;
    case 'DEVTOOLS_ATTEMPT':
    case 'PRINT_ATTEMPT':
      return hasAnyActiveSecurity(security);
    default:
      return false;
  }
}

export function evaluateSecurityKeydown(
  event: KeydownEventLike,
  security: SecurityConfig
): KeydownSecurityDecision {
  if (!hasAnyActiveSecurity(security)) {
    return { block: false, violationType: null };
  }

  const rawKey = typeof event.key === 'string' ? event.key : '';
  const key = rawKey.toLowerCase();
  const ctrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
  const shift = Boolean(event.shiftKey);
  const alt = Boolean(event.altKey);

  // Developer Tools shortcuts (checked before Ctrl+C so Ctrl+Shift+C maps to DEVTOOLS_ATTEMPT)
  if (rawKey === 'F12' || key === 'f12') {
    return { block: true, violationType: 'DEVTOOLS_ATTEMPT' };
  }

  if (ctrlOrMeta && shift && (key === 'i' || key === 'j' || key === 'c')) {
    return { block: true, violationType: 'DEVTOOLS_ATTEMPT' };
  }

  if (ctrlOrMeta && !shift && !alt && key === 'u') {
    return { block: true, violationType: 'DEVTOOLS_ATTEMPT' };
  }

  // Print shortcut
  if (ctrlOrMeta && !shift && !alt && key === 'p') {
    return { block: true, violationType: 'PRINT_ATTEMPT' };
  }

  // Save page shortcut (prevent saving HTML cleanly without blocking normal typing)
  if (ctrlOrMeta && !shift && !alt && key === 's') {
    return { block: true, violationType: null };
  }

  // Clipboard & selection shortcuts (strictly controlled by per-feature admin config)
  if (security.blockCopy && ctrlOrMeta && !shift && !alt && key === 'c') {
    return { block: true, violationType: 'COPY' };
  }

  if (security.blockPaste && ctrlOrMeta && !shift && !alt && key === 'v') {
    return { block: true, violationType: 'PASTE' };
  }

  if (security.blockCut && ctrlOrMeta && !shift && !alt && key === 'x') {
    return { block: true, violationType: 'CUT' };
  }

  if (security.blockSelection && ctrlOrMeta && !shift && !alt && key === 'a') {
    return { block: true, violationType: 'TEXT_SELECTION' };
  }

  return { block: false, violationType: null };
}

export function shouldDebounceViolation(
  last: LastViolationState,
  type: ViolationType,
  nowMs: number,
  intervalMs: number = VIOLATION_DEBOUNCE_MS
): boolean {
  if (last.type === null || last.timestamp <= 0) return false;
  return last.type === type && nowMs - last.timestamp < intervalMs;
}

/**
 * Shared cooldown across leave-page / focus / fullscreen-exit events
 * so one Home / Recent Apps / Fullscreen Exit action firing
 * visibilitychange + blur + pagehide + fullscreenchange counts strictly as +1.
 */
export function shouldSuppressExitEvent(
  lastExitEventAtMs: number,
  nowMs: number,
  cooldownMs: number = EXIT_EVENT_COOLDOWN_MS
): boolean {
  if (lastExitEventAtMs <= 0) return false;
  return nowMs - lastExitEventAtMs < cooldownMs;
}

export function shouldLockExamOnViolation(options: {
  violationCount: number;
  maxViolations: number;
  violationAction: ViolationAction;
  isMobile: boolean;
}): boolean {
  const { violationCount, maxViolations, violationAction, isMobile } = options;
  if (maxViolations <= 0 || violationCount < maxViolations) {
    return false;
  }
  // Mobile Strict Mode always locks at maxViolations.
  // On desktop, lock when action is 'lock' or 'end' (default is 'lock').
  if (isMobile) {
    return true;
  }
  return violationAction !== 'warn';
}

export function getEscalatingWarningContent(options: {
  violationCount: number;
  maxViolations: number;
  violationType: ViolationType;
}): EscalatingWarningContent {
  const { violationCount, maxViolations, violationType } = options;

  if (violationType === 'FULLSCREEN_EXIT') {
    return {
      title: 'ANDA KELUAR DARI MODE LAYAR PENUH',
      primaryMessage: 'Anda keluar dari mode layar penuh ujian.',
      secondaryMessage:
        violationCount === maxViolations - 1
          ? 'Peringatan terakhir akan menyebabkan ujian dikunci.'
          : 'Aktifkan kembali mode layar penuh untuk melanjutkan ujian.',
      isFullscreenExit: true,
    };
  }

  const isLeaveEvent =
    violationType === 'APP_SWITCH' ||
    violationType === 'TAB_SWITCH' ||
    violationType === 'WINDOW_BLUR';

  if (isLeaveEvent) {
    if (violationCount <= 1) {
      return {
        title: 'PERINGATAN 1',
        primaryMessage: 'Anda meninggalkan halaman ujian.',
        secondaryMessage:
          'Jangan membuka aplikasi lain selama ujian berlangsung.',
        isFullscreenExit: false,
      };
    }

    const isPenultimate = violationCount === maxViolations - 1;

    if (violationCount === 2) {
      return {
        title: 'PERINGATAN 2',
        primaryMessage: 'Anda kembali meninggalkan halaman ujian.',
        secondaryMessage: 'Ini adalah peringatan kedua.',
        warningFooter: isPenultimate
          ? 'Peringatan terakhir akan menyebabkan ujian dikunci.'
          : undefined,
        isFullscreenExit: false,
      };
    }

    return {
      title: `PERINGATAN ${violationCount}`,
      primaryMessage: 'Anda kembali meninggalkan halaman ujian.',
      secondaryMessage:
        'Jangan membuka aplikasi atau tab lain selama ujian berlangsung.',
      warningFooter: isPenultimate
        ? 'Peringatan terakhir akan menyebabkan ujian dikunci.'
        : undefined,
      isFullscreenExit: false,
    };
  }

  return {
    title: `PERINGATAN ${Math.max(1, violationCount)}`,
    primaryMessage: 'Aktivitas tidak diperbolehkan.',
    secondaryMessage:
      violationCount === maxViolations - 1
        ? 'Peringatan terakhir akan menyebabkan ujian dikunci.'
        : 'Tetap fokus pada halaman ujian hingga selesai.',
    isFullscreenExit: false,
  };
}

export function createEmptyViolationHistory(
  examId: string = ''
): ViolationHistory {
  return {
    examId,
    count: 0,
    violationCount: 0,
    examStatus: 'ACTIVE',
    violations: [],
  };
}

export function appendViolationRecord(
  history: ViolationHistory,
  type: ViolationType,
  timestamp: number = Date.now(),
  options?: {
    examId?: string;
    reason?: string;
    lockExam?: boolean;
  }
): ViolationHistory {
  const nextRecord: ViolationRecord = options?.reason
    ? { type, reason: options.reason, timestamp }
    : { type, timestamp };
  const nextViolations = [...history.violations, nextRecord];
  const nextCount = nextViolations.length;
  const nextStatus: ExamLockStatus =
    history.examStatus === 'LOCKED' || options?.lockExam ? 'LOCKED' : 'ACTIVE';

  return {
    examId: options?.examId ?? history.examId,
    count: nextCount,
    violationCount: nextCount,
    examStatus: nextStatus,
    violations: nextViolations,
  };
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function parseViolationHistory(
  raw: string | null,
  examId: string = ''
): ViolationHistory {
  if (!raw) return createEmptyViolationHistory(examId);

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return createEmptyViolationHistory(examId);
    }

    const record = parsed as Record<string, unknown>;
    const validRecords: ViolationRecord[] = [];

    if (Array.isArray(record.violations)) {
      for (const item of record.violations) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          continue;
        }
        const entry = item as Record<string, unknown>;
        const timestamp = normalizeTimestamp(entry.timestamp);
        if (
          typeof entry.type === 'string' &&
          VALID_VIOLATION_TYPES.includes(entry.type as ViolationType) &&
          timestamp !== null
        ) {
          validRecords.push(
            typeof entry.reason === 'string' && entry.reason.trim().length > 0
              ? {
                  type: entry.type as ViolationType,
                  reason: entry.reason,
                  timestamp,
                }
              : {
                  type: entry.type as ViolationType,
                  timestamp,
                }
          );
        }
      }
    }

    const storedCount =
      typeof record.violationCount === 'number' &&
      Number.isFinite(record.violationCount)
        ? record.violationCount
        : typeof record.count === 'number' && Number.isFinite(record.count)
          ? record.count
          : 0;
    const resolvedCount = Math.max(validRecords.length, Math.max(0, Math.floor(storedCount)));
    const resolvedStatus: ExamLockStatus =
      record.examStatus === 'LOCKED' ? 'LOCKED' : 'ACTIVE';
    const resolvedExamId =
      typeof record.examId === 'string' && record.examId.trim().length > 0
        ? record.examId
        : examId;

    return {
      examId: resolvedExamId,
      count: resolvedCount,
      violationCount: resolvedCount,
      examStatus: resolvedStatus,
      violations: validRecords,
    };
  } catch {
    return createEmptyViolationHistory(examId);
  }
}

export function loadViolationHistory(examId: string): ViolationHistory {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return createEmptyViolationHistory(examId);
  }
  try {
    const raw = window.sessionStorage.getItem(getViolationStorageKey(examId));
    return parseViolationHistory(raw, examId);
  } catch {
    return createEmptyViolationHistory(examId);
  }
}

export function saveViolationHistory(
  examId: string,
  history: ViolationHistory
): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }
  try {
    const payload: ViolationHistory = {
      ...history,
      examId,
      count: history.count,
      violationCount: history.count,
    };
    window.sessionStorage.setItem(
      getViolationStorageKey(examId),
      JSON.stringify(payload)
    );
    return true;
  } catch {
    return false;
  }
}
