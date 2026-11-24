📝 Product Requirement Document (PRD) – CMS Website Sekolah


1. Ringkasan Proyek (Project Overview)

Proyek ini bertujuan untuk membangun CMS (Content Management System) Website Sekolah yang berkinerja tinggi, aman, dan mudah dioperasikan oleh staf sekolah (staf TU/guru). Sistem ini berfokus pada penyajian informasi publik, dokumentasi kegiatan, transparansi akademik, dan publikasi agenda sekolah.

2. Tujuan & Sasaran (Objectives)

• Menyediakan wadah informasi resmi sekolah yang cepat diakses oleh siswa, orang tua, dan masyarakat umum.
• Mempermudah admin sekolah yang awam teknologi untuk memperbarui konten (berita, agenda, direktori guru).
• Menjamin keamanan data sekolah dari peretasan (deface), spam, dan kehilangan data dengan stack serverless/edge yang modern.

3. Arsitektur Teknologi (Tech Stack)

• Framework & Runtime: Astro (Latest Version) via @astrojs/cloudflare, Bun.js (Dev & CLI)
• Styling & UI: Tailwind CSS v4, Alpine.js, CSS/Web Animations API, Motion, GSAP (hanya untuk scroll advanced)
• Backend & Database: Hono.js (Edge), Turso SQLite (LibSQL Edge), Drizzle ORM & Kit
• Validation & API: Zod, @hono/zod-validator, Hono RPC Client
• Services (Auth, Storage, Cache): Firebase Auth (Admin Invite-only), Cloudflare R2, Redis/Upstash
• Tools & Utilities: WASM/Photon Image Compressor atau Cloudflare Image Resizing (Cloudflare Edge compatible), Cloudflare Cron Triggers (cron), Sentry/Logflare (monitoring), Tiptap (rich text editor)
• Arsitektur: Single-tenant (1 sekolah per deployment)

4. Ruang Lingkup Fitur (Feature Requirements)


Kluster A: Fitur Inti / Konten Utama (Wajib Ada)

1. Manajemen Profil Sekolah
	• Admin dapat mengisi data statis terstruktur: NPSN, Visi-Misi, Sejarah, Struktur Organisasi, dan Status Akreditasi.
2. Manajemen Informasi & Agenda
	• Berita & Artikel: CRUD berita kegiatan sekolah dengan kategori, tag, dan editor Tiptap.
	• Agenda Sekolah: Kalender kegiatan akademik, ujian, dan rapat.
	• Pengumuman Cepat: Input teks singkat yang akan muncul sebagai running text atau pop-up banner darurat di halaman utama.
3. Manajemen Direktori Akademik
	• Direktori Guru & Staf: Input nama, NIP, jabatan, foto, dan mata pelajaran yang diampu.
	• Direktori Siswa & Alumni: Halaman prestasi siswa dan pelacakan kelulusan alumni (tracer study).
4. Manajemen Halaman Statis & Media
	• Halaman Statis: Pembuat halaman kustom (Fasilitas, Kurikulum, Kontak).
	• Galeri Media: Unggah album foto kegiatan dan sematan (embed) video YouTube sekolah.
	• Dokumen & Unduhan: Unggah berkas penting (PDF/Doc) seperti kalender akademik atau materi ajar.
5. Modul PPDB (Pendaftaran Siswa Baru)
	• Halaman khusus informasi alur pendaftaran dan tombol pengalihan (integrasi) ke link PPDB eksternal milik dinas pendidikan.

Kluster B: Fitur Pengaturan & Tampilan (Administrasi)

1. Manajemen Pengguna & Hak Akses (User & Role)
	• Super Admin (Kepala IT): Akses penuh ke seluruh sistem dan konfigurasi.
	• Editor (Staf TU/Guru): Hanya bisa membuat/mengedit konten berita, agenda, dan galeri.
2. Pengaturan Layout & Identitas Visual
	• Ubah logo sekolah, favicon, info footer, dan susunan menu navigasi (header & footer).
	• Banner Slider: Kelola gambar besar geser di halaman depan beranda.
	• Sidebar & Widget: Atur komponen samping (widget jam, tautan dinas terkait).

Kluster C: Fitur Keamanan & Teknis (Belakang Layar)

1. Audit Trail Keamanan: Sistem mencatat log aktivitas otomatis (Siapa adminnya, aksi apa yang dilakukan, dan kapan waktunya) di database Turso.
2. Manajemen SEO Dasar: Form pengisian meta-title, meta-description untuk tiap halaman, serta pembuatan sitemap.xml otomatis.
3. Sistem Backup Data: Ekspor database sekali klik atau otomatis terjadwal via Cron.

5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

• Performa: Kecepatan muat halaman depan (Lighthouse Performance Score) wajib di atas 90, memanfaatkan fitur SSR/SSG hybrid dari Astro.
• Optimasi Gambar: Setiap gambar kegiatan sekolah yang diunggah wajib dikompres otomatis oleh sistem ke format .webp atau .avif dengan ukuran maksimal lebar 1200px sebelum masuk ke Cloudflare R2.
• Keamanan (Security):
	• Tidak ada kolom komentar publik di website untuk mencegah spam bot judi online.
	• API Hono harus dilindungi oleh middleware verifikasi Firebase ID Token untuk rute /admin/*.
• Aksesibilitas (Accessibility): Desain harus responsif (ramah ponsel pintar) karena mayoritas orang tua siswa mengakses web melalui HP.

6. Keputusan Arsitektur Kunci (Technical Decisions)

1. Runtime & Hosting: Cloudflare Pages/Workers via adapter `@astrojs/cloudflare`.
2. Pipeline Upload Gambar: Multipart upload via endpoint backend Hono untuk validasi MIME & ukuran, kompresi edge-friendly (WASM/Cloudflare Image Resizing), lalu stream ke Cloudflare R2.
3. Otentikasi Admin: Firebase Auth strictly Invite-Only / CLI Seeder. Pendaftaran publik dinonaktifkan di Firebase Console.
4. Tenancy: Single-tenant (1 instance database & codebase per sekolah).
