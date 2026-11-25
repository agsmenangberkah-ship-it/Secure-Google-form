import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  LogOut,
  Maximize,
  RefreshCw,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { useExamSecurity } from '../hooks/useExamSecurity';
import { useExamTimer } from '../hooks/useExamTimer';
import {
  SCHOOL_INFO,
  toGoogleFormEmbedUrl,
  type ExamConfig,
} from '../utils/examConfig';
import {
  exitAppFullscreen,
  isDocumentFullscreen,
  isFullscreenSupported,
  requestAppFullscreen,
} from '../utils/examMode';
import {
  VIOLATION_LABELS,
  appendViolationRecord,
  getEscalatingWarningContent,
  hasAnyActiveSecurity,
  isMobileDevice,
  loadViolationHistory,
  saveViolationHistory,
  shouldLockExamOnViolation,
  type ViolationEventInput,
  type ViolationHistory,
  type ViolationType,
} from '../utils/examSecurity';
import {
  canShowExitButton,
  getTimerWarningContent,
  resolveExamControlStatus,
  type TimerVisualStatus,
} from '../utils/examTimer';
import type { StudentExamSession } from '../utils/studentSession';

// Admin access is intentionally separated from the student exam interface.
// Admin panel tidak ditautkan dari halaman ujian siswa.
//
// STANSA SECURE FORM is a browser-based exam wrapper.
// Security controls are deterrence and session controls,
// not a replacement for OS-level kiosk/device management.
//
// Google Form is cross-origin.
// Parent page cannot access or modify the iframe DOM.
// Security controls and exam timer apply to the STANSA wrapper/browser-level
// events that are available to the page.
//
// STANSA SECURE FORM controls the exam session in the browser using
// timestamp-based timing and sessionStorage. It does not auto-submit Google Form
// or claim absolute OS-level lock.

interface StudentExamStartedViewProps {
  config: ExamConfig;
  session: StudentExamSession;
  initialFullscreenFailed: boolean;
}

function getTimerBadgeClasses(status: TimerVisualStatus): string {
  switch (status) {
    case 'LAST_MINUTE':
      return 'bg-red-600/30 text-red-100 ring-1 ring-red-400/70';
    case 'CRITICAL':
      return 'bg-orange-600/25 text-orange-200 ring-1 ring-orange-400/60';
    case 'WARNING':
      return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50';
    case 'EXPIRED':
      return 'bg-red-700/40 text-red-100 ring-1 ring-red-400/70';
    case 'NORMAL':
    default:
      return 'bg-slate-800 text-white ring-1 ring-slate-700';
  }
}

