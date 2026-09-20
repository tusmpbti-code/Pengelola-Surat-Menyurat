# SIPAS BTI — Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika

**SIPAS BTI** (Sistem Pengarsipan Surat SMP Bhinneka Tunggal Ika) adalah sistem tata kelola persuratan dan pengarsipan digital modern berbasis cloud yang dibangun khusus untuk staf Tata Usaha, Administrator, dan Pimpinan di lingkungan **SMP Bhinneka Tunggal Ika**.

Aplikasi ini menjamin kedaulatan data arsip sekolah, keamanan dokumen berjenjang (Role-Based Access Control & Row Level Security), otomatisasi pembacaan dokumen fisik dengan kecerdasan buatan Google Gemini (server-side), serta pelaporan dan pencetakan jurnal resmi berstandar tata naskah dinas.

---

## 1. Tentang SIPAS BTI

* **Institusi**: SMP Bhinneka Tunggal Ika
* **Domain Penggunaan**: Tata Usaha, Kearsipan Digital, Disposisi & Pelaporan Eksekutif
* **Filosofi Kualitas Data**: *Zero Dummy Data Policy*. Aplikasi didesain dalam kondisi murni (bersih dari data contoh/dummy) dan langsung siap menerima data dinas resmi sekolah sejak pertama kali dipasang.
* **Standar Keamanan**: Zero Client Secret Exposure. Kunci API kecerdasan buatan (`GEMINI_API_KEY`) dan kunci kontrol akses pangkalan data dikelola 100% pada *server-side*.

---

## 2. Fitur Utama

### A. Manajemen Arsip Persuratan
* **Buku Agenda Surat Masuk**: Pencatatan lengkap surat dinas eksternal dengan penomoran agenda atomik otomatis berbasis tahun kalender (`001/M/YYYY`), asal surat, tanggal terima, perihal, sifat surat, klasifikasi kategori, ringkasan, dan unggah berkas fisik.
* **Buku Agenda Surat Keluar**: Registrasi surat keluar resmi sekolah (`001/K/YYYY`), tujuan surat, tanggal surat, penandatangan & jabatan penandatangan, serta lampiran.
* **Atomic Agenda Counter**: Penghitung nomor agenda dijamin tidak pernah bentrok atau melompat akibat penghapusan data atau konkurensi antar-pengguna berkat fungsi PostgreSQL atomic transaction lock.
* **Pencegahan Duplikasi**: Sistem secara otomatis mendeteksi dan memberi peringatan jika nomor surat yang diinput sudah pernah diarsipkan sebelumnya.

### B. Ekstraksi Dokumen AI (Google Gemini)
* **AI OCR & Metadata Extraction**: Unggah berkas dokumen (PDF, JPG, JPEG, PNG, WEBP hingga 20 MB) dan sistem secara otomatis mengekstrak nomor surat, tanggal, pengirim, perihal, ringkasan, kata kunci, hingga agenda kegiatan.
* **Split-Screen Verification**: Tampilan pratinjau dokumen fisik bersebelahan dengan formulir pengarsipan untuk verifikasi visual cepat sebelum disimpan.
* **Human-in-the-Loop Safeguard**: AI hanya berfungsi sebagai asisten pengisi draf data; status verifikasi resmi (`VERIFIED`) mutlak hanya dapat disahkan oleh petugas manusia (Admin/Super Admin).

### C. Alur Status & Siklus Hidup Arsip
* Siklus status surat: `DRAFT` &rarr; `NEED_REVIEW` &rarr; `VERIFIED` &rarr; `ARCHIVED` &rarr; `TRASH`.
* **Lembar Disposisi Digital**: Pembuatan dan pencetakan lembar disposisi resmi pimpinan dengan format siap cetak (*print-friendly*).
* **Tempat Sampah (Recycle Bin)**: Proteksi penghapusan tidak sengaja (*Soft Delete*). Pengguna berwenang dapat melakukan *Restore* (Pemulihan) ke daftar aktif atau *Permanent Delete* (Hapus Selamanya beserta berkas fisik di storage).

### D. Pencarian Mendalam & Filter Multidimensi
* Pencarian cepat lintas field: nomor surat, nomor agenda, asal/tujuan, perihal, ringkasan isi, dan kata kunci (tags).
* Filter kombinasi: Jenis Surat, Tahun Kalender, Bulan, Rentang Tanggal Khusus, Klasifikasi, Sifat Surat, dan Status Surat.

