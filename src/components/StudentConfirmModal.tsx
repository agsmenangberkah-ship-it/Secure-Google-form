import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ExamConfig } from '../utils/examConfig';

interface StudentConfirmModalProps {
  isOpen: boolean;
  config: ExamConfig;
  studentName: string;
  studentId: string;
  studentClass: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StudentConfirmModal({
  isOpen,
  config,
  studentName,
  studentId,
  studentClass,
  onCancel,
  onConfirm,
}: StudentConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-start-exam-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="confirm-start-exam-title"
              className="text-lg font-extrabold tracking-normal text-slate-950"
            >
              SIAP MEMULAI UJIAN?
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Pastikan seluruh identitas peserta di bawah ini sudah benar.
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-3.5 text-sm">
          <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-2.5">
            <dt className="text-xs font-semibold text-slate-500">Nama</dt>
            <dd className="font-bold text-slate-900">{studentName.trim()}</dd>
          </div>

          <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-2.5">
            <dt className="text-xs font-semibold text-slate-500">NIS/NISN</dt>
            <dd className="font-mono font-semibold text-slate-900 tabular-nums">
              {studentId.trim()}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2.5">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Kelas</dt>
              <dd className="mt-0.5 font-bold text-slate-900">{studentClass}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Durasi</dt>
              <dd className="mt-0.5 font-bold text-slate-900 tabular-nums">
                {config.durationMinutes} Menit
              </dd>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-slate-500">Ujian</dt>
            <dd className="font-bold text-blue-800">{config.examName}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap"
          >
            BATAL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 whitespace-nowrap"
          >
            YA, MULAI UJIAN
          </button>
        </div>
      </div>
    </div>
  );
}
