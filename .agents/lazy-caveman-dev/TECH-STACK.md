# Tech Stack & Architecture Contract

Kontrak teknis proyek `super-cms-sekolah`. Melengkapi `SKILL.md` (perilaku agen) dan `DESIGN-SYSTEM.md` (aturan UI/UX).

---

## 1. Stack Inti & Versi

| Lapisan | Teknologi | Versi / Sumber | Catatan Wajib |
| :--- | :--- | :--- | :--- |
| **Meta-Framework** | Astro | `^7.4.2` | SSR/hybrid; `build.inlineStylesheets: 'always'` di `astro.config.mjs` |
| **Adapter Runtime** | `@astrojs/cloudflare` / `@astrojs/node` | `^14.4.2` / `^11.1.9` | `cloudflare` saat `build`/`preview` (`nodejs_compat`), `node` saat `dev` |
| **API Engine** | Hono | `^4.13.13` | `new Hono().basePath('/api')` di `src/server/index.ts`, di-mount via `src/pages/api/[...hono].ts` |
| **Validasi** | Zod + `@hono/zod-validator` | `^4.6.7` / `^0.9.1` | Validasi input server-side di endpoint API |
| **Database** | Turso / LibSQL (`@libsql/client`) | `^0.18.0` | Fallback lokal `file:local.db`; `libsql://` dinormalisasi ke `https://` |
| **ORM & Migrasi** | Drizzle ORM + Drizzle Kit | `^0.45.4` / `^0.31.11` | Skema tunggal di `src/db/schema.ts` (27 tabel) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | `^4.3.3` | CSS-first `@theme` di `src/styles/global.css` |
| **Ikon** | `astro-icon` + `SvgSprite.astro` | `^1.2.0` | Gunakan `<Icon name="..." />`, dilarang duplikasi inline SVG |
| **Rich Text Editor** | Tiptap | `^3.32.0` | Output disanitasi via `sanitizeArticleHtml` (`src/utils/sanitizeHtml.ts`) |
| **Animasi** | Anime.js | `^4.5.0` | Terpusat di `src/scripts/animePublic.ts` & `src/scripts/animeAdmin.ts` |
| **Auth & Token** | Web Crypto PBKDF2 + `jose` + Google OAuth | `jose ^6.2.18` | Session DB (`sessions`), rate limit (`loginAttempts`), RBAC (`super_admin` / `editor`) |
| **Object Storage** | `@aws-sdk/client-s3` | `^3.1156.0` | Cloudflare R2 / S3-compatible; pisahkan aset publik vs dokumen privat PPDB |
| **Spreadsheet** | `exceljs` & `xlsx` | `^4.4.0` / `^0.18.5` | Export/import data PPDB & kelulusan |
| **Runtime & Package Manager** | Bun (`bun`), Node `>=22.23.4`, `wrangler` | `^4.167.0` | Wajib gunakan `bun` untuk install dependensi dan menjalankan seluruh script (dilarang pakai `npm`) |

---

## 2. Aturan Arsitektur Backend & API

1. **Single API Entrypoint**: Seluruh endpoint REST ditempatkan di Hono (`src/server/**`) dan diekspos lewat `src/pages/api/[...hono].ts` (`prerender = false`). Jangan buat file API Astro terpisah kecuali callback OAuth (`src/pages/api/auth/**`).
2. **Edge-Safe Compatibility**: Semua utilitas server (hashing, crypto, token, storage) wajib kompatibel dengan **Cloudflare Workers (`workerd`)** dan **Node.js**. Gunakan Web Crypto API (`crypto.subtle`, `crypto.randomUUID()`), hindari modul Node-only yang tidak didukung `nodejs_compat`.
3. **Database Access**:
   - Gunakan query builder Drizzle ORM (`db.select`, `db.insert`, `db.update`, `db.delete`).
   - Dilarang string concatenation pada SQL.
   - Setiap perubahan skema dilakukan di `src/db/schema.ts`, lalu `bun run db:push` / `bun run db:generate`.
4. **Error Handling & Observability**:
   - Pertahankan `X-Correlation-ID` pada setiap request/response Hono.
   - Jangan pernah membocorkan stack trace, query DB, atau detail internal ke response error produksi (`app.onError`).
5. **Cache & Sanitasi**:
   - Panggil `invalidateSettingsCache()` setiap kali tabel `settings` dimutasi.
   - Konten HTML dari rich text editor wajib melewati `sanitizeArticleHtml()` sebelum disimpan atau dirender.

---

## 3. Aturan Keamanan, Auth & Storage

1. **RBAC & Sesi**:
   - Proteksi seluruh endpoint `/api/admin/*` dan halaman `/admin/*` (kecuali `/admin/login`) dengan verifikasi sesi + role (`super_admin` vs `editor`).
   - Password di-hash dengan PBKDF2 (`SHA-512`, `100000` iterations) dan dibandingkan dengan *constant-time comparison*.
   - Pertahankan pencatatan `auditLogs` untuk aksi sensitif (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`).
2. **Dokumen Privat vs Publik**:
   - Media umum disimpan dengan status `isPrivate: false`.
   - Berkas pendaftar PPDB (`fileKk`, `fileAkta`, `fileSkl`, `fileAdditional`) wajib ditangani lewat `src/server/ppdbStorage.ts` dan hanya boleh diakses oleh admin terautentikasi atau pemilik dengan `verificationCode` yang valid.
3. **Secrets & Environment**:
   - Dilarang hardcode secret produksi, API key, atau token di kode klien/server.
   - Selalu rujuk `.env.example` (`TURSO_*`, `R2_*`, `GOOGLE_CLIENT_*`, `SESSION_SECRET`, `OWNER_ADMIN_EMAIL`).

---

## 4. Perintah Proyek Resmi (Bun)

```bash
bun install          # Install dependensi (dilarang menggunakan npm)
bun run dev          # Astro dev server (Node adapter)
bun run build        # Production build (Cloudflare adapter)
bun run preview      # Preview production build
bun run db:generate  # Generate Drizzle migration
bun run db:push      # Push skema ke Turso/SQLite
bun run db:seed      # Jalankan src/db/seed.ts via Bun
```
