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
  formattedTime: string;
  status: TimerVisualStatus;
  activeWarning: TimerWarningThreshold | null;
  dismissWarning: () => void;
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
    if (rec.status === 'EXAM_EXPIRED') return 0;
    return Math.max(0, rec.endAt - Date.now());
  });

  const [isExpired, setIsExpired] = useState<boolean>(() => {
    if (!enabled) return false;
    const rec = recordRef.current;
    return rec.status === 'EXAM_EXPIRED' || Date.now() >= rec.endAt;
  });

  const [activeWarning, setActiveWarning] =
    useState<TimerWarningThreshold | null>(null);

  const dismissWarning = useCallback(() => {
    setActiveWarning(null);
  }, []);

  // Persist LOCKED status without erasing stansa_exam_end_at
  useEffect(() => {
    if (!enabled || !isLocked) return;
    const current = recordRef.current;
    if (current.status !== 'EXAM_EXPIRED' && current.status !== 'EXAM_LOCKED') {
      const updated: ExamTimerStateRecord = {
        ...current,
        status: 'EXAM_LOCKED',
      };
      recordRef.current = updated;
      saveExamTimerRecord(updated);
    }
  }, [enabled, isLocked]);

  // Single timestamp-driven interval + immediate visibility/focus resync
  useEffect(() => {
    if (!enabled || !isValidExamDuration(durationMinutes)) return;

    const rec = recordRef.current;

    if (import.meta.env.DEV) {
      console.info(
        `[STANSA TIMER]\nExam started: ${new Date(rec.startedAt).toISOString()}\nExam end: ${new Date(rec.endAt).toISOString()}\nRemaining: ${formatTimeRemaining(Math.max(0, rec.endAt - Date.now()))}\nStatus: ${rec.status}`
      );
    }

    if (rec.status === 'EXAM_EXPIRED' || isLocked) {
      return;
    }

    const syncFromTimestamp = () => {
      const current = recordRef.current;
      const now = Date.now();
      const nextRemaining = Math.max(0, current.endAt - now);

      setRemainingMs(nextRemaining);

      if (now >= current.endAt || current.status === 'EXAM_EXPIRED') {
        const expiredRecord: ExamTimerStateRecord = {
          ...current,
          status: 'EXAM_EXPIRED',
          warning15Shown: true,
          warning5Shown: true,
          warning1Shown: true,
        };
        recordRef.current = expiredRecord;
        saveExamTimerRecord(expiredRecord);
        setIsExpired(true);
        setActiveWarning(null);
        onExpireRef.current?.();
        return true;
      }

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
  }, [examId, durationMinutes, enabled, isLocked]);

  const status: TimerVisualStatus = isExpired
    ? 'EXPIRED'
    : getTimerVisualStatus(remainingMs);

  return {
    remainingMs,
    isExpired,
    formattedTime: formatTimeRemaining(remainingMs),
    status,
    activeWarning,
    dismissWarning,
    examStartedAt: recordRef.current.startedAt,
    examEndAt: recordRef.current.endAt,
  };
}
