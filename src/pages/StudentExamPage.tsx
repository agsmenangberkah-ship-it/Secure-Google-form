import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  UserCheck,
} from 'lucide-react';
import { Header } from '../components/Header';
import { StudentConfirmModal } from '../components/StudentConfirmModal';
import { StudentExamStartedView } from '../components/StudentExamStartedView';
import {
  SCHOOL_INFO,
  decodeExamConfig,
  isStudentEntryComplete,
  validateStudentEntry,
  type ExamConfig,
  type StudentEntryErrors,
} from '../utils/examConfig';
import {
  createStudentSession,
  loadStudentSession,
  saveStudentSession,
  type StudentExamSession,
} from '../utils/studentSession';
import { requestAppFullscreen } from '../utils/examMode';
import { loadViolationHistory } from '../utils/examSecurity';
import {
  initializeOrLoadExamTimer,
  isPersistedExamExpired,
  isValidExamDuration,
  loadExamTimerRecord,
} from '../utils/examTimer';

// Admin access is intentionally separated from the student exam interface.
// Admin panel tidak ditautkan dari halaman ujian siswa.

type StudentPageState =
  | 'LOADING'
  | 'INVALID'
  | 'INVALID_DURATION'
  | 'VERIFICATION'
  | 'EXAM_STARTED';

interface StudentExamPageProps {
  encodedConfig: string;
}

