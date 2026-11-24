import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSES_BY_LEVEL,
  DEFAULT_SECURITY_CONFIG,
  buildSecureExamLink,
  createExamPayload,
  decodeExamConfig,
  encodeExamConfig,
  isStudentEntryComplete,
  isValidGoogleFormUrl,
  slugifyFileName,
  toGoogleFormEmbedUrl,
  validateExamForm,
  validateStudentEntry,
  type ExamConfig,
  type ExamFormInput,
} from './examConfig';
import {
  createTabSwitchRecord,
  parseTabSwitchRecord,
  resolveActiveExamOverlay,
} from './examMode';
import {
  appendViolationRecord,
  createEmptyViolationHistory,
  evaluateSecurityKeydown,
  getEscalatingWarningContent,
  getViolationStorageKey,
  hasAnyActiveSecurity,
  isExitViolationType,
  isMobileDevice,
  isViolationTypeEnabled,
  parseViolationHistory,
  shouldDebounceViolation,
  shouldLockExamOnViolation,
  shouldSuppressExitEvent,
} from './examSecurity';
import { createStudentSession, parseStudentSession } from './studentSession';
import {
  evaluateNextTimerWarning,
  formatTimeRemaining,
  getTimerVisualStatus,
  getTimerWarningContent,
  isValidExamDuration,
  resolveExamControlStatus,
} from './examTimer';

const validFormInput: ExamFormInput = {
  examName: 'PAS Informatika Semester 1',
  level: 'IX',
  classes: ['IX A', 'IX B', 'IX C'],
  googleFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeDemoForm123456/viewform',
  durationMinutes: 90,
  security: { ...DEFAULT_SECURITY_CONFIG },
  maxViolations: 3,
  violationAction: 'lock',
};

test('isValidGoogleFormUrl accepts standard Google Form URLs and rejects invalid URLs', () => {
  assert.equal(
    isValidGoogleFormUrl('https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform'),
    true
  );
  assert.equal(
    isValidGoogleFormUrl('https://docs.google.com/forms/d/1AbCdEfGh/viewform?usp=sf_link'),
    true
  );
  assert.equal(isValidGoogleFormUrl('https://forms.gle/abc123XYZ'), true);

  assert.equal(isValidGoogleFormUrl(''), false);
  assert.equal(isValidGoogleFormUrl('https://example.com/forms/123'), false);
  assert.equal(isValidGoogleFormUrl('https://docs.google.com/spreadsheets/d/123'), false);
  assert.equal(isValidGoogleFormUrl('javascript:alert(1)'), false);
  assert.equal(isValidGoogleFormUrl('not-a-url'), false);
});

test('validateExamForm reports exact error messages for missing or out-of-range fields', () => {
  const emptyErrors = validateExamForm({
    ...validFormInput,
    examName: '   ',
    level: '',
    classes: [],
    googleFormUrl: '',
    durationMinutes: 4,
  });

  assert.equal(emptyErrors.examName, 'Nama ujian wajib diisi.');
  assert.equal(emptyErrors.level, 'Silakan pilih tingkat.');
  assert.equal(emptyErrors.classes, 'Pilih minimal satu kelas.');
  assert.equal(emptyErrors.googleFormUrl, 'Link Google Form wajib diisi.');
  assert.equal(emptyErrors.durationMinutes, 'Durasi minimal 5 menit.');

  const invalidUrlAndMaxDuration = validateExamForm({
    ...validFormInput,
    googleFormUrl: 'https://google.com',
    durationMinutes: 301,
  });

  assert.equal(
    invalidUrlAndMaxDuration.googleFormUrl,
    'Link tidak dikenali sebagai Google Form. Silakan periksa kembali.'
  );
  assert.equal(invalidUrlAndMaxDuration.durationMinutes, 'Durasi maksimal 300 menit.');

  const validErrors = validateExamForm(validFormInput);
  assert.deepEqual(validErrors, {});
});

