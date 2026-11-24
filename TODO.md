# SPEC & MASTER ROADMAP CMS SEKOLAH (SMAN 1 UNGGULAN)
*Standar Produksi: Astro v7, Tailwind CSS v4, Hono.js, LibSQL (Turso SQLite), Drizzle ORM, Cloudflare Pages/Workers & R2*

---

## 0. STATUS LEGEND & DEFINISI SELESAI (DEFINITION OF DONE)
Setiap modul dinilai dengan 3 status terukur:
- `[x]` **End-to-End Ready**: UI/UX responsif, endpoint CRUD aman di server, validasi Zod edge, audit trail tercatat, lulus uji error state, dan siap produksi.
- `[-]` **Partially Built (Fondasi Ada)**: Antarmuka dasar/tabel ada, namun alur lengkap (edit, validasi lanjut, proteksi role server, atau penanganan orphan media) belum selesai.
- `[ ]` **Belum Dikerjakan**: Belum memiliki implementasi kode atau endpoint aktif.

### 4 Pilar Standar Setiap Modul (DoD):
1. **UI & UX**: Form terstruktur, loading state, empty state, toast notifikasi, dialog konfirmasi hapus, aksesibilitas keyboard (WCAG 2.1 AA), dan responsif mobile.
2. **Backend & Data**: Endpoint REST/RPC dengan verifikasi sesi dan otorisasi role, validasi skema Zod di server, relasi foreign key & indeks database, soft-delete/arsip, serta error handling aman tanpa kebocoran stack trace.
3. **Acceptance Criteria**: Kriteria terukur yang dapat diverifikasi langsung.
4. **Pengujian & Deployment**: Uji kasus normal, uji kasus gagal (input salah, unauthenticated, akses terlarang), dan verifikasi kompatibilitas runtime Cloudflare.

---

## 1. URUTAN PRIORITAS PENGERJAAN (RECOMMENDED SPRINT ROADMAP)

### [SPRINT 1] Keamanan Kritis & Fondasi Backend (Prioritas Kritis)
- [x] Rotasi sesi kriptografis & pencabutan sesi di server saat logout.
- [x] Rate limiting login (mitigasi brute force) berbasis IP `CF-Connecting-IP` (maks 5 percobaan/15 menit).
- [x] Otorisasi server-side pada seluruh endpoint `/api/admin/*` (pemisahan Superadmin vs Editor).
- [x] Password hashing standar PBKDF2 Web Crypto (SHA-512, 100.000 iterasi).
- [x] Proteksi CSRF & validasi Origin header pada mutasi POST/PUT/DELETE.

### [SPRINT 2] Alur Penuh Berita & Agenda (Prioritas Tinggi)
- [x] Edit berita (`/admin/berita/edit/[id]`) & manajemen CRUD kategori (`/admin/berita/kategori`).
- [x] Pencegahan kebocoran draf (filter ketat draf pada publik, sitemap, pencarian, dan related news).
- [x] Token aman untuk pratinjau draf bagi staf (`/berita/preview?token=...`).
- [x] Edit agenda, validasi tanggal mulai vs selesai, filter bulan/status, dan penanganan zona waktu WIB (`Asia/Jakarta`).

### [SPRINT 3] Backup, Pemulihan Data & Observabilitas (Sebelum Produksi)
- [x] Prosedur snapshot backup Turso/SQLite terenkripsi dengan checksum SHA-256 integrity check.
- [x] SOP & skrip pengujian restore database dari backup snapshot v1.0.
- [x] Error handler global terpusat dengan ID korelasi (*Request Correlation ID*) & health check basis data dinamis.

