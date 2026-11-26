# Daftar Persiapan Sekolah untuk Website (Project SUPER CMS)

Dokumen ini berisi seluruh kebutuhan teknis, identitas, data, dan aset yang harus disiapkan oleh pihak sekolah sebelum melakukan setup, migrasi, atau peluncuran website menggunakan project ini.

---

## 1. Akun & Infrastruktur Teknis (Untuk Tim IT / Developer)

Berdasarkan `.env.example` dan `wrangler.jsonc`, siapkan layanan berikut:

- [ ] **Domain Resmi Sekolah** (disarankan domain `.sch.id` beserta akses DNS)
- [ ] **Hosting / Deployment**: Akun **Cloudflare** (Pages / Workers via `wrangler`)
- [ ] **Database (Turso / LibSQL)**:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- [ ] **Object Storage (Cloudflare R2)** untuk menyimpan foto, dokumen PDF, dan berkas PPDB:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_DOMAIN`
- [ ] **Autentikasi Admin (Google OAuth2 & Session)**:
  - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (dari Google Cloud Console)
  - `OWNER_ADMIN_EMAIL` (email Super Admin utama)
  - `SESSION_SECRET` (string acak minimal 32–64 karakter)
  - *(Opsional jika integrasi Firebase aktif)*: `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_PROJECT_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`

---

## 2. Identitas Resmi, Kontak & Branding Sekolah

Mengacu pada tabel `settings` dan `src/db/seed.ts`:

- [ ] **Nama Resmi Sekolah** (`school_name`)
- [ ] **NPSN** (`npsn`) & **Status Akreditasi** (`accreditation`, misal: `A (Unggul)`)
- [ ] **Alamat Lengkap** (`address`, `city`, `province`) + **Link / Embed Google Maps** untuk halaman Kontak
- [ ] **Kontak Resmi**: Email institusi (`email`), Nomor Telepon (`phone`), WhatsApp layanan, dan tautan Media Sosial resmi (Instagram, YouTube, Facebook, TikTok, X)
- [ ] **Logo Sekolah** (format SVG/PNG transparan resolusi tinggi) & Favicon
- [ ] **Identitas Warna Tema** (pilih 1 dari 6 preset: *Emerald, Ocean, Royal, Crimson, Earth, Minimal*, atau siapkan 3 kode HEX: `primary_color`, `secondary_color`, `tertiary_color`) dan preferensi mode (`light`, `dark`, `system`)

---

## 3. Konten Halaman Beranda & Profil

- [ ] **Hero Slider Beranda** (`hero_slides`): 1–5 foto terbaik sekolah (rasio 16:9, rekomendasi 1920x1080 px), lengkap dengan tagline, judul, subjudul, dan link tombol CTA
- [ ] **Sambutan Kepala Sekolah**:
  - Nama lengkap & gelar (`principal_name`)
  - Jabatan (`principal_title`)
  - Foto formal Kepala Sekolah (`principal_photo`, rasio portrait 4:5)
  - Teks kutipan sambutan (`principal_welcome_quote`)
- [ ] **Visi, Misi & Video Profil**:
  - Narasi ringkas profil sekolah (`school_profile_title`, `school_profile_desc`)
  - Teks Visi (`school_vision`) & poin-poin Misi (`school_mission`)
  - Link video profil YouTube (`school_video_url`) & gambar thumbnail (`school_video_thumbnail`)
- [ ] **4 Angka Statistik Unggulan** (`stat_1_*` s.d. `stat_4_*`), misal: Jumlah Siswa Aktif, Persentase Lulusan PTN/Kerja, Jumlah Guru Tersertifikasi, Jumlah Prestasi
- [ ] **Pengumuman Cepat / Running Banner** (`announcements`): Teks singkat info mendesak + link tujuan (jika ada)

---

## 4. Data SDM, Siswa, Prestasi & Alumni

- [ ] **Direktori Guru & Tenaga Kependidikan** (`teachers`):
  - Daftar nama, NIP/NUPTK, jabatan, kategori (`pimpinan`, `guru`, `tendik`), mata pelajaran yang diampu, dan foto profil (rasio 4:5 atau 3:4)
- [ ] **Data Prestasi Siswa** (`students_alumni` tipe `achievement`):
  - Nama siswa/tim, judul prestasi/juara, tahun, penyelenggara lomba, deskripsi, dan foto dokumentasi
- [ ] **Data & Testimoni Alumni** (`students_alumni` tipe `alumni`):
  - Nama alumni, tahun lulus, kampus/perusahaan saat ini, kutipan testimoni, foto, dan **persetujuan publikasi data** (`isPublicConsent`)
- [ ] **Rekapitulasi Statistik Kesiswaan (SSOT Dapodik/EMIS)** (`student_enrollment_stats`):
  - Data per tahun ajaran: total siswa, jumlah putra/putri, jumlah rombel
- [ ] **Rekapitulasi Sebaran Lulusan / Tracer Study** (`graduation_tracer_stats`):
  - Data per tahun lulus: total lulusan, diterima PTN, diterima PTS, bekerja, wirausaha

---

## 5. Konten Publikasi, Fasilitas & Kemitraan

- [ ] **Berita & Artikel Awal** (`articles` & `categories`):
  - Minimal 3–5 artikel berita awal beserta foto cover (rasio 16:9) dan daftar kategori berita (misal: *Prestasi, Akademik, Fasilitas, Kesiswaan*)
- [ ] **Agenda Kegiatan** (`agendas`):
  - Jadwal kegiatan terdekat (judul, tanggal mulai/selesai, jam, lokasi, deskripsi singkat)
- [ ] **Galeri Foto & Video** (`galleries`):
  - Kumpulan foto kegiatan dikelompokkan per nama album + link video YouTube sekolah
- [ ] **Dokumen Publik** (`documents`):
  - File PDF siap unduh (Kalender Akademik, Tata Tertib, Silabus, Brosur Sekolah, Formulir)
- [ ] **Fasilitas & Sarana Prasarana** (`facilities`):
  - Nama ruangan/lab, kategori, lokasi gedung, kapasitas, deskripsi, dan foto
- [ ] **Ekstrakurikuler** (`extracurriculars`):
  - Nama ekskul, kategori, jadwal latihan, nama pembina, deskripsi, dan foto kegiatan
- [ ] **Mitra & Perguruan Tinggi / Industri** (`partners`):
  - Nama instansi mitra, kategori, logo (transparan/bersih), dan website mitra
- [ ] **Halaman Statis Tambahan** (`pages`), jika diperlukan (misal: Kurikulum, Sejarah Sekolah, Program Unggulan)

---

## 6. Data Modul Layanan Khusus (Sesuai Jenjang Sekolah)

Aktifkan dan siapkan data berikut sesuai kebutuhan sekolah:

- [ ] **Modul PPDB / Penerimaan Siswa Baru** (`registrations`, `ppdb_form_versions`):
  - Tahun ajaran & gelombang pendaftaran (misal: Gelombang 1, Gelombang 2)
  - Jalur pendaftaran yang dibuka (Zonasi, Prestasi, Afirmasi, Pindahan, dll.)
  - Daftar kompetensi keahlian/jurusan (khusus SMK/MA) & informasi asrama (jika boarding)
  - Daftar berkas syarat upload (KK, Akta Lahir, SKL/Ijazah, berkas tambahan)
  - Template aturan/catatan untuk cetak bukti pendaftaran A4
- [ ] **Modul Pengumuman Kelulusan** (`graduations`):
  - File Excel/CSV berisi data kelulusan siswa tingkat akhir: `NISN`, `NIS`, `Nama`, `Kelas`, `Jurusan`, `Tempat/Tgl Lahir`, `Status (LULUS/TIDAK_LULUS/DITUNDA)`, `Nomor SKL`, dan `Nilai Rata-rata`
- [ ] **Modul OSIS / OSIM**:
  - Struktur kepengurusan, foto ketua/pengurus, dan program kerja
- [ ] **Modul BKK (Khusus SMK)** (`bkk_opportunities`):
  - Daftar lowongan kerja, program magang, atau mitra MoU industri beserta kontak person & deadline
- [ ] **Modul Ma'had / Kepesantrenan (Khusus Madrasah / Boarding)** (`mahad_programs`):
  - Daftar program keagamaan/tahfidz, target capaian, jadwal, dan nama pengasuh/mentor

---

## 7. Tim Pengelola CMS (Admin & Redaksi)

Mengacu pada tabel `users`:

- [ ] **Super Admin** (`super_admin`): 1–2 orang (Tim IT/Operator Sekolah) — akses penuh ke pengaturan tema, navbar, user, PPDB, kelulusan, dan audit log
- [ ] **Editor / Humas** (`editor`): Staf humas/guru redaksi — akses kelola berita, agenda, pengumuman, galeri, dan dokumen
- [ ] Siapkan **Nama Lengkap** dan **Alamat Email aktif** masing-masing pengelola untuk didaftarkan ke sistem