test('encodeExamConfig and decodeExamConfig perform lossless URL-safe Base64URL round-trip', () => {
  const sample: ExamConfig = {
    examId: 'stansa-ab12cd34ef',
    examName: 'PTS Bahasa Sunda & Informatika — Kelas IX',
    level: 'IX',
    classes: ['IX A', 'IX B', 'IX C'],
    googleFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform',
    durationMinutes: 90,
    security: { ...DEFAULT_SECURITY_CONFIG, blockCut: false },
    maxViolations: 3,
    violationAction: 'lock',
  };

  const encoded = encodeExamConfig(sample);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes('+'), false);
  assert.equal(encoded.includes('/'), false);
  assert.equal(encoded.includes('='), false);

  const decoded = decodeExamConfig(encoded);
  assert.deepEqual(decoded, sample);
});

test('decodeExamConfig returns null for malformed or tampered payloads', () => {
  assert.equal(decodeExamConfig(''), null);
  assert.equal(decodeExamConfig('not-valid-base64!!!'), null);
  assert.equal(decodeExamConfig('e30'), null); // "{}" missing required fields
});

test('createExamPayload builds dynamic origin link without hardcoding domains', () => {
  const result = createExamPayload(
    validFormInput,
    'https://secure.smpn1tjssmd.sch.id/'
  );

  assert.ok(result.config.examId.startsWith('stansa-'));
  assert.equal(
    result.secureLink,
    `https://secure.smpn1tjssmd.sch.id/exam/${result.encodedConfig}`
  );
  assert.equal(
    buildSecureExamLink('abc123', 'https://secure.smpn1tjssmd.sch.id'),
    'https://secure.smpn1tjssmd.sch.id/exam/abc123'
  );
  assert.deepEqual(decodeExamConfig(result.encodedConfig), result.config);
});

test('slugifyFileName produces clean ASCII filenames', () => {
  assert.equal(slugifyFileName('PAS Informatika Semester 1'), 'pas-informatika-semester-1');
  assert.equal(slugifyFileName('   '), 'ujian');
});

test('CLASSES_BY_LEVEL provides classes A through K for VII, VIII, and IX', () => {
  const suffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  for (const level of ['VII', 'VIII', 'IX'] as const) {
    assert.deepEqual(
      CLASSES_BY_LEVEL[level],
      suffixes.map((letter) => `${level} ${letter}`)
    );
  }
});

test('validateStudentEntry & isStudentEntryComplete enforce Nama, NIS/NISN, Kelas with trim and class allowlist', () => {
  const allowedClasses = ['IX A', 'IX B', 'IX C'];

  // Empty & whitespace-only inputs are rejected
  assert.equal(
    isStudentEntryComplete({ fullName: '', studentId: '', selectedClass: '' }, allowedClasses),
    false
  );
  assert.equal(
    isStudentEntryComplete({ fullName: '   ', studentId: '   ', selectedClass: 'IX A' }, allowedClasses),
    false
  );
  // Name only -> disabled
  assert.equal(
    isStudentEntryComplete({ fullName: 'Andri Ganda Saputra', studentId: '', selectedClass: '' }, allowedClasses),
    false
  );
  // Name + NIS without Class -> disabled
  assert.equal(
    isStudentEntryComplete({ fullName: 'Andri Ganda Saputra', studentId: '123456789', selectedClass: '' }, allowedClasses),
    false
  );
  // Class outside link config -> rejected
  const outsideClassErrors = validateStudentEntry(
    { fullName: 'Andri Ganda Saputra', studentId: '123456789', selectedClass: 'IX D' },
    allowedClasses
  );
  assert.equal(outsideClassErrors.selectedClass, 'Silakan pilih kelas.');
  assert.equal(
    isStudentEntryComplete(
      { fullName: 'Andri Ganda Saputra', studentId: '123456789', selectedClass: 'IX D' },
      allowedClasses
    ),
    false
  );

  // All 3 valid -> enabled
  assert.deepEqual(
    validateStudentEntry(
      { fullName: 'Andri Ganda Saputra', studentId: '123456789', selectedClass: 'IX A' },
      allowedClasses
    ),
    {}
  );
  assert.equal(
    isStudentEntryComplete(
      { fullName: 'Andri Ganda Saputra', studentId: '123456789', selectedClass: 'IX A' },
      allowedClasses
    ),
    true
  );

  // Missing field messages
  const missingErrors = validateStudentEntry(
    { fullName: '  ', studentId: '  ', selectedClass: '' },
    allowedClasses
  );
  assert.equal(missingErrors.fullName, 'Nama lengkap wajib diisi.');
  assert.equal(missingErrors.studentId, 'NIS/NISN wajib diisi.');
  assert.equal(missingErrors.selectedClass, 'Silakan pilih kelas.');
});

