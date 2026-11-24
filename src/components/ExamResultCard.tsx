import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Printer,
  QrCode,
  RotateCcw,
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  getViolationActionLabel,
  slugifyFileName,
  type GeneratedExamResult,
} from '../utils/examConfig';
import { triggerDataUrlDownload } from '../utils/qrCode';

interface ExamResultCardProps {
  result: GeneratedExamResult;
  qrDataUrl: string;
  isGeneratingQr: boolean;
  qrError: string | null;
  onReset: () => void;
}

export function ExamResultCard({
  result,
  qrDataUrl,
  isGeneratingQr,
  qrError,
  onReset,
}: ExamResultCardProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const { config, secureLink } = result;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(secureLink);
    setCopyStatus(ok ? 'copied' : 'failed');
    window.setTimeout(() => {
      setCopyStatus('idle');
    }, 3000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const slug = slugifyFileName(config.examName);
    triggerDataUrlDownload(qrDataUrl, `qr-stansa-${slug}.png`);
  };

  const handlePrintQr = () => {
    window.print();
  };

  return (
    <section
      aria-labelledby="exam-result-heading"
      data-testid="exam-result-card"
      className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="exam-result-heading"
              className="text-lg font-extrabold tracking-normal text-slate-900"
            >
              UJIAN BERHASIL DIBUAT
            </h2>
            <p className="mt-0.5 text-xs font-mono text-slate-500">
              ID: {config.examId}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Buat Ujian Lain
        </button>
      </div>

      {/* Exam Summary */}
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-slate-500">Nama Ujian</dt>
          <dd className="mt-1 text-sm font-bold text-slate-900">{config.examName}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Tingkat</dt>
          <dd className="mt-1 text-sm font-bold text-slate-900">{config.level}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Kelas</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">
            {config.classes.join(', ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Durasi</dt>
          <dd className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
            {config.durationMinutes} menit
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          Batas pelanggaran:{' '}
          <strong className="font-semibold text-slate-700 tabular-nums">
            {config.maxViolations}x
          </strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Tindakan:{' '}
          <strong className="font-semibold text-slate-700">
            {getViolationActionLabel(config.violationAction)}
          </strong>
        </span>
      </div>

      {/* Secure Exam Link */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <label
          htmlFor="secure-exam-link-output"
          className="block text-sm font-bold text-slate-900"
        >
          Secure Exam Link
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Bagikan tautan berikut kepada siswa atau tampilkan QR Code di kelas.
        </p>

        <div className="mt-3">
          <input
            id="secure-exam-link-output"
            type="text"
            readOnly
            value={secureLink}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Secure Exam Link"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap"
          >
            {copyStatus === 'copied' ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                TERSALIN
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                COPY LINK
              </>
            )}
          </button>

          <a
            href={secureLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition-colors duration-150 hover:border-blue-700 hover:bg-blue-50/40 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            BUKA UJIAN
          </a>
        </div>

        {copyStatus === 'copied' && (
          <p
            role="status"
            aria-live="polite"
            className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Link berhasil disalin.
          </p>
        )}

        {copyStatus === 'failed' && (
          <p
            role="alert"
            className="mt-2.5 text-xs font-semibold text-amber-800"
          >
            Gagal menyalin otomatis. Silakan klik kolom link lalu tekan Ctrl+C / Salin.
          </p>
        )}
      </div>

      {/* QR Code Section */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <h3 className="text-sm font-bold tracking-normal text-slate-900">
            QR CODE UJIAN
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Dapat langsung dipindai menggunakan kamera HP siswa.
        </p>

        <div className="mt-4 flex flex-col items-center">
          <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 sm:h-60 sm:w-60">
            {isGeneratingQr ? (
              <div className="text-xs font-medium text-slate-500">
                Membuat QR Code...
              </div>
            ) : qrError ? (
              <div className="px-4 text-center text-xs font-medium text-red-600">
                {qrError}
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code untuk ${config.examName}`}
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>

          <div className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrDataUrl || isGeneratingQr}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition-colors duration-150 hover:border-blue-700 hover:bg-blue-50/40 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              DOWNLOAD QR
            </button>

            <button
              type="button"
              onClick={handlePrintQr}
              disabled={!qrDataUrl || isGeneratingQr}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-950 transition-colors duration-150 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              CETAK QR
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