### [SPRINT 4] Kelengkapan Modul CMS Lainnya
- [x] Running banner pengumuman dengan tanggal aktif & tanggal kedaluwarsa otomatis.
- [x] Direktori guru: edit profil, status aktif/nonaktif, penataan urutan pimpinan, validasi NIP unik.
- [x] Galeri media: manajemen album, YouTube embed, alt text gambar, integrasi unggah R2/lokal.
- [x] Unduhan dokumen: update versi berkas, hitung unduhan, validasi tipe MIME PDF/DOCX.
- [x] Prestasi & Alumni: verifikasi capaian, filter privasi data alumni (PII compliance).
- [x] Manajemen akun staf (invite-only, reset password, nonaktifkan akun, proteksi RBAC Superadmin).
- [x] Pengaturan Identitas Visual & Multi-Tema Dinamis (Color picker brand primary & accent, preset tema, integrasi logo, favicon & nama sekolah real-time di portal publik dan CMS).
- [x] Manajemen Banner Slider Hero (`/admin/slider`): Drag and drop reordering dengan penataan nomor urut otomatis & failover rollback, integrasi langsung Pustaka Media (tanpa input link manual), 2 tombol CTA per slide (Primary & Secondary), toggle aktif/nonaktif, dan integrasi autoplay beranda.
- [x] Kustomisasi Istilah Pendaftaran Dinamis (`admissions_label`): Opsi nama PPDB/SPMB/PMB di panel pengaturan, serta migrasi rute ke `/pendaftaran` dengan pengalihan 301 otomatis dari `/ppdb`.

### [SPRINT 5] Penyempurnaan Portal Publik & SEO
- [x] Halaman pencarian global (`/cari`) berbasis database query multi-entitas (berita, agenda, dokumen, dewan guru).
- [x] Halaman 404 kustom institusional berstandar editorial Genesis dengan search bar & navigasi cepat.
- [x] Schema.org JSON-LD (HighSchool, NewsArticle, Organization) & OpenGraph tag lengkap.
- [x] Halaman Kebijakan Privasi (`/kebijakan-privasi`) & Kontak Pengaduan (`/kontak`).
- [x] Mode cetak `@media print` untuk halaman profil dan artikel pengumuman.
- [x] Sitemap dinamis (`/sitemap.xml`) & konfigurasi crawler `robots.txt` ramah SEO tanpa bocoran admin.

### [SPRINT 6] Integrasi CMS Konten Beranda & Fitur Pendukung
- [x] **Counter Statistik Sekolah**: Migrasi angka statik (siswa, PTN, guru, prestasi) ke konfigurasi `settings` di CMS agar dapat diedit dinamis dari `/admin/pengaturan`.
- [x] **Sambutan Kepala Sekolah**: Input field `settings` (foto, nama pimpinan, kutipan sambutan, link selengkapnya) di CMS + render komponen di Beranda (`src/pages/index.astro`).
- [x] **Ekstrakurikuler Sekolah**: Skema database `extracurriculars`, panel admin mandiri di `/admin/ekskul` (kategori, jadwal, pembina, foto cover, toggle status, reorder), dan seksi mandiri di Beranda publik.
- [x] **Fasilitas Kampus & Sarana**: Skema database `facilities`, panel admin mandiri di `/admin/fasilitas` (kategori, lokasi gedung, kapasitas, foto cover, toggle status, reorder), dan seksi mandiri di Beranda publik.
- [x] **Testimoni / Kata Alumni**: Sambungkan data alumni dari tabel `students_alumni` (dikelola via `/admin/prestasi`) ke query dan UI beranda (`src/pages/index.astro`) lengkap dengan kontrol visibilitas di `/admin/pengaturan`.
- [x] **Logo Mitra / Kerja Sama**: Pengelolaan logo instansi/perusahaan rekanan & perguruan tinggi tujuan di CMS + render infinite carousel/ticker di Beranda.

---

## 2. MODUL CMS ADMIN (`/admin`)

### 2.1. Autentikasi Staf & Sesi
- **URL**: `/admin/login` | Endpoint: `/api/auth/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (PBKDF2 Web Crypto, rate limiting IP, database session table, HMAC token signature, proteksi CSRF origin).
- **Komponen UI/UX**:
  - Form login: input email dinas, password, tombol masuk dengan animasi loading status.
  - Alert error ramah pengguna (pesan kegagalan tanpa memberi petunjuk apakah email atau password yang salah).
- **Backend & Logika Keamanan**:
  - Rate limiting: Maksimal 5 percobaan gagal per IP (`CF-Connecting-IP`) dalam 15 menit, blokir sementara jika terlampaui.
  - Password Hashing: Migrasi ke Argon2id untuk hashing password admin.
  - Sesi Server: Simpan hash sesi di server/database (`sessions` table / KV); saat logout, sesi dicabut permanen di server, bukan sekadar menghapus cookie client.
  - Cookie Policy: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=86400`.
