export type GradeLevel = 'VII' | 'VIII' | 'IX';

export type ViolationAction = 'warn' | 'lock' | 'terminate';

export interface SecurityConfig {
  fullscreen: boolean;
  blockCopy: boolean;
  blockPaste: boolean;
  blockCut: boolean;
  blockContextMenu: boolean;
  blockSelection: boolean;
  detectTabSwitch: boolean;
  detectFullscreenExit: boolean;
  timer: boolean;
}

export interface ExamConfig {
  examId: string;
  examName: string;
  level: GradeLevel;
  classes: string[];
  googleFormUrl: string;
  durationMinutes: number;
  security: SecurityConfig;
  maxViolations: number;
  violationAction: ViolationAction;
}

export interface ExamFormInput {
  examName: string;
  level: GradeLevel | '';
  classes: string[];
  googleFormUrl: string;
  durationMinutes: number;
  security: SecurityConfig;
  maxViolations: number;
  violationAction: ViolationAction;
}

export interface ValidationErrors {
  examName?: string;
  level?: string;
  classes?: string;
  googleFormUrl?: string;
  durationMinutes?: string;
  maxViolations?: string;
}

export const SCHOOL_INFO = {
  schoolName: 'SMPN 1 TANJUNGSARI',
  schoolNameTitle: 'SMPN 1 Tanjungsari',
  location: 'Sumedang',
  appName: 'STANSA SECURE FORM',
  subtitle: 'Secure Examination Gateway',
  logoUrl:
    'https://www.smpn1tjssmd.sch.id/media_library/images/dae70b66b531790d5f6bf03365c0d2e7.png',
  targetDomain: 'https://secure.smpn1tjssmd.sch.id',
} as const;

export const GRADE_LEVELS: readonly GradeLevel[] = ['VII', 'VIII', 'IX'];

export const CLASSES_BY_LEVEL: Record<GradeLevel, readonly string[]> = {
  VII: [
    'VII A',
    'VII B',
    'VII C',
    'VII D',
    'VII E',
    'VII F',
    'VII G',
    'VII H',
    'VII I',
    'VII J',
    'VII K',
  ],
  VIII: [
    'VIII A',
    'VIII B',
    'VIII C',
    'VIII D',
    'VIII E',
    'VIII F',
    'VIII G',
    'VIII H',
    'VIII I',
    'VIII J',
    'VIII K',
  ],
  IX: [
    'IX A',
    'IX B',
    'IX C',
    'IX D',
    'IX E',
    'IX F',
    'IX G',
    'IX H',
    'IX I',
    'IX J',
    'IX K',
  ],
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  fullscreen: true,
  blockCopy: true,
  blockPaste: true,
  blockCut: true,
  blockContextMenu: true,
  blockSelection: true,
  detectTabSwitch: true,
  detectFullscreenExit: true,
  timer: true,
};

export interface SecurityOptionMeta {
  key: keyof SecurityConfig;
  label: string;
}

export const SECURITY_OPTIONS: readonly SecurityOptionMeta[] = [
  { key: 'fullscreen', label: 'Fullscreen' },
  { key: 'blockCopy', label: 'Blok Copy' },
  { key: 'blockPaste', label: 'Blok Paste' },
  { key: 'blockCut', label: 'Blok Cut' },
  { key: 'blockContextMenu', label: 'Blok Klik Kanan' },
  { key: 'blockSelection', label: 'Blok Text Selection' },
  { key: 'detectTabSwitch', label: 'Deteksi Pindah Tab' },
  { key: 'detectFullscreenExit', label: 'Deteksi Keluar Fullscreen' },
  { key: 'timer', label: 'Timer' },
];

export const VIOLATION_ACTION_OPTIONS: ReadonlyArray<{
  value: ViolationAction;
  label: string;
}> = [
  { value: 'warn', label: 'Peringatan saja' },
  { value: 'lock', label: 'Kunci ujian' },
  { value: 'terminate', label: 'Akhiri ujian' },
];

export function getViolationActionLabel(action: ViolationAction): string {
  const found = VIOLATION_ACTION_OPTIONS.find((item) => item.value === action);
  return found ? found.label : 'Kunci ujian';
}

export function isValidGoogleFormUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  if (host === 'docs.google.com') {
    return /^\/forms\/.+/.test(pathname);
  }

  if (host === 'forms.gle') {
    return pathname.length > 1 && /^\/[A-Za-z0-9_-]+/.test(pathname);
  }

  return false;
}

export function validateExamForm(input: ExamFormInput): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.examName.trim()) {
    errors.examName = 'Nama ujian wajib diisi.';
  }

  if (!input.level || !GRADE_LEVELS.includes(input.level)) {
    errors.level = 'Silakan pilih tingkat.';
  }

  if (!input.classes || input.classes.length === 0) {
    errors.classes = 'Pilih minimal satu kelas.';
  }

  const trimmedUrl = input.googleFormUrl.trim();
  if (!trimmedUrl) {
    errors.googleFormUrl = 'Link Google Form wajib diisi.';
  } else if (!isValidGoogleFormUrl(trimmedUrl)) {
    errors.googleFormUrl =
      'Link tidak dikenali sebagai Google Form. Silakan periksa kembali.';
  }

  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 5) {
    errors.durationMinutes = 'Durasi minimal 5 menit.';
  } else if (input.durationMinutes > 300) {
    errors.durationMinutes = 'Durasi maksimal 300 menit.';
  }

  if (!Number.isFinite(input.maxViolations) || input.maxViolations < 1) {
    errors.maxViolations = 'Maksimal pelanggaran minimal 1.';
  } else if (input.maxViolations > 20) {
    errors.maxViolations = 'Maksimal pelanggaran maksimal 20.';
  }

  return errors;
}