test('toGoogleFormEmbedUrl appends embedded=true for Google Form viewform links', () => {
  assert.equal(
    toGoogleFormEmbedUrl('https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform'),
    'https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform?embedded=true'
  );
  assert.equal(
    toGoogleFormEmbedUrl('https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform?embedded=true'),
    'https://docs.google.com/forms/d/e/1FAIpQLSeDemo/viewform?embedded=true'
  );
  assert.equal(
    toGoogleFormEmbedUrl('https://forms.gle/abc123XYZ'),
    'https://forms.gle/abc123XYZ'
  );
});

test('studentSession creates and validates temporary sessionStorage payload safely', () => {
  const allowedClasses = ['IX A', 'IX B', 'IX C'];
  const session = createStudentSession(
    'stansa-abc123',
    { fullName: '  Andri Ganda Saputra  ', studentId: ' 123456789 ', selectedClass: 'IX A' },
    '2026-11-24T01:00:00.000Z'
  );
  assert.deepEqual(session, {
    examId: 'stansa-abc123',
    studentName: 'Andri Ganda Saputra',
    studentId: '123456789',
    studentClass: 'IX A',
    startedAt: '2026-11-24T01:00:00.000Z',
  });

  const serialized = JSON.stringify(session);
  assert.deepEqual(parseStudentSession(serialized, 'stansa-abc123', allowedClasses), session);
  assert.equal(parseStudentSession(serialized, 'stansa-other', allowedClasses), null);
  assert.equal(parseStudentSession(serialized, 'stansa-abc123', ['IX D']), null);
  assert.equal(parseStudentSession('not-json', 'stansa-abc123', allowedClasses), null);
});

test('examMode tabSwitchRecord creates and validates sessionStorage structure', () => {
  const record = createTabSwitchRecord('2026-11-24T04:30:00.000Z');
  assert.deepEqual(record, {
    tabSwitchDetected: true,
    lastDetectedAt: '2026-11-24T04:30:00.000Z',
  });
  assert.deepEqual(parseTabSwitchRecord(JSON.stringify(record)), record);
  assert.equal(parseTabSwitchRecord(null), null);
  assert.equal(parseTabSwitchRecord('{"tabSwitchDetected":false}'), null);
  assert.equal(parseTabSwitchRecord('invalid-json'), null);
});

test('resolveActiveExamOverlay prioritizes fullscreen exit, fullscreen failed, tab switch, and back warning cleanly', () => {
  assert.equal(
    resolveActiveExamOverlay({
      fullscreenFailed: false,
      fullscreenExited: false,
      tabSwitchWarning: false,
      backNavigationWarning: false,
    }),
    null
  );
  assert.equal(
    resolveActiveExamOverlay({
      fullscreenFailed: true,
      fullscreenExited: true,
      tabSwitchWarning: true,
      backNavigationWarning: true,
    }),
    'fullscreen-exited'
  );
  assert.equal(
    resolveActiveExamOverlay({
      fullscreenFailed: true,
      fullscreenExited: false,
      tabSwitchWarning: true,
      backNavigationWarning: false,
    }),
    'fullscreen-failed'
  );
  assert.equal(
    resolveActiveExamOverlay({
      fullscreenFailed: false,
      fullscreenExited: false,
      tabSwitchWarning: true,
      backNavigationWarning: true,
    }),
    'tab-switch'
  );
  assert.equal(
    resolveActiveExamOverlay({
      fullscreenFailed: false,
      fullscreenExited: false,
      tabSwitchWarning: false,
      backNavigationWarning: true,
    }),
    'back-navigation'
  );
});