- **Acceptance Criteria**:
  - Akun terkunci sementara setelah 5x password salah.
  - Token sesi lama langsung ditolak setelah logout dipanggil.
  - Akses langsung ke `/api/admin/*` tanpa sesi menghasilkan HTTP 401 Unauthorized.
- **Pengujian**:
  - Uji brute force 6 kali berurutan.
  - Uji replay token setelah logout.

---

### 2.2. Dashboard Utama
- **URL**: `/admin`
- **Status Saat Ini**: `[x]` End-to-End Ready
- **Komponen UI/UX**:
  - 4 Kartu Metrik: Berita Terbit, Agenda Aktif, Tenaga Pendidik, Status TLS/Keamanan.
  - Tabel 5 Berita Terbaru dengan shortcut edit/lihat.
  - Cuplikan 5 Log Audit keamanan live.
- **Backend & Logika**:
  - Direct SSR query dari database lokal/Turso dengan agregasi query efisien.
  - Pembatasan query (`LIMIT 5`) untuk mencegah beban database berlebih.
- **Acceptance Criteria**:
  - Halaman dimuat < 300ms.
  - Semua metrik bersumber dari data live, bukan angka hardcoded.

---

### 2.3. Manajemen Berita
- **URL**:
  - Daftar: `/admin/berita`
  - Tambah: `/admin/berita/tambah`
  - Edit: `/admin/berita/edit/[id]`
  - Kategori: `/admin/berita/kategori`
- **Status Saat Ini**: `[x]` End-to-End Ready (CRUD artikel penuh, pencegahan slug duplikat, tab filter status & sampah, soft delete & restore, token pratinjau draf bertanda tangan, CRUD taksonomi kategori).
- **Komponen UI/UX**:
  - **Daftar (`/admin/berita`)**:
    - Filter bar: Input live search judul, dropdown filter kategori, dropdown status (Semua / Terbit / Draf / Sampah).
    - Tabel berita: Judul, kategori badge, status, total pembaca, tanggal rilis, tombol aksi (Lihat, Edit, Hapus).
    - Pagination server-side (10-20 artikel per halaman).
    - Dialog konfirmasi hapus dengan opsi: "Pindahkan ke Sampah" (*soft delete*) dan "Hapus Permanen".
  - **Tambah & Edit (`/admin/berita/tambah` & `/admin/berita/edit/[id]`)**:
    - Input Judul & Auto-slug generator (dengan deteksi konflik slug duplikat).
    - Kategori dropdown (terhubung ke tabel `categories`).
    - Excerpt / ringkasan artikel (maksimal 250 karakter untuk meta SEO).
    - Uploader gambar sampul ke Cloudflare R2 dengan pratinjau live + input teks alternatif (*alt text*).
    - Editor artikel luas (mendukung heading, format teks, kutipan, list).
    - Opsi status: Simpan Draf vs Terbitkan Langsung.
    - Opsi jadwal publikasi: Tanggal terbit otomatis (*scheduled publication*).
    - Tombol "Pratinjau Draf" (menghasilkan URL dengan token bertanda tangan kedaluwarsa 1 jam).
  - **Kelola Kategori (`/admin/berita/kategori`)**:
    - Tambah, edit nama & slug kategori, proteksi penghapusan kategori jika masih digunakan oleh artikel aktif.
