# MASTER PRD FRAMEWORK (AI ZERO-MISTAKE & 5-WHYS SPECIFICATION)

Dokumen ini adalah **kontrak spesifikasi universal** untuk membangun proyek apa pun (Absensi Sekolah, Manajemen Keuangan, Inventaris, PPDB, Layanan Desa, dll.) agar AI tidak menebak-nebak, tidak melewatkan edge-case, dan langsung menyelesaikan akar masalah.

---

## 0. PROTOKOL EKSEKUSI AI (WAJIB DIPATUHI SEBELUM CODING)

Saat pengguna memberi perintah singkat (contoh: *"Saya mau buat absensi siswa menggunakan QR code dengan jumlah siswa 300-an siswa"* atau *"Buat sistem manajemen keuangan kas"*):

1. **DILARANG langsung menulis kode** sebelum seluruh bagian PRD (Bagian 1–9) terisi untuk proyek tersebut.
2. **Wajib turunkan setiap masalah minimal 5 level `Why`** hingga menyentuh akar masalah teknis/operasional, bukan gejalanya.
3. **Wajib kunci ambiguitas** (tanyakan maksimal 3–5 pertanyaan kritis jika ada keputusan arsitektur bercabang yang berdampak besar, misal: *QR statis di kartu pelajar vs QR dinamis di layar guru?*).
4. **Wajib hitung skala & burst concurrency** dari angka yang disebut user (misal 300 siswa masuk jam 06:45–07:00 ≠ 300 request merata 24 jam).
5. **Wajib pakai tipe data aman** (uang = integer/decimal presisi, dilarang float; nomor identitas seperti NISN/NIK = string; tanggal/jam = ISO 8601 + timezone eksplisit).

---

## 1. IDENTITAS, TUJUAN & BATASAN PROYEK

Isi blok ini di awal setiap proyek baru:

```yaml
PROJECT_NAME: "[Nama Proyek]"
DOMAIN: "[Absensi | Keuangan | Inventaris | Akademik | Layanan Publik | Lainnya]"
PROBLEM_STATEMENT: "[1-2 kalimat masalah utama yang ingin diselesaikan]"
TARGET_USERS: "[Daftar aktor: Admin, Guru/Petugas, Siswa/Anggota, Pimpinan, Orang Tua]"
TECH_STACK: "[Rujuk TECH-STACK.md atau isi stack target]"
IN_SCOPE:
  - "[Fitur yang wajib ada di fase ini]"
OUT_OF_SCOPE:
  - "[Fitur yang sengaja TIDAK dibuat agar scope tidak melebar]"
```

---

## 2. ANALISIS AKAR MASALAH — METODE 5-WHYS (WAJIB 5 LEVEL)

Setiap fitur inti harus berasal dari analisis 5-Whys. Dilarang berhenti di Why ke-2 atau ke-3, dan **dilarang berhenti hanya di level teknis**.

Wajib lakukan **2 lapis 5-Whys**:
1. **5-Whys Lapangan (Manusia & Operasional):** Menggali akar masalah nyata di dunia pengguna (mengapa kejadian itu terus berulang di lapangan?) → menentukan **fitur produk & kebijakan sistem** yang benar-benar membantu.
2. **5-Whys Teknis (Arsitektur & Sistem):** Menggali potensi kegagalan aplikasi/server/UX → menentukan **arsitektur & guardrails kode**.

### Template 5-Whys
```markdown
### Masalah #[N]: [Gejala / Masalah di Lapangan]
- **Why 1 (Mengapa gejala terjadi?):** ...
- **Why 2 (Mengapa penyebab 1 terjadi?):** ...
- **Why 3 (Mengapa penyebab 2 terjadi?):** ...
- **Why 4 (Mengapa penyebab 3 terjadi?):** ...
- **Why 5 (Akar Masalah / Root Cause):** ...
- **Solusi Sistem Wajib (Memutus Why 5):** [Fitur/keputusan produk atau teknis spesifik]
```

### Contoh Referensi Terisi: Kasus "Absensi Siswa QR Code (~300 Siswa)"