test('examSecurity respects per-flag configuration including all-off mode', () => {
  const allOff = {
    fullscreen: false,
    blockCopy: false,
    blockPaste: false,
    blockCut: false,
    blockContextMenu: false,
    blockSelection: false,
    detectTabSwitch: false,
    detectFullscreenExit: false,
    timer: false,
  };

  assert.equal(hasAnyActiveSecurity(allOff), false);
  assert.equal(isViolationTypeEnabled('COPY', allOff), false);
  assert.equal(isViolationTypeEnabled('PASTE', allOff), false);
  assert.equal(isViolationTypeEnabled('CUT', allOff), false);
  assert.equal(isViolationTypeEnabled('CONTEXT_MENU', allOff), false);
  assert.equal(isViolationTypeEnabled('TAB_SWITCH', allOff), false);
  assert.equal(isViolationTypeEnabled('WINDOW_BLUR', allOff), false);
  assert.equal(isViolationTypeEnabled('FULLSCREEN_EXIT', allOff), false);

  // fullscreen=false disables FULLSCREEN_EXIT even if detectFullscreenExit=true
  assert.equal(
    isViolationTypeEnabled('FULLSCREEN_EXIT', {
      ...allOff,
      fullscreen: false,
      detectFullscreenExit: true,
    }),
    false
  );

  // Default all-on enables all checks including DEVTOOLS_ATTEMPT and PRINT_ATTEMPT
  assert.equal(hasAnyActiveSecurity(DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('COPY', DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('FULLSCREEN_EXIT', DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('WINDOW_BLUR', DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('DEVTOOLS_ATTEMPT', DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('PRINT_ATTEMPT', DEFAULT_SECURITY_CONFIG), true);
  assert.equal(isViolationTypeEnabled('DEVTOOLS_ATTEMPT', allOff), false);
  assert.equal(isViolationTypeEnabled('PRINT_ATTEMPT', allOff), false);
});

test('evaluateSecurityKeydown selectively blocks shortcuts while preserving normal typing and respecting config', () => {
  const allOff = {
    fullscreen: false,
    blockCopy: false,
    blockPaste: false,
    blockCut: false,
    blockContextMenu: false,
    blockSelection: false,
    detectTabSwitch: false,
    detectFullscreenExit: false,
    timer: false,
  };

  // Clipboard & selection shortcuts
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'c', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'COPY' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'v', ctrlKey: false, metaKey: true, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'PASTE' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'x', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'CUT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'a', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'TEXT_SELECTION' }
  );

  // DevTools, View Source, Print, Save shortcuts
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'F12', ctrlKey: false, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'DEVTOOLS_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'I', ctrlKey: true, metaKey: false, shiftKey: true }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'DEVTOOLS_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'J', ctrlKey: true, metaKey: false, shiftKey: true }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'DEVTOOLS_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'C', ctrlKey: true, metaKey: false, shiftKey: true }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'DEVTOOLS_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'u', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'DEVTOOLS_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'p', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: 'PRINT_ATTEMPT' }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false }, DEFAULT_SECURITY_CONFIG),
    { block: true, violationType: null }
  );

  // Normal typing & navigation keys are NEVER blocked
  for (const key of ['a', 'C', 'Backspace', 'Enter', ' ', 'ArrowDown', 'Tab']) {
    assert.deepEqual(
      evaluateSecurityKeydown({ key, ctrlKey: false, metaKey: false, shiftKey: key === 'C' }, DEFAULT_SECURITY_CONFIG),
      { block: false, violationType: null }
    );
  }

  // Per-flag disable respected (e.g. blockCopy: false allows Ctrl+C)
  assert.deepEqual(
    evaluateSecurityKeydown(
      { key: 'c', ctrlKey: true, metaKey: false, shiftKey: false },
      { ...DEFAULT_SECURITY_CONFIG, blockCopy: false }
    ),
    { block: false, violationType: null }
  );
  assert.deepEqual(
    evaluateSecurityKeydown(
      { key: 'v', ctrlKey: true, metaKey: false, shiftKey: false },
      { ...DEFAULT_SECURITY_CONFIG, blockPaste: false }
    ),
    { block: false, violationType: null }
  );

  // All security OFF allows everything including F12 & Ctrl+C
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'F12', ctrlKey: false, metaKey: false, shiftKey: false }, allOff),
    { block: false, violationType: null }
  );
  assert.deepEqual(
    evaluateSecurityKeydown({ key: 'c', ctrlKey: true, metaKey: false, shiftKey: false }, allOff),
    { block: false, violationType: null }
  );
});

