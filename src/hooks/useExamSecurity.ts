import { useEffect, useRef } from 'react';
import type { ExamConfig } from '../utils/examConfig';
import { isDocumentFullscreen, saveTabSwitchEvent } from '../utils/examMode';
import {
  EXIT_EVENT_COOLDOWN_MS,
  VIOLATION_DEBOUNCE_MS,
  evaluateSecurityKeydown,
  hasAnyActiveSecurity,
  isExitViolationType,
  isViolationTypeEnabled,
  shouldDebounceViolation,
  shouldSuppressExitEvent,
  type LastViolationState,
  type ViolationEventInput,
  type ViolationType,
} from '../utils/examSecurity';

// Google Form is cross-origin.
// Parent page cannot access or modify the iframe DOM.
// Security controls apply to the STANSA wrapper/browser-level events
// that are available to the page.
//
// Browser-based security is deterrence and detection only.
// Websites cannot block OS Home/Recent Apps buttons, OS screenshots,
// screen recording, external devices, or detect which external app was opened.

interface UseExamSecurityOptions {
  config: ExamConfig;
  isExamStarted: boolean;
  isMobile: boolean;
  isLocked?: boolean;
  onViolation: (input: ViolationEventInput) => void;
  onReturnFromLeave?: (type: ViolationType) => void;
  onFullscreenChange?: (active: boolean) => void;
}

const BLUR_SETTLE_DELAY_MS = 80;