#### A. 5-Whys Lapangan (Operasional & Manusia)
- **Masalah #1: Siswa sering datang terlambat ke sekolah**
  - **Why 1 (Mengapa anak telat?):** Karena berangkat ke sekolah dengan berjalan kaki.
  - **Why 2 (Mengapa jalan kaki padahal rumahnya jauh?):** Karena orang tuanya tidak punya motor/kendaraan.
  - **Why 3 (Mengapa tidak punya motor?):** Karena keluarga kurang mampu secara ekonomi.
  - **Why 4 (Mengapa tidak berangkat lebih pagi agar tidak telat?):** Karena tidak ada yang membangunkan di rumah (ibunya sudah bekerja pagi/lupa).
  - **Why 5 (Root Cause):** Keterlambatan bukan semata soal disiplin, melainkan gabungan faktor ekonomi/transportasi dan tidak adanya pengingat pagi di rumah; sistem yang hanya menandai `TERLAMBAT` lalu menghukum siswa tidak menyelesaikan akar masalah.
  - **Solusi Sistem Wajib:**
    1. Saat scan `TERLAMBAT`, sediakan **alasan/kategori keterlambatan terstruktur** (misal: *Kendala Transportasi / Jarak Jauh / Bangun Kesiangan / Hujan / Sakit*) + catatan singkat petugas.
    2. **Notifikasi/Rekap ke Orang Tua** (WA/pesan status harian atau mingguan) agar wali murid sadar pola telat anak dan ikut mengingatkan lebih pagi.
    3. **Laporan Pola Keterlambatan** untuk BK/Wali Kelas (filter siswa yang sering telat karena kendala jarak/ekonomi agar sekolah bisa memberi kebijakan/bantuan tepat sasaran, bukan sekadar sanksi).

#### B. 5-Whys Teknis (Sistem & Arsitektur)
- **Masalah #2: Antrean panjang dan macet di gerbang saat jam masuk (06:45–07:00)**
  - **Why 1:** Proses scan QR memakan waktu 10–15 detik per siswa.
  - **Why 2:** Aplikasi menunggu response server + reload halaman/kamera ulang setiap satu kali scan.
  - **Why 3:** Kamera scanner di-mount ulang atau tidak ada local feedback instan & antrean asinkron.
  - **Why 4:** Arsitektur frontend dibuat request-blocking (1 scan = 1 roundtrip sinkron ke DB sebelum siap scan berikutnya).
  - **Why 5 (Root Cause):** Sistem tidak memisahkan *capture/decode QR* (harus <200ms lokal) dari *sinkronisasi DB*, serta tidak punya mode *continuous scan* dengan cooldown per siswa.
  - **Solusi Sistem Wajib:** Scanner kamera kontinyu (*continuous loop*), audio/visual feedback instan (<200ms), *cooldown* 60 detik per ID siswa agar tidak double-scan, dan antrean retry otomatis jika koneksi gerbang lambat.

- **Masalah #2: Siswa titip absen pakai foto/screenshot QR code**
  - **Why 1:** Siswa bisa memindai QR milik temannya dari jarak jauh atau lewat WhatsApp.
  - **Why 2:** QR code bersifat statis permanen dan tidak terikat waktu maupun perangkat/petugas.
  - **Why 3:** Tidak ada token kedaluwarsa (TTL) atau verifikasi konteks saat pemindaian.
  - **Why 4:** Desain awal hanya menyamakan QR = `student_id` mentah.
  - **Why 5 (Root Cause):** Identitas pada QR tidak dipisahkan dari *proof of presence* (bukti kehadiran fisik).
  - **Solusi Sistem Wajib:** Pilih salah satu arsitektur tegas:
    - *Model A (Petugas/Kiosk Scan Kartu Siswa):* QR kartu berisi signed token `student_id`, tapi **hanya perangkat/akun petugas/kiosk terautentikasi** yang boleh menembak endpoint `/scan` (siswa tidak bisa absen mandiri dari HP sendiri).
    - *Model B (Siswa Scan Layar Kelas):* QR di layar guru/kiosk memakai **TOTP/HMAC rotating token** (berubah tiap 15–30 detik) + wajib login akun siswa + validasi lokasi/IP jaringan sekolah.