### E. Rekapitulasi, Jurnal, & Ekspor Data
* **Statistik Real-Time**: Ringkasan total surat masuk, keluar, status verifikasi, dan tren bulanan dihitung langsung dari data nyata database (jika belum ada data, tampil 0 secara akurat).
* **Jurnal Surat Masuk & Jurnal Surat Keluar**: Tabel register dinas lengkap dengan pilihan visibilitas kolom kustom.
* **Cetak Lembar Fisik (Print)**: Layout cetak ramah kertas dengan Kop Surat resmi SMP Bhinneka Tunggal Ika, tabel rapi, dan kolom tanda tangan penanggung jawab Tata Usaha.
* **Ekspor PDF Berkualitas Tinggi**: Generator PDF menggunakan `jspdf` & `jspdf-autotable` yang dapat diunduh langsung atau disimpan ke arsip berkas cloud.
* **Ekspor Spreadsheet Excel**: Menghasilkan berkas `.xlsx` terstruktur dan siap olah.

### F. Jejak Audit & Keamanan
* **Audit Trail Otomatis**: Setiap aksi cetak, ekspor PDF/Excel, arsip jurnal, penambahan surat, pengeditan, verifikasi, dan penghapusan dicatat ke tabel `letter_logs` (lengkap dengan userId, timestamp, dan payload metadata perubahan).
* **Role-Based Access Control (RBAC)**: Tiga tingkat peran:
  * `SUPER_ADMIN`: Kontrol penuh sistem, manajemen akun pengguna, pengaturan identitas sekolah, dan penghapusan permanen.
  * `ADMIN`: Pencatatan surat, proses ekstraksi AI, verifikasi status arsip, ekspor data, dan pencetakan.
  * `VIEWER`: Akses baca terbatas pada surat-surat yang telah berstatus `VERIFIED` atau `ARCHIVED`.
* **Private Storage with Signed URLs**: Berkas fisik disimpan di bucket privat. Akses pratinjau atau unduh berkas menggunakan *Signed URL* berbatas waktu (1 jam), mencegah kebocoran tautan publik.

---

## 3. Arsitektur Sistem

```
[ Klien Browser: React 18 + Vite + Tailwind CSS ]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[ Supabase Cloud Backend ]     [ Server-Side Proxy / Netlify Function ]
 • PostgreSQL 15 Database       • POST /api/extract-letter (Dev Middleware)
 • Supabase Auth (JWT/Sessions) • POST /.netlify/functions/extract-letter
 • Row Level Security (RLS)     • Mengamankan GEMINI_API_KEY di server
 • Private Storage Bucket       • Google GenAI SDK (gemini-3.8-flash)
```

---

## 4. Prasyarat Sistem