- **Backend & Data**:
  - Endpoint REST:
    - `GET /api/admin/articles` (dengan parameter `?page=1&limit=10&status=...&category=...&q=...`)
    - `POST /api/admin/articles` (validasi Zod lengkap)
    - `GET /api/admin/articles/:id`
    - `PUT /api/admin/articles/:id`
    - `DELETE /api/admin/articles/:id` (soft delete: set `deleted_at = CURRENT_TIMESTAMP`)
    - `POST /api/admin/articles/:id/restore` (memulihkan dari sampah)
    - `GET /api/admin/categories` & `POST/PUT/DELETE /api/admin/categories`
  - Isolasi Draf: Seluruh query publik (`/berita`, `/berita/:slug`, `/api/articles`, `sitemap.xml`) wajib memiliki filter mutlak `is_published = true AND (published_at <= CURRENT_TIMESTAMP) AND deleted_at IS NULL`.
- **Acceptance Criteria**:
  - Berita draf tidak dapat diakses di URL publik tanpa token pratinjau yang sah.
  - Slug berita yang sama menghasilkan peringatan validasi ramah dan tidak error 500.
  - Artikel yang diedit mempertahankan counter `view_count` lama tanpa ter-reset.
  - Artikel yang dihapus masuk ke tab Sampah dan dapat dipulihkan.

---

### 2.4. Manajemen Agenda Kegiatan
- **URL**: `/admin/agenda` | Endpoint: `/api/admin/agendas/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Form input & edit terintegrasi, tanggal selesai kegiatan opsional, validasi tanggal mulai <= selesai, filter bulan & status, toggle selesai).
- **Komponen UI/UX**:
  - Form input: Judul acara, tanggal & jam mulai, tanggal & jam selesai opsional, lokasi gedung/ruang, deskripsi rincian kegiatan.
  - Form Edit Agenda: Modal dialog atau halaman edit rincian agenda.
  - Filter: Filter agenda per bulan, filter status (Semua / Mendatang / Selesai / Terlewat).
  - Daftar kartu/tabel agenda dengan tombol Edit, Selesai, dan Hapus.
- **Backend & Data**:
  - Validasi Zod: `endDate` harus sama atau setelah `startDate`. Waktu diproses dalam zona waktu resmi `Asia/Jakarta` (WIB).
  - Definisi Agenda Mendatang: Dihitung dari `startDate >= CURRENT_TIMESTAMP` DAN `is_completed = false`. Agenda yang tanggalnya lewat otomatis masuk kategori riwayat/terlewat tanpa harus ditandai manual.
  - Endpoint: `GET /api/admin/agendas`, `POST /api/admin/agendas`, `PUT /api/admin/agendas/:id`, `DELETE /api/admin/agendas/:id`.
- **Acceptance Criteria**:
  - Input tanggal selesai sebelum tanggal mulai ditolak oleh validasi server dengan pesan jelas.
  - Agenda lama otomatis tidak muncul di widget "Agenda Mendatang" di Beranda publik.

---

### 2.5. Direktori Guru & Tenaga Kependidikan
- **URL**: `/admin/direktori` | Endpoint: `/api/admin/teachers/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Form Tambah/Edit, Status Aktif Toggle, Pengurutan Pimpinan, NIP Monospace & Validasi Unik).

---

### 2.6. Banner Pengumuman Cepat
- **URL**: `/admin/pengumuman` | Endpoint: `/api/admin/announcements/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (CRUD Pengumuman, Tautan Aksi, Checkbox Darurat/Penting, Filter Auto-Expiry Otomatis).

---

### 2.7. Galeri Media & Dokumentasi
- **URL**: `/admin/galeri` | Endpoint: `/api/admin/galleries/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Album Foto Kegiatan, Embed Video YouTube, Alt Text Keterangan, Unggah Cepat R2).

---

### 2.8. Repositori Dokumen & Unduhan
- **URL**: `/admin/dokumen` | Endpoint: `/api/admin/documents/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Manajemen Berkas Resmi, Kategori Kurikulum/PPDB/SK, Counter Unduhan Otomatis).

---

### 2.9. Prestasi Siswa & Tracer Study Alumni
- **URL**: `/admin/prestasi` | Endpoint: `/api/admin/students_alumni/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Rekam Jejak Juara Siswa, Tracer Alumni, PII Consent Checkbox).

---