- **Masalah #3: Rekap absensi bulanan terlambat dan sering selisih**
  - **Why 1:** Wali kelas/TU masih merekap manual dari catatan kertas atau export mentah.
  - **Why 2:** Data scan harian tidak otomatis diklasifikasikan (Hadir, Terlambat, Izin, Sakit, Alpha).
  - **Why 3:** Sistem tidak menyimpan aturan jam masuk/toleransi keterlambatan dan hari libur sekolah.
  - **Why 4:** Pencatatan izin/sakit terpisah dari tabel absensi utama (lewat chat WA ke guru).
  - **Why 5 (Root Cause):** Tidak ada *Single Source of Truth* (SSOT) yang menggabungkan rule kalender akademik, log scan QR, dan input Izin/Sakit wali kelas dalam satu tabel status harian.
  - **Solusi Sistem Wajib:** Tabel `attendance_records` unik per `(student_id, date)`, aturan jam batas `late_threshold` di `settings`, form input Izin/Sakit oleh wali kelas/admin, dan generator status `ALPHA` otomatis untuk siswa yang belum punya record setelah jam tutup.

---

## 3. PEMODELAN SKALA, CONCURRENCY & PERFORMA

AI wajib menghitung angka berikut sebelum memilih arsitektur DB & API:

| Parameter | Cara Hitung / Pertanyaan Wajib | Contoh (Absensi 300 Siswa) |
| :--- | :--- | :--- |
| **Total Entitas Aktif** | Berapa user/baris master data? | ~300 siswa, ~30 guru, 10–12 kelas |
| **Peak Concurrency (Burst)** | Kapan semua user akses bersamaan? | 300 siswa dalam 15 menit = rata-rata 20 scan/menit, burst 3–5 scan/detik saat bel masuk |
| **Pertumbuhan Data / Tahun** | Baris transaksi per hari × hari aktif | 300 × 240 hari = ~72.000 baris/tahun (aman untuk SQLite/LibSQL/Postgres dengan index tepat) |
| **Target Latency API** | Batas respon maksimal endpoint kritis | Endpoint `/scan` wajib `< 300ms` p95 |
| **Strategi Optimasi** | Index komposit, caching master data, batching | Index unik `(student_id, date)`, cache aturan jam masuk di memori/edge |

---

## 4. MATRIKS PERAN PENGGUNA (RBAC) & BATAS AKSES

Dilarang membuat role tanpa matriks izin eksplisit.

| Role | Akses Baca (Read) | Akses Tulis (Create/Update) | Akses Hapus / Sensitif | Larangan Keras |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Semua data, log audit | Master data, user, pengaturan jam/aturan | Hapus/arsip data, export laporan | Tidak boleh hapus log audit |
| **Petugas / Guru / Bendahara** | Data kelas/unit binaan atau sesuai tugas | Scan absensi, input izin/sakit, catat transaksi | Tidak boleh ubah aturan sistem / role | Tidak boleh edit transaksi yang sudah ditutup/dikunci |
| **Siswa / Anggota / User Biasa** | **Hanya data miliknya sendiri** | Profil terbatas (jika diizinkan) | Tidak ada | **Dilarang keras** akses data orang lain (Anti-IDOR) |

---

## 5. ARSITEKTUR DATA & STATE MACHINE (ZERO AMBIGUITY)

### 5.1 Aturan Desain Skema Database
1. **Primary Key**: Gunakan `UUID v4` (string) untuk data sensitif/publik agar tidak bisa ditebak (anti-enumerasi), atau `autoIncrement` integer hanya untuk data internal non-sensitif.
2. **Tipe Data Kritis**:
   - **Uang / Nominal Keuangan**: WAJIB `integer` (dalam satuan terkecil, misal Rupiah penuh tanpa desimal atau sen), **DILARANG KERAS** `float`/`real` (menghindari floating-point rounding bug).
   - **Nomor Identitas (NISN, NIK, NIP, No. Rekening, No. HP)**: WAJIB `text`/`varchar`, **DILARANG** `integer` (angka nol di depan akan hilang dan rawan overflow).
   - **Tanggal & Waktu**: Simpan dalam format ISO 8601 (`YYYY-MM-DD` untuk tanggal bisnis lokal, `ISO timestamp` / Unix epoch UTC untuk waktu kejadian), dengan timezone referensi eksplisit (misal `Asia/Jakarta`).