Sebelum menginstal dan menjalankan SIPAS BTI, pastikan lingkungan Anda memiliki:
* **Node.js**: Versi `18.x`, `20.x`, atau lebih baru.
* **NPM**: Versi `9.x` atau lebih baru (atau Yarn/PNPM).
* **Akun Supabase**: Akun aktif di [supabase.com](https://supabase.com) (Tersedia Free Tier).
* **Google Gemini API Key**: Kunci API dari [Google AI Studio](https://aistudio.google.com).
* **Akun Netlify (Opsional untuk deployment)**: [netlify.com](https://netlify.com).

---

## 5. Langkah Instalasi

1. **Kloning atau Unduh Repositori**:
   ```bash
   git clone <url-repo-anda>
   cd sipas-bti
   ```

2. **Pasang Dependensi Node.js**:
   ```bash
   npm install
   ```

3. **Buat Berkas Lingkungan (`.env`)**:
   Salin berkas `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Lengkapi isian berikut:
   ```env
   VITE_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
   GEMINI_API_KEY="AIzaSy..."
   ```

4. **Jalankan Server Pengembangan**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan pada `http://localhost:3000`.

---

## 6. Konfigurasi Supabase

### A. Buat Project Supabase
1. Masuk ke [Supabase Dashboard](https://app.supabase.com).
2. Klik **New Project**, pilih nama organisasi dan beri nama project (misal: `sipas-bti-production`).
3. Tentukan kata sandi database yang kuat dan pilih region terdekat (misal: `Southeast Asia (Singapore)`).

### B. Jalankan Migration SQL
Buka menu **SQL Editor** pada Supabase Dashboard, lalu salin dan jalankan isi file migrasi secara berurutan:
1. `supabase/migrations/20260920000001_sipas_bti_schema.sql` (Membuat tabel utama, tipe enum, triggers, dan aturan keamanan RLS).
2. `supabase/migrations/20260920000002_atomic_agenda_counter.sql` (Membuat tabel sekuens `agenda_counters` dan fungsi atomik nomor agenda).
3. `supabase/migrations/20260920000003_report_archives.sql` (Membuat tabel arsip PDF laporan `report_archives`).

### C. Verifikasi Storage Bucket Privat
Skema migrasi nomor 1 secara otomatis membuat storage bucket privat:
* **Bucket ID**: `letter-files`
* **Public**: `FALSE` (Private)
* **File Size Limit**: `52428800` (50 MB)
* **Allowed MIME Types**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.

### D. Konfigurasi Row Level Security (RLS)
Seluruh tabel (`profiles`, `letters`, `letter_files`, `letter_ai_results`, `letter_tags`, `letter_logs`, `system_settings`, `report_archives`, `agenda_counters`) telah dilindungi RLS aktif. Klien publik/anonim tidak dapat mengakses atau memodifikasi data tanpa otorisasi.

---

## 7. Konfigurasi Autentikasi & Pengguna

### A. Initial Admin Setup (Pembuatan Akun Pertama)
1. Setelah database dihubungkan dan tabel `profiles` masih dalam kondisi kosong (0 pengguna), aplikasi otomatis mengarahkan ke halaman **/initial-admin-setup**.
2. Masukkan identitas Administrator Pertama:
   * **Nama Lengkap**: Nama Petugas / Kepala TU (misal: `Administrator TU`)
   * **Email Administrator**: Email aktif (misal: `tu.smpbti@gmail.com`)
   * **Kata Sandi**: Minimal 6 karakter
3. Klik **Buat Akun SUPER_ADMIN**. Akun pertama otomatis mendapatkan hak istimewa tertinggi `SUPER_ADMIN`.

### B. Manajemen Pengguna Selanjutnya
* Pengguna `SUPER_ADMIN` dapat membuka menu **Manajemen Pengguna** di dalam aplikasi untuk:
  * Menambah staf Tata Usaha baru dengan peran `ADMIN` atau `VIEWER`.
  * Mengaktifkan atau menonaktifkan akun staf.
  * Mengubah hak akses peran (*role*).

---

## 8. Konfigurasi Google Gemini API

1. Buka [Google AI Studio](https://aistudio.google.com).
2. Masuk menggunakan akun Google Anda dan klik **Get API Key**.
3. Buat API Key baru dan simpan di tempat yang aman.
4. Masukkan kunci tersebut ke variabel lingkungan server:
   * Pada file `.env` lokal: `GEMINI_API_KEY=AIzaSy...`
   * Pada Netlify: Menu **Site configuration &rarr; Environment variables &rarr; Add a variable &rarr; `GEMINI_API_KEY`**.
5. Kunci ini hanya dibaca oleh backend function / dev middleware dan tidak pernah dibundel ke kode JavaScript klien.

---

## 9. Konfigurasi Netlify

Aplikasi telah dilengkapi dengan berkas `netlify.toml` dan `public/_redirects`:

```toml
[build]
  publish = "dist"
  functions = "netlify/functions"
  command = "npm run build"

[[redirects]]
  from = "/api/extract-letter"
  to = "/.netlify/functions/extract-letter"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  node_bundler = "esbuild"
```

### Variabel Lingkungan di Netlify
Atur variabel lingkungan berikut pada dashboard Netlify:
* `VITE_SUPABASE_URL`: URL project Supabase Anda.
* `VITE_SUPABASE_ANON_KEY`: Public Anon Key Supabase Anda.
* `GEMINI_API_KEY`: Kunci API Google Gemini Anda.

---

## 10. Panduan Deployment Produksi

### Deploy ke Netlify via Git (Rekomendasi):
1. Unggah kode ke repositori GitHub privat SMP Bhinneka Tunggal Ika:
   ```bash
   git add .
   git commit -m "feat: SIPAS BTI production ready"
   git push origin main
   ```
2. Buka dashboard Netlify dan pilih **Add new site &rarr; Import an existing project**.
3. Pilih repositori GitHub Anda.
4. Pengaturan Build:
   * **Build command**: `npm run build`
   * **Publish directory**: `dist`
5. Masukkan Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
6. Klik **Deploy site**.

### Verifikasi Build Lokal Sebelum Deploy:
```bash
npm run lint    # Memastikan tidak ada kesalahan TypeScript
npm run build   # Memastikan bundel produksi sukses dibuat di folder dist/
```

---

## 11. Panduan Penggunaan Harian

### A. Surat Masuk
1. Pilih menu **Surat Masuk** pada navigasi samping.
2. Klik tombol **Catat Surat Masuk**.
3. Unggah scan berkas surat fisik (PDF/Gambar). Anda dapat mengklik **Baca dengan AI** untuk pengisian data otomatis.
4. Periksa kecocokan data, lengkapi tanggal terima, sifat surat, dan ringkasan.
5. Klik **Simpan Surat**. Nomor agenda atomik akan diterbitkan secara otomatis.

### B. Surat Keluar
1. Pilih menu **Surat Keluar**.
2. Klik tombol **Catat Surat Keluar**.
3. Masukkan nomor surat resmi yang telah disetujui, tanggal surat, tujuan surat, perihal, dan penandatangan.
4. Unggah salinan berkas resmi bertandatangan.
5. Klik **Simpan Surat**.

### C. Ekstraksi Dokumen AI & Verifikasi
1. Pada form pencatatan surat, setelah memilih berkas, klik **Baca dengan AI**.
2. Panel verifikasi split-screen akan menampilkan pratinjau dokumen di sisi kiri dan formulir data di sisi kanan.
3. Petugas memeriksa akurasi setiap kolom teks dan melakukan penyesuaian bila diperlukan.
4. Untuk mengesahkan status dokumen, buka detail surat dan klik **Verifikasi Dokumen**.

### D. Disposisi Surat
1. Buka halaman detail surat masuk yang telah diverifikasi.
2. Klik tombol **Cetak Disposisi**.
3. Sistem akan menyajikan lembar disposisi berformat resmi siap cetak, memuat Kop Surat SMP Bhinneka Tunggal Ika, identitas surat, instruksi pimpinan, dan kolom tanda tangan.

### E. Laporan & Jurnal
1. Pilih menu **Laporan** untuk melihat rekapitulasi statistik tahunan dan bulanan.
2. Pilih menu **Jurnal Surat Masuk** atau **Jurnal Surat Keluar**.
3. Sesuaikan filter tahun, bulan, periode tanggal, sifat, atau kategori.
4. Gunakan fitur **Pilih Kolom** untuk menyembunyikan atau menampilkan kolom tertentu.

### F. Ekspor & Cetak Jurnal
* **Cetak (Print)**: Klik tombol **Cetak** untuk membuka dialog cetak peramban dengan layout kertas lanskap terstandar.
* **Ekspor PDF**: Klik tombol **Ekspor PDF** untuk mengunduh dokumen PDF resmi.
* **Simpan ke Arsip**: Simpan berkas PDF jurnal langsung ke penyimpanan awan `report_archives`.
* **Ekspor Excel**: Klik tombol **Ekspor Excel** untuk menghasilkan berkas spreadsheet `.xlsx`.

### G. Tempat Sampah & Pemulihan (Recycle Bin)
1. Surat yang dihapus dari daftar aktif akan dipindahkan ke **Tempat Sampah**.
2. Buka menu Tempat Sampah untuk meninjau surat yang dihapus.
3. Klik **Pulihkan** untuk mengembalikan surat ke daftar aktif tanpa kehilangan metadata atau berkas lampiran.
4. Klik **Hapus Permanen** jika dokumen benar-benar harus dibersihkan secara mutlak dari database dan storage.

### H. Audit Aktivitas (Audit Log)
* Setiap tindakan penting (pencatatan, perubahan status, verifikasi, cetak, ekspor) secara otomatis dicatat ke riwayat audit.
* Buka menu **Audit Log** untuk meninjau rekam jejak aktivitas staf berdasarkan nama pengguna, jenis tindakan, dan waktu kejadian.

---

## 12. Cadangan & Pemeliharaan (Backup & Maintenance)

### Cadangan Database PostgreSQL:
* Gunakan fitur **Database &rarr; Backups** bawaan Supabase untuk mengaktifkan pencadangan harian otomatis.
* Atau jalankan ekspor data melalui CLI:
  ```bash
  supabase db dump -f sipas_bti_backup_$(date +%Y%m%d).sql
  ```

### Cadangan Berkas Fisik:
* Berkas fisik tersimpan aman di Supabase Storage bucket `letter-files`. Berkas dapat disinkronkan berkala menggunakan Supabase CLI atau script otomasi penyimpanan cadangan.

---

## 13. Pemecahan Masalah (Troubleshooting)

| Gejala Masalah | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| Halaman meminta *Setup Supabase* | Variabel `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` kosong | Buka modal pengaturan Supabase pada aplikasi atau periksa file `.env`. |
| AI mengembalikan pesan *High Demand / 503* | Lonjakan antrean sementara pada Google Gemini | Tunggu 3–5 detik lalu klik **Coba Lagi**, atau gunakan opsi input formulir manual. |
| AI mengembalikan *Konfigurasi GEMINI_API_KEY server belum lengkap* | `GEMINI_API_KEY` belum disetel di Netlify / server | Tambahkan `GEMINI_API_KEY` pada Environment Variables Netlify atau `.env`. |
| Gagal mengunggah berkas | Ukuran berkas > 20 MB atau format selain PDF/JPG/PNG/WEBP | Pastikan berkas berukuran di bawah 20 MB dan berformat dokumen/gambar yang didukung. |
| Pengguna baru tidak dapat membuka surat | Role pengguna baru secara default adalah `VIEWER` | Super Admin perlu meningkatkan peran pengguna menjadi `ADMIN` di menu Manajemen Pengguna jika staf bertugas mencatat surat. |

---

## Hak Cipta & Lisensi

Dikembangkan secara khusus untuk **SMP Bhinneka Tunggal Ika**. Seluruh hak kepemilikan kode sumber dan data pengarsipan sepenuhnya milik SMP Bhinneka Tunggal Ika.