export function useExamSecurity({
  config,
  isExamStarted,
  isMobile,
  isLocked = false,
  onViolation,
  onReturnFromLeave,
  onFullscreenChange,
}: UseExamSecurityOptions): void {
  const onViolationRef = useRef(onViolation);
  const onReturnFromLeaveRef = useRef(onReturnFromLeave);
  const onFullscreenChangeRef = useRef(onFullscreenChange);
  const lastViolationRef = useRef<LastViolationState>({
    type: null,
    timestamp: 0,
  });
  const lastExitEventAtRef = useRef<number>(0);
  const leftPageRef = useRef<boolean>(false);
  const pendingReturnTypeRef = useRef<ViolationType | null>(null);
  const wasFullscreenRef = useRef<boolean>(isDocumentFullscreen());

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    onReturnFromLeaveRef.current = onReturnFromLeave;
  }, [onReturnFromLeave]);

  useEffect(() => {
    onFullscreenChangeRef.current = onFullscreenChange;
  }, [onFullscreenChange]);

  const { examId, security } = config;
  const {
    fullscreen,
    blockCopy,
    blockPaste,
    blockCut,
    blockContextMenu,
    blockSelection,
    detectTabSwitch,
    detectFullscreenExit,
  } = security;

  useEffect(() => {
    // Security only runs after YA, MULAI UJIAN and stops once exam is LOCKED
    if (!isExamStarted || isLocked) return;

    const activeSecurityConfig = {
      fullscreen,
      blockCopy,
      blockPaste,
      blockCut,
      blockContextMenu,
      blockSelection,
      detectTabSwitch,
      detectFullscreenExit,
      timer: security.timer,
    };

    const anySecurityActive = hasAnyActiveSecurity(activeSecurityConfig);
    wasFullscreenRef.current = isDocumentFullscreen();

    let pendingBlurTimer: number | null = null;

    const clearPendingBlur = () => {
      if (pendingBlurTimer !== null) {
        window.clearTimeout(pendingBlurTimer);
        pendingBlurTimer = null;
      }
    };

    /**
     * Single Violation Coordinator:
     * Priority order: visibilitychange -> pagehide -> blur -> fullscreenchange.
     * - Exit-group events (APP_SWITCH, TAB_SWITCH, WINDOW_BLUR, FULLSCREEN_EXIT)
     *   share a 2000ms cooldown so one Home/Recent Apps/Fullscreen Exit gesture
     *   never counts more than +1.
     * - Action events (COPY, PASTE, CUT, etc.) use a 1000ms same-type debounce
     *   so keydown + clipboard event counts strictly as +1.
     */
    const registerViolation = ({ type, reason }: ViolationEventInput) => {
      if (!isExamStarted || isLocked) return;
      if (!isViolationTypeEnabled(type, activeSecurityConfig)) return;

      const now = Date.now();

      if (isExitViolationType(type)) {
        if (
          shouldSuppressExitEvent(
            lastExitEventAtRef.current,
            now,
            EXIT_EVENT_COOLDOWN_MS
          )
        ) {
          return;
        }
        lastExitEventAtRef.current = now;
      } else if (
        shouldDebounceViolation(
          lastViolationRef.current,
          type,
          now,
          VIOLATION_DEBOUNCE_MS
        )
      ) {
        return;
      }

      lastViolationRef.current = {
        type,
        timestamp: now,
      };

      onViolationRef.current({ type, reason });
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (!isExamStarted || !blockCopy) return;
      event.preventDefault();
      event.stopPropagation();
      registerViolation({ type: 'COPY', reason: 'Copy action blocked' });
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (!isExamStarted || !blockPaste) return;
      event.preventDefault();
      event.stopPropagation();
      registerViolation({ type: 'PASTE', reason: 'Paste action blocked' });
    };

    const handleCut = (event: ClipboardEvent) => {
      if (!isExamStarted || !blockCut) return;
      event.preventDefault();
      event.stopPropagation();
      registerViolation({ type: 'CUT', reason: 'Cut action blocked' });
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!isExamStarted || !blockContextMenu) return;
      event.preventDefault();
      event.stopPropagation();
      registerViolation({
        type: 'CONTEXT_MENU',
        reason: 'Context menu blocked',
      });
    };

    const handleSelectStart = (event: Event) => {
      if (!isExamStarted || !blockSelection) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'IFRAME' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isExamStarted || !anySecurityActive) return;

      const decision = evaluateSecurityKeydown(event, activeSecurityConfig);
      if (!decision.block) return;

      event.preventDefault();
      event.stopPropagation();

      if (decision.violationType) {
        registerViolation({
          type: decision.violationType,
          reason: `Blocked shortcut: ${event.key}`,
        });
      }
    };

    // Priority 1: visibilitychange (most reliable on Android/iOS Home, Recent Apps, App Switch)
    const handleVisibilityChange = () => {
      if (!isExamStarted || !detectTabSwitch) return;

      if (document.visibilityState === 'hidden') {
        clearPendingBlur();
        const leaveType: ViolationType = isMobile ? 'APP_SWITCH' : 'TAB_SWITCH';
        leftPageRef.current = true;
        pendingReturnTypeRef.current = leaveType;
        saveTabSwitchEvent(examId);
        registerViolation({
          type: leaveType,
          reason: 'Exam page became hidden',
        });
      } else if (document.visibilityState === 'visible') {
        if (leftPageRef.current) {
          const returnType =
            pendingReturnTypeRef.current ??
            (isMobile ? 'APP_SWITCH' : 'TAB_SWITCH');
          leftPageRef.current = false;
          pendingReturnTypeRef.current = null;
          onReturnFromLeaveRef.current?.(returnType);
        }
      }
    };

    // Priority 2: pagehide / pageshow (mobile BFCache & browser background transitions)
    const handlePageHide = () => {
      if (!isExamStarted || !detectTabSwitch) return;
      clearPendingBlur();
      const leaveType: ViolationType = isMobile ? 'APP_SWITCH' : 'TAB_SWITCH';
      leftPageRef.current = true;
      pendingReturnTypeRef.current = leaveType;
      saveTabSwitchEvent(examId);
      registerViolation({
        type: leaveType,
        reason: 'Exam page hidden (pagehide)',
      });
    };

    const handlePageShow = () => {
      if (!isExamStarted || !detectTabSwitch) return;
      if (leftPageRef.current && document.visibilityState === 'visible') {
        const returnType =
          pendingReturnTypeRef.current ??
          (isMobile ? 'APP_SWITCH' : 'TAB_SWITCH');
        leftPageRef.current = false;
        pendingReturnTypeRef.current = null;
        onReturnFromLeaveRef.current?.(returnType);
      }
    };

    // Priority 3: window blur / focus (with 80ms settle window to avoid double-count & iframe false positive)
    const handleWindowBlur = () => {
      if (!isExamStarted || !detectTabSwitch) return;
      if (document.visibilityState === 'hidden') return;

      // Ignore focus shifting cleanly into the embedded Google Form iframe
      if (document.activeElement?.tagName === 'IFRAME') {
        return;
      }

      clearPendingBlur();
      pendingBlurTimer = window.setTimeout(() => {
        pendingBlurTimer = null;
        if (document.visibilityState === 'hidden') return;
        if (document.activeElement?.tagName === 'IFRAME') return;

        const blurType: ViolationType = isMobile ? 'APP_SWITCH' : 'WINDOW_BLUR';
        leftPageRef.current = true;
        pendingReturnTypeRef.current = blurType;
        registerViolation({
          type: blurType,
          reason: 'Exam window lost focus',
        });
      }, BLUR_SETTLE_DELAY_MS);
    };

    const handleWindowFocus = () => {
      clearPendingBlur();
      if (leftPageRef.current && document.visibilityState === 'visible') {
        const returnType =
          pendingReturnTypeRef.current ??
          (isMobile ? 'APP_SWITCH' : 'WINDOW_BLUR');
        leftPageRef.current = false;
        pendingReturnTypeRef.current = null;
        onReturnFromLeaveRef.current?.(returnType);
      }
    };

    // Priority 4: fullscreenchange (deduplicated with exit cooldown against Home/visibilitychange)
    const handleFullscreenChange = () => {
      const active = isDocumentFullscreen();
      onFullscreenChangeRef.current?.(active);

      if (active) {
        wasFullscreenRef.current = true;
      } else if (wasFullscreenRef.current) {
        wasFullscreenRef.current = false;
        if (fullscreen && detectFullscreenExit) {
          registerViolation({
            type: 'FULLSCREEN_EXIT',
            reason: 'Fullscreen mode exited',
          });
        }
      }
    };

    // Attach listeners once
    if (blockCopy) {
      document.addEventListener('copy', handleCopy, true);
    }
    if (blockPaste) {
      document.addEventListener('paste', handlePaste, true);
    }
    if (blockCut) {
      document.addEventListener('cut', handleCut, true);
    }
    if (blockContextMenu) {
      document.addEventListener('contextmenu', handleContextMenu, true);
    }
    if (blockSelection) {
      document.addEventListener('selectstart', handleSelectStart, true);
    }
    if (anySecurityActive) {
      document.addEventListener('keydown', handleKeyDown, true);
    }
    if (detectTabSwitch) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pagehide', handlePageHide);
      window.addEventListener('pageshow', handlePageShow);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    }
    if (fullscreen) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      );
    }

    return () => {
      clearPendingBlur();
      if (blockCopy) {
        document.removeEventListener('copy', handleCopy, true);
      }
      if (blockPaste) {
        document.removeEventListener('paste', handlePaste, true);
      }
      if (blockCut) {
        document.removeEventListener('cut', handleCut, true);
      }
      if (blockContextMenu) {
        document.removeEventListener('contextmenu', handleContextMenu, true);
      }
      if (blockSelection) {
        document.removeEventListener('selectstart', handleSelectStart, true);
      }
      if (anySecurityActive) {
        document.removeEventListener('keydown', handleKeyDown, true);
      }
      if (detectTabSwitch) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('pageshow', handlePageShow);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      }
      if (fullscreen) {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener(
          'webkitfullscreenchange',
          handleFullscreenChange
        );
      }
    };
  }, [
    isExamStarted,
    isMobile,
    isLocked,
    examId,
    fullscreen,
    blockCopy,
    blockPaste,
    blockCut,
    blockContextMenu,
    blockSelection,
    detectTabSwitch,
    detectFullscreenExit,
    security.timer,
  ]);
}