export function StudentExamPage({ encodedConfig }: StudentExamPageProps) {
  const [pageState, setPageState] = useState<StudentPageState>('LOADING');
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [activeSession, setActiveSession] = useState<StudentExamSession | null>(
    null
  );

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [touched, setTouched] = useState<{
    fullName: boolean;
    studentId: boolean;
    selectedClass: boolean;
  }>({
    fullName: false,
    studentId: false,
    selectedClass: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [initialFullscreenFailed, setInitialFullscreenFailed] = useState(false);

  useEffect(() => {
    setPageState('LOADING');
    setIsConfirmOpen(false);

    const timer = window.setTimeout(() => {
      const decoded = decodeExamConfig(encodedConfig);
      if (!decoded) {
        setConfig(null);
        setActiveSession(null);
        setPageState('INVALID');
        return;
      }

      if (!isValidExamDuration(decoded.durationMinutes)) {
        setConfig(null);
        setActiveSession(null);
        setPageState('INVALID_DURATION');
        return;
      }

      setConfig(decoded);
      const existingSession = loadStudentSession(decoded.examId, decoded.classes);
      const persistedViolation = loadViolationHistory(decoded.examId);
      const persistedTimer = loadExamTimerRecord(decoded.examId);
      const persistedExpired = isPersistedExamExpired(decoded.examId);

      if (existingSession) {
        setActiveSession(existingSession);
        setPageState('EXAM_STARTED');
      } else if (
        persistedTimer ||
        persistedExpired ||
        persistedViolation.examStatus === 'LOCKED'
      ) {
        setActiveSession({
          examId: decoded.examId,
          studentName: 'Peserta Ujian',
          studentId: '-',
          studentClass: decoded.classes[0] ?? '-',
          startedAt: new Date(
            persistedTimer?.startedAt ?? Date.now()
          ).toISOString(),
        });
        setPageState('EXAM_STARTED');
      } else {
        setActiveSession(null);
        setPageState('VERIFICATION');
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [encodedConfig]);

  const entryInput = { fullName, studentId, selectedClass };
  const allowedClasses = config?.classes ?? [];
  const allErrors: StudentEntryErrors = config
    ? validateStudentEntry(entryInput, allowedClasses)
    : {};
  const canStartExam = config
    ? isStudentEntryComplete(entryInput, allowedClasses)
    : false;

  const visibleErrors: StudentEntryErrors = {
    fullName:
      touched.fullName || submitAttempted ? allErrors.fullName : undefined,
    studentId:
      touched.studentId || submitAttempted ? allErrors.studentId : undefined,
    selectedClass:
      touched.selectedClass || submitAttempted
        ? allErrors.selectedClass
        : undefined,
  };

  const handleOpenConfirm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!config || !canStartExam) {
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmStartExam = async () => {
    if (!config || !canStartExam) return;
    if (!isValidExamDuration(config.durationMinutes)) {
      setIsConfirmOpen(false);
      setPageState('INVALID_DURATION');
      return;
    }

    const session = createStudentSession(config.examId, entryInput);
    saveStudentSession(session);

    // Always initialize timestamp-based exam timer immediately on YA, MULAI UJIAN
    initializeOrLoadExamTimer(config.examId, config.durationMinutes, Date.now());

    setActiveSession(session);
    setIsConfirmOpen(false);

    // Invoke Fullscreen API directly inside the student's click interaction only if configured
    if (config.security.fullscreen) {
      const enteredFullscreen = await requestAppFullscreen();
      setInitialFullscreenFailed(!enteredFullscreen);
    } else {
      setInitialFullscreenFailed(false);
    }
    setPageState('EXAM_STARTED');
  };

  if (pageState === 'EXAM_STARTED' && config && activeSession) {
    return (
      <StudentExamStartedView
        config={config}
        session={activeSession}
        initialFullscreenFailed={initialFullscreenFailed}
      />
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900"
      data-student-state={pageState}
    >
      <Header variant="exam" />

      <main className="flex flex-1 flex-col">
        {pageState === 'LOADING' && (
          <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-4 py-12">
            <section
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-xs"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-blue-700"
                aria-hidden="true"
              />
              <p className="mt-4 text-base font-bold text-slate-900">
                Memuat ujian...
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Membaca konfigurasi ujian dari tautan aman.
              </p>
            </section>
          </div>
        )}

        {pageState === 'INVALID' && (
          <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-4 py-12">
            <section
              role="alert"
              className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xs sm:p-9"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-extrabold tracking-normal text-slate-950">
                UJIAN TIDAK VALID
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Link ujian tidak dapat dibaca atau sudah rusak.
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-800">
                Silakan hubungi panitia/guru.
              </p>
            </section>
          </div>
        )}

        {pageState === 'INVALID_DURATION' && (
          <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-4 py-12">
            <section
              role="alert"
              className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xs sm:p-9"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-xl font-extrabold tracking-normal text-slate-950">
                DURASI UJIAN TIDAK VALID
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                Konfigurasi durasi ujian tidak valid.
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-800">
                Silakan hubungi panitia.
              </p>
            </section>
          </div>
        )}

        {pageState === 'VERIFICATION' && config && (
          <div className="mx-auto w-full max-w-[640px] flex-1 px-4 py-6 sm:px-6 sm:py-10">
            {/* Loaded Status Notice */}
            <div
              role="status"
              className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Data ujian berhasil dimuat.</span>
            </div>

            {/* Unified Verification Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              {/* Exam Information Section */}
              <section
                aria-labelledby="exam-info-heading"
                className="border-b border-slate-200 bg-slate-50/70 px-5 py-6 sm:px-7"
              >
                <p className="text-center text-xs font-bold tracking-wider text-blue-700">
                  NAMA UJIAN
                </p>
                <h1
                  id="exam-info-heading"
                  className="mt-1.5 text-center text-xl font-extrabold tracking-normal text-slate-950 sm:text-2xl"
                >
                  {config.examName}
                </h1>

                <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold tracking-wider text-slate-500">
                      TINGKAT
                    </dt>
                    <dd className="mt-0.5 text-sm font-extrabold text-slate-900">
                      {config.level}
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                    <dt className="text-[11px] font-bold tracking-wider text-slate-500">
                      DURASI
                    </dt>
                    <dd className="mt-0.5 text-sm font-extrabold text-slate-900 tabular-nums">
                      {config.durationMinutes} MENIT
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 sm:col-span-1">
                    <dt className="text-[11px] font-bold tracking-wider text-slate-500">
                      KELAS
                    </dt>
                    <dd className="mt-0.5 text-xs font-bold leading-snug text-slate-900 sm:text-sm">
                      {config.classes.join(', ')}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Participant Data Form Section */}
              <section
                aria-labelledby="participant-form-heading"
                className="px-5 py-6 sm:px-7 sm:py-7"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <UserCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="participant-form-heading"
                      className="text-base font-extrabold tracking-normal text-slate-900 sm:text-lg"
                    >
                      DATA PESERTA
                    </h2>
                    <p className="text-xs text-slate-500">
                      Isi identitas Anda dengan benar sebelum memulai ujian.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleOpenConfirm}
                  noValidate
                  className="mt-5 space-y-5"
                  aria-label="Formulir verifikasi data peserta"
                >
                  {/* Nama Lengkap */}
                  <div>
                    <label
                      htmlFor="student-fullname-input"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Nama Lengkap{' '}
                      <span className="text-red-600" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="student-fullname-input"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, fullName: true }))
                      }
                      placeholder="Masukkan nama lengkap"
                      autoComplete="name"
                      aria-required="true"
                      aria-invalid={Boolean(visibleErrors.fullName)}
                      className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                        visibleErrors.fullName
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-300 focus:border-blue-700'
                      }`}
                    />
                    {visibleErrors.fullName && (
                      <p
                        className="mt-1.5 text-xs font-semibold text-red-600"
                        role="alert"
                      >
                        {visibleErrors.fullName}
                      </p>
                    )}
                  </div>

                  {/* NIS / NISN */}
                  <div>
                    <label
                      htmlFor="student-id-input"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      NIS / NISN{' '}
                      <span className="text-red-600" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="student-id-input"
                      type="text"
                      inputMode="numeric"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, studentId: true }))
                      }
                      placeholder="Masukkan NIS / NISN"
                      autoComplete="off"
                      aria-required="true"
                      aria-invalid={Boolean(visibleErrors.studentId)}
                      className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                        visibleErrors.studentId
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-300 focus:border-blue-700'
                      }`}
                    />
                    {visibleErrors.studentId && (
                      <p
                        className="mt-1.5 text-xs font-semibold text-red-600"
                        role="alert"
                      >
                        {visibleErrors.studentId}
                      </p>
                    )}
                  </div>

                  {/* Kelas (strictly from Secure Exam Link config) */}
                  <div>
                    <label
                      htmlFor="student-class-select"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Kelas{' '}
                      <span className="text-red-600" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <select
                      id="student-class-select"
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setTouched((prev) => ({ ...prev, selectedClass: true }));
                      }}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, selectedClass: true }))
                      }
                      aria-required="true"
                      aria-invalid={Boolean(visibleErrors.selectedClass)}
                      className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                        visibleErrors.selectedClass
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-300 focus:border-blue-700'
                      }`}
                    >
                      <option value="">Pilih Kelas</option>
                      {config.classes.map((className) => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))}
                    </select>
                    {visibleErrors.selectedClass && (
                      <p
                        className="mt-1.5 text-xs font-semibold text-red-600"
                        role="alert"
                      >
                        {visibleErrors.selectedClass}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={!canStartExam}
                      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold tracking-wide transition-colors duration-150 sm:text-base whitespace-nowrap ${
                        canStartExam
                          ? 'cursor-pointer bg-blue-700 text-white shadow-xs hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500'
                          : 'cursor-not-allowed bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                      MULAI UJIAN
                    </button>

                    {!canStartExam && (
                      <p className="mt-2.5 text-center text-xs font-medium text-slate-500">
                        Lengkapi data peserta terlebih dahulu.
                      </p>
                    )}
                  </div>
                </form>
              </section>
            </div>
          </div>
        )}

      </main>

      {config && (
        <StudentConfirmModal
          isOpen={isConfirmOpen}
          config={config}
          studentName={fullName}
          studentId={studentId}
          studentClass={selectedClass}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmStartExam}
        />
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-center px-4 py-4 text-xs text-slate-500 sm:px-6">
          <p>
            {SCHOOL_INFO.schoolNameTitle}, {SCHOOL_INFO.location} ·{' '}
            {SCHOOL_INFO.appName}
          </p>
        </div>
      </footer>
    </div>
  );
}