test('examSecurity deduplication prevents duplicate same-type violations within 1000ms (e.g. keydown + copy)', () => {
  assert.equal(shouldDebounceViolation({ type: null, timestamp: 0 }, 'COPY', 5000), false);
  // Same type within 1000ms -> ignored
  assert.equal(shouldDebounceViolation({ type: 'COPY', timestamp: 5000 }, 'COPY', 5050), true);
  assert.equal(shouldDebounceViolation({ type: 'COPY', timestamp: 5000 }, 'COPY', 5999), true);
  // Same type at or after 1000ms -> allowed
  assert.equal(shouldDebounceViolation({ type: 'COPY', timestamp: 5000 }, 'COPY', 6000), false);
  // Different violation type -> NOT suppressed
  assert.equal(
    shouldDebounceViolation({ type: 'COPY', timestamp: 5000 }, 'DEVTOOLS_ATTEMPT', 5200),
    false
  );
});

test('examSecurity violation history stores count, violationCount, examStatus, and parses sessionStorage cleanly', () => {
  assert.equal(
    getViolationStorageKey('stansa-123'),
    'stansa_secure_violation_stansa-123'
  );

  const h0 = createEmptyViolationHistory('stansa-123');
  const h1 = appendViolationRecord(h0, 'APP_SWITCH', 1730000000000, {
    examId: 'stansa-123',
    reason: 'Exam page became hidden',
  });
  const h2 = appendViolationRecord(h1, 'DEVTOOLS_ATTEMPT', 1730000005000, {
    examId: 'stansa-123',
    lockExam: true,
  });

  assert.equal(h2.count, 2);
  assert.equal(h2.violationCount, 2);
  assert.equal(h2.examStatus, 'LOCKED');
  assert.deepEqual(h2.violations, [
    {
      type: 'APP_SWITCH',
      reason: 'Exam page became hidden',
      timestamp: 1730000000000,
    },
    { type: 'DEVTOOLS_ATTEMPT', timestamp: 1730000005000 },
  ]);

  assert.deepEqual(parseViolationHistory(JSON.stringify(h2), 'stansa-123'), h2);

  // Backward compatibility with legacy ISO timestamps
  const legacyParsed = parseViolationHistory(
    JSON.stringify({
      violationCount: 1,
      violations: [{ type: 'COPY', timestamp: '2026-11-24T05:00:00.000Z' }],
    }),
    'stansa-legacy'
  );
  assert.equal(legacyParsed.count, 1);
  assert.equal(legacyParsed.violationCount, 1);
  assert.equal(legacyParsed.examStatus, 'ACTIVE');
  assert.equal(legacyParsed.violations[0].type, 'COPY');
  assert.equal(
    legacyParsed.violations[0].timestamp,
    Date.parse('2026-11-24T05:00:00.000Z')
  );

  assert.deepEqual(
    parseViolationHistory(null, 'stansa-123'),
    createEmptyViolationHistory('stansa-123')
  );
  assert.deepEqual(
    parseViolationHistory('bad-json', 'stansa-123'),
    createEmptyViolationHistory('stansa-123')
  );
});