export function generateExamId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 10;
  let token = '';

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      token += alphabet[bytes[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }

  return `stansa-${token}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeExamConfig(config: ExamConfig): string {
  const json = JSON.stringify(config);
  const bytes = new TextEncoder().encode(json);
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeExamConfig(encoded: string): ExamConfig | null {
  if (!encoded || typeof encoded !== 'string') return null;

  try {
    const trimmed = decodeURIComponent(encoded.trim());
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;

    let base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padLength);

    const bytes = base64ToBytes(base64);
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);

    if (!isPlainObject(parsed)) return null;

    const {
      examId,
      examName,
      level,
      classes,
      googleFormUrl,
      durationMinutes,
      security,
      maxViolations,
      violationAction,
    } = parsed;

    if (
      typeof examId !== 'string' ||
      !examId.trim() ||
      typeof examName !== 'string' ||
      !examName.trim() ||
      typeof level !== 'string' ||
      !GRADE_LEVELS.includes(level as GradeLevel) ||
      !Array.isArray(classes) ||
      classes.length === 0 ||
      !classes.every((c) => typeof c === 'string' && c.trim().length > 0) ||
      typeof googleFormUrl !== 'string' ||
      !isValidGoogleFormUrl(googleFormUrl) ||
      typeof durationMinutes !== 'number' ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 5 ||
      durationMinutes > 300 ||
      !isPlainObject(security) ||
      typeof maxViolations !== 'number' ||
      !Number.isFinite(maxViolations) ||
      maxViolations < 1 ||
      (violationAction !== 'warn' &&
        violationAction !== 'lock' &&
        violationAction !== 'terminate')
    ) {
      return null;
    }

    const parsedSecurity: SecurityConfig = {
      fullscreen: Boolean(security.fullscreen),
      blockCopy: Boolean(security.blockCopy),
      blockPaste: Boolean(security.blockPaste),
      blockCut: Boolean(security.blockCut),
      blockContextMenu: Boolean(security.blockContextMenu),
      blockSelection: Boolean(security.blockSelection),
      detectTabSwitch: Boolean(security.detectTabSwitch),
      detectFullscreenExit: Boolean(security.detectFullscreenExit),
      timer: Boolean(security.timer),
    };

    return {
      examId: examId.trim(),
      examName: examName.trim(),
      level: level as GradeLevel,
      classes: classes.map((c) => c.trim()),
      googleFormUrl: googleFormUrl.trim(),
      durationMinutes,
      security: parsedSecurity,
      maxViolations,
      violationAction,
    };
  } catch {
    return null;
  }
}

export function hasInvalidDurationInPayload(encoded: string): boolean {
  if (!encoded || typeof encoded !== 'string') return false;
  try {
    const trimmed = decodeURIComponent(encoded.trim());
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;

    let base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padLength);

    const bytes = base64ToBytes(base64);
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);

    if (!isPlainObject(parsed)) return false;
    if (!('durationMinutes' in parsed)) return false;

    const duration = parsed.durationMinutes;
    return (
      typeof duration !== 'number' ||
      !Number.isFinite(duration) ||
      duration <= 0
    );
  } catch {
    return false;
  }
}

export function buildSecureExamLink(encodedConfig: string, origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `${cleanOrigin}/exam/${encodedConfig}`;
}

export interface GeneratedExamResult {
  config: ExamConfig;
  encodedConfig: string;
  secureLink: string;
}

export function createExamPayload(
  input: ExamFormInput,
  origin: string
): GeneratedExamResult {
  const level = input.level as GradeLevel;
  const config: ExamConfig = {
    examId: generateExamId(),
    examName: input.examName.trim(),
    level,
    classes: [...input.classes],
    googleFormUrl: input.googleFormUrl.trim(),
    durationMinutes: Math.round(input.durationMinutes),
    security: { ...input.security },
    maxViolations: Math.round(input.maxViolations),
    violationAction: input.violationAction,
  };

  const encodedConfig = encodeExamConfig(config);
  const secureLink = buildSecureExamLink(encodedConfig, origin);

  return { config, encodedConfig, secureLink };
}

export function slugifyFileName(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'ujian'
  );
}

export interface StudentEntryInput {
  fullName: string;
  studentId: string;
  selectedClass: string;
}

export interface StudentEntryErrors {
  fullName?: string;
  studentId?: string;
  selectedClass?: string;
}

export function validateStudentEntry(
  input: StudentEntryInput,
  allowedClasses: readonly string[]
): StudentEntryErrors {
  const errors: StudentEntryErrors = {};

  if (!input.fullName.trim()) {
    errors.fullName = 'Nama lengkap wajib diisi.';
  }

  if (!input.studentId.trim()) {
    errors.studentId = 'NIS/NISN wajib diisi.';
  }

  if (!input.selectedClass || !allowedClasses.includes(input.selectedClass)) {
    errors.selectedClass = 'Silakan pilih kelas.';
  }

  return errors;
}

export function isStudentEntryComplete(
  input: StudentEntryInput,
  allowedClasses: readonly string[]
): boolean {
  return Object.keys(validateStudentEntry(input, allowedClasses)).length === 0;
}

export function toGoogleFormEmbedUrl(googleFormUrl: string): string {
  const trimmed = googleFormUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname.toLowerCase() === 'docs.google.com' &&
      /\/forms\/.+\/viewform\/?$/.test(parsed.pathname)
    ) {
      if (!parsed.searchParams.has('embedded')) {
        parsed.searchParams.set('embedded', 'true');
      }
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