3. **Unique Constraints & Integritas**:
   - Wajib definisikan `UNIQUE` di level database untuk mencegah race condition (contoh Absensi: `UNIQUE(student_id, attendance_date)` — 1 siswa hanya boleh punya 1 record per hari; contoh Keuangan: `UNIQUE(invoice_number)` atau `idempotency_key`).
4. **Riwayat & Audit**:
   - Data keuangan dan absensi resmi **tidak boleh dihapus permanen** (`DELETE` fisik dilarang untuk transaksi valid). Gunakan `void`/`cancelled` + `audit_logs` (mencatat `actor_id`, `action`, `before_json`, `after_json`, `reason`, `ip_address`, `created_at`).

### 5.2 State Machine (Transisi Status Wajib)
Setiap entitas berstatus wajib punya diagram transisi yang di-enforce di backend:

*Contoh Absensi Harian:*
- Belum ada record → `HADIR` (scan <= jam batas) atau `TERLAMBAT` (scan > jam batas) atau `IZIN`/`SAKIT` (input wali kelas/admin)
- Setelah jam cutoff → siswa tanpa record otomatis menjadi `ALPHA`
- Perubahan status setelah `LOCKED` (akhir bulan) → ditolak kecuali oleh `Super Admin` dengan alasan wajib di `audit_logs`.

*Contoh Transaksi Keuangan:*
- `DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`
- `APPROVED` tidak bisa diedit nominalnya; koreksi hanya lewat transaksi pembalik (`VOID` / `ADJUSTMENT`) agar saldo selalu akurat (*immutable ledger*).

---

## 6. KONTRAK API, VALIDASI & EDGE CASES

### 6.1 Standar Endpoint & Validasi
- Setiap endpoint menerima input tervalidasi ketat (Zod / schema validator) di server. Client validation hanyalah UX, **server validation adalah hukum**.
- Setiap mutasi kritikal (pembayaran, transfer, scan masuk) wajib mendukung **Idempotency** (mengabaikan atau mengembalikan hasil sukses yang sama jika request identik terkirim 2x karena klik ganda atau retry jaringan).

### 6.2 Daftar Edge Cases Wajib Ditangani (Checklist Per Domain)

- **Umum (Semua Proyek):**
  - [ ] Double-click tombol submit / retry network lambat
  - [ ] Akses lintas role / tebak ID milik user lain (IDOR)
  - [ ] Perbedaan jam perangkat client vs jam server (**selalu pakai waktu server** sebagai penentu sah)
  - [ ] Pagination & pencarian pada data > 1.000 baris (dilarang `SELECT *` tanpa `LIMIT`)
  - [ ] Export Excel/CSV wajib menormalkan karakter formula injection (`=`, `+`, `-`, `@` di awal sel)

- **Domain Absensi:**
  - [ ] Siswa scan 2x dalam 1 menit (cooldown / idempotent return: *"Sudah tercatat Hadir pukul 06:52"*)
  - [ ] QR rusak / tidak terbaca → wajib ada fallback input manual NIS/NISN oleh petugas
  - [ ] Hari libur / akhir pekan → sistem menolak atau menandai libur sesuai kalender
  - [ ] Koneksi internet gerbang putus sebentar → queue lokal + sync saat online (atau feedback error jelas tanpa hang)
  - [ ] Siswa pindah kelas / lulus / nonaktif → tidak ikut terhitung `ALPHA`