export function StudentExamStartedView({
  config,
  session,
  initialFullscreenFailed,
}: StudentExamStartedViewProps) {
  const isMobile = useMemo(() => isMobileDevice(), []);

  // Load persisted violation & lock state synchronously from sessionStorage
  const [violationHistory, setViolationHistory] = useState<ViolationHistory>(
    () => {
      const loaded = loadViolationHistory(config.examId);
      const mustBeLocked =
        loaded.examStatus === 'LOCKED' ||
        shouldLockExamOnViolation({
          violationCount: loaded.count,
          maxViolations: config.maxViolations,
          violationAction: config.violationAction,
          isMobile,
        });
      if (mustBeLocked && loaded.examStatus !== 'LOCKED') {
        const lockedState: ViolationHistory = {
          ...loaded,
          examStatus: 'LOCKED',
        };
        saveViolationHistory(config.examId, lockedState);
        return lockedState;
      }
      return loaded;
    }
  );

  // Mirror ref so sessionStorage writes happen synchronously even on pagehide/hidden
  const violationHistoryRef = useRef<ViolationHistory>(violationHistory);
  violationHistoryRef.current = violationHistory;

  const securityLocked = violationHistory.examStatus === 'LOCKED';
  const violationCount = violationHistory.count;

  // Centralized Timestamp-Based Exam Timer (primary source of truth for exit control)
  const timer = useExamTimer({
    examId: config.examId,
    durationMinutes: config.durationMinutes,
    enabled: true,
    isLocked: securityLocked,
  });

  // Strict Status Priority: EXAM_FINISHED (only after expiry) -> EXAM_EXPIRED -> EXAM_LOCKED -> EXAM_STARTED
  const controlStatus = resolveExamControlStatus({
    isExpired: timer.isExpired,
    isLocked: securityLocked,
    isStarted: true,
    isFinished: timer.isFinished,
  });
  const isFinished = controlStatus === 'EXAM_FINISHED';
  const isExpired = controlStatus === 'EXAM_EXPIRED';
  const isLocked = controlStatus === 'EXAM_LOCKED';
  const isTerminated = isExpired || isLocked || isFinished;
  const isExitAllowed = isExpired || isFinished;
  const showExitButton = canShowExitButton(controlStatus);

  const isTerminatedRef = useRef<boolean>(isTerminated);
  isTerminatedRef.current = isTerminated;

  const isExitAllowedRef = useRef<boolean>(isExitAllowed);
  isExitAllowedRef.current = isExitAllowed;

  const isLockedRef = useRef<boolean>(isLocked);
  isLockedRef.current = isLocked;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    isDocumentFullscreen()
  );
  const [fullscreenFailed, setFullscreenFailed] = useState<boolean>(
    () =>
      !isTerminated &&
      config.security.fullscreen &&
      !isDocumentFullscreen() &&
      initialFullscreenFailed
  );
  const [backNavigationWarning, setBackNavigationWarning] =
    useState<boolean>(false);
  const [fullscreenAttempts, setFullscreenAttempts] = useState<number>(
    initialFullscreenFailed ? 1 : 0
  );
  const [activeViolationType, setActiveViolationType] =
    useState<ViolationType | null>(null);

  const [iframeState, setIframeState] = useState<
    'loading' | 'loaded' | 'fallback'
  >('loading');
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);

  const embedUrl = toGoogleFormEmbedUrl(config.googleFormUrl);
  const fullscreenSupported = isFullscreenSupported();
  const secureModeActive = hasAnyActiveSecurity(config.security);

  const handleViolation = useCallback(
    ({ type, reason }: ViolationEventInput) => {
      if (isTerminatedRef.current) return;

      const current = violationHistoryRef.current;
      if (current.examStatus === 'LOCKED') return;

      const nextCount = current.count + 1;
      const shouldLock = shouldLockExamOnViolation({
        violationCount: nextCount,
        maxViolations: config.maxViolations,
        violationAction: config.violationAction,
        isMobile,
      });

      const next = appendViolationRecord(current, type, Date.now(), {
        examId: config.examId,
        reason,
        lockExam: shouldLock,
      });

      // Persist synchronously immediately (critical for mobile Home / pagehide)
      violationHistoryRef.current = next;
      saveViolationHistory(config.examId, next);
      setViolationHistory(next);

      if (shouldLock) {
        setActiveViolationType(null);
        setFullscreenFailed(false);
        setBackNavigationWarning(false);
      } else {
        setActiveViolationType(type);
      }
    },
    [config.examId, config.maxViolations, config.violationAction, isMobile]
  );

  // Ensure student sees the warning immediately upon returning from another app/tab
  const handleReturnFromLeave = useCallback((type: ViolationType) => {
    if (isTerminatedRef.current) return;
    const current = violationHistoryRef.current;
    if (current.examStatus === 'LOCKED') return;
    if (current.count > 0) {
      setActiveViolationType((prev) => prev ?? type);
    }
  }, []);

  const handleFullscreenStateChange = useCallback((active: boolean) => {
    setIsFullscreen(active);
    if (active) {
      setFullscreenFailed(false);
      setActiveViolationType((prev) =>
        prev === 'FULLSCREEN_EXIT' ? null : prev
      );
    }
  }, []);

  // Centralized Security Engine — active strictly inside EXAM_STARTED while not locked/expired
  useExamSecurity({
    config,
    isExamStarted: true,
    isMobile,
    isLocked: isTerminated,
    onViolation: handleViolation,
    onReturnFromLeave: handleReturnFromLeave,
    onFullscreenChange: handleFullscreenStateChange,
  });

  // Lock outer viewport scrollbars while Exam Mode is mounted
  useEffect(() => {
    document.documentElement.classList.add('exam-mode-active');
    document.body.classList.add('exam-mode-active');
    return () => {
      document.documentElement.classList.remove('exam-mode-active');
      document.body.classList.remove('exam-mode-active');
    };
  }, []);

  // Browser Back & Page Leave Control (active while exam time is running, including EXAM_LOCKED)
  // Releases cleanly once EXAM_EXPIRED or EXAM_FINISHED is reached.
  useEffect(() => {
    if (isExitAllowedRef.current) return;

    try {
      window.history.pushState(
        { stansaExamGuard: true },
        '',
        window.location.href
      );
    } catch {
      // Ignore restricted history API contexts
    }

    const handlePopState = () => {
      if (isExitAllowedRef.current) return;

      try {
        window.history.pushState(
          { stansaExamGuard: true },
          '',
          window.location.href
        );
      } catch {
        // Ignore restricted history API contexts
      }

      if (!isLockedRef.current) {
        setBackNavigationWarning(true);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExitAllowedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleRequestFullscreen = async () => {
    setFullscreenAttempts((count) => count + 1);
    const entered = await requestAppFullscreen();
    if (entered) {
      setIsFullscreen(true);
      setFullscreenFailed(false);
      setActiveViolationType((prev) =>
        prev === 'FULLSCREEN_EXIT' ? null : prev
      );
    } else {
      setIsFullscreen(false);
      setFullscreenFailed(true);
    }
  };

  const handleRetryIframe = () => {
    setIframeState('loading');
    setIframeReloadKey((key) => key + 1);
  };

  const handleExitExam = async () => {
    if (!canShowExitButton(controlStatus)) return;
    await exitAppFullscreen();
    timer.markExamFinished();
  };

  // PRIORITY 0: EXAM_FINISHED VIEW — Shown only after student clicks KELUAR DARI UJIAN upon EXAM_EXPIRED
  if (isFinished) {
    return (
      <div
        data-testid="exam-finished-view"
        data-exam-state="EXAM_FINISHED"
        data-exam-status="EXAM_FINISHED"
        data-violation-count={String(violationCount)}
        className="exam-mode fixed inset-0 z-30 flex flex-col bg-slate-950 text-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3.5 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <SchoolLogo
              size="sm"
              className="h-8 w-8 rounded-lg ring-0 sm:h-9 sm:w-9"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold tracking-normal text-white sm:text-sm">
                {SCHOOL_INFO.appName}
              </p>
              <p className="truncate text-[11px] font-semibold text-amber-300 sm:text-xs">
                {config.examName}
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600/20 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-emerald-300 ring-1 ring-emerald-500/40 whitespace-nowrap">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            SESI SELESAI
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <section
            role="status"
            aria-labelledby="exam-finished-title"
            className="w-[min(92vw,440px)] rounded-2xl border border-emerald-500/30 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>

            <p className="mt-4 text-xs font-extrabold tracking-wider text-emerald-700">
              KELUAR DARI SISTEM UJIAN
            </p>

            <h1
              id="exam-finished-title"
              className="mt-1.5 text-xl font-extrabold tracking-normal text-slate-950 sm:text-2xl"
            >
              SESI UJIAN SELESAI
            </h1>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Anda telah keluar dari sistem ujian.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Anda dapat menutup tab atau jendela browser ini sekarang.
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-600">Status</span>
                <strong className="font-extrabold text-emerald-700">
                  SELESAI
                </strong>
              </div>
              <div className="border-t border-slate-200 pt-2 text-slate-700">
                <p className="truncate">
                  Peserta:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentName}
                  </strong>
                </p>
                <p className="mt-0.5 tabular-nums">
                  NIS/NISN:{' '}
                  <strong className="font-mono font-bold text-slate-900">
                    {session.studentId}
                  </strong>{' '}
                  · Kelas:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentClass}
                  </strong>
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // PRIORITY 1: EXAM_EXPIRED VIEW — Persistent time-expired lock, Google Form unmounted, KELUAR DARI UJIAN enabled
  if (isExpired) {
    return (
      <div
        data-testid="exam-expired-view"
        data-exam-state="EXAM_EXPIRED"
        data-exam-status="EXAM_EXPIRED"
        data-violation-count={String(violationCount)}
        className="exam-mode fixed inset-0 z-30 flex flex-col bg-slate-950 text-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3.5 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <SchoolLogo
              size="sm"
              className="h-8 w-8 rounded-lg ring-0 sm:h-9 sm:w-9"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold tracking-normal text-white sm:text-sm">
                {SCHOOL_INFO.appName}
              </p>
              <p className="truncate text-[11px] font-semibold text-amber-300 sm:text-xs">
                {config.examName}
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600/20 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-red-300 ring-1 ring-red-500/40 whitespace-nowrap">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            WAKTU HABIS
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <section
            role="alert"
            aria-labelledby="exam-expired-title"
            className="w-[min(92vw,440px)] rounded-2xl border border-red-500/30 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Clock className="h-7 w-7" aria-hidden="true" />
            </div>

            <p className="mt-4 text-xs font-extrabold tracking-wider text-red-600">
              UJIAN TELAH BERAKHIR
            </p>

            <h1
              id="exam-expired-title"
              className="mt-1.5 text-xl font-extrabold tracking-normal text-slate-950 sm:text-2xl"
            >
              WAKTU UJIAN TELAH HABIS
            </h1>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Waktu pengerjaan Anda telah selesai.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Silakan keluar dari sistem ujian.
            </p>

            <div className="mt-5 space-y-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3.5 text-left text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-600">Status</span>
                <strong className="inline-flex items-center gap-1 font-extrabold text-red-700">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  WAKTU HABIS
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="font-medium text-slate-600">Durasi Ujian</span>
                <strong className="font-bold text-slate-900">
                  {config.durationMinutes} Menit
                </strong>
              </div>
              <div className="border-t border-red-200/70 pt-2 text-slate-700">
                <p className="truncate">
                  Peserta:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentName}
                  </strong>
                </p>
                <p className="mt-0.5 tabular-nums">
                  NIS/NISN:{' '}
                  <strong className="font-mono font-bold text-slate-900">
                    {session.studentId}
                  </strong>{' '}
                  · Kelas:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentClass}
                  </strong>
                </p>
              </div>
            </div>

            {showExitButton && (
              <button
                type="button"
                data-testid="exit-exam-button"
                onClick={handleExitExam}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold tracking-wide text-white shadow-xs transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                KELUAR DARI UJIAN
              </button>
            )}
          </section>
        </main>
      </div>
    );
  }

  // PRIORITY 2: EXAM_LOCKED VIEW — Persistent security lock screen, Google Form unmounted,
  // timer keeps running until 00:00 -> automatic transition to EXAM_EXPIRED. No exit button here.
  if (isLocked) {
    return (
      <div
        data-testid="exam-locked-view"
        data-exam-state="EXAM_LOCKED"
        data-exam-status="LOCKED"
        data-violation-count={String(violationCount)}
        className="exam-mode fixed inset-0 z-30 flex flex-col bg-slate-950 text-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3.5 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <SchoolLogo
              size="sm"
              className="h-8 w-8 rounded-lg ring-0 sm:h-9 sm:w-9"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold tracking-normal text-white sm:text-sm">
                {SCHOOL_INFO.appName}
              </p>
              <p className="truncate text-[11px] font-semibold text-amber-300 sm:text-xs">
                {config.examName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              data-testid="locked-header-timer"
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-extrabold tracking-tight tabular-nums whitespace-nowrap ${getTimerBadgeClasses(timer.status)}`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {timer.formattedTime}
            </span>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-red-600/20 px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-red-300 ring-1 ring-red-500/40 whitespace-nowrap">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              UJIAN DIKUNCI
            </span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <section
            role="alert"
            aria-labelledby="exam-locked-title"
            className="w-[min(92vw,440px)] rounded-2xl border border-red-500/30 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ShieldOff className="h-7 w-7" aria-hidden="true" />
            </div>

            <p className="mt-4 text-xs font-extrabold tracking-wider text-red-600">
              PERINGATAN {config.maxViolations}
            </p>

            <h1
              id="exam-locked-title"
              className="mt-1.5 text-xl font-extrabold tracking-normal text-slate-950 sm:text-2xl"
            >
              UJIAN DIKUNCI
            </h1>

            <p className="mt-3 text-sm font-semibold text-slate-800">
              Sesi ujian Anda telah dikunci karena batas pelanggaran telah
              tercapai.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Silakan menunggu sampai waktu ujian berakhir.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white">
              <p className="text-[11px] font-bold tracking-wider text-slate-300">
                SISA WAKTU UJIAN
              </p>
              <p
                data-testid="locked-exam-timer"
                className="mt-1 font-mono text-2xl font-extrabold tracking-tight text-amber-300 tabular-nums"
              >
                {timer.formattedTime}
              </p>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3.5 text-left text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-600">Status</span>
                <strong className="font-extrabold text-red-700">
                  UJIAN DIKUNCI
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="font-medium text-slate-600">Pelanggaran</span>
                <strong className="font-extrabold text-red-700">
                  {violationCount} / {config.maxViolations}
                </strong>
              </div>
              <div className="border-t border-red-200/70 pt-2 text-slate-700">
                <p className="truncate">
                  Peserta:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentName}
                  </strong>
                </p>
                <p className="mt-0.5 tabular-nums">
                  NIS/NISN:{' '}
                  <strong className="font-mono font-bold text-slate-900">
                    {session.studentId}
                  </strong>{' '}
                  · Kelas:{' '}
                  <strong className="font-bold text-slate-900">
                    {session.studentClass}
                  </strong>
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const activeWarningContent = activeViolationType
    ? getEscalatingWarningContent({
        violationCount,
        maxViolations: config.maxViolations,
        violationType: activeViolationType,
      })
    : null;

  const activeTimerWarningContent =
    timer.activeWarning !== null
      ? getTimerWarningContent(timer.activeWarning)
      : null;

  return (
    <div
      data-testid="exam-started-view"
      data-exam-state="EXAM_STARTED"
      data-exam-status="ACTIVE"
      data-mobile-strict={isMobile ? 'true' : 'false'}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      data-violation-count={String(violationCount)}
      className={`exam-mode fixed inset-0 z-20 flex flex-col bg-white text-slate-900 ${
        config.security.blockSelection ? 'exam-security-wrapper' : ''
      }`}
    >
      {/* Minimal Sticky Top Exam Header (compact for max Google Form area on HP & Desktop) */}
      <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-slate-200 bg-slate-900 px-3 py-2 text-white sm:px-5 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <SchoolLogo
            size="sm"
            className="h-8 w-8 rounded-lg ring-0 sm:h-9 sm:w-9"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-extrabold tracking-normal text-white sm:text-sm">
                {SCHOOL_INFO.appName}
              </span>
              <span
                className="hidden text-slate-500 sm:inline"
                aria-hidden="true"
              >
                ·
              </span>
              <h1 className="hidden truncate text-xs font-bold text-amber-300 sm:block sm:text-sm">
                {config.examName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-300 sm:text-xs">
              <span className="font-semibold text-amber-300 sm:hidden">
                {config.examName}
              </span>
              <span className="text-slate-500 sm:hidden" aria-hidden="true">
                ·
              </span>
              <span className="max-w-[130px] truncate sm:max-w-none">
                Nama:{' '}
                <strong className="font-semibold text-white">
                  {session.studentName}
                </strong>
              </span>
              <span
                className="hidden text-slate-500 sm:inline"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="hidden tabular-nums sm:inline">
                NIS:{' '}
                <strong className="font-mono font-semibold text-white">
                  {session.studentId}
                </strong>
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span>
                Kelas:{' '}
                <strong className="font-semibold text-white">
                  {session.studentClass}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          {secureModeActive && (
            <span
              data-testid="security-mode-badge"
              className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider text-amber-300 whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {isMobile ? 'MODE UJIAN KETAT' : 'SECURE MODE'}
            </span>
          )}

          {config.security.timer && (
            <span
              data-testid="exam-timer"
              data-timer-status={timer.status}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-extrabold tracking-tight tabular-nums sm:text-sm whitespace-nowrap ${getTimerBadgeClasses(timer.status)}`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {timer.formattedTime}
            </span>
          )}

          {isFullscreen && (
            <span className="hidden items-center gap-1 text-[11px] font-bold tracking-wider text-emerald-300 md:inline-flex whitespace-nowrap">
              <Maximize className="h-3.5 w-3.5" aria-hidden="true" />
              FULLSCREEN
            </span>
          )}

          {secureModeActive && (
            <span
              data-testid="violation-counter"
              className="text-[11px] font-semibold text-slate-200 tabular-nums sm:text-xs whitespace-nowrap"
            >
              Pelanggaran:{' '}
              <strong className="font-bold text-white">
                {violationCount} / {config.maxViolations}
              </strong>
            </span>
          )}

          {iframeState !== 'fallback' && (
            <button
              type="button"
              onClick={() => setIframeState('fallback')}
              className="hidden rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:inline-block whitespace-nowrap"
            >
              Formulir tidak tampil?
            </button>
          )}

          {config.security.fullscreen && !isFullscreen && (
            <button
              type="button"
              onClick={handleRequestFullscreen}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:px-3 sm:text-xs whitespace-nowrap"
            >
              <Maximize className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              LAYAR PENUH
            </button>
          )}
        </div>
      </header>

      {/* Main Full-Area Google Form Container (never unmounted by warnings) */}
      <main className="relative min-h-0 flex-1 w-full overflow-hidden bg-white">
        {iframeState === 'fallback' ? (
          <div
            role="alert"
            className="flex h-full w-full flex-col items-center justify-center px-6 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-extrabold tracking-normal text-slate-950 sm:text-xl">
              FORM UJIAN TIDAK DAPAT DITAMPILKAN
            </h2>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-slate-600">
              Google Form tidak mengizinkan formulir ditampilkan langsung di
              dalam halaman ini.
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Silakan hubungi panitia/guru.
            </p>
            <button
              type="button"
              onClick={handleRetryIframe}
              className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              COBA LAGI
            </button>
          </div>
        ) : (
          <>
            {iframeState === 'loading' && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/95 px-6 text-center"
              >
                <Loader2
                  className="h-8 w-8 animate-spin text-blue-700"
                  aria-hidden="true"
                />
                <p className="text-sm font-bold text-slate-800">
                  Memuat formulir ujian...
                </p>
              </div>
            )}

            <iframe
              key={iframeReloadKey}
              src={embedUrl}
              title="Form Ujian"
              allow="fullscreen"
              className="exam-frame"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setIframeState('loaded')}
              onError={() => setIframeState('fallback')}
            />
          </>
        )}
      </main>

      {/* Escalating Security Violation Warning Overlay (z-index: 999999, above iframe) */}
      {activeViolationType && activeWarningContent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="violation-warning-title"
          data-testid="violation-overlay"
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
        >
          <div className="w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>

            <h2
              id="violation-warning-title"
              className="mt-4 text-lg font-extrabold tracking-normal text-slate-950"
            >
              {activeWarningContent.title}
            </h2>

            <p className="mt-2.5 text-sm font-semibold text-slate-800">
              {activeWarningContent.primaryMessage}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {activeWarningContent.secondaryMessage}
            </p>

            <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="text-xs text-slate-600 sm:text-sm">
                Jenis:{' '}
                <strong className="font-bold text-slate-900">
                  {VIOLATION_LABELS[activeViolationType]}
                </strong>
              </p>
              <p className="text-slate-600 tabular-nums">
                Pelanggaran:{' '}
                <strong className="font-extrabold text-amber-800">
                  {violationCount} / {config.maxViolations}
                </strong>
              </p>
            </div>

            {activeWarningContent.warningFooter && (
              <p className="mt-3 text-xs font-bold text-red-700">
                {activeWarningContent.warningFooter}
              </p>
            )}

            {activeWarningContent.isFullscreenExit ? (
              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={handleRequestFullscreen}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
                >
                  <Maximize className="h-4 w-4" aria-hidden="true" />
                  KEMBALI KE LAYAR PENUH
                </button>
                {(!fullscreenSupported || fullscreenAttempts >= 2) && (
                  <button
                    type="button"
                    onClick={() => setActiveViolationType(null)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    KEMBALI KE UJIAN
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveViolationType(null)}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
              >
                KEMBALI KE UJIAN
              </button>
            )}
          </div>
        </div>
      )}

      {/* Initial Fullscreen Failed Overlay (when fullscreen=true & browser blocked auto request) */}
      {!activeViolationType && fullscreenFailed && config.security.fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-fullscreen-failed-title"
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
        >
          <div className="w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Maximize className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2
              id="overlay-fullscreen-failed-title"
              className="mt-4 text-lg font-extrabold tracking-normal text-slate-950"
            >
              MODE LAYAR PENUH TIDAK AKTIF
            </h2>
            <p className="mt-2.5 text-sm font-semibold text-slate-800">
              {isMobile
                ? 'Browser HP Anda tidak mengizinkan mode layar penuh otomatis.'
                : 'Mode layar penuh tidak berhasil diaktifkan.'}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Klik tombol di bawah untuk mengaktifkan layar penuh dan
              melanjutkan ujian.
            </p>

            <button
              type="button"
              onClick={handleRequestFullscreen}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
            >
              <Maximize className="h-4 w-4" aria-hidden="true" />
              {isMobile ? 'AKTIFKAN LAYAR PENUH' : 'MASUK LAYAR PENUH'}
            </button>

            {(!fullscreenSupported || fullscreenAttempts >= 2) && (
              <button
                type="button"
                onClick={() => setFullscreenFailed(false)}
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Lanjutkan Tanpa Layar Penuh
              </button>
            )}
          </div>
        </div>
      )}

      {/* Browser Back Navigation Warning Overlay */}
      {!activeViolationType && !fullscreenFailed && backNavigationWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-back-nav-title"
          data-testid="back-navigation-warning"
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
        >
          <div className="w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2
              id="overlay-back-nav-title"
              className="mt-4 text-lg font-extrabold tracking-normal text-slate-950"
            >
              UJIAN MASIH BERLANGSUNG
            </h2>
            <p className="mt-2.5 text-sm font-semibold text-slate-800">
              Anda tidak dapat keluar dari halaman ujian sebelum waktu berakhir.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Silakan kembali ke halaman ujian.
            </p>
            <button
              type="button"
              onClick={() => setBackNavigationWarning(false)}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
            >
              KEMBALI KE UJIAN
            </button>
          </div>
        </div>
      )}

      {/* One-Time Timer Threshold Warning Overlay (15m / 5m / 1m) */}
      {!activeViolationType &&
        !fullscreenFailed &&
        !backNavigationWarning &&
        activeTimerWarningContent && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="timer-warning-title"
            data-testid="timer-warning-overlay"
            data-warning-threshold={String(activeTimerWarningContent.threshold)}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          >
            <div className="w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7">
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
                  activeTimerWarningContent.severity === 'last-minute'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <Clock className="h-6 w-6" aria-hidden="true" />
              </div>

              <h2
                id="timer-warning-title"
                className="mt-4 text-lg font-extrabold tracking-normal text-slate-950"
              >
                {activeTimerWarningContent.title}
              </h2>

              <p className="mt-2.5 text-sm font-semibold text-slate-800">
                {activeTimerWarningContent.primaryMessage}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {activeTimerWarningContent.secondaryMessage}
              </p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  Sisa Waktu Saat Ini
                </p>
                <p
                  className={`mt-0.5 font-mono text-xl font-extrabold tabular-nums ${
                    activeTimerWarningContent.severity === 'last-minute'
                      ? 'text-red-600'
                      : 'text-amber-700'
                  }`}
                >
                  {timer.formattedTime}
                </p>
              </div>

              <button
                type="button"
                onClick={timer.dismissWarning}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
              >
                MENGERTI, LANJUTKAN UJIAN
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
