import { ArrowRight, DatabaseZap, FileSpreadsheet, Globe, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { SchoolLogo } from '../components/SchoolLogo';
import { SCHOOL_INFO } from '../utils/examConfig';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header variant="landing" onNavigate={onNavigate} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
            {/* Left Primary Column */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-4">
                <SchoolLogo size="lg" />
                <div>
                  <p className="text-xs font-bold tracking-wider text-blue-800 sm:text-sm">
                    {SCHOOL_INFO.schoolName}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                    {SCHOOL_INFO.location} · Jawa Barat
                  </p>
                </div>
              </div>

              <h1 className="mt-7 text-3xl font-extrabold tracking-normal text-slate-950 sm:text-4xl lg:text-5xl">
                {SCHOOL_INFO.appName}
              </h1>

              <p className="mt-2 text-lg font-semibold text-blue-700 sm:text-xl">
                {SCHOOL_INFO.subtitle}
              </p>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Gateway keamanan ujian berbasis Google Form untuk lingkungan sekolah.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => onNavigate('/admin')}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-blue-700 px-7 py-3 text-sm font-bold tracking-wide text-white shadow-xs transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:w-auto sm:text-base whitespace-nowrap"
                >
                  PANITIA / GURU
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Right Structured Overview Column */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-7">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Alur Pembuatan Link Ujian
                      </h2>
                      <p className="text-xs text-slate-500">
                        Siap pakai untuk panitia dan guru mapel
                      </p>
                    </div>
                  </div>
                </div>

                <ol className="mt-5 space-y-4">
                  <li className="flex items-start gap-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-800 tabular-nums">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Isi identitas & link Google Form
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        Tentukan nama ujian, tingkat VII–IX, kelas peserta, dan durasi pengerjaan.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-xs font-bold text-blue-800 tabular-nums">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Atur kebijakan keamanan ujian
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        Konfigurasi mode keamanan dan batas pelanggaran tersimpan langsung di tautan.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-900 tabular-nums">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Bagikan Secure Exam Link & QR Code
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        Salin tautan, unduh gambar QR, atau cetak lembar QR untuk ruang ujian.
                      </p>
                    </div>
                  </li>
                </ol>

                <div className="mt-6 border-t border-slate-200/80 pt-4 text-xs text-slate-500">
                  Subdomain target:{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    secure.smpn1tjssmd.sch.id
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Architecture Highlights */}
        <section aria-label="Keunggulan sistem" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <DatabaseZap className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                Tanpa Database
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Seluruh konfigurasi ujian disandikan secara aman di dalam tautan URL. Tidak memerlukan server backend maupun koneksi database.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                Berbasis Google Form
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Terintegrasi langsung dengan tautan Google Form yang telah disiapkan guru, sehingga pencatatan jawaban tetap berada di akun sekolah.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <Globe className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                Siap digunakan di subdomain sekolah
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Dibangun sebagai aplikasi web statis ringan untuk hosting cPanel Apache dengan deteksi domain otomatis.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p className="font-medium text-slate-600">
            {SCHOOL_INFO.schoolNameTitle}, {SCHOOL_INFO.location}
          </p>
          <p>
            {SCHOOL_INFO.appName} · {SCHOOL_INFO.subtitle}
          </p>
        </div>
      </footer>
    </div>
  );
}