- **Domain Manajemen Keuangan:**
  - [ ] Race condition saldo (2 transaksi bersamaan membuat saldo minus) → gunakan **database transaction + atomic update / row lock**
  - [ ] Pembulatan angka / desimal → pakai integer
  - [ ] Hapus/edit transaksi lama → dilarang, wajib pakai mekanisme `VOID` + jurnal pembalik
  - [ ] Selisih laporan harian vs bulanan → semua laporan dihitung dari satu tabel ledger (`SUM` terverifikasi), bukan angka cache yang tidak sinkron

---

## 7. KEAMANAN, PRIVASI & INTEGRITAS

1. **Autentikasi & Session**: Password di-hash kuat (PBKDF2/Argon2/bcrypt), session HTTP-only cookie, rate limit login (`login_attempts` lock setelah X kali gagal).
2. **Otorisasi (Zero Trust)**: Setiap API route mengecek `session` + `role` + `ownership` sebelum menyentuh DB.
3. **Proteksi Input/Output**: Validasi MIME & ukuran file upload di server, sanitasi HTML, parameterized query ORM (anti-SQLi), proteksi CSV/Excel formula injection.
4. **Privasi Data (PII)**: Data sensitif (NIK, no HP orang tua, rincian gaji/tunggakan) tidak boleh terekspos di endpoint publik atau log error.
5. **Error Handling**: Response error produksi tidak boleh menampilkan stack trace atau struktur tabel DB.

---

## 8. ALUR UI/UX & 4 STATE WAJIB

Setiap halaman/komponen data wajib mendesain 4 kondisi berikut:
1. **Loading State**: Skeleton atau spinner terukur (tanpa layout shift).
2. **Empty State**: Pesan jelas + tombol aksi utama jika data kosong.
3. **Error State**: Pesan error ramah pengguna + tombol coba lagi (tanpa error mentah teknis).
4. **Success / Active State**: Feedback instan (toast/status badge/suara beep untuk scanner QR).

Jika menggunakan scanner kamera/mobile:
- Wajib minta izin kamera dengan panduan jelas jika ditolak.
- Layout mobile-first, tombol sentuh minimal `44x44px`, kontras tinggi untuk pemakaian di luar ruangan (gerbang sekolah).

---

## 9. ACCEPTANCE CRITERIA & VERIFICATION MATRIX

Setiap fitur dianggap **SELESAI** hanya jika lolos skenario berikut:

```markdown
### AC-01: [Nama Skenario Happy Path]
- **Given:** [Kondisi awal]
- **When:** [Aksi dilakukan]
- **Then:** [Hasil yang diharapkan di UI & Database]

### AC-02: [Nama Skenario Edge Case / Duplikasi]
- **Given:** [Misal siswa sudah scan 10 detik lalu]
- **When:** [Scan ulang QR yang sama]
- **Then:** [Server tidak membuat baris baru, UI menampilkan status sudah absen]

### AC-03: [Nama Skenario Keamanan / Akses Ilegal]
- **Given:** [User role Siswa login]
- **When:** [Mencoba hit endpoint admin / melihat data siswa lain]
- **Then:** [HTTP 403 Forbidden]
```

**Verifikasi Wajib Sebelum Selesai:**
1. Typecheck / lint bersih tanpa error.
2. Build produksi sukses.
3. Uji seluruh skenario AC-01 s.d. AC-N (minimal test unit/integrasi pada logika bisnis kritis seperti perhitungan saldo & validasi scan).

---

## 10. CARA PAKAI CEPAT (PROMPT TRIGGER)

Saat memulai proyek baru, cukup kirim pesan ke AI dengan format:

```text
Baca @prd.md.
Saya ingin membuat: [deskripsi singkat proyek, misal: "absensi siswa menggunakan QR code untuk ~300 siswa"].
Tech stack: [sebutkan stack atau rujuk @TECH-STACK.md].

Tugasmu sekarang:
1. Turunkan seluruh masalah inti dengan metode 5-Whys.
2. Lengkapi seluruh bagian PRD (Bagian 1–9) secara spesifik untuk proyek ini.
3. Ajukan pertanyaan klarifikasi jika ada ambiguitas arsitektur.
4. JANGAN menulis kode aplikasi sebelum PRD ini saya setujui.
```
