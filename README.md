# STANSA SECURE FORM — PART 1 – PART 4
**Secure Examination Gateway · SMPN 1 Tanjungsari, Sumedang**

Aplikasi web statis ringan (React + TypeScript + Vite) untuk membuat **Secure Exam Link** dan **QR Code** ujian berbasis Google Form tanpa database.

Target deployment: `https://secure.smpn1tjssmd.sch.id` (Hosting sekolah + cPanel + Apache).

## Fitur Saat Ini
- **Landing Page (`/`)**: Identitas sekolah SMPN 1 Tanjungsari dan navigasi menuju Panel Admin (`PANITIA / GURU`).
- **Panel Admin (`/admin`)**:
  - Formulir pembuatan ujian (Nama Ujian, Tingkat VII/VIII/IX, Kelas A–K + `PILIH SEMUA`, Link Google Form dengan validasi, Durasi 5–300 menit).
  - Konfigurasi **Mode Keamanan** (9 opsi keamanan + batas pelanggaran & tindakan).
  - Enkode konfigurasi ujian ke format URL-safe **Base64URL** (tanpa database).
  - Generate Secure Exam Link otomatis menggunakan `window.location.origin`.
  - Salin link (Clipboard API + fallback), buka link ujian, generate QR Code, unduh PNG QR Code, dan cetak lembar QR (`@media print`).
- **Halaman Siswa (`/exam/:encodedConfig` — PART 2, PART 3 & PART 4)**:
  - Bebas navigasi Admin/Home (*Admin panel tidak ditautkan dari halaman ujian siswa*).
  - Verifikasi **DATA PESERTA** (`Nama Lengkap`, `NIS / NISN`, `Kelas` sesuai konfigurasi link), modal konfirmasi **SIAP MEMULAI UJIAN?**, dan sesi sementara di `sessionStorage`.
  - **Exam Mode Fullscreen (`100vw × 100vh`)**: aktivasi Fullscreen API sesuai konfigurasi, Google Form iframe penuh (dengan loading & fallback rapi).
  - **Security Engine & Violation Detection (`useExamSecurity` — PART 4)**: aktif khusus saat `EXAM_STARTED` sesuai konfigurasi link (blok copy, paste, cut, klik kanan, seleksi teks wrapper, deteksi pindah tab, window blur, keluar layar penuh), debounce 1000ms, counter `Pelanggaran: X / Y`, overlay peringatan `z-index: 99999`, serta riwayat pelanggaran di `sessionStorage` (`stansa_secure_violation_<examId>`).

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

## Build Produksi (cPanel / Apache)

```bash
npm run build
```

Hasil build statis siap upload berada di folder `dist/` (sudah termasuk file `.htaccess` untuk routing SPA Apache).
