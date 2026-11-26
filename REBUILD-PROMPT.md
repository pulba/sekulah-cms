# Blueprint & Perintah Rebuild Proyek

Gunakan dokumen ini sebagai **master prompt** saat ingin membangun ulang aplikasi ini dengan **tech stack** dan **jenis institusi** berbeda, namun mempertahankan seluruh kapabilitas fitur inti.

---

## 1. Konfigurasi Target (WAJIB DIISI SEBELUM EKSEKUSI)

Isi bagian ini sebelum memberikan prompt ke AI agent:

```yaml
PROJECT_NAME: "[Nama Proyek Baru]"
INSTITUTION_TYPE: "[Pilih: Sekolah | Kampus | Pesantren | Desa | Organisasi | Perusahaan]"
INSTITUTION_NAME: "[Nama Resmi Institusi]"

TECH_STACK:
  frontend_framework: "[misal: Next.js App Router / SvelteKit / Nuxt / Laravel Inertia / Astro]"
  backend_api: "[misal: Hono / Next API Routes / Express / Laravel / FastAPI]"
  database_orm: "[misal: PostgreSQL + Prisma / PostgreSQL + Drizzle / MySQL + Eloquent / SQLite + Drizzle]"
  styling: "[misal: Tailwind CSS v4]"
  rich_text_editor: "[misal: Tiptap / Lexical / Quill]"
  animation: "[misal: Anime.js / Motion / CSS Transitions]"
  auth_session: "[misal: Cookie HTTP-only + Jose JWT / Lucia / Auth.js / Laravel Breeze]"
  object_storage: "[misal: Cloudflare R2 / AWS S3 / Supabase Storage / Local Disk]"
  spreadsheet_export: "[misal: ExcelJS / SheetJS]"
  deployment_target: "[misal: Cloudflare Workers / Vercel / VPS Docker / Node]"

MIGRATION_MODE: "[fresh_seed | migrate_from_existing_db]"
DESIGN_MODE: "[keep_editorial_precision_design_system | custom_design_system]"
```

---

## 2. Peta Adaptasi Jenis Institusi (Domain Mapping)

Gunakan tabel ini untuk memetakan nama tabel, rute, dan istilah UI sesuai `INSTITUTION_TYPE`:

| Modul Asli (Sekolah) | Kampus | Pesantren | Desa | Organisasi / Komunitas |
| :--- | :--- | :--- | :--- | :--- |
| **Identitas (`settings`)** | Profil Kampus (Kode PT) | Profil Pesantren (NSPP) | Profil Desa (Kode Wilayah) | Profil Organisasi (AD/ART) |
| **Guru & Tendik (`teachers`)** | Dosen & Tenaga Kependidikan | Kiai, Ustadz & Pengurus | Kepala Desa & Perangkat Desa | Pengurus Inti & Koordinator |
| **Siswa & Alumni (`studentsAlumni`)** | Mahasiswa Berprestasi & Alumni | Santri Berprestasi & Alumni | Warga Berprestasi & Tokoh | Anggota Berprestasi & Alumni |
| **PPDB (`registrations`, `ppdbFormVersions`)** | PMB (Penerimaan Mahasiswa Baru) | Pendaftaran Santri Baru (PSB) | Layanan Administrasi Warga / Surat | Open Recruitment Anggota |
| **Kelulusan (`graduations`)** | Yudisium / Wisuda | Kelulusan / Khataman | *Nonaktif / Diganti Data Bansos* | Sertifikasi / Pelantikan |
| **Ekstrakurikuler (`extracurriculars`)** | UKM (Unit Kegiatan Mahasiswa) | Kegiatan Santri | Karang Taruna / PKK / Posyandu | Divisi / Komunitas Minat |
| **OSIS / OSIM (`osis`, `osim`)** | BEM / Senat Mahasiswa | Organisasi Santri (OSDA/OPPM) | BPD / LPMD | Badan Pengurus Harian |
| **Ma'had (`mahadPrograms`)** | Asrama Mahasiswa / Ma'had | Program Kepesantrenan (Tahfidz/Kitab) | Program Keagamaan / Sosial Desa | Program Pembinaan Khusus |
| **BKK (`bkkOpportunities`)** | Career Center (CDC) & Magang | Unit Usaha / Koperasi Pesantren | BUMDes & Lowongan Kerja Desa | Bursa Kerja / Peluang Kolaborasi |
| **Fasilitas (`facilities`)** | Fasilitas Kampus & Lab | Sarana Asrama & Masjid | Fasilitas Publik & Balai Desa | Sekretariat & Ruang Kerja |
| **Rekap Siswa (`studentEnrollmentStats`)** | Statistik Mahasiswa Aktif | Statistik Santri Periodik | Statistik Demografi Penduduk | Statistik Keanggotaan |
| **Tracer Lulusan (`graduationTracerStats`)** | Tracer Study Alumni | Sebaran Pengabdian Alumni | *Nonaktif / Indeks Desa* | Laporan Dampak Program |

