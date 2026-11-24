# 🎓 SEKULAH CMS — Modern, Edge-First School Portal & Content Management System

[![Astro](https://img.shields.io/badge/Astro-v5+-BC52EE?style=flat&logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38BDF8?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers_%26_R2-F38020?style=flat&logo=cloudflare&logoColor=white)](https://cloudflare.com)
[![Turso](https://img.shields.io/badge/Turso-LibSQL_SQLite-00E699?style=flat&logo=sqlite&logoColor=black)](https://turso.tech)
[![Bun](https://img.shields.io/badge/Runtime-Bun_v1.4+-black?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**SEKULAH CMS** adalah sistem manajemen konten (CMS) dan portal web resmi sekolah modern berbasis arsitektur **Edge Computing** (Astro + Cloudflare Workers + Turso SQLite). Dirancang khusus untuk sekolah di Indonesia (SD, SMP, SMA, SMK, dan Madrasah) yang membutuhkan website berkinerja tinggi, berpenampilan editorial elegan, ramah ponsel, bebas risiko peretasan (*anti-deface/judi online*), serta gratis/sangat murah dioperasikan tanpa biaya server bulanan yang mahal.

---

## 📑 Daftar Isi

- [Keunggulan Utama](#-keunggulan-utama)
- [Ruang Lingkup Fitur](#-ruang-lingkup-fitur)
- [Arsitektur & Tech Stack](#-arsitektur--tech-stack)
- [Prasyarat Sistem](#-prasyarat-sistem)
- [Panduan Instalasi Langkah Demi Langkah](#-panduan-instalasi-langkah-demi-langkah)
  - [Langkah 1: Kloning & Pasang Dependensi](#langkah-1-kloning--pasang-dependensi)
  - [Langkah 2: Setup Database Turso (LibSQL)](#langkah-2-setup-database-turso-libsql)
  - [Langkah 3: Setup Google OAuth2](#langkah-3-setup-google-oauth2)
  - [Langkah 4: Setup Firebase Auth](#langkah-4-setup-firebase-auth)
  - [Langkah 5: Setup Cloudflare R2 Storage](#langkah-5-setup-cloudflare-r2-storage)
  - [Langkah 6: Konfigurasi File Environment (.env & .dev.vars)](#langkah-6-konfigurasi-file-environment-env--devvars)
  - [Langkah 7: Push Skema Database & Data Seeding](#langkah-7-push-skema-database--data-seeding)
  - [Langkah 8: Menjalankan Server Development](#langkah-8-menjalankan-server-development)
- [Mekanisme & State Autentikasi (Google OAuth & RBAC)](#-mekanisme--state-autentikasi-google-oauth--rbac)
- [Panduan Deployment ke Cloudflare Production](#-panduan-deployment-ke-cloudflare-production)
- [Kustomisasi Identitas & Tema Warna Sekolah](#-kustomisasi-identitas--tema-warna-sekolah)
- [Perintah CLI Proyek](#-perintah-cli-proyek)
- [Lisensi](#-lisensi)

---

## 🌟 Keunggulan Utama

1. **Bebas Deface & Anti-Spam Bot**: Arsitektur serverless edge tanpa server PHP/cPanel tradisional yang rentan injeksi SQL dan deface situs judi online. Tidak ada kolom komentar publik yang bisa dieksploitasi bot.
2. **Ultra Cepat (Lighthouse Score 95+)**: Menggunakan Astro hybrid rendering (SSR di Cloudflare Edge) dengan kompresi CSS Tailwind v4 dan optimasi gambar LCP. Waktu buka halaman kurang dari 1 detik di jaringan seluler.
3. **Biaya Operasional Nyaris Rp 0**: Memanfaatkan kuota gratis (*free tier*) Cloudflare Workers, Cloudflare R2 (10GB), dan Turso SQLite (9GB penyimpanan + 500 database), cukup untuk kebutuhan operasional sekolah pada umumnya.
4. **Desain Editorial Precision**: Tampilan formal, anggun, berwibawa, dan kontras tajam memenuhi standar aksesibilitas WCAG AA (mode terang & mode gelap otomatis).
5. **Siap Cetak A4 Standar Resmi**: Modul bukti pendaftaran PPDB dan surat kelulusan otomatis terformat rapi sesuai ukuran kertas cetak A4 210mm tanpa perlu penataan manual.

---

## 📦 Ruang Lingkup Fitur

### 🌐 Portal Publik Sekolah
- **Beranda Interaktif**: Banner slider hero, sambutan kepala sekolah, sekilas profil & video resmi, kartu statistik unggulan, berita terkini, agenda kalender akademik, dan testimoni alumni.
- **Profil Sekolah Lengkap**: Sejarah, visi, misi, struktur organisasi pimpinan, akreditasi BAN-S/M, dan data fasilitas kampus.
- **Direktori Pendidik & Tenaga Kependidikan**: Pencarian guru/staf berdasarkan nama, NIP, atau mata pelajaran yang diampu.
- **Pusat Informasi & Prestasi**: Berita kegiatan sekolah dengan editor kaya, tag, kategori, arsip prestasi siswa, dan ekstrakurikuler.
- **Pengumuman Darurat**: Banner pengumuman penting berbasis status masa aktif (*auto-expiry*).
- **Galeri Foto & Sematan Video YouTube**: Dokumentasi kegiatan terstruktur per album.
- **Dokumen & Unduhan**: Bank berkas publik (kurikulum, silabus, formulir resmi).
- **Modul PPDB Online (Pendaftaran Siswa Baru)**:
  - Multi-step wizard registrasi mandiri calon peserta didik.
  - Unggah berkas persyaratan (Kartu Keluarga, Akta Kelahiran, SKL).
  - Cek status pendaftaran instan menggunakan kode registrasi / NISN.
  - Cetak Bukti Pendaftaran format resmi cetak A4.
- **Modul Pengumuman Kelulusan Online**: Pengecekan status kelulusan siswa berbasis NISN dengan hitung mundur (*countdown timer*).

### 🛠️ Panel Administrasi CMS (`/admin`)
- **Dashboard Statistik**: Metrik real-time pendaftar PPDB, berita terbit, total agenda, dan galeri.
- **Tiptap Rich-Text Editor**: Editor konten berita/halaman yang intuitif dengan fitur heading, gambar, format kutipan, dan tabel.
- **Manajemen Pengguna & RBAC**: Pembagian hak akses Super Admin (akses penuh) dan Editor (staf TU/guru pembuat konten).
- **Pengaturan Identitas & Tema Sekolah**: Penggantian logo, favicon, kontak dinas, serta 6 preset tema warna (Emerald, Ocean, Royal, Crimson, Earth, Minimal) atau kode HEX kustom.
- **Penyusun Menu Navigasi**: Drag & organize struktur menu navbar header dan tautan footer.
- **Audit Trail Keamanan**: Rekam jejak seluruh aktivitas perubahan data di admin (waktu, pelaku, jenis aksi, IP address).
- **Pencadangan Data Sekali Klik**: Ekspor basis data dan berkas untuk pemulihan bencana.

---

## 🏗️ Arsitektur & Tech Stack

| Lapisan | Teknologi | Peran |
| :--- | :--- | :--- |
| **Framework & Engine** | [Astro v5+](https://astro.build) | Hybrid Server-Side Rendering (SSR) & Static Generation |
| **Edge Serverless Adapter** | [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | Runtime Cloudflare Workers & Pages Functions |
| **API Backend** | [Hono](https://hono.dev) | Edge-native REST API routing di dalam rute `/api` |
| **Database** | [Turso](https://turso.tech) (LibSQL) | SQLite terdistribusi di edge over HTTP pipeline |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team) | Type-safe database queries & skema TypeScript |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Desain utility-first deklaratif CSS `@theme` |
| **Animasi & Interaksi** | [Anime.js v4](https://animejs.com) | Smooth gentle physics scroll reveals & counter dinamis |
| **Otentikasi Staf** | Google OAuth2 + Firebase Auth | Login 1-klik akun Google guru/staf dengan JWT stateless |
| **Penyimpanan Media** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | S3-compatible cloud storage untuk foto berita & dokumen |
| **Package Manager** | [Bun](https://bun.sh) | Runtime JavaScript/TypeScript dan package manager super cepat |

---

## 📋 Prasyarat Sistem

Sebelum memulai instalasi, pastikan Anda telah menyiapkan alat berikut:
1. **[Bun Runtime](https://bun.sh)** (versi 1.2 atau lebih baru). Cek dengan `bun --version`.
2. **Git** terpasang di komputer Anda.
3. Akun gratis di:
   - **[Cloudflare](https://dash.cloudflare.com)** (untuk Workers dan R2 Storage).
   - **[Turso Database](https://turso.tech)** (untuk database LibSQL).
   - **[Google Cloud Console](https://console.cloud.google.com)** (untuk Google OAuth 2.0).
   - **[Firebase Console](https://console.firebase.google.com)** (untuk Firebase Authentication).

---

## 🚀 Panduan Instalasi Langkah Demi Langkah

### Langkah 1: Kloning & Pasang Dependensi

Buka terminal dan unduh repositori proyek:

```bash
git clone https://github.com/username/super-cms-sekolah.git
cd super-cms-sekolah

# Pasang seluruh dependensi via Bun
bun install
```

---

### Langkah 2: Setup Database Turso (LibSQL)

Turso menyediakan basis data SQLite di edge dengan koneksi HTTP yang sangat cepat.

1. Pasang CLI Turso di komputer Anda (atau gunakan Dashboard Web Turso):
   ```bash
   # Windows (via PowerShell)
   irm https://get.turso.tech/install.ps1 | iex
   
   # Linux / macOS
   curl -sFL https://get.turso.tech/install.sh | bash
   ```
2. Login ke akun Turso Anda:
   ```bash
   turso auth login
   ```
3. Buat database baru untuk sekolah Anda:
   ```bash
   turso db create cms-sekolah --location sin
   ```
   *(Pilih lokasi terdekat seperti `sin` / Singapura untuk latensi terendah di Indonesia).*
4. Dapatkan URL Database:
   ```bash
   turso db show cms-sekolah --url
   # Contoh output: libsql://cms-sekolah-organisasi.turso.io
   ```
5. Buat token autentikasi permanen:
   ```bash
   turso db tokens create cms-sekolah
   # Salin JWT token panjang yang muncul
   ```

Simpan URL (`TURSO_DATABASE_URL`) dan Token (`TURSO_AUTH_TOKEN`) untuk konfigurasi environment.

---

### Langkah 3: Setup Google OAuth2

Untuk mengaktifkan fitur **Login dengan Akun Google Guru/Staf**:

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat Project Baru (misal: `Sekolah-Digital-Portal`).
3. Masuk ke menu **APIs & Services** > **OAuth consent screen**:
   - Pilih User Type: **External**.
   - Isi Nama Aplikasi (misal: `Portal Admin SMAN 1`), email dukungan, dan email developer.
   - Pada bagian Scopes, pilih `.../auth/userinfo.email` dan `.../auth/userinfo.profile`.
4. Masuk ke menu **APIs & Services** > **Credentials**:
   - Klik **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `CMS Sekolah Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:4321` (Development)
     - `https://domain-sekolah-anda.sch.id` (Production)
   - **Authorized redirect URIs**:
     - `http://localhost:4321/api/auth/callback/google` (Development)
     - `https://domain-sekolah-anda.sch.id/api/auth/callback/google` (Production)
5. Klik **Create**, lalu salin **Client ID** dan **Client Secret**.

---

### Langkah 4: Setup Firebase Auth

Firebase digunakan sebagai Identity Provider dan manajemen Custom Claims (Role Admin/Editor):

1. Buka [Firebase Console](https://console.firebase.google.com/) dan tautkan dengan Project Google Cloud yang telah dibuat di Langkah 3 (atau buat project baru).
2. Masuk ke **Authentication** > **Sign-in method**:
   - Aktifkan provider **Google**.
   - Masukkan Client ID dan Client Secret dari Langkah 3 jika diminta.
3. Dapatkan **Web API Key**:
   - Masuk ke **Project Settings** (ikon gerigi) > tab **General**.
   - Salin nilai **Web API Key** (ini adalah `PUBLIC_FIREBASE_API_KEY`).
4. Buat & Unduh **Service Account Key** (Admin SDK):
   - Masuk ke tab **Service accounts**.
   - Klik **Generate new private key**, lalu unduh file `.json`.
   - Buka file JSON tersebut, Anda akan menemukan:
     - `project_id` -> Masukkan ke `FIREBASE_PROJECT_ID`
     - `client_email` -> Masukkan ke `FIREBASE_CLIENT_EMAIL`
     - `private_key` -> Masukkan ke `FIREBASE_PRIVATE_KEY`

---

### Langkah 5: Setup Cloudflare R2 Storage

Cloudflare R2 digunakan untuk menyimpan seluruh dokumen pendaftaran siswa dan foto kegiatan:

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) > pilih menu **R2**.
2. Klik **Create bucket**, beri nama bucket (misal: `sekulah`).
3. Pada tab **Settings** bucket:
   - Di bagian **Public Access**, klik **Connect Domain** atau aktifkan **R2.dev subdomain**.
   - Salin URL domain publik (misal: `https://pub-a7c1a1da419440d09dd737c461fec07e.r2.dev`).
4. Buat Kunci API R2:
   - Kembali ke halaman utama R2 > klik **Manage R2 API Tokens** di sisi kanan.
   - Klik **Create API Token**.
   - Permissions: **Object Read & Write**.
   - Klik **Create API Token**, lalu salin:
     - **Account ID**
     - **Access Key ID**
     - **Secret Access Key**

---

### Langkah 6: Konfigurasi File Environment (`.env` & `.dev.vars`)

Duplikasi template berkas konfigurasi:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

Edit berkas `.env` (untuk development lokal Node/Bun) dan `.dev.vars` (untuk runtime Cloudflare/Wrangler):

```env
# ==========================================
# 1. DATABASE TURSO (LibSQL)
# ==========================================
# Gunakan https:// untuk keandalan maksimal di environment serverless
TURSO_DATABASE_URL="https://cms-sekolah-organisasi.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsIn..."

# ==========================================
# 2. GOOGLE OAUTH2 (Google Cloud Console)
# ==========================================
GOOGLE_CLIENT_ID="xxxx-xxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"

# ==========================================
# 3. SUPER ADMIN BOOTSTRAP OWNER
# Email ini otomatis mendapat akses Super Admin saat pertama kali login Google
# ==========================================
OWNER_ADMIN_EMAIL="kepala.it@sekolah.sch.id"

# ==========================================
# 4. KEAMANAN SESI (SESSION SECRET)
# String acak aman 64 karakter untuk enkripsi token JWT
# Generate via: openssl rand -hex 32
# ==========================================
SESSION_SECRET="7f83e29a4c106d817e99c372f85a109e4d580b3967d7120aef245e396bc7520a"

# ==========================================
# 5. FIREBASE AUTHENTICATION
# ==========================================
PUBLIC_FIREBASE_API_KEY="AIzaSyBd3kpa..."
FIREBASE_PROJECT_ID="sekolah-digital"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@sekolah-digital.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"

# ==========================================
# 6. CLOUDFLARE R2 OBJECT STORAGE
# ==========================================
R2_ACCOUNT_ID="8f3ffe5d365203c843a90a3396ff9363"
R2_ACCESS_KEY_ID="a96af839f3d4cd6bc8c8343592e27f5a"
R2_SECRET_ACCESS_KEY="bbfa29db0d3e811d55efdd0ca30db9ae4ef..."
R2_BUCKET_NAME="sekulah"
R2_PUBLIC_DOMAIN="https://pub-xxxxxx.r2.dev"
```

> [!NOTE]
> Pada mode development offline lokal, Anda juga dapat mengisi `TURSO_DATABASE_URL="file:local.db"`. Namun untuk deployment ke Cloudflare, **wajib** menggunakan URL remote Turso.

---

### Langkah 7: Push Skema Database & Data Seeding

Sinkronkan seluruh tabel database dan masukkan data konfigurasi awal sekolah:

```bash
# 1. Terapkan skema tabel Drizzle ke database Turso
bun run db:push

# 2. Masukkan data dummy & konfigurasi bawaan (profil, guru, navigasi, tema)
bun run db:seed
```

Output seeding akan membuat pengaturan default identitas sekolah, akun staf, pimpinan sekolah, dan kategori konten.

---

### Langkah 8: Menjalankan Server Development

Jalankan server pengembangan di komputer lokal Anda:

```bash
bun run dev
```

Buka peramban di:
- **Portal Publik**: [http://localhost:4321](http://localhost:4321)
- **Panel Admin**: [http://localhost:4321/admin/login](http://localhost:4321/admin/login)

---

## 🔐 Mekanisme & State Autentikasi (Google OAuth & RBAC)

Sistem menggunakan alur autentikasi bertingkat yang menjamin keamanan data dan kemudahan staf sekolah:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Staf / Guru Sekolah
    participant Web as Browser (Admin Login)
    participant Auth as Astro Endpoint (/api/auth)
    participant Google as Google Identity Provider
    participant FB as Firebase Identity Toolkit
    participant DB as Database Turso (Users)

    Admin->>Web: Klik "Login dengan Google"
    Web->>Auth: Request /api/auth/google
    Auth->>Auth: Generate random CSRF state & simpan di cookie oauth_state
    Auth-->>Web: Redirect ke Google OAuth Consent Screen
    Web->>Google: Autentikasi akun Google staf
    Google-->>Web: Redirect kembali ke /api/auth/callback/google?code=...&state=...
    Web->>Auth: Kirim Auth Code & State
    Auth->>Auth: Verifikasi kecocokan cookie oauth_state (Anti-CSRF)
    Auth->>Google: Pertukaran Code dengan Google ID Token
    Auth->>FB: Verifikasi ID Token via Firebase Identity Toolkit
    FB-->>Auth: Kembalikan Firebase UID, Email, dan DisplayName
    
    alt Email == OWNER_ADMIN_EMAIL (Bootstrap Pertama)
        Auth->>FB: Set Firebase Custom Claims { role: "admin" }
        Auth->>DB: Daftarkan akun sebagai super_admin
    else Akun Terdaftar di Database / Firebase
        Auth->>FB: Ambil role yang sudah diset admin sebelumnya
    else Akun Asing / Tidak Terdaftar
        Auth-->>Web: Tolak akses (?error=unregistered_account)
    end

    Auth->>Auth: Buat token JWT sesi stateless (ditandatangani SESSION_SECRET)
    Auth-->>Web: Set Cookie cms_session (HttpOnly, Secure, 7 Hari)
    Web-->>Admin: Masuk ke Dashboard Admin (/admin)
```

### Penjelasan State & Logika Proteksi:
1. **CSRF State (`oauth_state`)**: State acak kriptografis dibuat sebelum pengguna diarahkan ke Google dan divalidasi ketat saat Google memanggil kembali endpoint callback untuk mencegah serangan *Cross-Site Request Forgery*.
2. **Mekanisme Bootstrap Owner (`OWNER_ADMIN_EMAIL`)**:
   - Sekolah tidak perlu repot membuat Super Admin secara manual di database.
   - Saat staf pemilik email yang tercantum pada variabel `OWNER_ADMIN_EMAIL` masuk untuk pertama kali, sistem secara otomatis mengangkat akun tersebut menjadi **Super Admin** (`role: admin`).
3. **Sistem Tertutup (*Invite-Only*)**:
   - Akun Google lain yang mencoba masuk namun belum didaftarkan oleh Super Admin melalui menu `/admin/users` akan ditolak secara otomatis dengan pesan kesalahan `unregistered_account`.
4. **Fallback Akun Lokal**:
   - Untuk kemudahan pengujian saat jaringan offline, tersedia login password lokal:
     - **Super Admin**: `admin@sman1unggulan.sch.id` / `admin123`
     - **Editor**: `editor@sman1unggulan.sch.id` / `editor123`
     *(Segera ganti kata sandi ini di panel admin sebelum menuju tahap produksi).*

---

## ☁️ Panduan Deployment ke Cloudflare Production

Aplikasi dirancang untuk langsung di-*deploy* ke Cloudflare Workers dengan performa global edge.

### 1. Pasang Wrangler CLI & Login
```bash
bun x wrangler login
```

### 2. Buat KV Namespace untuk Sesi
Cloudflare adapter memerlukan binding KV untuk manajemen sesi:
```bash
bun x wrangler kv namespace create SESSION
```
Salin ID KV yang dihasilkan.

### 3. Masukkan Environment Variables & Secrets di Cloudflare
Jalankan perintah berikut untuk mengunggah kredensial sensitif ke Cloudflare:

```bash
bun x wrangler secret put TURSO_DATABASE_URL
bun x wrangler secret put TURSO_AUTH_TOKEN
bun x wrangler secret put SESSION_SECRET
bun x wrangler secret put GOOGLE_CLIENT_ID
bun x wrangler secret put GOOGLE_CLIENT_SECRET
bun x wrangler secret put OWNER_ADMIN_EMAIL
bun x wrangler secret put PUBLIC_FIREBASE_API_KEY
bun x wrangler secret put FIREBASE_PROJECT_ID
bun x wrangler secret put FIREBASE_CLIENT_EMAIL
bun x wrangler secret put FIREBASE_PRIVATE_KEY
bun x wrangler secret put R2_ACCOUNT_ID
bun x wrangler secret put R2_ACCESS_KEY_ID
bun x wrangler secret put R2_SECRET_ACCESS_KEY
bun x wrangler secret put R2_BUCKET_NAME
bun x wrangler secret put R2_PUBLIC_DOMAIN
```

*(Atau masukkan seluruh variabel di atas melalui **Cloudflare Dashboard** > **Workers & Pages** > Project Anda > **Settings** > **Variables and Secrets**).*

### 4. Build & Deploy
Lakukan kompilasi dan deploy langsung dari terminal:
```bash
# Build aplikasi untuk target Cloudflare Workers
bun run build

# Deploy artefak ke Cloudflare
bun x wrangler deploy
```

---

## 🎨 Kustomisasi Identitas & Tema Warna Sekolah

Tidak perlu mengubah kode CSS atau merancang tema gelap manual. Sistem telah dilengkapi kalkulasi matematis otomatis (`src/utils/themeSystem.ts`) yang mengatur kontras teks dan dark mode.

### 6 Preset Tema Bawaan:
| Preset | Nuansa | Cocok Untuk |
| :--- | :--- | :--- |
| **Emerald** (Default) | Deep Green (`#064734`) + Mint (`#E0FFC2`) | Madrasah, Sekolah Islam, Sekolah Ramah Lingkungan |
| **Ocean** | Deep Navy (`#0F284E`) + Sky Ice (`#BAE6FD`) | SMA/SMK Negeri, Sekolah Teknologi & Maritim |
| **Royal** | Imperial Purple (`#3B1A5A`) + Lilac (`#E9D5FF`) | Sekolah Prestisius, Berasrama, Keunggulan Riset |
| **Crimson** | Burgundy (`#5B1321`) + Blush Rose (`#FFE4E6`) | Sekolah Olahraga, Seni & Budaya, Semangat Juang |
| **Earth** | Espresso (`#3E2723`) + Soft Sand (`#D7CCC8`) | Sekolah Vokasi/SMK Pertanian, Kriya, Humaniora |
| **Minimal** | Zinc Dark (`#18181B`) + Slate (`#E4E4E7`) | Sekolah Internasional, Desain Bersih & Elegan |

Untuk mengubah tema dan warna, cukup buka panel admin di menu **`/admin/pengaturan`** > **Identitas Visual**.

---

## 💻 Perintah CLI Proyek

| Perintah | Deskripsi |
| :--- | :--- |
| `bun run dev` | Menjalankan server pengembangan lokal (`http://localhost:4321`) |
| `bun run build` | Melakukan build produksi untuk target Cloudflare Workers |
| `bun run preview` | Menjalankan preview lokal hasil build produksi |
| `bun run db:push` | Menerapkan skema Drizzle ORM ke basis data Turso |
| `bun run db:generate` | Membuat berkas migrasi SQL baru di folder `drizzle/` |
| `bun run db:seed` | Mengisi database dengan data demo dan pengaturan awal sekolah |

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi **MIT License**. Sekolah atau institusi pendidikan bebas menggunakan, memodifikasi, dan menyebarkan kode sumber ini untuk keperluan pendidikan non-komersial maupun komersial.

---

<p align="center">
  Dibuat dengan dedikasi untuk memajukan digitalisasi pendidikan sekolah di seluruh Indonesia 🇮🇩
</p>
