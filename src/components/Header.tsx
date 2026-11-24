import { SCHOOL_INFO } from '../utils/examConfig';
import { SchoolLogo } from './SchoolLogo';

// Admin access is intentionally separated from the student exam interface.
// Admin panel tidak ditautkan dari halaman ujian siswa.

interface HeaderProps {
  variant: 'landing' | 'admin' | 'exam';
  onNavigate?: (path: string) => void;
}

export function Header({ variant, onNavigate }: HeaderProps) {
  if (variant === 'exam') {
    return (
      <header className="no-print border-b border-slate-200/90 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <SchoolLogo size="sm" className="sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-normal text-slate-900 sm:text-base md:text-lg">
                {SCHOOL_INFO.appName}
              </div>
              <div className="truncate text-xs font-semibold text-blue-800 sm:text-[13px]">
                {SCHOOL_INFO.schoolName}
              </div>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold tracking-wider text-blue-800 whitespace-nowrap sm:text-xs">
            UJIAN ONLINE
          </span>
        </div>
      </header>
    );
  }

  const brandContent = (
    <>
      <SchoolLogo size="sm" className="sm:h-11 sm:w-11" />
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold tracking-normal text-slate-900 sm:text-base md:text-lg">
          {SCHOOL_INFO.appName}
        </div>
        <div className="truncate text-xs font-medium text-slate-500 sm:text-[13px]">
          {SCHOOL_INFO.subtitle}
        </div>
      </div>
    </>
  );

  return (
    <header className="no-print border-b border-slate-200/90 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.('/');
          }}
          className="group flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          {brandContent}
        </a>

        {variant === 'admin' && (
          <div className="flex shrink-0 items-center gap-4">
            <span
              className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold tracking-wider text-amber-900 whitespace-nowrap sm:text-xs"
              aria-label="Mode Admin atau Panitia"
            >
              ADMIN / PANITIA
            </span>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('/');
              }}
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-blue-700 whitespace-nowrap sm:inline-block"
            >
              Beranda
            </a>
          </div>
        )}

        {variant === 'landing' && (
          <nav
            aria-label="Navigasi utama"
            className="flex shrink-0 items-center gap-5"
          >
            <span className="hidden text-xs font-semibold text-slate-500 whitespace-nowrap md:inline-block">
              {SCHOOL_INFO.schoolNameTitle} · {SCHOOL_INFO.location}
            </span>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('/admin');
              }}
              className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-900 hover:underline underline-offset-4 whitespace-nowrap"
            >
              Panel Admin
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