> **Instruksi ke AI:** Nonaktifkan atau sembunyikan modul yang bertanda *Nonaktif* pada jenis institusi terpilih, dan sesuaikan seluruh label UI, slug URL, serta validasi form dengan terminologi kolom target.

---

## 3. Master Prompt Siap Pakai (Copy-Paste ke AI Agent)

```markdown
Bangun ulang aplikasi web portal institusi & CMS lengkap dengan spesifikasi berikut:

### A. Konteks & Konfigurasi
- Nama Proyek: [PROJECT_NAME]
- Jenis Institusi: [INSTITUTION_TYPE] ([INSTITUTION_NAME])
- Tech Stack: [Isi dari bagian 1]
- Target Deployment: [deployment_target]
- Gunakan peta terminologi domain sesuai jenis institusi (jangan sisakan istilah "sekolah/siswa/PPDB" jika targetnya bukan sekolah).

### B. Arsitektur Data (27 Entitas Inti — Sesuaikan Nama/Kolom dengan Domain)
1. **Auth & Keamanan**: `users` (RBAC: `super_admin`, `editor`), `sessions` (HTTP-only session token), `loginAttempts` (rate limiting per IP/email), `auditLogs` (mencatat CREATE, UPDATE, DELETE, LOGIN, IP, diff ringkas).
2. **Konten Editorial**: `categories`, `articles` (slug unik, rich-text JSON/HTML, viewCount, soft delete `deletedAt`, status `draft`/`published`, SEO metaTitle/metaDescription), `pages` (halaman statis dinamis berbasis slug).
3. **Informasi Publik**: `agendas` (eventDate, endDate, startTime, endTime, location, isCompleted), `announcements` (running banner/pengumuman cepat dengan `isUrgent` dan `expiresAt` auto-expiry), `documents` (file unduhan publik + `downloadCount`), `galleries` (foto & embed YouTube + `albumName`).
4. **Direktori & Profil**: `teachers` (SDM/Pengurus dengan kategori, urutan `orderNumber`), `studentsAlumni` (prestasi & alumni dengan `isPublicConsent` untuk kontrol PII), `facilities`, `extracurriculars`, `partners` (mitra/rekanan).
5. **Modul Operasional Khusus** (aktifkan sesuai jenis institusi):
   - **Pendaftaran/Registrasi Dinamis**: `registrations` (nomor registrasi unik dari server, NIK 16 digit unik per periode, kode akses rahasia `verificationCode`, status berlapis: `registrationStatus`, `verificationStatus`, `selectionStatus`, `revisionNotes`, `configSnapshot`, lampiran berkas privat) + `ppdbFormVersions` (dynamic form builder + versioning draft/published).
   - **Kelulusan/Sertifikasi**: `graduations` (cek status publik berbasis nomor induk/identitas, surat keterangan `letterNumber`, status lulus/ditunda/tidak lulus).
   - **Program Khusus & Karir**: `bkkOpportunities` (lowongan/magang/MoU), `mahadPrograms`, `studentEnrollmentStats`, `graduationTracerStats`.
6. **Konfigurasi & Tampilan**: `settings` (key-value identitas, kontak, maintenance mode, konfigurasi tema 3 warna `primary`/`secondary`/`tertiary` + mode `light`/`dark`/`system`), `navigationItems` (dynamic navbar hierarkis `page` & `dropdown`, kontrol `showDesktop`/`showMobile`), `heroSlides` (multi-slide banner beranda), `media` (pustaka media terpusat dengan kategori, `altText`, `isPrivate`, dimensi gambar, dan `storageKey`).

### C. Fitur Halaman Publik
- **Beranda**: Hero slider (LCP eager di slide 1, lazy `data-src` di slide 2+), running announcement banner, berita terbaru, agenda terdekat, slider infinite loop + touch/drag (SDM, Alumni, Mitra), fasilitas & kegiatan unggulan.
- **Direktori & Publikasi**: Daftar & detail berita (filter kategori, halaman penulis, counter pembaca), agenda, galeri foto/video, dokumen unduhan, fasilitas, kegiatan/divisi, profil institusi, halaman dinamis, pencarian global (`/cari`), halaman kontak + peta.
- **Layanan Publik**: Form pendaftaran multi-step dinamis (sesuai versi form published), halaman cek status pendaftaran dengan kode verifikasi + revisi berkas, halaman cetak formulir A4, halaman cek kelulusan/sertifikasi, mode pemeliharaan (`maintenance`), `sitemap.xml` dinamis, halaman legal (privasi & syarat ketentuan).

### D. Fitur Panel Admin CMS
- Login (email/password + opsi OAuth) dengan rate limiting & audit trail.
- Dashboard ringkasan KPI & aktivitas terbaru.
- CRUD penuh + pencarian, filter status tab (zero-load segmented control), pagination terpusat, toggle switch status aktif/nonaktif, dan icon-only action buttons untuk seluruh modul aktif.
- Rich text editor (Tiptap/setara) terintegrasi dengan Media Library terpusat (upload ke object storage, metadata alt text, pemisahan file publik vs privat).
- Manajemen Pendaftaran: verifikasi berkas, catatan revisi, ubah status seleksi, ekspor data ke Excel (`.xlsx`), dan cetak formulir A4.
- Manajemen Kelulusan: CRUD + import/export Excel massal.
- Pengaturan Sistem: identitas institusi, dynamic navbar builder (urutan & submenu), theme customizer (preset + custom hex dengan kalkulasi kontras WCAG AA & auto dark mode), manajemen user/role, dan maintenance mode toggle.

### E. Standar Teknis, Keamanan & UI/UX
- **Keamanan**: Validasi input server-side ketat (Zod/setara) di semua endpoint, proteksi CSRF/XSS (sanitasi HTML rich text), file privat (berkas pendaftaran) hanya dapat diakses admin terautentikasi atau pemilik dengan `verificationCode` valid, tidak ada hardcoded secret.
- **UI/UX**: Token warna semantik (dilarang warna palette mentah), zero inline `style="..."`, dark mode otomatis kontras >= 4.5:1 (WCAG AA), icon terpusat (SVG sprite), komponen Pagination & Breadcrumb terpusat, gambar dengan `width`/`height` eksplisit (zero CLS), dan aksesibilitas form/ARIA lengkap.
- **Eksekusi Bertahap**: Kerjakan per fase dan verifikasi build/test di akhir setiap fase:
  - Fase 1: Setup project, DB schema, auth/session, middleware RBAC, layout & design tokens.
  - Fase 2: Settings, Dynamic Navbar, Media Library, Hero Slider, Berita/Kategori/Pages.
  - Fase 3: Direktori SDM, Alumni/Prestasi, Agenda, Pengumuman, Galeri, Dokumen, Fasilitas, Ekskul/Divisi, Mitra.
  - Fase 4: Modul Pendaftaran Dinamis + Cek Status + Cetak A4 + Export Excel + Kelulusan.
  - Fase 5: Audit keamanan, optimasi Core Web Vitals, build check, dan seed data demo.
```