### 2.10. Pengaturan Sekolah & Backup Database
- **URL**: `/admin/pengaturan` | Endpoint: `/api/admin/settings` & `/api/admin/backup/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Identitas Sekolah, Kustomisasi Tema Dinamis, Upload Media R2/Lokal, Ekspor Snapshot JSON Terlindungi SHA-256, & Pemulihan Basis Data Super Admin).
- **Komponen UI/UX**:
  - Form Identitas: Nama sekolah, NPSN, status akreditasi (dropdown terstandarisasi A/B/C/Belum Terakreditasi), alamat, nomor telepon, email, URL PPDB Dinas.
  - Setup Branding & Identitas Visual:
    - Input Warna Utama (*Brand Primary*) & Warna Aksen/Sekunder (*10% CTA*) dengan color picker, input Hex, dan live preview seketika.
    - 3 Preset Paket Tema siap pakai: *Akademik Klasik & Prestisius*, *Modern & Inovatif*, dan *Edukatif Cerah & Ramah*.
    - Sinkronisasi instan ke CSS variable token (`--color-primary`, `--color-accent`, dll.) di Portal Publik (`Layout.astro`) dan Panel CMS (`AdminLayout.astro`).
    - Uploader Logo Sekolah & Favicon dengan auto-preview dan fallback monogram inisial sekolah di sidebar admin, header portal, serta halaman login staf.
  - Panel Backup & Pemulihan:
    - Tombol "Buat Snapshot Backup Database Sekarang".
    - Daftar riwayat snapshot database (tanggal, ukuran file, status integritas).
    - Tombol unduh snapshot aman (hanya Superadmin dengan verifikasi password ulang).
    - Panduan langkah pemulihan (*disaster recovery procedure*).
- **Backend & Data**:
  - Injeksi Dinamis: Helper styling CSS variabel yang menghitung turunan hover dan light menggunakan CSS `color-mix()` untuk fleksibilitas tema tanpa kompilasi ulang aset.
  - Backup Engine: Menghasilkan dump SQL/SQLite dari database Turso, menyimpannya ke bucket R2 khusus berstatus privat tanpa akses publik.
  - Akses Ekspor: Endpoint ekspor wajib dilindungi otorisasi `role = 'superadmin'`.

---

### 2.11. Manajemen Pengguna & Hak Akses
- **URL**: `/admin/users` | Endpoint: `/api/admin/users/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Invite Staf, Reset Password PBKDF2, Nonaktifkan Akun, Proteksi Self-Deletion).
- **Komponen UI/UX**:
  - Tabel staf: Nama, email, role badge (`Superadmin` / `Editor`), status aktif, tanggal buat.
  - Form Tambah Staf (Invite-Only): Input nama, email dinas, password awal, role.
  - Modal Reset Password & Nonaktifkan Akun.
- **Backend & Aturan Hak Akses (RBAC)**:
  - `Superadmin`: Akses penuh ke seluruh fitur (Pengaturan Sekolah, Backup, Manajemen Pengguna, Audit Logs, Hapus Permanen Konten).
  - `Editor`: Hanya dapat membuat dan mengedit Berita, Agenda, Pengumuman, Galeri, Dokumen, dan Prestasi. Dilarang mengakses rute dan API `/admin/pengaturan`, `/admin/users`, `/admin/logs`, dan backup.

---

### 2.12. Audit Trail Keamanan
- **URL**: `/admin/logs` | Endpoint: `/api/admin/logs`
- **Status Saat Ini**: `[x]` End-to-End Ready
- **Komponen UI/UX**:
  - Tabel audit: Waktu Indonesia (WIB), email aktor, aksi (LOGIN, CREATE, UPDATE, DELETE), detail keterangan aksi, dan IP pengirim.
- **Backend & Keamanan**:
  - IP Resolution: Mengambil IP dari header Cloudflare tepercaya `c.req.header('cf-connecting-ip') || c.req.header('x-real-ip')`.
  - Akses terbatas: Hanya dapat dibuka oleh `Superadmin`.

---

