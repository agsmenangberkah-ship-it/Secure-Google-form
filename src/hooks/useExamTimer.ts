import { useCallback, useEffect, useRef, useState } from 'react';
import {
  evaluateNextTimerWarning,
  formatTimeRemaining,
  getTimerVisualStatus,
  initializeOrLoadExamTimer,
  isValidExamDuration,
  saveExamTimerRecord,
  type ExamTimerStateRecord,
  type TimerVisualStatus,
  type TimerWarningThreshold,
} from '../utils/examTimer';

interface UseExamTimerOptions {
  examId: string;
  durationMinutes: number;
  enabled: boolean;
  isLocked: boolean;
  onExpire?: () => void;
}

export interface UseExamTimerResult {
  remainingMs: number;
  isExpired: boolean;
  isFinished: boolean;
  formattedTime: string;
  status: TimerVisualStatus;
  activeWarning: TimerWarningThreshold | null;
  dismissWarning: () => void;
  markExamFinished: () => void;
  examStartedAt: number;
  examEndAt: number;
}

const TIMER_TICK_MS = 500;

export function useExamTimer({
  examId,
  durationMinutes,
  enabled,
  isLocked,
  onExpire,
}: UseExamTimerOptions): UseExamTimerResult {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  // Initialize or restore persisted timestamp record synchronously on mount
  const initialRecordRef = useRef<ExamTimerStateRecord | null>(null);
  if (
    initialRecordRef.current === null ||
    initialRecordRef.current.examId !== examId
  ) {
    initialRecordRef.current =
      enabled && isValidExamDuration(durationMinutes)
        ? initializeOrLoadExamTimer(examId, durationMinutes, Date.now())
        : {
            examId,
            startedAt: Date.now(),
            endAt: Date.now() + Math.max(0, durationMinutes) * 60 * 1000,
            status: 'EXAM_STARTED',
            warning15Shown: false,
            warning5Shown: false,
            warning1Shown: false,
          };
  }

  const recordRef = useRef<ExamTimerStateRecord>(initialRecordRef.current);

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!enabled) return Math.max(0, durationMinutes) * 60 * 1000;
    const rec = recordRef.current;
    if (rec.status === 'EXAM_EXPIRED' || rec.status === 'EXAM_FINISHED') {
      return 0;
    }
    return Math.max(0, rec.endAt - Date.now());
  });

  const [isExpired, setIsExpired] = useState<boolean>(() => {
    if (!enabled) return false;
    const rec = recordRef.current;
    return (
      rec.status === 'EXAM_EXPIRED' ||
      rec.status === 'EXAM_FINISHED' ||
      Date.now() >= rec.endAt
    );
  });

  const [isFinished, setIsFinished] = useState<boolean>(() => {
    if (!enabled) return false;
    return recordRef.current.status === 'EXAM_FINISHED';
  });

  const [activeWarning, setActiveWarning] =
    useState<TimerWarningThreshold | null>(null);

  const dismissWarning = useCallback(() => {
    setActiveWarning(null);
  }, []);

  // Only allow marking EXAM_FINISHED after exam time has genuinely expired
  const markExamFinished = useCallback(() => {
    const current = recordRef.current;
    if (
      current.status !== 'EXAM_EXPIRED' &&
      current.status !== 'EXAM_FINISHED' &&
      Date.now() < current.endAt
    ) {
      return;
    }

    const finishedRecord: ExamTimerStateRecord = {
      ...current,
      status: 'EXAM_FINISHED',
      warning15Shown: true,
      warning5Shown: true,
      warning1Shown: true,
    };
    recordRef.current = finishedRecord;
    saveExamTimerRecord(finishedRecord);
    setIsExpired(true);
    setIsFinished(true);
    setRemainingMs(0);
    setActiveWarning(null);
  }, []);

  // Persist LOCKED status without erasing stansa_exam_end_at or stopping countdown
  useEffect(() => {
    if (!enabled || !isLocked) return;
    setActiveWarning(null);
    const current = recordRef.current;
    if (
      current.status !== 'EXAM_EXPIRED' &&
      current.status !== 'EXAM_FINISHED' &&
      current.status !== 'EXAM_LOCKED'
    ) {
      const updated: ExamTimerStateRecord = {
        ...current,
        status: 'EXAM_LOCKED',
      };
      recordRef.current = updated;
      saveExamTimerRecord(updated);
    }
  }, [enabled, isLocked]);

  // Single timestamp-driven interval + immediate visibility/focus resync.
  // Continues running while EXAM_LOCKED so EXAM_LOCKED automatically transitions
  // to EXAM_EXPIRED once Date.now() >= examEndAt.
  useEffect(() => {
    if (!enabled || !isValidExamDuration(durationMinutes)) return;

    const rec = recordRef.current;

    if (rec.status === 'EXAM_EXPIRED' || rec.status === 'EXAM_FINISHED') {
      return;
    }

    const syncFromTimestamp = () => {
      const current = recordRef.current;
      const now = Date.now();
      const nextRemaining = Math.max(0, current.endAt - now);

      setRemainingMs(nextRemaining);

      if (
        now >= current.endAt ||
        current.status === 'EXAM_EXPIRED' ||
        current.status === 'EXAM_FINISHED'
      ) {
        const nextStatus =
          current.status === 'EXAM_FINISHED' ? 'EXAM_FINISHED' : 'EXAM_EXPIRED';
        const expiredRecord: ExamTimerStateRecord = {
          ...current,
          status: nextStatus,
          warning15Shown: true,
          warning5Shown: true,
          warning1Shown: true,
        };
        recordRef.current = expiredRecord;
        saveExamTimerRecord(expiredRecord);
        setRemainingMs(0);
        setIsExpired(true);
        if (nextStatus === 'EXAM_FINISHED') {
          setIsFinished(true);
        }
        setActiveWarning(null);
        onExpireRef.current?.();
        return true;
      }

      // Suppress timed threshold modals while student is already on EXAM_LOCKED screen
      if (!isLockedRef.current) {
        const evaluation = evaluateNextTimerWarning({
          remainingMs: nextRemaining,
          durationMinutes,
          flags: {
            warning15Shown: current.warning15Shown,
            warning5Shown: current.warning5Shown,
            warning1Shown: current.warning1Shown,
          },
        });

        if (evaluation.triggered !== null) {
          const updated: ExamTimerStateRecord = {
            ...current,
            ...evaluation.nextFlags,
          };
          recordRef.current = updated;
          saveExamTimerRecord(updated);
          setActiveWarning(evaluation.triggered);
        }
      }

      return false;
    };

    // Immediate initial sync on mount/refresh
    const alreadyExpired = syncFromTimestamp();
    if (alreadyExpired) return;

    const intervalId = window.setInterval(() => {
      const expiredNow = syncFromTimestamp();
      if (expiredNow) {
        window.clearInterval(intervalId);
      }
    }, TIMER_TICK_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromTimestamp();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
    };
  }, [examId, durationMinutes, enabled]);

  const status: TimerVisualStatus = isExpired
    ? 'EXPIRED'
    : getTimerVisualStatus(remainingMs);

  return {
    remainingMs,
    isExpired,
    isFinished,
    formattedTime: formatTimeRemaining(remainingMs),
    status,
    activeWarning,
    dismissWarning,
    markExamFinished,
    examStartedAt: recordRef.current.startedAt,
    examEndAt: recordRef.current.endAt,
  };
}
