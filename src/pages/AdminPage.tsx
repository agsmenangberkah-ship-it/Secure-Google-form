import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Clock, FileText, Link2, Lock, QrCode } from 'lucide-react';
import { ExamResultCard } from '../components/ExamResultCard';
import { Header } from '../components/Header';
import { PrintQrSheet } from '../components/PrintQrSheet';
import { SecurityConfigCard } from '../components/SecurityConfigCard';
import {
  CLASSES_BY_LEVEL,
  DEFAULT_SECURITY_CONFIG,
  GRADE_LEVELS,
  SCHOOL_INFO,
  createExamPayload,
  validateExamForm,
  type GeneratedExamResult,
  type GradeLevel,
  type SecurityConfig,
  type ValidationErrors,
  type ViolationAction,
} from '../utils/examConfig';
import { generateQrDataUrl } from '../utils/qrCode';

// Admin access is intentionally separated from the student exam interface.
// Admin panel tidak ditautkan dari halaman ujian siswa.

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const [examName, setExamName] = useState('');
  const [level, setLevel] = useState<GradeLevel | ''>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [security, setSecurity] = useState<SecurityConfig>({
    ...DEFAULT_SECURITY_CONFIG,
  });
  const [maxViolations, setMaxViolations] = useState<number>(3);
  const [violationAction, setViolationAction] = useState<ViolationAction>('lock');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [result, setResult] = useState<GeneratedExamResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const availableClasses = level ? CLASSES_BY_LEVEL[level] : [];
  const allClassesSelected =
    availableClasses.length > 0 &&
    availableClasses.every((cls) => selectedClasses.includes(cls));

  const clearFieldError = (field: keyof ValidationErrors) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleLevelChange = (nextLevel: GradeLevel | '') => {
    setLevel(nextLevel);
    setSelectedClasses([]);
    clearFieldError('level');
    clearFieldError('classes');
  };

  const handleToggleClass = (className: string) => {
    setSelectedClasses((prev) => {
      const exists = prev.includes(className);
      const next = exists
        ? prev.filter((item) => item !== className)
        : [...prev, className];

      // Preserve canonical class order (A..K)
      return availableClasses.filter((cls) => next.includes(cls));
    });
    clearFieldError('classes');
  };

  const handleToggleSelectAllClasses = () => {
    if (!level) return;
    if (allClassesSelected) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses([...availableClasses]);
      clearFieldError('classes');
    }
  };

  const handleToggleSecurity = (key: keyof SecurityConfig) => {
    setSecurity((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const input = {
      examName,
      level,
      classes: selectedClasses,
      googleFormUrl,
      durationMinutes,
      security,
      maxViolations,
      violationAction,
    };

    const validationErrors = validateExamForm(input);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const currentOrigin = window.location.origin;
    const generated = createExamPayload(input, currentOrigin);
    setResult(generated);
    setQrError(null);
    setIsGeneratingQr(true);

    try {
      const dataUrl = await generateQrDataUrl(generated.secureLink);
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl('');
      setQrError('QR Code gagal dibuat. Silakan coba buat link ujian kembali.');
    } finally {
      setIsGeneratingQr(false);
    }

    // Bring generated result into view cleanly on smaller screens
    window.requestAnimationFrame(() => {
      resultSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const handleReset = () => {
    setExamName('');
    setLevel('');
    setSelectedClasses([]);
    setGoogleFormUrl('');
    setDurationMinutes(90);
    setSecurity({ ...DEFAULT_SECURITY_CONFIG });
    setMaxViolations(3);
    setViolationAction('lock');
    setErrors({});
    setResult(null);
    setQrDataUrl('');
    setQrError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header variant="admin" onNavigate={onNavigate} />

      <main className="no-print mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold text-blue-700">
              {SCHOOL_INFO.schoolNameTitle} · {SCHOOL_INFO.location}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Panel Pembuatan Ujian
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Origin aktif:{' '}
            <span className="font-mono font-medium text-slate-700">
              {window.location.origin}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Exam Configuration Form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6 lg:col-span-7"
            aria-label="Formulir buat ujian baru"
          >
            {errorCount > 0 && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="font-bold">Periksa kembali data ujian</p>
                  <p className="mt-0.5 text-xs text-red-700">
                    Terdapat {errorCount} kolom yang perlu dilengkapi atau diperbaiki sebelum membuat Secure Exam Link.
                  </p>
                </div>
              </div>
            )}

            {/* Main Card: BUAT UJIAN BARU */}
            <section
              aria-labelledby="create-exam-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
            >
              <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="create-exam-heading"
                    className="text-lg font-extrabold tracking-normal text-slate-900"
                  >
                    BUAT UJIAN BARU
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Masukkan data ujian untuk membuat Secure Exam Link.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {/* Field 1: Nama Ujian */}
                <div>
                  <label
                    htmlFor="exam-name-input"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Nama Ujian <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="exam-name-input"
                    type="text"
                    value={examName}
                    onChange={(e) => {
                      setExamName(e.target.value);
                      clearFieldError('examName');
                    }}
                    placeholder="Contoh: PAS Informatika Semester 1"
                    aria-required="true"
                    aria-invalid={Boolean(errors.examName)}
                    className={`mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                      errors.examName
                        ? 'border-red-500 focus:border-red-600'
                        : 'border-slate-300 focus:border-blue-700'
                    }`}
                  />
                  {errors.examName && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
                      {errors.examName}
                    </p>
                  )}
                </div>

                {/* Field 2 & Field 5 Row: Tingkat & Durasi Ujian */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* Field 2: Tingkat */}
                  <div>
                    <label
                      htmlFor="level-select"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Tingkat <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="level-select"
                      value={level}
                      onChange={(e) =>
                        handleLevelChange(e.target.value as GradeLevel | '')
                      }
                      aria-required="true"
                      aria-invalid={Boolean(errors.level)}
                      className={`mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                        errors.level
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-300 focus:border-blue-700'
                      }`}
                    >
                      <option value="">Pilih Tingkat</option>
                      {GRADE_LEVELS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                    {errors.level && (
                      <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
                        {errors.level}
                      </p>
                    )}
                  </div>

                  {/* Field 5: Durasi Ujian */}
                  <div>
                    <label
                      htmlFor="duration-input"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Durasi Ujian <span className="text-red-600" aria-hidden="true">*</span>
                    </label>
                    <div className="relative mt-1.5 flex items-center">
                      <Clock
                        className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="duration-input"
                        type="number"
                        min={5}
                        max={300}
                        value={Number.isNaN(durationMinutes) ? '' : durationMinutes}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setDurationMinutes(raw === '' ? Number.NaN : Number(raw));
                          clearFieldError('durationMinutes');
                        }}
                        aria-required="true"
                        aria-invalid={Boolean(errors.durationMinutes)}
                        className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-16 text-sm font-semibold text-slate-900 tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-base ${
                          errors.durationMinutes
                            ? 'border-red-500 focus:border-red-600'
                            : 'border-slate-300 focus:border-blue-700'
                        }`}
                      />
                      <span className="pointer-events-none absolute right-3.5 text-xs font-semibold text-slate-500">
                        menit
                      </span>
                    </div>
                    {errors.durationMinutes ? (
                      <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
                        {errors.durationMinutes}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Rentang 5 – 300 menit (default 90 menit).
                      </p>
                    )}
                  </div>
                </div>

                {/* Field 3: Kelas (muncul setelah Tingkat dipilih) */}
                {level && (
                  <fieldset className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <legend className="text-sm font-semibold text-slate-800">
                        Kelas Tingkat {level}{' '}
                        <span className="text-red-600" aria-hidden="true">*</span>
                      </legend>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold tracking-wide text-blue-700 hover:text-blue-900">
                        <input
                          type="checkbox"
                          checked={allClassesSelected}
                          onChange={handleToggleSelectAllClasses}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-700"
                        />
                        <span>PILIH SEMUA</span>
                      </label>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                      {availableClasses.map((className) => {
                        const checked = selectedClasses.includes(className);
                        return (
                          <label
                            key={className}
                            className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                              checked
                                ? 'border-blue-700 bg-blue-700 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleClass(className)}
                              className="h-4 w-4 shrink-0 rounded accent-amber-400"
                            />
                            <span className="whitespace-nowrap">{className}</span>
                          </label>
                        );
                      })}
                    </div>

                    {errors.classes && (
                      <p className="mt-2.5 text-xs font-semibold text-red-600" role="alert">
                        {errors.classes}
                      </p>
                    )}
                  </fieldset>
                )}

                {!level && errors.classes && (
                  <p className="text-xs font-semibold text-red-600" role="alert">
                    {errors.classes}
                  </p>
                )}

                {/* Field 4: Link Google Form */}
                <div>
                  <label
                    htmlFor="google-form-url-input"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Link Google Form <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Link2
                      className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="google-form-url-input"
                      type="url"
                      value={googleFormUrl}
                      onChange={(e) => {
                        setGoogleFormUrl(e.target.value);
                        clearFieldError('googleFormUrl');
                      }}
                      placeholder="Tempel link Google Form di sini"
                      aria-required="true"
                      aria-invalid={Boolean(errors.googleFormUrl)}
                      className={`w-full rounded-lg border bg-white py-3 pl-10 pr-4 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:text-sm ${
                        errors.googleFormUrl
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-300 focus:border-blue-700'
                      }`}
                    />
                  </div>
                  {errors.googleFormUrl ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
                      {errors.googleFormUrl}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      Contoh:{' '}
                      <span className="break-all font-mono text-slate-600">
                        https://docs.google.com/forms/d/e/XXXXXXXX/viewform
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Field 6 + Violation Limits Card */}
            <SecurityConfigCard
              security={security}
              maxViolations={maxViolations}
              violationAction={violationAction}
              maxViolationsError={errors.maxViolations}
              onToggleSecurity={handleToggleSecurity}
              onChangeMaxViolations={(val) => {
                setMaxViolations(val);
                clearFieldError('maxViolations');
              }}
              onChangeViolationAction={setViolationAction}
            />

            {/* Primary Action Button */}
            <div>
              <button
                type="submit"
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-xs transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:text-base whitespace-nowrap"
              >
                <Lock className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                BUAT LINK UJIAN
              </button>
            </div>
          </form>

          {/* Right Column: Generated Secure Exam Link & QR Code */}
          <div ref={resultSectionRef} className="lg:sticky lg:top-6 lg:col-span-5">
            {result ? (
              <ExamResultCard
                result={result}
                qrDataUrl={qrDataUrl}
                isGeneratingQr={isGeneratingQr}
                qrError={qrError}
                onReset={handleReset}
              />
            ) : (
              <aside
                aria-label="Informasi hasil link ujian"
                className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center sm:p-8"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <QrCode className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900">
                  Secure Exam Link &amp; QR Code
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Lengkapi data ujian di sebelah kiri lalu tekan{' '}
                  <strong className="font-semibold text-slate-800">
                    BUAT LINK UJIAN
                  </strong>{' '}
                  untuk menghasilkan tautan ujian terenkode dan QR Code siap cetak.
                </p>

                <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-left text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Format tautan otomatis:</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {window.location.origin}/exam/&lt;encoded-config&gt;
                  </p>
                </div>
              </aside>
            )}
          </div>
        </div>
      </main>

      {/* Dedicated Print Layout for QR Code */}
      {result && <PrintQrSheet config={result.config} qrDataUrl={qrDataUrl} />}

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>
            {SCHOOL_INFO.schoolNameTitle}, {SCHOOL_INFO.location}
          </p>
          <p>{SCHOOL_INFO.appName} · Panel Admin / Panitia</p>
        </div>
      </footer>
    </div>
  );
}