### 2.13. Manajemen Ekstrakurikuler
- **URL**: `/admin/ekskul` | Endpoint: `/api/admin/extracurriculars/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Form Tambah/Edit dengan Media Picker, Kategori, Jadwal Latihan, Pembina, Urutan, Toggle Status Aktif, Hapus).

---

### 2.14. Manajemen Fasilitas Kampus
- **URL**: `/admin/fasilitas` | Endpoint: `/api/admin/facilities/*`
- **Status Saat Ini**: `[x]` End-to-End Ready (Form Tambah/Edit dengan Media Picker, Kategori, Lokasi Gedung/Lantai, Kapasitas, Urutan, Toggle Status Aktif, Hapus).

---

## 3. MODUL PORTAL PUBLIK (`/`)

### 3.1. Halaman Beranda (`/`)
- **Status**: `[-]` Partially Built (Fondasi Ada)
- **Fitur Ada**: Header 56px sticky, Running Banner Pengumuman dinamis, Hero slider dinamis, Counter statistik dinamis (CMS `settings`), Sambutan Kepala Sekolah dinamis (CMS `settings`), Seksi Ekstrakurikuler Unggulan dinamis DB, Seksi Fasilitas Kampus & Sarana dinamis DB, 3 Berita terbaru DB, Agenda mendatang DB, Layanan cepat dokumen, Footer institusi resmi.
- **Item Belum Terintegrasi CMS**:
  - [x] **Counter Statistik Sekolah**: Dinamis dari tabel `settings` dan dapat dikonfigurasi di `/admin/pengaturan`.
  - [x] **Sambutan Kepala Sekolah**: Terhubung ke CMS `settings` (foto, kutipan, tautan) dan tampil elegan di beranda.
  - [x] **Ekstrakurikuler Sekolah**: Terhubung ke tabel `extracurriculars` dan panel `/admin/ekskul`.
  - [x] **Fasilitas Kampus**: Terhubung ke tabel `facilities` dan panel `/admin/fasilitas`.
  - [x] **Sekilas Profil & Video Profil**: Terintegrasi ke CMS `settings` (judul, narasi, visi misi, thumbnail, URL YouTube) dengan inline player interaktif di Beranda dan Profil.
  - [x] **Testimoni / Kata Alumni**: Terhubung dinamis ke tabel `students_alumni` (`isPublicConsent = true`), panel `/admin/prestasi`, dan pengaturan visibilitas di `/admin/pengaturan`.
  - [x] **Logo Mitra / Kerja Sama**: Skema tabel `partners`, panel admin `/admin/mitra` (MediaPicker, switch toggle, icon actions), endpoint CRUD `/api/admin/partners/*`, dan infinite tripartite carousel di beranda (`src/pages/index.astro`).

### 3.2. Halaman Profil Sekolah (`/profil`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Sejarah pendirian, Visi & Misi, Bagan Pimpinan Sekolah, data legalitas terhubung langsung ke tabel `settings`.
- **Penyempurnaan Diperlukan**: Mode cetak `@media print` rapi untuk dokumen profil.

### 3.3. Pusat Berita & Pembaca Artikel
- **URL**: `/berita` & `/berita/[slug]`
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Filter kategori, grid berita, pembaca artikel dengan tipografi editorial, counter tayangan (*views*) otomatis, sidebar berita terkait, tombol share WhatsApp & Facebook, Schema.org NewsArticle, state 404 ramah pengguna.

### 3.4. Kalender Akademik & Agenda (`/agenda`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Timeline kegiatan, blok visual tanggal, status acara, lokasi, jam pelaksanaan.

### 3.5. Direktori Guru Publik (`/direktori`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Kartu guru, tabel resmi data pegawai, NIP monospace, filter mata pelajaran.

### 3.6. Informasi Pendaftaran & Alur Seleksi (`/pendaftaran`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Dinamis mengikuti konfigurasi `admissions_label` (PPDB/SPMB/PMB), CTA redirect ke portal resmi Dinas/Mandiri, kuota 4 jalur seleksi, 5 langkah alur pendaftaran, checklist berkas persyaratan, posko helpdesk kontak resmi, serta pengalihan otomatis HTTP 301 dari rute lama `/ppdb`.

### 3.7. Halaman Pencarian Terpadu (`/cari`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Input pencarian global multi-entitas (Berita, Agenda, Dokumen, Guru), query database langsung, rekomendasi kata kunci populer, dan state hasil kosong yang informatif.

### 3.8. Halaman Error Khusus (`/404`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Halaman 404 elegan berstandar editorial Genesis dengan search bar interaktif dan pintasan cepat kembali ke Beranda/Berita/PPDB.

### 3.9. Halaman Kebijakan Privasi & Kontak Resmi (`/kebijakan-privasi` & `/kontak`)
- **Status**: `[x]` End-to-End Ready
- **Fitur**: Pernyataan kepatuhan UU PDP No. 27/2022, perlakuan cookie sesi admin, formulir pengaduan & pertanyaan masyarakat, detail kontak dan jam operasional tata usaha.

---

## 4. QUALITY ASSURANCE & RELEASE CHECKLIST (22 UJI MUTU - 100% LULUS)

### A. Keamanan & Autentikasi
- [x] **TC-01**: Login dengan email/password benar berhasil dan menyematkan cookie `HttpOnly`.
- [x] **TC-02**: Login dengan kredensial salah menampilkan pesan ramah tanpa bocoran info.
- [x] **TC-03**: Percobaan login gagal 5x mengunci request dari IP tersebut selama 15 menit.
- [x] **TC-04**: Akses rute `/admin/*` dan `/api/admin/*` tanpa cookie menghasilkan redirect 302 / error 401.
- [x] **TC-05**: Pengguna dengan role `Editor` ditolak (HTTP 403) saat mencoba mengakses rute atau endpoint `Superadmin`.
- [x] **TC-06**: Logout benar-benar mencabut sesi di server; token lama tidak dapat dipakai ulang.

### B. Pengelolaan Konten & Isolasi Draf
- [x] **TC-07**: Berita berstatus `Draf` tidak pernah muncul di `/berita`, sitemap, pencarian, maupun endpoint publik.
- [x] **TC-08**: Pembuatan berita dengan slug duplikat ditolak oleh validasi server dengan pesan bersahabat.
- [x] **TC-09**: Edit berita berhasil memperbarui konten tanpa menghapus view count atau data yang tidak diubah.
- [x] **TC-10**: Hapus berita memindahkan artikel ke Sampah (*soft-delete*); artikel dapat dipulihkan (*restore*).
- [x] **TC-11**: Agenda dengan tanggal selesai sebelum tanggal mulai ditolak oleh validasi Zod.
- [x] **TC-12**: Pengumuman cepat otomatis berhenti tampil di web publik saat waktu melewati tanggal berakhir.

### C. Media, Dokumen, & Penyimpanan R2
- [x] **TC-13**: File dengan ekstensi atau MIME type berbahaya (PHP, EXE, SH, BAT) ditolak oleh server.
- [x] **TC-14**: File berukuran lebih dari 10 MB ditolak oleh edge handler sebelum menghabiskan bandwidth.
- [x] **TC-15**: Penataan media terstruktur & isolasi penyimpanan aset lokal/R2 berjalan bersih.
- [x] **TC-16**: Unduhan berkas PDF publik mencatat pertambahan counter `download_count` dengan benar.

### D. Integritas Database & API
- [x] **TC-17**: Seluruh mutasi `POST/PUT/DELETE` divalidasi oleh skema di server, bukan hanya di browser.
- [x] **TC-18**: Setiap aksi administratif penting tercatat di tabel `audit_logs` bersama aktor dan IP asli.
- [x] **TC-19**: Endpoint pagination (`limit` & `page`) membatasi jumlah baris dan tidak melakukan pembacaan seluruh tabel (*full table scan*).
- [x] **TC-20**: Kegagalan database Turso/server menghasilkan respon JSON terstruktur ramah pengguna dengan correlationId tanpa membocorkan kredensial atau stack trace.

### E. Produksi & SEO
- [x] **TC-21**: Build produksi Cloudflare (`rtk bun run build`) tuntas dengan status 0 error.
- [x] **TC-22**: Berkas `sitemap.xml` dan `robots.txt` hanya memuat tautan artikel terbit dan tidak memuat halaman admin.
