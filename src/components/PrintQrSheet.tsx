import { SCHOOL_INFO, type ExamConfig } from '../utils/examConfig';
import { SchoolLogo } from './SchoolLogo';

interface PrintQrSheetProps {
  config: ExamConfig;
  qrDataUrl: string;
}

export function PrintQrSheet({ config, qrDataUrl }: PrintQrSheetProps) {
  return (
    <div className="print-only" aria-hidden="true">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-2xl border-2 border-slate-900 bg-white px-10 py-10 text-center">
        <SchoolLogo size="md" className="mb-3" />
        <div className="text-2xl font-extrabold tracking-tight text-slate-950">
          {SCHOOL_INFO.appName}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-600">
          {SCHOOL_INFO.schoolName} — {SCHOOL_INFO.location}
        </div>

        <hr className="my-6 w-full border-slate-300" />

        <h1 className="text-2xl font-extrabold text-slate-950">{config.examName}</h1>

        <div className="mt-4 space-y-1.5 text-base font-medium text-slate-800">
          <p>
            <span className="font-bold">Tingkat:</span> {config.level}
          </p>
          <p>
            <span className="font-bold">Kelas:</span> {config.classes.join(', ')}
          </p>
          <p className="tabular-nums">
            <span className="font-bold">Durasi:</span> {config.durationMinutes} menit
          </p>
        </div>

        {qrDataUrl && (
          <div className="my-7 rounded-xl border border-slate-300 bg-white p-4">
            <img
              src={qrDataUrl}
              alt={`QR Code ${config.examName}`}
              className="h-64 w-64 object-contain"
            />
          </div>
        )}

        <p className="text-base font-bold text-slate-900">
          Scan QR Code untuk mengikuti ujian.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          ID Ujian: {config.examId}
        </p>
      </div>
    </div>
  );
}