---

## 4. Referensi Stack Proyek Saat Ini (Baseline)

Daftar teknologi yang dipakai di proyek `super-cms-sekolah` saat ini (sebagai acuan padanan saat migrasi tech stack):

- **Frontend / Meta-Framework**: Astro `^7.4.2` (`@astrojs/cloudflare` `^14.4.2` untuk build/preview, `@astrojs/node` `^11.1.9` untuk dev)
- **Backend API & Validasi**: Hono `^4.13.13` (di-mount via `src/pages/api/[...hono].ts`), `@hono/zod-validator` `^0.9.1`, Zod `^4.6.7`
- **Database & ORM**: LibSQL / Turso (`@libsql/client` `^0.18.0`), Drizzle ORM `^0.45.4`, Drizzle Kit `^0.31.11` (27 tabel di `src/db/schema.ts`)
- **Styling & Ikon**: Tailwind CSS v4 (`tailwindcss` `^4.3.3`, `@tailwindcss/vite` `^4.3.3`), `astro-icon` `^1.2.0`, `@fortawesome/free-brands-svg-icons` `^7.3.1`, `simple-icons` `^16.35.0`
- **Rich Text Editor**: Tiptap `^3.32.0` (`@tiptap/core`, `@tiptap/starter-kit`, `character-count`, `code-block`, `image`, `link`, `placeholder`, `strike`, `text-align`, `underline`)
- **Animasi**: Anime.js `^4.5.0` (`@types/animejs` `^4.0.0`)
- **Auth & Session**: `jose` `^6.2.18` (JWT/session) + Google OAuth (`src/pages/api/auth/google.ts`, `src/pages/api/auth/callback/google.ts`)
- **Object Storage**: `@aws-sdk/client-s3` `^3.1156.0` (Cloudflare R2 / S3-compatible)
- **Export / Import Spreadsheet**: `exceljs` `^4.4.0` & `xlsx` `^0.18.5`
- **Runtime & Deployment**: Node `>=22.23.4`, `wrangler` `^4.167.0` (Cloudflare), `bun` untuk script `db:seed` (`src/db/seed.ts`)

