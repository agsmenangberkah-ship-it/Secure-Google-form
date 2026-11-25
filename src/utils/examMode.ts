export interface TabSwitchRecord {
  tabSwitchDetected: true;
  lastDetectedAt: string;
}

const TAB_SWITCH_KEY_PREFIX = 'stansa_exam_tab_switch_';

export function getTabSwitchStorageKey(examId: string): string {
  return `${TAB_SWITCH_KEY_PREFIX}${examId}`;
}

export function createTabSwitchRecord(
  nowIso: string = new Date().toISOString()
): TabSwitchRecord {
  return {
    tabSwitchDetected: true,
    lastDetectedAt: nowIso,
  };
}

export function parseTabSwitchRecord(raw: string | null): TabSwitchRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (
      record.tabSwitchDetected === true &&
      typeof record.lastDetectedAt === 'string' &&
      record.lastDetectedAt.trim().length > 0
    ) {
      return {
        tabSwitchDetected: true,
        lastDetectedAt: record.lastDetectedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTabSwitchEvent(
  examId: string,
  nowIso: string = new Date().toISOString()
): TabSwitchRecord {
  const record = createTabSwitchRecord(nowIso);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(
        getTabSwitchStorageKey(examId),
        JSON.stringify(record)
      );
    } catch {
      // Ignore storage quota / privacy mode restrictions
    }
  }
  return record;
}

export function loadTabSwitchEvent(examId: string): TabSwitchRecord | null {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(getTabSwitchStorageKey(examId));
    return parseTabSwitchRecord(raw);
  } catch {
    return null;
  }
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  return Boolean(
    (doc.fullscreenEnabled || doc.webkitFullscreenEnabled) &&
      (typeof el.requestFullscreen === 'function' ||
        typeof el.webkitRequestFullscreen === 'function')
  );
}

export async function requestAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (isDocumentFullscreen()) return true;

  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return isDocumentFullscreen();
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await Promise.resolve(el.webkitRequestFullscreen());
      return isDocumentFullscreen();
    }
    return false;
  } catch {
    return false;
  }
}

export async function exitAppFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!isDocumentFullscreen()) return;

  const doc = document as FullscreenDocument;
  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await Promise.resolve(doc.webkitExitFullscreen());
    }
  } catch {
    // Ignore browser fullscreen exit restrictions
  }
}

export type ActiveExamOverlay =
  | 'fullscreen-failed'
  | 'fullscreen-exited'
  | 'tab-switch'
  | 'back-navigation'
  | null;

export interface ExamOverlayFlags {
  fullscreenFailed: boolean;
  fullscreenExited: boolean;
  tabSwitchWarning: boolean;
  backNavigationWarning: boolean;
}

export function resolveActiveExamOverlay(
  flags: ExamOverlayFlags
): ActiveExamOverlay {
  if (flags.fullscreenExited) return 'fullscreen-exited';
  if (flags.fullscreenFailed) return 'fullscreen-failed';
  if (flags.tabSwitchWarning) return 'tab-switch';
  if (flags.backNavigationWarning) return 'back-navigation';
  return null;
}