test('PART 4.2 mobile detection, 2000ms exit cooldown, escalating warnings, and lock thresholds', () => {
  // Mobile detection combines UA + coarse pointer
  assert.equal(isMobileDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', false), true);
  assert.equal(isMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', false), true);
  assert.equal(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', true), true);
  assert.equal(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false), false);

  // Exit-group classification & 2000ms cross-event cooldown
  assert.equal(isExitViolationType('APP_SWITCH'), true);
  assert.equal(isExitViolationType('TAB_SWITCH'), true);
  assert.equal(isExitViolationType('WINDOW_BLUR'), true);
  assert.equal(isExitViolationType('FULLSCREEN_EXIT'), true);
  assert.equal(isExitViolationType('COPY'), false);

  assert.equal(shouldSuppressExitEvent(0, 10000), false);
  assert.equal(shouldSuppressExitEvent(10000, 10050), true);
  assert.equal(shouldSuppressExitEvent(10000, 11999), true);
  assert.equal(shouldSuppressExitEvent(10000, 12000), false);

  // Lock thresholds
  assert.equal(
    shouldLockExamOnViolation({
      violationCount: 2,
      maxViolations: 3,
      violationAction: 'lock',
      isMobile: true,
    }),
    false
  );
  assert.equal(
    shouldLockExamOnViolation({
      violationCount: 3,
      maxViolations: 3,
      violationAction: 'lock',
      isMobile: true,
    }),
    true
  );
  assert.equal(
    shouldLockExamOnViolation({
      violationCount: 3,
      maxViolations: 3,
      violationAction: 'warn',
      isMobile: true,
    }),
    true
  );
  assert.equal(
    shouldLockExamOnViolation({
      violationCount: 3,
      maxViolations: 3,
      violationAction: 'warn',
      isMobile: false,
    }),
    false
  );

  // Escalating warning content (PERINGATAN 1 -> PERINGATAN 2 -> Fullscreen Exit)
  const w1 = getEscalatingWarningContent({
    violationCount: 1,
    maxViolations: 3,
    violationType: 'APP_SWITCH',
  });
  assert.equal(w1.title, 'PERINGATAN 1');
  assert.equal(w1.primaryMessage, 'Anda meninggalkan halaman ujian.');

  const w2 = getEscalatingWarningContent({
    violationCount: 2,
    maxViolations: 3,
    violationType: 'APP_SWITCH',
  });
  assert.equal(w2.title, 'PERINGATAN 2');
  assert.equal(w2.primaryMessage, 'Anda kembali meninggalkan halaman ujian.');
  assert.equal(
    w2.warningFooter,
    'Peringatan terakhir akan menyebabkan ujian dikunci.'
  );

  const wf = getEscalatingWarningContent({
    violationCount: 1,
    maxViolations: 3,
    violationType: 'FULLSCREEN_EXIT',
  });
  assert.equal(wf.title, 'ANDA KELUAR DARI MODE LAYAR PENUH');
  assert.equal(wf.isFullscreenExit, true);
});

test('PART 5 formatTimeRemaining, visual status, and duration validation', () => {
  assert.equal(formatTimeRemaining(90 * 60 * 1000), '01:30:00');
  assert.equal(formatTimeRemaining(60 * 60 * 1000), '01:00:00');
  assert.equal(formatTimeRemaining((59 * 60 + 59) * 1000), '59:59');
  assert.equal(formatTimeRemaining((45 * 60 + 30) * 1000), '45:30');
  assert.equal(formatTimeRemaining((10 * 60 + 5) * 1000), '10:05');
  assert.equal(formatTimeRemaining(500), '00:01');
  assert.equal(formatTimeRemaining(0), '00:00');
  assert.equal(formatTimeRemaining(-5000), '00:00');

  assert.equal(getTimerVisualStatus(16 * 60 * 1000), 'NORMAL');
  assert.equal(getTimerVisualStatus(15 * 60 * 1000), 'WARNING');
  assert.equal(getTimerVisualStatus(5 * 60 * 1000), 'CRITICAL');
  assert.equal(getTimerVisualStatus(60 * 1000), 'LAST_MINUTE');
  assert.equal(getTimerVisualStatus(0), 'EXPIRED');

  assert.equal(isValidExamDuration(90), true);
  assert.equal(isValidExamDuration(5), true);
  assert.equal(isValidExamDuration(0), false);
  assert.equal(isValidExamDuration(-10), false);
  assert.equal(isValidExamDuration(Number.NaN), false);
});

test('PART 5 one-time threshold warnings (15m / 5m / 1m) and strict status priority', () => {
  let flags = {
    warning15Shown: false,
    warning5Shown: false,
    warning1Shown: false,
  };

  // Above 15m -> no warning
  const r0 = evaluateNextTimerWarning({
    remainingMs: 20 * 60 * 1000,
    durationMinutes: 90,
    flags,
  });
  assert.equal(r0.triggered, null);

  // Enter <= 15m -> triggers 15 once
  const r15 = evaluateNextTimerWarning({
    remainingMs: 15 * 60 * 1000,
    durationMinutes: 90,
    flags,
  });
  assert.equal(r15.triggered, 15);
  assert.equal(getTimerWarningContent(15).title, 'WAKTU UJIAN TERSISA 15 MENIT');
  flags = r15.nextFlags;

  // Still <= 15m -> does NOT spam again
  const r15Repeat = evaluateNextTimerWarning({
    remainingMs: 14 * 60 * 1000,
    durationMinutes: 90,
    flags,
  });
  assert.equal(r15Repeat.triggered, null);

  // Enter <= 5m -> triggers 5 once
  const r5 = evaluateNextTimerWarning({
    remainingMs: 5 * 60 * 1000,
    durationMinutes: 90,
    flags,
  });
  assert.equal(r5.triggered, 5);
  assert.equal(getTimerWarningContent(5).title, 'PERHATIAN');
  flags = r5.nextFlags;

  // Enter <= 1m -> triggers 1 once
  const r1 = evaluateNextTimerWarning({
    remainingMs: 60 * 1000,
    durationMinutes: 90,
    flags,
  });
  assert.equal(r1.triggered, 1);
  assert.equal(getTimerWarningContent(1).title, 'WAKTU HAMPIR HABIS');
  flags = r1.nextFlags;

  // Short 10-minute exam skips 15m warning at start
  const rShort = evaluateNextTimerWarning({
    remainingMs: 10 * 60 * 1000,
    durationMinutes: 10,
    flags: { warning15Shown: false, warning5Shown: false, warning1Shown: false },
  });
  assert.equal(rShort.triggered, null);

  // Strict status priority: EXAM_EXPIRED > EXAM_LOCKED > EXAM_STARTED > READY
  assert.equal(
    resolveExamControlStatus({ isExpired: true, isLocked: true, isStarted: true }),
    'EXAM_EXPIRED'
  );
  assert.equal(
    resolveExamControlStatus({ isExpired: false, isLocked: true, isStarted: true }),
    'EXAM_LOCKED'
  );
  assert.equal(
    resolveExamControlStatus({ isExpired: false, isLocked: false, isStarted: true }),
    'EXAM_STARTED'
  );
  assert.equal(
    resolveExamControlStatus({ isExpired: false, isLocked: false, isStarted: false }),
    'READY'
  );
});
