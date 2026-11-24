import { ShieldCheck } from 'lucide-react';
import {
  SECURITY_OPTIONS,
  VIOLATION_ACTION_OPTIONS,
  type SecurityConfig,
  type ViolationAction,
} from '../utils/examConfig';

interface SecurityConfigCardProps {
  security: SecurityConfig;
  maxViolations: number;
  violationAction: ViolationAction;
  maxViolationsError?: string;
  onToggleSecurity: (key: keyof SecurityConfig) => void;
  onChangeMaxViolations: (value: number) => void;
  onChangeViolationAction: (value: ViolationAction) => void;
}

export function SecurityConfigCard({
  security,
  maxViolations,
  violationAction,
  maxViolationsError,
  onToggleSecurity,
  onChangeMaxViolations,
  onChangeViolationAction,
}: SecurityConfigCardProps) {
  const activeCount = Object.values(security).filter(Boolean).length;

  return (
    <section
      aria-labelledby="security-mode-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="security-mode-heading"
              className="text-base font-bold tracking-normal text-slate-900 sm:text-lg"
            >
              MODE KEAMANAN
            </h2>
            <span className="text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">
              {activeCount} / {SECURITY_OPTIONS.length} aktif
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Pengaturan keamanan aktif secara otomatis setelah peserta memulai ujian.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY_OPTIONS.map((option) => {
          const checked = security[option.key];
          return (
            <label
              key={option.key}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
                checked
                  ? 'border-blue-600/40 bg-blue-50/60 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleSecurity(option.key)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              <span className="leading-snug">{option.label}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-bold text-slate-800">Batas Pelanggaran</h3>
        <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="max-violations-input"
              className="block text-sm font-semibold text-slate-700"
            >
              Maksimal Pelanggaran
            </label>
            <input
              id="max-violations-input"
              type="number"
              min={1}
              max={20}
              value={Number.isNaN(maxViolations) ? '' : maxViolations}
              onChange={(e) => {
                const raw = e.target.value;
                onChangeMaxViolations(raw === '' ? Number.NaN : Number(raw));
              }}
              aria-invalid={Boolean(maxViolationsError)}
              className={`mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                maxViolationsError
                  ? 'border-red-500 focus:border-red-600'
                  : 'border-slate-300 focus:border-blue-700'
              }`}
            />
            {maxViolationsError ? (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {maxViolationsError}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Jumlah toleransi pelanggaran sebelum tindakan diterapkan (default: 3).
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="violation-action-select"
              className="block text-sm font-semibold text-slate-700"
            >
              Tindakan Pelanggaran
            </label>
            <select
              id="violation-action-select"
              value={violationAction}
              onChange={(e) =>
                onChangeViolationAction(e.target.value as ViolationAction)
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 transition-colors focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            >
              {VIOLATION_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Konfigurasi disimpan langsung di dalam Secure Exam Link.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
