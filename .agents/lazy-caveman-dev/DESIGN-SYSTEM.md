# MASTER DESIGN SYSTEM: EDITORIAL PRECISION (TAILWIND CSS v4)
*Kombinasi Genesis Editorial Precision & Anti-Vibe-Coded Architecture*

---

## 1. Peran & Prinsip Inti

1. **Editorial Precision**: Desain tenang, berwibawa, berorientasi konten (*content-first*), tipografi display kuat (*bold geometric*), spasi lega (*breathing room*), dan kartu berbingkai presisi 1px.
2. **Anti-Vibe-Coded**: Tanpa gradient ungu/pink generik AI, tanpa glow neon tanpa alasan, tanpa bento grid berlebihan, tanpa animasi looping tanpa fungsi, dan DILARANG KERAS menggunakan dot/lingkaran dekoratif generik (`<span class="h-2 w-2 rounded-full ..."></span>`) di dalam badge, overline, maupun pill status.
3. **Fungsional & Terukur**: Setiap warna, border, radius, shadow, dan jarak memiliki peran semantik yang jelas.
4. **Tailwind CSS v4 Native**: Didefinisikan secara deklaratif menggunakan direktif `@theme` CSS-first.
5. **PERINGATAN KERAS PENGGUNAAN WARNA (ZERO RAW PALETTE TOLERANCE)**:
   DILARANG KERAS membuat atau memakai utility color bawaan Tailwind seperti `bg-amber-*`, `text-amber-*`, `border-amber-*`, `border-blue-*`, `text-blue-*`, `border-emerald-*`, `text-emerald-*`, `bg-emerald-*`, `border-rose-*`, `text-rose-*`, `bg-rose-*`, `slate-*`, dsb., maupun warna arbitrary/ad-hoc lainnya. WAJIB 100% memakai token theme variabel yang sudah didefinisikan di `src/styles/global.css` (seperti `primary`, `secondary`, `tertiary`, `accent`, `surface`, `surface-subtle`, `background`, `border`, `border-subtle`, `heading`, `body`, `muted`, `disabled`, `success`, `success-light`, `success-text`, `warning`, `warning-light`, `warning-text`, `error`, `error-light`, `error-text`, `white`).
6. **DILARANG KERAS MENGGUNAKAN INLINE `style="..."` (ZERO INLINE STYLE TOLERANCE)**:
   Seluruh penataan visual, dimensi, warna, layout, dan visibilitas WAJIB 100% menggunakan Tailwind CSS utility classes yang telah disediakan sistem token. Dilarang keras menulis atribut `style="..."` ad-hoc di elemen HTML (seperti `style="display: none;"`, `style="width: 28%;"`, `style="color: #047857;"`). Untuk kontrol visibilitas interaktif via JavaScript, gunakan manipulasi class Tailwind (misal: `el.classList.add("hidden")` dan `el.classList.remove("hidden")`).
7. **SENTRALISASI STYLING DOKUMEN & DILARANG MENARUH BLOK `<style>` DUPLIKAT PER-HALAMAN**:
   Dilarang keras menyalin atau menaruh blok `<style>` di dalam `<head>` halaman secara terpisah-pisah (seperti template cetak A4, aturan `@page`, `@media print`, dsb.). Seluruh styling global, stylesheet engine cetak resmi A4, media queries cetak, dan isolasi kanvas dokumen (`#a4-sheet-container`, `.a4-container`) WAJIB dipusatkan di `src/styles/global.css`. Setiap halaman hanya perlu mengimpor `src/styles/global.css` dan menggunakan class semantiknya.
8. **DILARANG KERAS MENDUPLIKASI ROOT HTML BOILERPLATE (ZERO REDUNDANT ROOT HTML TOLERANCE)**:
   Dilarang keras menulis manual deklarasi `<!doctype html>`, `<html lang="id">`, `<head>`, dan `<body>` secara berulang di file halaman individual (`src/pages/**`). Seluruh struktur root HTML WAJIB dikapsulasi ke dalam komponen Layout terpusat (`Layout.astro`, `AdminLayout.astro`, atau layout khusus cetak seperti `PrintLayout.astro`). Setiap halaman hanya bertindak sebagai pengisi konten (`<slot />`).
9. **KEBIJAKAN LATAR KARTU SOLID & ANTI-TRANSPARANSI RENDAH (SOLID CARD SURFACE POLICY)**:
   Seluruh kartu statistik (KPI), panel data, kartu artikel, dan widget UI WAJIB 100% menggunakan permukaan solid dengan batas presisi 1px `border`.
   - **Pola A (Neutral Solid)**: Menggunakan `bg-surface border-border` dengan aksen status pada teks angka metrik (`text-success`, `text-warning`, `text-error`).
   - **Pola B (Multi-Color Solid KPI)**: Jika kartu KPI/statistik memerlukan diferensiasi warna latar yang kontras (seperti di Dashboard Utama dan Panel Kelulusan), gunakan warna solid penuh berbasis token tema semantik (`bg-primary border-primary text-primary-foreground`, `bg-success border-success text-white`, `bg-secondary border-secondary text-secondary-foreground`, `bg-warning border-warning text-white`, `bg-error border-error text-white`).
   - **DILARANG KERAS**: Menggunakan latar belakang transparansi rendah (`bg-white/10`, `bg-white/50`, `bg-surface/50`, `bg-surface/60`, `backdrop-blur-*`) maupun mewarnai badan kartu dengan utility tint status (`bg-success-light`, `bg-warning-light`, `bg-error-light`, `bg-primary-light`). Pada mode gelap (*dark mode*), latar transparan dan tint tipis menghasilkan visual kusam/berlumpur (*muddy*) serta merusak kontras tipografi. Selalu gunakan warna solid penuh yang terdefinisi pada token tema semantik.
10. **SENTRALISASI KOMPONEN PAGINATION (ZERO DUPLICATE PAGINATION TOLERANCE)**:
   Seluruh tabel data, direktori, berita, dan modul CMS/publik yang memiliki daftar data berhalaman WAJIB 100% menggunakan komponen terpusat `<Pagination />` (`src/components/Pagination.astro`) serta helper pendukung `src/utils/pagination.ts`. DILARANG KERAS menulis manual puluhan baris HTML markup tombol pagination dan duplikasi fungsi kalkulasi halaman berulang-ulang di setiap file halaman. Komponen mendukung dua mode resmi: Mode Link Server (`getPageUrl`) dan Mode Client-Side Zero-Load (`id` container + event delegation).
11. **STANDARISASI SWITCH TOGGLE STATUS (ZERO TEXT STATUS TOGGLE TOLERANCE)**:
   Seluruh kolom status aktif/nonaktif pada tabel CMS atau daftar data interaktif WAJIB menggunakan tombol switch toggle native (`role="switch"`, `aria-checked`, container `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out` dengan state aktif `bg-primary` dan inaktif `bg-border`, serta knob/thumb `pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs transition duration-200 ease-in-out` dengan translasi `translate-x-4` saat aktif dan `translate-x-0` saat inaktif). Dilarang menggunakan tombol teks biasa ("Aktif" / "Nonaktif") yang memakan ruang dan tidak memberikan visual interaktif instan.
12. **STANDARISASI TOMBOL TINDAKAN TABEL & HIERARKI (ICON-ONLY ACTION BUTTONS POLICY)**:
   Seluruh kolom "Tindakan" pada tabel data CMS serta baris hierarki item (seperti Menu Navbar, Kategori, Modul) WAJIB 100% menggunakan tombol berbasis ikon ringkas saja (Icon-Only Actions) seperti `<Icon name="edit" />` dan `<Icon name="trash" />`. DILARANG KERAS menggunakan tombol teks panjang ("Edit", "Hapus") yang memboroskan ruang horizontal tabel. Tombol wajib dibungkus kontainer DRY Tailwind v4 selector `*:` (contoh: `*:inline-flex *:h-7 *:w-7 *:items-center *:justify-center *:rounded-[6px] *:border *:transition-colors *:cursor-pointer`) dengan state hover terisolasi eksplisit pada elemen anak (`hover:text-primary hover:border-primary/40 hover:bg-surface-subtle` dan `hover:text-error hover:border-error/40 hover:bg-error-light`).
13. **LARANGAN PENGGUNAAN GARIS PEMISAH HORIZONTAL `border-b border-border` DAN `border-t border-border` (ZERO HORIZONTAL DIVIDER BORDER TOLERANCE)**:
   DILARANG KERAS menggunakan utility garis pemisah horizontal seperti `border-b border-border` dan `border-t border-border` di mana pun (baik pada header halaman, header section, card header/footer, modal header/footer, maupun pemisah antar komponen). Garis horizontal ad-hoc memotong ritme visual, menciptakan clutter, dan merusak konsep editorial spacing. Struktur layout WAJIB dipisahkan secara elegan menggunakan:
   - **Spasi Negatif / Breathing Room**: Margin dan padding natural (`space-y-6`, `pb-6`, `py-4`, `gap-4`).
   - **Kontur Kartu Solid Utuh**: Wadah kartu lengkap dengan 4 sisi border terbungkus rapi (`rounded-[8px] border border-border bg-surface`).
   - **Diferensiasi Background Lembut**: Kontras permukaan kanvas semantik (`bg-surface-subtle` vs `bg-surface`).
14. **STANDARISASI PENGGUNAAN IKON & TOMBOL SIMPAN INTERAKTIF (CENTRALIZED ICON & INTERACTIVE SAVE BUTTON POLICY)**:
   - **Sentralisasi Ikon**: Seluruh kebutuhan ikon di dalam proyek WAJIB 100% menggunakan komponen terpusat `<Icon name="..." />` (`src/components/Icon.astro`) yang merujuk pada sprite sheet SVG global (`src/components/SvgSprite.astro`). DILARANG KERAS menyalin path `<svg>` mentah inline berulang kali di berbagai halaman. Jika diperlukan ikon baru, daftarkan simbolnya terlebih dahulu ke dalam `<defs>` di `src/components/SvgSprite.astro`.
   - **Tombol Simpan Interaktif (3-State Feedback)**: Seluruh tombol aksi simpan data/pengaturan di halaman admin atau modal form WAJIB dilengkapi visual feedback terpadu (*zero layout shift*):
     - **Idle / Standby**: Ikon disket (`<Icon name="save" ... />`) + label "Simpan Perubahan" atau "Simpan Data".
     - **Loading / Proses**: Ikon spinner animasi (`<svg class="animate-spin" ...>`) + label "Menyimpan..." dan tombol disabled.
     - **Sukses / Tersimpan**: Ikon centang (`<Icon name="check" ... />`) + label "Tersimpan" / "✓ Tersimpan", yang otomatis kembali ke state Idle setelah 2–2.5 detik. Dilarang menampilkan popup alert/banner statis terpisah yang merusak atau menggeser tata letak form (*layout shift*).
15. **STANDARISASI ASSET IMAGE, LOADING PRIORITIES & CORE WEB VITALS (IMAGE & ASSET LOADING POLICY)**:
   - **Prioritisasi LCP (Largest Contentful Paint)**:
     - Gambar pahlawan (*Hero image*), banner slide pertama, serta gambar cover utama artikel/prestasi detail (`/berita/[slug]`, `/prestasi/[id]`) WAJIB menggunakan `loading="eager"` dan `fetchpriority="high"`.
     - DILARANG KERAS menggunakan `loading="lazy"` pada gambar pertama atau elemen kandidat LCP.
     - Gambar di bawah batas layar (*below-the-fold*), slide ke-2 dst, kartu artikel, galeri, avatar, dan fasilitas WAJIB menggunakan `loading="lazy"` dan `fetchpriority="low"` (atau omitted).
     - Pada hero slider multi-slide, slide ke-2 dst wajib menggunakan lazy evaluation (`data-src`) agar browser tidak mengunduh seluruh slide secara bersamaan saat *initial page load*.
   - **Dimensi Eksplisit & Pencegahan Pergeseran Tata Letak (Zero CLS)**:
     - Seluruh tag `<img>` WAJIB memiliki atribut eksplisit `width="..."` dan `height="..."` yang proporsional sesuai rasio aspek kontainernya (`aspect-video`, `aspect-[4/3]`, `aspect-[4/5]`, `aspect-square`). Dilarang keras membiarkan tag `<img>` tanpa atribut dimensi yang menyebabkan *layout shift* (CLS) saat gambar selesai diunduh.
     - Bungkus gambar dalam kontainer dengan rasio aspek tetap (`aspect-*`) dan warna dasar cadangan (`bg-surface-subtle`) serta terapkan `class="h-full w-full object-cover"`.
   - **Aksesibilitas Gambar, Tombol & Form Controls**:
     - Seluruh `<img>` konten WAJIB memiliki atribut `alt` yang deskriptif dan dinamis (`alt={item.title}`, `alt={teacher.name}`).
     - Tautan `<a>` yang hanya membungkus gambar kartu WAJIB dilengkapi `aria-label={item.title}` agar dapat diidentifikasi oleh pembaca layar (*screen reader*).
     - Elemen `<button>` DILARANG KERAS ditulis *self-closing* (`<button ... />` adalah syntax invalid yang merusak parser DOM HTML5). Selalu gunakan penutup berpasangan `<button ...></button>`.
     - Seluruh input form, search box, dan select WAJIB memiliki label visual atau atribut `aria-label` deskriptif.
     - Seluruh elemen `<iframe>` (seperti peta Google Maps) WAJIB memiliki atribut `title` deskriptif.
   - **Bebas Rantai Pemblokir Render (Zero Render-Blocking Waterfall)**:
     - DILARANG KERAS menggunakan `@import url("https://fonts.googleapis.com/...")` di dalam file CSS (`global.css`). Seluruh font dan aset eksternal WAJIB dimuat melalui tag `<link rel="preconnect">` dan `<link rel="stylesheet">` di `<head>` layout terpusat (`Layout.astro`).
16. **STANDARISASI SISTEM ANIMASI TRANSISI & SCROLL REVEAL (ANIME.JS & GENTLE PHYSICS POLICY)**:
   - **Engine Terpusat**: Seluruh scroll reveal, hero entrance, animasi counter metrik dinamis, dan kartu staggered WAJIB 100% menggunakan engine terpusat Anime.js (`src/scripts/animePublic.ts` dan `src/scripts/animeAdmin.ts`).
   - **Kurva Gerak Landai (Prinsip Bukit & Lembah - `inOutSine`)**:
     - DILARANG KERAS menggunakan easing yang melesat kencang lalu mengerem mendadak (seperti `outQuart`, `outExpo`) yang membuat animasi berakhir terlalu cepat dan terasa patah/kaku.
     - WAJIB menerapkan prinsip gerak landai menggunakan kurva harmonik `inOutSine` dengan durasi 850ms–1000ms:
       1. **Siap muncul dengan landai**: Percepatan awal bertahap dan halus (slope perlahan dari 0).
       2. **Meluncur tenang terus-menerus**: Kecepatan konstan mengalir di tengah layaknya sepeda menuruni lembah perbukitan.
       3. **Menempel dengan landai**: Perlambatan pendaratan gradual (*zero-impact soft landing*) tanpa sentakan atau rem mendadak.
   - **Per-Property Duration (Pemisahan Durasi Opacity vs Translate)**:
     - WAJIB membedakan durasi antara `opacity` dan `translateY` untuk menjaga ketegasan keterbacaan teks (*anti-ghosting*):
       - `opacity`: **450ms–480ms** (`outSine`) agar teks dan gambar langsung jelas terbaca sejak awal.
       - `translateY`: **920ms–1000ms** (`inOutSine`) agar pergerakan fisik tetap lambat, anggun, dan landai.
   - **Hierarki Massa & Inersia Visual**:
     - Elemen besar/utama (Featured news, Ketua Umum OSIS, Prestasi utama) memiliki durasi fisik lebih berbobot (**1000ms**).
     - Elemen kecil pendukung dan kartu grid bergelombang berdurasi **920ms**.
   - **Pola Delay Gelombang (Wave) & Sekuensial 1 Besar + 4 Kecil**:
     - **Multi-Card Grid (4–5 kartu)**: Terapkan jeda gelombang (*wave delay*) bertingkat 100ms–130ms antar kartu (misal: Ekskul, Fasilitas, Guru, Agenda).
     - **Komposisi 1 Besar + 4 Kecil (Berita, Prestasi, Galeri, OSIS)**: Kartu besar muncul di `100ms`, disusul kartu kecil satu per satu secara sekuensial di `240ms`, `360ms`, `480ms`, `600ms`.
   - **Bidirectional Scroll Support (Scroll ke Bawah & ke Atas)**:
     - Animasi WAJIB aktif dua arah. Observer otomatis me-reset state elemen ketika keluar jauh dari layar (>100px) sehingga elemen kembali meluncur masuk secara responsif (`translateY: [24px, 0]` saat scroll ke bawah, `translateY: [-20px, 0]` saat scroll ke atas).
17. **STANDARISASI SLIDER INFINITE LOOPING TANPA BATAS & TOUCH/DRAG GESTURE (INFINITE TRIPARTITE CAROUSEL POLICY)**:
   - **Looping Mulus Tanpa Batas (Zero Rewind / Zero Reset Jump)**:
     - Seluruh carousel/slider konten horizontal (seperti Slider Guru, Testimoni Alumni, Mitra Industri & Kampus Favorit) WAJIB menerapkan perputaran tanpa batas (*seamless infinite loop*).
     - DILARANG KERAS menggunakan mekanisme rewind melompat kasar ke awal (`scrollTo({ left: 0 })` saat mencapai ujung track) yang merusak kontinuitas visual (*jarring reset jump*).
     - Wajib menerapkan arsitektur **Tripartite Cloned Sets** (duplikasi array data menjadi 3 set identik: set awal, set tengah aktif, set akhir) dengan normalisasi posisi scroll otomatis (`normalizePosition`) tanpa animasi saat melintasi batas set, sehingga carousel meluncur terus maju secara abadi tanpa pernah terlihat mengulang dari awal.
   - **Dukungan Gesture Layar Sentuh & Mouse Drag (Touch & Drag First)**:
     - Slider WAJIB dapat digulir dan digeser bebas menggunakan gestur sentuhan jari pada layar sentuh (*mobile touch swipe*) maupun drag kursor mouse di desktop (`cursor-grab active:cursor-grabbing select-none`), tanpa mengharuskan pengguna mengeklik tombol navigasi panah.
     - Kontrol panah prev/next hanya bertindak sebagai pelengkap aksesibilitas sekunder.
   - **Autoplay dengan Smart Pause**:
     - Autoplay berjalan perlahan dan halus (3200ms–4500ms per langkah).
     - Autoplay WAJIB otomatis berhenti (*pause*) seketika saat pointer mouse masuk (*mouseenter*), saat tombol mouse ditekan (*mousedown*), maupun saat layar disentuh (*touchstart*), dan otomatis melanjutkan putaran (*resume*) saat interaksi selesai (*mouseleave*, *mouseup*, *touchend*).

---

## 2. Tailwind CSS v4 Theme Specification

Letakkan konfigurasi token ini pada file utama CSS (misal `src/styles/global.css`):

```css
@import "tailwindcss";

@theme {
  /* ======================================================== */
  /* COLOR TOKENS: SEMANTIC & MULTI-TENANT THEME SYSTEM       */
  /* Default: Emerald Preset (#064734 / #E0FFC2 / #D9F45B)    */
  /* ======================================================== */

  /* 1. Primary (Identitas Utama - Tombol CTA, Navbar, Brand) */
  --color-primary: #064734;
  --color-primary-hover: #053a2b;
  --color-primary-light: #e6f3ee;
  --color-primary-foreground: #ffffff;

  /* 2. Secondary (Warna Pendukung - Badge, Sub-fitur, Aksen Lembut) */
  --color-secondary: #e0ffc2;
  --color-secondary-hover: #ccee9f;
  --color-secondary-light: #f7fee7;
  --color-secondary-foreground: #143823;

  /* 3. Tertiary (Warna Sorotan/Highlight, Metrik, Dekorasi) */
  --color-tertiary: #d9f45b;
  --color-tertiary-hover: #c4e03e;
  --color-tertiary-light: #f9fee0;
  --color-tertiary-foreground: #17251f;

  /* 4. Accent (Alias Kompatibilitas untuk Tertiary/Highlight) */
  --color-accent: #d9f45b;
  --color-accent-hover: #c4e03e;
  --color-accent-light: #f9fee0;
  --color-accent-foreground: #17251f;

  /* 5. Surface & Background (Light Mode) */
  --color-background: #f8faf8;
  --color-surface: #ffffff;
  --color-surface-subtle: #f0f4f1;
  --color-white: #ffffff;

  /* 6. Text & Typography */
  --color-heading: #17251f;
  --color-body: #32433b;
  --color-muted: #64746b;
  --color-disabled: #94a39b;

  /* 7. Borders */
  --color-border: #e2e9e4;
  --color-border-subtle: #edf2ee;

  /* 8. Feedback / Status */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Typography (Single Font Policy: Poppins Only) */
  --font-display: "Poppins", sans-serif;
  --font-body: "Poppins", sans-serif;
  --font-mono: "Poppins", sans-serif;

  /* Border Radius */
  --radius-tag: 4px;
  --radius-subtle: 6px;
  --radius-panel: 8px;
  --radius-card: 12px;
  --radius-pill: 9999px;

  /* Elevation & Shadows */
  --shadow-hairline: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-hover: 0 8px 30px rgba(0, 0, 0, 0.08);
  --shadow-button-glow: 0 4px 12px rgba(6, 71, 52, 0.35);
  --shadow-dropdown: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);

  /* Spacing Scale (4px base) */
  --spacing-grid-base: 4px;
}
```

---

## 2.1 Arsitektur Multi-Tenant Theme System (Identity vs Semantic Tokens)

Untuk mendukung banyak sekolah dengan identitas visual unik tanpa mengubah kode frontend, sistem memisahkan **Identitas Warna Sekolah** dari **Sistem Warna Antarmuka (Design Tokens)**:

### 1. Pembagian Peran
- **Warna Identitas (3 Warna Dikelola Sekolah)**:
  - `Primary`: Identitas utama (navbar, tombol aksi utama, link aktif).
  - `Secondary`: Pendukung (badge, section pendukung, tombol sekunder).
  - `Tertiary`: Aksen & sorotan (highlight, kartu statistik, dekorasi).
- **Warna Semantik (Dikelola Otomatis oleh Sistem)**:
  - `Background`, `Surface`, `Surface-subtle`
  - `Heading`, `Body`, `Muted`, `Disabled`
  - `Border`, `Border-subtle`
  - `Foreground` untuk setiap level identitas (`primary-foreground`, `secondary-foreground`, `tertiary-foreground`).

### 2. Auto-Generated Dark Mode & WCAG Contrast
Pengguna/admin tidak perlu merancang Dark Mode secara manual. Cukup pilih Preset atau masukkan 3 kode HEX identitas sekolah, sistem kalkulasi matematis (`src/utils/themeSystem.ts`) akan:
1. Menghitung *relative luminance* dan *contrast ratio* setiap warna.
2. Mengkalibrasi ulang tingkat kecerahan (*lightness*) agar kontras terhadap permukaan dark mode (`#101A16`, `#18251F`).
3. Menetapkan warna foreground (`#FFFFFF` atau near-black `#09090B`) yang dijamin memenuhi standar **WCAG AA (kontras minimal 4.5:1)**.

### 3. Preset Tema Bawaan (6 Pilihan)
| Preset | Primary | Secondary | Tertiary | Nuansa |
| :--- | :--- | :--- | :--- | :--- |
| **Emerald** (Default) | `#064734` (Deep Green) | `#E0FFC2` (Mint Soft) | `#D9F45B` (Volt Yellow) | Edukasi Islam/Madrasah, Segar, Berwibawa |
| **Ocean** | `#0F284E` (Deep Navy) | `#BAE6FD` (Sky Ice) | `#06B6D4` (Vibrant Cyan) | Teknologi, Negeri/Umum, Kredibel |
| **Royal** | `#3B1A5A` (Imperial Purple) | `#E9D5FF` (Soft Lilac) | `#F59E0B` (Amber Gold) | Prestisius, Keunggulan Akademik |
| **Crimson** | `#5B1321` (Burgundy) | `#FFE4E6` (Blush Rose) | `#F97316` (Vivid Orange) | Semangat, Keberanian, Olahraga |
| **Earth** | `#3E2723` (Warm Espresso) | `#D7CCC8` (Soft Sand) | `#E07A5F` (Terracotta) | Humanis, Budaya, Vokasi/SMK |
| **Minimal** | `#18181B` (Zinc Dark) | `#E4E4E7` (Cool Slate) | `#3B82F6` (Electric Blue) | Modern, Bersih, Editorial Minimalis |

### 4. Pilihan Mode Tampilan
1. **Light**: Selalu mode terang.
2. **Dark**: Selalu mode gelap.
3. **System**: Mengikuti preferensi OS/peramban (`prefers-color-scheme`).

### 5. Kompatibilitas Teks Putih (CSS Safeguard)
Untuk mencegah teks putih tidak terbaca saat warna latar sekunder atau tersier bernuansa terang, CSS global menyediakan *contrast safeguard rule*:
```css
.bg-primary.text-white, .bg-primary .text-white { color: var(--color-primary-foreground); }
.bg-secondary.text-white, .bg-secondary .text-white { color: var(--color-secondary-foreground); }
.bg-tertiary.text-white, .bg-tertiary .text-white { color: var(--color-tertiary-foreground); }
```
Hal ini menjamin 700+ utilitas `bg-primary`/`text-white` yang ada tetap terbaca sempurna di seluruh tema tanpa perlu refactoring manual ratusan file.

  /* Elevation & Shadows */
  --shadow-hairline: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-hover: 0 8px 30px rgba(0, 0, 0, 0.08);
  --shadow-button-glow: 0 4px 12px rgba(99, 102, 241, 0.35);
  --shadow-dropdown: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);

  /* Spacing Scale (4px base) */
  --spacing-grid-base: 4px;
}
```

---

## 3. Sistem Tipografi & Hierarki

Font dimuat dari penyedia resmi (Single Font Policy):
- **Display, Body/UI, & Monospace**: `Poppins` (Google Fonts) – bobot Regular (400), Medium (500), SemiBold (600), dan Bold (700). Seluruh antarmuka 100% menggunakan Poppins (font lain dilarang keras).

| Peran | Utility Tailwind | Ukuran / Line-height | Pemakaian |
| :--- | :--- | :--- | :--- |
| **Display** | `font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]` | 48px – 72px | Headline Hero Beranda |
| **Headline (H1)** | `font-display text-3xl sm:text-4xl font-bold tracking-tight text-heading` | 36px – 44px | Judul Halaman Publik & Dashboard |
| **Section (H2)** | `font-display text-2xl sm:text-3xl font-bold tracking-tight text-heading` | 24px – 32px | Judul Section Konten |
| **Subsection (H3)**| `font-display text-lg sm:text-xl font-semibold text-heading` | 18px – 20px | Header Card, Widget Sidebar |
| **Body (Utama)** | `font-body text-[15px] text-body leading-relaxed max-w-prose` | 15px / 1.6 | Artikel, Berita, Konten Profil |
| **Body UI (Small)**| `font-body text-[13px] text-body leading-normal` | 13px / 1.4 | Tabel, Form label, Item navigasi |
| **Caption / Muted**| `font-body text-xs text-muted` | 12px | Timestamp, Metadata penulis, NIP |
| **Overline / Tag** | `font-body text-[11px] font-semibold uppercase tracking-wider text-muted` | 11px | Kategori artikel, Label modul |

---

## 4. Sistem Elevasi, Border, & Radius

1. **Elevation Strategy**:
   - Status statis selalu **flat** dengan garis tepi 1px `border border-border`.
   - Hover pada card interaktif: translasi vertikal `-translate-y-0.5` (-2px lift) + `shadow-(--shadow-hover)` durasi 200ms.
   - Primary button hover: translasi vertikal `-translate-y-[1px]` + `shadow-(--shadow-button-glow)`.
   - **Focus & Ring Policy (`none`)**: Keduanya wajib `none` (`outline: none`, `box-shadow: none`, `--tw-ring-shadow: 0 0 #0000`). Dilarang menambahkan utility `focus:*`, `focus-visible:*`, `focus-within:*`, maupun `ring-*` pada elemen HTML/Astro; global reset pada `src/styles/global.css` menonaktifkan seluruh outline dan ring focus secara menyeluruh.
2. **Radius Konsisten**:
   - `rounded-[6px]`: Tombol, input text, select, dropdown item.
   - `rounded-[12px]`: Card artikel, card galeri, dialog modal, panel utama.
   - `rounded-[4px]`: Tag kategori, chip status kecil.
   - `rounded-full`: Avatar foto guru, status dot online/offline, pill filter.

---

## 5. Komponen Inti

### 5.1 Tombol (Button System)
- **Primary**:
  ```html
  <button class="inline-flex h-[38px] items-center justify-center gap-2 rounded-[6px] bg-primary px-4 font-body text-sm font-medium text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-primary-hover hover:shadow-(--shadow-button-glow) disabled:pointer-events-none disabled:opacity-50">
    Simpan Konten
  </button>
  ```
- **Secondary / Outline**:
  ```html
  <button class="inline-flex h-[38px] items-center justify-center gap-2 rounded-[6px] border border-border bg-surface px-4 font-body text-sm font-medium text-heading transition-all duration-200 hover:-translate-y-[1px] hover:border-heading hover:bg-surface-subtle">
    Batal
  </button>
  ```
- **Ghost**:
  ```html
  <button class="inline-flex h-[38px] items-center justify-center gap-2 rounded-[6px] px-3 font-body text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-subtle hover:text-heading">
    Detail
  </button>
  ```
- **Destructive**:
  ```html
  <button class="inline-flex h-[38px] items-center justify-center gap-2 rounded-[6px] border border-error/30 bg-surface px-4 font-body text-sm font-medium text-error transition-all duration-200 hover:-translate-y-[1px] hover:bg-error hover:text-white">
    Hapus
  </button>
  ```

### 5.2 Kartu (Editorial Cards & Anti-Bento)
- Rasio gambar standar: `aspect-[16/10]` atau `aspect-[4/3]` untuk foto kegiatan.
- Dilarang membungkus seluruh konten menjadi card bulat raksasa (*anti-bento*).
```html
<article class="group overflow-hidden rounded-[12px] border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-hover)">
  <div class="aspect-[16/10] w-full overflow-hidden bg-surface-subtle">
    <img src="/foto.webp" alt="Kegiatan Upacara" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
  </div>
  <div class="p-5">
    <div class="mb-2 flex items-center gap-2">
      <span class="rounded-[4px] bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">Prestasi</span>
      <time class="text-xs text-muted">23 Okt 2026</time>
    </div>
    <h3 class="font-display text-lg font-semibold text-heading transition-colors group-hover:text-primary">
      Siswa Juara 1 Olimpiade Sains Nasional
    </h3>
    <p class="mt-2 line-clamp-2 text-sm text-muted">
      Dokumentasi peraihan medali emas oleh siswa dalam ajang kompetisi sains tingkat nasional...
    </p>
  </div>
</article>
```

#### 5.2.1 Kebijakan Latar Belakang Kartu Solid & Anti-Transparansi Rendah (Solid Card Surface Policy)
- **Prinsip Inti & Konsistensi Dark Mode**:
  - Seluruh latar belakang kartu (*cards*), kartu statistik/KPI (*stat cards*), widget dashboard, dan panel data **WAJIB 100% menggunakan permukaan solid** dengan batas presisi 1px `border`.
  - **Dilarang keras** menggunakan background dengan transparansi rendah (seperti `bg-white/10`, `bg-white/50`, `bg-surface/50`, `bg-surface/60`, `backdrop-blur-*`), maupun mewarnai seluruh badan kartu menggunakan utility tint status tipis (`bg-success-light`, `bg-warning-light`, `bg-error-light`, `bg-primary-light`).
- **Alasan Teknis & Desain**:
  1. **Visual Washed-Out & Kusam**: Transparansi rendah dan tint tipis membuat card terlihat kusam, batas kontur hilang, dan terkesan tidak terdefinisi (*weak visual structure*).
  2. **Anomali Dark Mode (Muddy Surfaces)**: Pada mode gelap (*dark mode*), warna tint tipis (`bg-success-light`, `bg-warning-light`, `bg-error-light`) dan transparansi rendah berubah menjadi latar kotor/berlumpur (*muddy*), merusak kontras tipografi dan tidak harmonis dengan kanvas gelap `--color-background` (`#101A16`) dan `--color-surface` (`#18251F`).
  3. **Hierarki Kontras Editorial**: Kontras warna dipastikan tajam di mode terang maupun gelap. Jika kartu menggunakan warna solid semantik penuh, gunakan token teks berpasangan (`text-primary-foreground`, `text-secondary-foreground`, `text-white`).

- **Dua Pola Resmi Kartu Statistik/KPI**:

  **Pola 1: Standar Netral Solid (`bg-surface`)**
  Digunakan saat kartu statistik menyatu dengan latar netral dan status hanya ditandai pada angka:
  ```html
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 *:p-4 *:rounded-lg *:border *:border-border *:bg-surface *:shadow-2xs">
    <div>
      <span class="text-[11px] font-medium text-muted block">Total Siswa</span>
      <p class="font-display text-2xl font-bold text-heading mt-0.5">120</p>
      <span class="text-[10px] text-muted">Peserta kelulusan terdata</span>
    </div>
    <div>
      <span class="text-[11px] font-semibold text-success block">Dinyatakan LULUS</span>
      <p class="font-display text-2xl font-bold text-success mt-0.5">118</p>
      <span class="text-[10px] text-muted">Memenuhi kriteria kelulusan</span>
    </div>
  </div>
  ```

  **Pola 2: Kartu KPI Unggulan Multi-Warna Solid (Solid Semantic Tokens)**
  Digunakan saat kartu metrik membutuhkan diferensiasi warna tegas dan tidak putih polos (seperti di Dashboard Utama `/admin` dan Panel Kelulusan `/admin/kelulusan`):
  ```html
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 *:p-4 *:rounded-lg *:border *:shadow-2xs">
    <!-- 1. Total / Metrik Utama (Primary Solid) -->
    <div class="bg-primary border-primary text-primary-foreground">
      <span class="text-[11px] font-semibold text-primary-foreground block">Total Calon Siswa</span>
      <p class="font-display text-2xl font-bold text-primary-foreground mt-0.5">120</p>
      <span class="text-[10px] text-primary-foreground/80">Seluruh berkas masuk</span>
    </div>
    <!-- 2. Sukses / Lulus (Success Solid) -->
    <div class="bg-success border-success text-white">
      <span class="text-[11px] font-semibold text-white block">Dinyatakan LULUS</span>
      <p class="font-display text-2xl font-bold text-white mt-0.5">118</p>
      <span class="text-[10px] text-white/80">Memenuhi kriteria kelulusan</span>
    </div>
    <!-- 3. Warning / Cadangan / Ditunda (Warning Solid) -->
    <div class="bg-warning border-warning text-white">
      <span class="text-[11px] font-semibold text-white block">Cadangan</span>
      <p class="font-display text-2xl font-bold text-white mt-0.5">2</p>
      <span class="text-[10px] text-white/80">Menunggu kuota tersedia</span>
    </div>
    <!-- 4. Error / Tidak Lulus (Error Solid) atau Secondary Solid -->
    <div class="bg-error border-error text-white">
      <span class="text-[11px] font-semibold text-white block">Tidak Lulus</span>
      <p class="font-display text-2xl font-bold text-white mt-0.5">0</p>
      <span class="text-[10px] text-white/80">Belum memenuhi syarat</span>
    </div>
  </div>
  ```

### 5.3 Input & Form (CMS & Pengaturan)
- Selalu sertakan label eksplisit di atas input.
```html
<div class="space-y-1.5">
  <label for="title" class="block font-body text-sm font-medium text-heading">
    Judul Berita
  </label>
  <input
    id="title"
    type="text"
    placeholder="Masukkan judul..."
    class="h-[40px] w-full rounded-[6px] border border-border bg-surface px-3.5 font-body text-sm text-heading placeholder:text-muted/60 transition-colors"
  />
</div>
```

### 5.4 Tabel Data (Direktori Akademik & Audit Trail)
```html
<div class="overflow-x-auto rounded-[8px] border border-border bg-surface">
  <table class="w-full text-left font-body text-sm">
    <thead class="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-muted">
      <tr>
        <th class="px-4 py-3">Nama / NIP</th>
        <th class="px-4 py-3">Mata Pelajaran</th>
        <th class="px-4 py-3">Status</th>
        <th class="px-4 py-3 text-right">Aksi</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-border text-body">
      <tr class="transition-colors hover:bg-surface-subtle/50">
        <td class="px-4 py-3 font-medium text-heading">Drs. Ahmad Fauzi</td>
        <td class="px-4 py-3 text-muted">Matematika</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Aktif
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          <button class="text-xs font-medium text-primary hover:underline">Edit</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 5.5 Navigasi (Header)
- Tinggi tetap: `h-14` (56px).
- Transparan lembut: `bg-surface/90 backdrop-blur-md border-b border-border`.
- Batas container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.

### 5.6 Accordion & Dropdown Sidebar (Single-Open / Mutually Exclusive)
- **Aturan Wajib (Exclusive Single-Open)**:
  - Ketika sebuah item accordion dibuka, seluruh item accordion lain yang sebelumnya sedang terbuka WAJIB otomatis tertutup (*auto-close*).
  - Ketentuan yang sama berlaku untuk dropdown submenu di sidebar: membuka satu grup menu harus otomatis menutup grup menu sidebar lain yang sebelumnya terbuka.
- **Tujuan UX & Arsitektur**:
  - Mencegah penumpukan konten vertikal (*content bloat* dan *long scrolling fatigue*).
  - Menjaga fokus pengguna hanya pada satu konteks data yang sedang dikelola.
- **Pola Teknis**:
  - **Native HTML5**: Gunakan atribut `name` yang seragam pada elemen semantik `<details name="group-identifier">` (fitur native exclusive accordion) dilengkapi fallback event listener `toggle` untuk kompatibilitas lintas peramban.
  - **Custom Accordion / Sidebar Dropdown JS**: Sebelum membuka item target (`classList.remove('hidden')` dan `rotate-180`), iterasi seluruh item bersaudara dalam container untuk menutupnya (`classList.add('hidden')`, `classList.remove('rotate-180')`, dan `setAttribute('aria-expanded', 'false')`).

### 5.7 Simplifikasi Child Utility & Responsive Grid dengan Selector Tailwind v4 (`*:` & `nth-child`)
- **Tujuan Arsitektur**: Meniadakan duplikasi class utilitas yang berulang (*DRY Tailwind*) pada elemen anak yang bersaudara (seperti tab filter, grup tombol status, atau kontrol pagination) dan menyederhanakan layout responsif hybrid (misal 2 kolom di mobile + span kolom penuh untuk search box).
- **Aturan Implementasi**:
  - Pindahkan utilitas layout, ukuran, kursor, dan tipografi dasar yang sama ke parent menggunakan child selector `*:` yang dikombinasikan dengan pseudo-class Tailwind v4 (`*:not-last:`, `*:nth-[n]:`, `*:first:`, `*:last:`).
  - Elemen anak hanya perlu menampung class varian status aktif/tidak aktif (`bg-primary text-white` vs `border border-border bg-surface text-muted`).
  - Untuk grid responsif dengan input pencarian sebagai anak terakhir: terapkan `*:nth-[5]:col-span-2 sm:*:nth-[5]:col-span-1` (atau `*:last:col-span-2 sm:*:last:col-span-1`) pada parent container.
- **Pola Kode Standar**:
  ```html
  <div class="grid grid-cols-2 sm:grid-cols-5 items-center gap-2 pb-2 *:not-last:rounded-[6px] *:not-last:px-3.5 *:not-last:py-2 sm:*:not-last:py-1.5 *:not-last:font-body *:not-last:text-xs *:not-last:cursor-pointer *:not-last:text-center *:not-last:transition-all *:nth-[5]:col-span-2 sm:*:nth-[5]:col-span-1">
    <button class="cat-filter-btn bg-primary font-semibold text-white shadow-xs">Semua</button>
    <button class="cat-filter-btn border border-border bg-surface font-medium text-muted hover:border-heading hover:text-heading">Kategori 1</button>
    <button class="cat-filter-btn border border-border bg-surface font-medium text-muted hover:border-heading hover:text-heading">Kategori 2</button>
    <button class="cat-filter-btn border border-border bg-surface font-medium text-muted hover:border-heading hover:text-heading">Kategori 3</button>
    <div class="relative w-full">
      <input type="text" placeholder="Cari data..." class="h-[40px] w-full rounded-[6px] border border-border bg-surface px-3.5 font-body text-xs" />
    </div>
  </div>
  ```

### 5.8 Breadcrumb Navigasi
- **Prinsip**: Gunakan komponen terpusat `<Breadcrumb />` (`src/components/Breadcrumb.astro`) untuk seluruh hierarki navigasi sekunder. Dilarang menulis manual markup breadcrumb inline berulang di setiap halaman.
- **Aksesibilitas & Semantik**:
  - Bungkus dalam elemen semantik `<nav aria-label="Breadcrumb">` dan `<ol class="inline-flex items-center flex-wrap gap-2">`.
  - Setiap segmen dibungkus `<li>` dengan `class="inline-flex items-center gap-2"`.
  - Item aktif terakhir menggunakan `aria-current="page"` dengan gaya `text-heading font-medium`.
  - Pemisah menggunakan `/` tipis (`text-muted/50 select-none` dengan `aria-hidden="true"`).
- **Spesifikasi Utility**:
  - Ukuran teks: `text-xs font-body`.
  - Default spacing: `mb-6`.
  - Warna link terdahulu: `text-muted hover:text-heading transition-colors`.

### 5.9 Ikonografi Terpusat (SVG Sprite System)
- **Prinsip**: Dilarang menyalin-tempel raw path SVG panjang berulang di komponen UI atau halaman. Semua ikon umum dan brand didefinisikan sekali di [`SvgSprite.astro`](file:///src/components/SvgSprite.astro) (diinjeksi otomatis di root `Layout.astro`).
- **Penggunaan Konsumen**:
  - Gunakan komponen ringan [`<Icon />`](file:///src/components/Icon.astro):
    ```astro
    import Icon from '../components/Icon.astro';

    <Icon name="search" class="h-4 w-4 text-muted" />
    <Icon name="whatsapp" class="h-5 w-5 text-[#25D366]" />
    ```
  - Bebas overhead JavaScript, ramah cache browser, payload HTML berkurang drastis tanpa duplikasi byte path SVG.
  - Nama ikon terdaftar: `whatsapp`, `instagram`, `youtube`, `facebook`, `tiktok`, `x`, `twitter`, `play`, `plus`, `close`, `check`, `search`, `calendar`, `clock`, `map-pin`, `phone`, `mail`, `chevron-right`, `chevron-left`, `chevron-down`, `download`, `menu`, `sun`, `moon`.

### 5.10 Aturan Penggunaan Tailwind v4 Selector `*:` (Child Variant)
- **Cakupan Penggunaan**:
  - Gunakan `*:` di level parent container hanya untuk styling struktural dan base yang repetitif: layout (`*:flex`, `*:inline-flex`), dimensi (`*:h-8 *:w-8`), padding/spacing (`*:p-4`, `*:space-y-1`), borders (`*:border *:border-border`), background default (`*:bg-surface`), border-radius (`*:rounded-[6px]`), dan transisi base (`*:transition-all`).
- **Pengecualian Mutlak State Interaktif (`hover:`)**:
  - **Dilarang keras** menggabungkan utility `hover:` ke dalam selector `*:` di level parent (misal `*:hover:...` atau `hover:*:...`).
  - **Alasan Teknis**:
    1. Menggabungkan `hover:` di parent dapat memicu bubbling atau triggering aneh antar elemen anak yang berdekatan atau elemen pembungkus (seperti `<li>` yang membungkus `<a>`).
    2. Menghilangkan kejelasan target interaktif (`<a>`, `<button>`) pada saat audit CSS/DOM.
  - **Aturan Implementasi**:
    - Utility `hover:...` **wajib** ditempatkan langsung pada elemen interaktif anak yang bersangkutan (`<a>`, `<button>`).
    - *Contoh*:
      ```astro
      <!-- Benar: Parent hanya atur base/layout, anak pegang hover secara eksplisit -->
      <div class="flex gap-2 *:inline-flex *:h-8 *:w-8 *:rounded-[6px] *:border *:border-border *:bg-surface *:transition-colors">
        <a href="..." class="hover:-translate-y-0.5 hover:border-primary hover:text-primary">...</a>
        <a href="..." class="hover:-translate-y-0.5 hover:border-secondary hover:text-secondary">...</a>
      </div>

      <!-- Salah: Menggabungkan hover di parent dengan *: -->
      <div class="flex gap-2 *:hover:-translate-y-0.5 hover:*:border-primary">
        ...
      </div>
      ```
- **Trigger Cepat Refactoring (`*: <file>` atau `/dry-star <file>`)**:
  - Untuk memicu agen melakukan refactoring DRY Tailwind `*:` pada file secara instan tanpa menulis prompt panjang, cukup ketik:
    `*: @[path/to/file.astro]` atau `/dry-star @[path/to/file.astro]`
  - Agen akan langsung memindai duplikasi utility, memindahkannya ke parent container via `*:`, menjaga isolasi `hover:...`, dan menerapkan perubahan seketika.

### 5.11 Status Tabs & Segmented Control (Zero-Load Pattern)
- **Filosofi & Tujuan**: Seluruh tab status/filter kategori (seperti *Semua, Terbit, Draf, Sampah* atau *Terbaru, Populer*) wajib menggunakan pola **Segmented Control Zero-Load**:
  1. **Zero Load (Zero Page Reload)**: Dilarang keras memicu refresh/reload halaman peramban (*browser document reload*). Tab switcher wajib menggunakan tombol interaktif (`<button type="button" role="tab">`) dengan manipulasi DOM / state di memori atau AJAX/History API (`history.pushState`) agar transisi data terjadi seketika (0ms) tanpa jeda reload server.
  2. **DRY Tailwind v4 Child Selector (`*:`)**: Penataan padding, radius sudut, dimensi teks, dan kursor diletakkan di container parent; elemen anak (`<button>`) hanya menampung state aktif/inaktif secara deklaratif.
- **Ketentuan Spesifikasi Desain**:
  - **Container**: `inline-flex bg-surface-subtle *:px-2.5 *:py-1 *:text-[11px] *:cursor-pointer *:transition-colors *:first:rounded-l-[4px] *:last:rounded-r-[4px]`
  - **Padding**: Wajib seragam `px-2.5 py-1` via `*:px-2.5 *:py-1`. Dilarang menduplikasi padding manual di setiap anak.
  - **Border Radius**: Segmen bersatu (*continuous segmented pill*), hanya anak pertama (`*:first:rounded-l-[4px]`) dan anak terakhir (`*:last:rounded-r-[4px]`) yang memiliki radius 4px. Segmen tengah lurus tanpa celah (`gap-0`).
  - **Tipografi**: `text-[11px] font-medium` (aktif: `font-semibold`).
  - **State Aktif**:
    - Standar: `bg-primary font-semibold text-white`
    - Destruktif (misal filter Sampah/Trash): `bg-error font-semibold text-white`
  - **State Inaktif**:
    - Standar: `font-medium text-muted hover:text-heading`
    - Destruktif (misal Sampah): `font-medium text-muted hover:text-error`
- **Pola Kode Standar**:
  - *In-Page Tablist Switcher / Filter Data (Zero Page Reload - Wajib)*:
    ```astro
    <div
      class="inline-flex bg-surface-subtle *:px-2.5 *:py-1 *:text-[11px] *:cursor-pointer *:transition-colors *:first:rounded-l-[4px] *:last:rounded-r-[4px]"
      role="tablist"
      aria-label="Filter status data"
    >
      <button
        type="button"
        role="tab"
        data-status="all"
        aria-selected="true"
        class="status-tab-btn bg-primary font-semibold text-white"
      >
        Semua ({totalCount})
      </button>
      <button
        type="button"
        role="tab"
        data-status="published"
        aria-selected="false"
        class="status-tab-btn font-medium text-muted hover:text-heading"
      >
        Terbit ({publishedCount})
      </button>
      <button
        type="button"
        role="tab"
        data-status="trash"
        aria-selected="false"
        class="status-tab-btn font-medium text-muted hover:text-error"
      >
        Sampah ({trashCount})
      </button>
    </div>
    ```
  - *Sinkronisasi URL Tanpa Reload*: Gunakan `window.history.pushState(null, '', url)` dan event `popstate` agar URL tetap bersih, dapat di-bookmark/dibagikan, tanpa pernah memicu browser loading indicator.
  - *Pengecualian Anchor (`<a>`)*: Tag `<a>` hanya diizinkan untuk navigasi menuju rute fisik halaman yang berbeda sama sekali (misal dari `/admin/berita` menuju `/admin/berita/kategori` atau `/admin/berita/tambah`), bukan untuk tab filter status di halaman yang sama.

### 5.12 Sentralisasi Root Layout Dokumen (Zero Redundant Root HTML)
- **Prinsip**: Tag root HTML (`<!doctype html>`, `<html lang="id">`, `<head>`, `<meta charset="UTF-8" />`, `<meta name="viewport" ... />`, `<title>`, `<body>`) adalah tanggung jawab tunggal dari komponen layout di direktori `src/layouts/`.
- **Dilarang Keras**: Menulis manual struktur root HTML mentah di dalam file halaman `src/pages/**`.
- **Standar Layout Sesuai Konteks**:
  1. **Halaman Publik**: Menggunakan `<Layout title="...">` (`src/layouts/Layout.astro`).
  2. **Halaman Admin/Dashboard**: Menggunakan `<AdminLayout title="...">` (`src/layouts/AdminLayout.astro`).
  3. **Halaman Cetak Dokumen / Form A4**: Wajib menggunakan layout dokumen terpusat (seperti `PrintLayout.astro`) yang menangani metadata print, CSS print global, toolbar aksi cetak, dan isolasi container `#a4-sheet-container` / `.a4-container`.

### 5.13 Komponen Pagination Terpusat (Centralized Pagination Component)
- **Prinsip**: Navigasi halaman untuk tabel data, daftar artikel, dan direktori wajib 100% menggunakan komponen terpusat `<Pagination />` (`src/components/Pagination.astro`) serta modul helper pendukung `src/utils/pagination.ts`. Dilarang keras menyalin puluhan baris markup tombol pagination dan duplikasi logika kalkulasi halaman manual di setiap file halaman (*anti-DRY*).
- **Dua Mode Operasional**:
  1. **Mode Server-Side (URL Navigation)**: Menerima prop fungsi `getPageUrl={(page) => ...}`. Menghasilkan tag semantik `<a>` untuk navigasi multi-halaman tradisional dan ramah SEO peramban.
  2. **Mode Client-Side (Zero-Load / 0ms)**: Menerima prop `id="..."` tanpa `getPageUrl`. Menghasilkan tombol interaktif `<button type="button" data-page="...">` yang dikontrol secara instan (0ms) via JavaScript DOM manipulation atau helper `src/utils/pagination.ts`.
- **Spesifikasi Tampilan & Token Semantik**:
  - **Kontainer**: `flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-surface text-xs text-muted`.
  - **Info Rentang**: `Menampilkan <span class="font-semibold text-heading">{from}</span>–<span class="font-semibold text-heading">{to}</span> dari <span class="font-semibold text-heading">{total}</span> {itemLabel}`.
  - **Tombol Navigasi**: `*:inline-flex *:h-[30px] *:items-center *:justify-center *:rounded-[6px] *:font-medium *:transition-colors *:text-xs`.
  - **Tombol Aktif**: `bg-primary text-white font-semibold shadow-xs`.
  - **Tombol Inaktif**: `border border-border bg-surface text-heading hover:bg-surface-subtle cursor-pointer`.
  - **Tombol Disabled** (`Sebelumnya`/`Selanjutnya` di batas): `pointer-events-none opacity-40 bg-surface-subtle text-muted`.
- **Pola Kode Standar**:
  ```astro
  ---
  import Pagination from '../../../components/Pagination.astro';
  ---

  <!-- Contoh 1: Mode Server-Side URL Link (e.g. Berita / Agenda Publik) -->
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalFiltered}
    pageSize={10}
    itemLabel="berita"
    getPageUrl={(page) => `/admin/berita?page=${page}`}
  />

  <!-- Contoh 2: Mode Client-Side Zero-Load (Tabel Data CMS) -->
  <Pagination
    id="admissions-pagination-container"
    currentPage={1}
    totalPages={Math.max(1, Math.ceil(items.length / 10))}
    totalItems={items.length}
    pageSize={10}
    itemLabel="calon siswa"
  />
  ```
- **Helper Client-Side (`src/utils/pagination.ts`)**:
  ```typescript
  import { renderClientPaginationBar } from '../../../utils/pagination';

  // Render ulang UI pagination secara instan saat data difilter/dicari di memori
  renderClientPaginationBar({
    container: document.getElementById('admissions-pagination-container'),
    currentPage: 1,
    totalPages: 5,
    totalItems: 48,
    pageSize: 10,
    itemLabel: 'calon siswa',
  });
  ```

### 5.14 Tombol Switch Toggle Status (Accessible Toggle Switch)
- **Prinsip & Semantik**:
  - Kolom status aktif/nonaktif pada tabel data dan baris pengaturan wajib menggunakan tombol switch toggle interaktif.
  - Wajib menyertakan atribut aksesibilitas `role="switch"`, `aria-checked="true|false"`, label `title` dan `aria-label` yang deskriptif, serta teks tersembunyi `<span class="sr-only">Aktif|Nonaktif</span>`.
  - Hindari tombol badge teks mentah ("Aktif"/"Nonaktif") yang memakan ruang horizontal dan membingungkan aksi klik.
  - **Eliminasi Redundansi Modal**: Jika status aktif/publikasi sudah dikelola langsung melalui switch toggle pada tabel data, kontrol status/checkbox dilarang dimunculkan lagi di dalam form pop up/modal (create/edit) agar modal tetap bersih, fokus, dan bebas duplikasi kontrol. State status tetap dipertahankan nilainya saat simpan.
- **Spesifikasi Utility**:
  - **Dimensi Track**: `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`.
  - **State Aktif**: `bg-primary` (atau token semantik `bg-success`).
  - **State Inaktif**: `bg-border` (atau `bg-surface-subtle border border-border`).
  - **Thumb / Knob**: `pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out`.
  - **Translasi Knob**:
    - Aktif: `translate-x-4` (menggeser knob sejauh 16px ke ujung kanan).
    - Inaktif: `translate-x-0` (posisi default di ujung kiri).
- **Pola Kode Standar**:
  ```astro
  <button
    type="button"
    role="switch"
    aria-checked={item.isActive ? "true" : "false"}
    class:list={[
      "toggle-status-btn relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
      item.isActive ? "bg-primary" : "bg-border"
    ]}
    data-id={item.id}
    title={item.isActive ? "Aktif (Klik untuk menonaktifkan)" : "Nonaktif (Klik untuk mengaktifkan)"}
    aria-label={item.isActive ? "Nonaktifkan status" : "Aktifkan status"}
  >
    <span class="sr-only">{item.isActive ? 'Aktif' : 'Nonaktif'}</span>
    <span
      aria-hidden="true"
      class:list={[
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
        item.isActive ? "translate-x-4" : "translate-x-0"
      ]}
    />
  </button>
  ```

### 5.15 Tombol Tindakan Icon-Only pada Tabel & Baris Hierarki (Icon-Only Table Actions)
- **Prinsip**:
  - Kolom "Tindakan" pada tabel data CMS dan baris hierarki (Menu Navbar, Kategori, Submenu) wajib menggunakan tombol aksi berbasis ikon ringkas saja (*icon-only*).
  - Menggunakan komponen ikon terpusat `<Icon name="edit" />` dan `<Icon name="trash" />`. Dilarang menyalin path SVG mentah panjang secara inline.
  - Dilarang keras menggunakan tombol dengan label teks panjang ("Edit", "Hapus") pada kolom tindakan tabel karena memboroskan ruang kolom dan memicu overflow tabel.
  - Dilarang menyembunyikan aksi primer (Edit/Hapus) ke dalam popover menu 3-titik jika ruang horizontal baris masih sangat lega; tampilkan aksi secara langsung via icon button.
- **Pola DRY Tailwind v4 Child Selector (`*:` & hover isolation)**:
  - Container pembungkus mengatur dimensi tombol, border-radius, background dasar, border, dan flexbox:
    - **Tabel Standar**: `*:inline-flex *:h-7 *:w-7 *:items-center *:justify-center *:rounded-[6px] *:border *:transition-colors *:cursor-pointer`.
    - **Baris Navigasi / Menu Utama**: `*:inline-flex *:h-6.5 *:w-6.5 *:items-center *:justify-center *:rounded-[6px] *:border *:transition-colors *:cursor-pointer`.
    - **Submenu / Item Rapat**: `*:inline-flex *:h-5.5 *:w-5.5 *:items-center *:justify-center *:rounded-[4px] *:border *:transition-colors *:cursor-pointer`.
  - **Isolasi State Interaktif**: State `hover:` WAJIB terpasang langsung pada masing-masing tombol anak (`hover:text-primary hover:border-primary/40 hover:bg-surface-subtle` untuk Edit, dan `hover:text-error hover:border-error/40 hover:bg-error-light` untuk Hapus).
  - Tambahkan `pointer-events-none` pada tag `<Icon />` untuk menjamin event click selalu ditangkap bersih oleh tag `<button>`.
- **Pola Kode Standar**:
  ```astro
  <!-- Tindakan Tabel CMS -->
  <td class="py-3 px-4 text-right whitespace-nowrap">
    <div class="inline-flex items-center gap-1.5 *:inline-flex *:h-7 *:w-7 *:items-center *:justify-center *:rounded-[6px] *:border *:transition-colors *:cursor-pointer">
      <button
        type="button"
        class="edit-btn border-border bg-surface text-muted hover:text-primary hover:border-primary/40 hover:bg-surface-subtle shadow-2xs"
        data-item={JSON.stringify(item)}
        title="Edit data"
        aria-label="Edit data"
      >
        <Icon name="edit" class="h-3.5 w-3.5 pointer-events-none" />
      </button>
      <button
        type="button"
        class="delete-btn border-border bg-surface text-muted hover:text-error hover:border-error/40 hover:bg-error-light shadow-2xs"
        data-id={item.id}
        title="Hapus data"
        aria-label="Hapus data"
      >
        <Icon name="trash" class="h-3.5 w-3.5 pointer-events-none" />
      </button>
    </div>
  </td>
  ```

### 5.16 Standarisasi Ikon & Tombol Simpan Interaktif (Interactive Save Button & Icon System)
- **Filosofi & Tujuan**: Menghilangkan duplikasi path SVG (*zero redundant SVG path bloat*) dan memberikan umpan balik aksi langsung di dalam elemen pemicu (*in-place feedback*) tanpa memicu pergeseran tata letak halaman (*zero layout shift*).
- **Ketentuan Spesifikasi Desain**:
  1. **Komponen Ikon**: Menggunakan `<Icon name="..." class="h-3.5 w-3.5" />`. Daftar nama ikon resmi diatur di `src/components/SvgSprite.astro` (misal: `save`, `check`, `edit`, `trash`, `plus`, `close`, `search`, `calendar`, dll.).
  2. **Struktur Tombol Simpan 3-State**:
     - **Wadah**: `inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-white transition-all hover:bg-primary-hover shadow-xs cursor-pointer disabled:opacity-50`
     - **State 1 (Idle)**: Ikon `<Icon id="...-icon-save" name="save" class="h-3.5 w-3.5 text-white" />` aktif, spinner dan check hidden. Label: `"Simpan Perubahan"`.
     - **State 2 (Loading)**: Spinner `<svg id="...-spinner" class="h-3.5 w-3.5 animate-spin text-white" ...>` aktif, icon save dan check hidden. Tombol `disabled = true`. Label: `"Menyimpan..."`.
     - **State 3 (Sukses)**: Ikon centang `<Icon id="...-check" name="check" class="h-3.5 w-3.5 text-white" />` aktif, spinner dan icon save hidden. Label teks berubah menjadi `"Tersimpan"`. Reset otomatis ke State 1 setelah 2.5 detik.
- **Pola Kode Standar**:
  ```astro
  <!-- Tombol Simpan Standar -->
  <button
    type="button"
    id="btn-header-save"
    class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-white transition-all hover:bg-primary-hover shadow-xs cursor-pointer disabled:opacity-50"
  >
    <Icon id="btn-header-icon-save" name="save" class="h-3.5 w-3.5 text-white" />
    <svg
      id="btn-header-spinner"
      class="hidden h-3.5 w-3.5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <Icon id="btn-header-check" name="check" class="hidden h-3.5 w-3.5 text-white" />
    <span id="btn-header-label">Simpan Perubahan</span>
  </button>
  ```
  ```javascript
  // Pola JavaScript 3-State Feedback
  function setLoading(isLoading) {
    btnSave.disabled = isLoading;
    btnLabel.innerText = isLoading ? "Menyimpan..." : "Simpan Perubahan";
    if (isLoading) {
      iconSave?.classList.add("hidden");
      iconSpinner?.classList.remove("hidden");
      iconCheck?.classList.add("hidden");
    } else {
      iconSpinner?.classList.add("hidden");
    }
  }

  // Saat Sukses Disimpan
  iconSave?.classList.add("hidden");
  iconSpinner?.classList.add("hidden");
  iconCheck?.classList.remove("hidden");
  btnLabel.innerText = "Tersimpan";
  setTimeout(() => {
    iconCheck?.classList.add("hidden");
    iconSave?.classList.remove("hidden");
    btnLabel.innerText = "Simpan Perubahan";
  }, 2500);
  ```

### 5.17 Standarisasi Image, Responsive Sizing & Loading Prioritization (Image Optimization & Core Web Vitals Standard)
- **Filosofi & Tujuan**: Menjamin performa dan aksesibilitas Lighthouse selalu berada di zona hijau (95–100), mempercepat LCP (*Largest Contentful Paint*), mengeliminasi CLS (*Cumulative Layout Shift* = 0), dan memenuhi standar WCAG 2.1 AA.
- **Ketentuan Spesifikasi Teknis**:
  1. **Atribut Pemuatan Gambar (Loading & Fetch Priority)**:
     - **Slide 1 / Cover LCP Utama (Above-the-Fold)**:
       - `loading="eager"`
       - `fetchpriority="high"`
       - `decoding="sync"` (atau async pada non-critical hero)
       - Wajib menyertakan atribut integer `width` dan `height` presisi (misal `width="1920" height="1080"` atau `width="1200" height="675"`).
     - **Slide Berikutnya & Elemen Below-the-Fold**:
       - `loading="lazy"`
       - `fetchpriority="low"` (atau omitted)
       - `decoding="async"`
       - Pada hero slider multi-slide, slide index > 0 menggunakan placeholder inline SVG ringan dan atribut `data-src` yang ditukar ke `src` via JavaScript saat berpindah slide agar tidak mengunduh semua file gambar saat load awal.
  2. **Tabel Standar Dimensi & Rasio Aspek Gambar**:
     | Elemen UI / Komponen | Rasio Aspek Tailwind | Rekomendasi Dimensi (`width` & `height`) | Sifat Pemuatan (`loading`) |
     | :--- | :--- | :--- | :--- |
     | **Hero Banner Slide 1** | `aspect-video` / Full Hero | `width="1920" height="1080"` | `eager` + `fetchpriority="high"` |
     | **Hero Banner Slide 2+** | `aspect-video` / Full Hero | `width="1920" height="1080"` | `lazy` + `fetchpriority="low"` (`data-src`) |
     | **Cover Berita / Prestasi Detail** | `aspect-video` | `width="1200" height="675"` | `eager` + `fetchpriority="high"` |
     | **Kartu Berita / Fasilitas / Ekskul** | `aspect-video` (16:9) | `width="800" height="450"` atau `width="400" height="225"` | `lazy` |
     | **Foto Kepala Sekolah / Profil Guru** | `aspect-[4/5]` / `aspect-[3/4]` | `width="280" height="350"` atau `width="200" height="250"` | `lazy` (atau `eager` jika hero profil) |
     | **Foto Alumni / Galeri Dokumentasi** | `aspect-[4/3]` / `aspect-[16/10]` | `width="600" height="375"` atau `width="400" height="300"` | `lazy` |
     | **Avatar Tabel / Staf Kecil** | `rounded-full` (1:1) | `width="40" height="40"` atau `width="48" height="48"` | `lazy` |
     | **Logo Sekolah / Navbar Brand** | Sesuai SVG / Logo | `width="36" height="36"` atau `width="28" height="28"` | `eager` |
  3. **Pencegahan CLS (Zero Layout Shift)**:
     - Setiap gambar WAJIB dibungkus kontainer yang mendefinisikan rasio aspek eksplisit (`aspect-video`, `aspect-[4/3]`, `aspect-[4/5]`, atau `aspect-square`) dan background cadangan `bg-surface-subtle`.
     - Gunakan `class="h-full w-full object-cover"` pada gambar agar mengisi penuh kontainer tanpa distorsi visual.
  4. **Fallback Error Handling**:
     - Gunakan atribut `onerror` dengan fallback ke avatar lokal resmi (`/images/default-avatar.svg`) atau placeholder internal, untuk mencegah broken image icon saat link gambar eksternal tidak dapat dimuat.
- **Pola Kode Standar**:
  ```astro
  <!-- Pola A: Hero Banner / LCP Image (Slide 1 vs Slide Selanjutnya) -->
  <div class="relative aspect-video w-full overflow-hidden bg-surface-subtle">
    <img
      src={index === 0 ? slide.imageUrl : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E"}
      data-src={index > 0 ? slide.imageUrl : undefined}
      alt={slide.title}
      width="1920"
      height="1080"
      class="h-full w-full object-cover object-center"
      loading={index === 0 ? "eager" : "lazy"}
      fetchpriority={index === 0 ? "high" : "low"}
      decoding={index === 0 ? "sync" : "async"}
    />
  </div>

  <!-- Pola B: Kartu Artikel / Fasilitas / Berita Standard Below-the-Fold -->
  <a
    href={`/berita/${item.slug}`}
    aria-label={item.title}
    class="group block overflow-hidden rounded-[10px] border border-border bg-surface"
  >
    <div class="relative aspect-video w-full overflow-hidden bg-surface-subtle">
      <img
        src={item.coverImage || "/images/default-cover.webp"}
        alt={item.title}
        width="800"
        height="450"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
        onerror="this.onerror=null;this.src='/images/default-cover.webp';"
      />
    </div>
    <div class="p-4">
      <h3 class="font-display text-sm font-bold text-heading line-clamp-2">
        {item.title}
      </h3>
    </div>
  </a>
  ```

### 5.18 Standarisasi Slider Looping Tanpa Batas & Gesture Navigasi (Infinite Tripartite Loop & Touch-Drag Gesture Standard)
- **Filosofi & Tujuan**: Menghadirkan pengalaman interaksi kelas dunia pada carousel/slider kartu foto (Guru), testimoni (Alumni), serta logo kemitraan industri & kampus (BKK/MoU). Menghilangkan efek kaku "mentok di ujung lalu melompat kasar ke slide 1" (*anti-rewind*), serta memberikan kebebasan gestur geser alami (*swipe/drag*) tanpa ketergantungan pada tombol panah.
- **Ketentuan Spesifikasi Arsitektur**:
  1. **Tripartite Set Clones (Server / Frontmatter)**:
     - Gandakan array data minimal menjadi 3 set (`[...items, ...items, ...items]`).
     - Jika jumlah data asli kurang dari batas minimum (misal < 4 item), lakukan perulangan internal hingga mencapai batas minimum sebelum digandakan menjadi 3 set.
     - Posisi awal scroll saat pertama kali dimuat diatur tepat di awal set kedua (`track.scrollLeft = singleSetWidth`), sehingga pengguna dapat menggeser ke kiri maupun ke kanan secara instan.
  2. **Normalisasi Posisi Instan (Zero Visual Shift)**:
     - Saat posisi scroll memasuki set ketiga (`scrollLeft >= 2 * singleSetWidth - 8`), kurangi posisi scroll sebesar 1 set (`scrollLeft -= singleSetWidth`) secara instan dengan menonaktifkan class `scroll-smooth` dan `scrollSnapType` selama 60ms, lalu aktifkan kembali.
     - Saat posisi scroll digeser mundur memasuki set pertama (`scrollLeft <= singleSetWidth * 0.4`), tambah posisi scroll sebesar 1 set (`scrollLeft += singleSetWidth`).
     - Pengguna tidak akan pernah melihat jeda atau pergeseran visual karena set tampilan identik 100%.
  3. **Touch Swipe & Mouse Drag**:
     - Tambahkan utilitas Tailwind `overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 cursor-grab active:cursor-grabbing select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` pada container track.
     - Terapkan event listener `mousedown`, `mousemove`, `mouseup` pada track untuk mendukung drag kursor mouse di layar desktop.
     - Tambahkan `pointer-events-none` pada elemen gambar anak agar drag browser native tidak memicu drag-image ghost.
  4. **Smart Autoplay**:
     - Timer autoplay (interval 3200ms–4500ms) wajib di-*clear* saat `mouseenter`, `mousedown`, atau `touchstart`, dan diaktifkan kembali saat `mouseleave`, `mouseup`, atau `touchend`.
- **Pola Kode Standar**:
  ```astro
  ---
  // Frontmatter: Siapkan 3 Set Duplikasi
  let baseItems = rawItems;
  while (baseItems.length > 0 && baseItems.length < 4) {
    baseItems = [...baseItems, ...rawItems];
  }
  const displayItems = baseItems.length > 0
    ? [...baseItems, ...baseItems, ...baseItems]
    : [];
  ---

  <!-- Markup Track Slider -->
  <div
    id="infinite-slider-track"
    class="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-2 cursor-grab active:cursor-grabbing select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {displayItems.map((item, idx) => (
      <div class="flex-none w-[200px] sm:w-[240px] rounded-[10px] border border-border bg-surface p-4 snap-start shadow-xs hover:-translate-y-0.5 hover:shadow-(--shadow-hover) transition-all duration-200">
        <img src={item.logoUrl} alt={item.name} class="h-14 w-full object-contain pointer-events-none" loading="lazy" />
        <h4 class="font-display text-xs font-bold text-heading mt-2">{item.name}</h4>
      </div>
    ))}
  </div>
  ```
  ```javascript
  // Client JavaScript: Tripartite Infinite Normalization & Drag Engine
  function initInfiniteSlider() {
    const track = document.getElementById("infinite-slider-track");
    if (!track) return;

    const totalItems = track.children.length;
    if (totalItems <= 3) return;

    const singleSetCount = Math.floor(totalItems / 3);
    let isNormalizing = false;
    let autoTimer = null;
    let scrollTimeout = null;

    function getSingleSetWidth() {
      const firstCard = track.children[0];
      const middleCard = track.children[singleSetCount];
      if (!firstCard || !middleCard) return 0;
      return middleCard.offsetLeft - firstCard.offsetLeft;
    }

    function setInitialPosition() {
      const singleSetWidth = getSingleSetWidth();
      if (singleSetWidth > 0 && track.scrollLeft < singleSetWidth * 0.5) {
        track.classList.remove("scroll-smooth");
        track.style.scrollSnapType = "none";
        track.scrollLeft = singleSetWidth;
        void track.offsetWidth;
        track.classList.add("scroll-smooth");
        track.style.scrollSnapType = "";
      }
    }

    function normalizePosition() {
      if (isNormalizing) return;
      const singleSetWidth = getSingleSetWidth();
      if (singleSetWidth <= 0) return;

      if (track.scrollLeft >= 2 * singleSetWidth - 8) {
        isNormalizing = true;
        track.classList.remove("scroll-smooth");
        track.style.scrollSnapType = "none";
        track.scrollLeft -= singleSetWidth;
        void track.offsetWidth;
        track.classList.add("scroll-smooth");
        track.style.scrollSnapType = "";
        setTimeout(() => { isNormalizing = false; }, 60);
      } else if (track.scrollLeft <= singleSetWidth * 0.4) {
        isNormalizing = true;
        track.classList.remove("scroll-smooth");
        track.style.scrollSnapType = "none";
        track.scrollLeft += singleSetWidth;
        void track.offsetWidth;
        track.classList.add("scroll-smooth");
        track.style.scrollSnapType = "";
        setTimeout(() => { isNormalizing = false; }, 60);
      }
    }

    function scrollStep(direction) {
      normalizePosition();
      const firstCard = track.children[0];
      const step = firstCard ? firstCard.offsetWidth + 20 : track.clientWidth * 0.75;
      track.scrollBy({ left: direction * step, behavior: "smooth" });
    }

    function startAutoPlay() {
      stopAutoPlay();
      autoTimer = setInterval(() => { scrollStep(1); }, 3200);
    }

    function stopAutoPlay() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    // Touch & Mouse Drag Gesture
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    track.addEventListener("mousedown", (e) => {
      isDragging = true;
      stopAutoPlay();
      track.classList.remove("scroll-smooth");
      startX = e.pageX - track.offsetLeft;
      startScrollLeft = track.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      track.classList.add("scroll-smooth");
      normalizePosition();
      startAutoPlay();
    });

    track.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 1.2;
      track.scrollLeft = startScrollLeft - walk;
    });

    track.addEventListener("mouseenter", stopAutoPlay);
    track.addEventListener("mouseleave", () => { if (!isDragging) startAutoPlay(); });
    track.addEventListener("touchstart", stopAutoPlay, { passive: true });
    track.addEventListener("touchend", () => { normalizePosition(); startAutoPlay(); }, { passive: true });

    track.addEventListener("scroll", () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(normalizePosition, 160);
    }, { passive: true });

    setInitialPosition();
    startAutoPlay();
  }
  ```

---

## 6. Aturan Ketat (Do's & Don'ts)

| Wajib Dilakukan (Do) | Dilarang Keras (Don't) |
| :--- | :--- |
| Gunakan border 1px subtle (`border-border`) untuk batas visual struktur. | Jangan gunakan shadow tebal (`shadow-xl`/`shadow-2xl`) di semua card. |
| Gunakan `Poppins` untuk seluruh display heading & body/UI secara konsisten. | Jangan mencampuradukkan font display yang tidak didefinisikan dalam token. |
| Gunakan warna indigo (`#6366F1`) murni untuk elemen interaktif & CTA utama. | Jangan gunakan warna primer untuk teks biasa atau dekorasi latar belakang luas. |
| Batasi lebar teks artikel maksimal `max-w-prose`. | Jangan biarkan paragraf artikel membentang penuh 100% layar lebar. |
| Sediakan label form eksplisit dan pertahankan global reset `outline: none` & `ring: none` dari `global.css`. | Jangan hanya mengandalkan placeholder teks tanpa label, dan dilarang memakai class `focus:*`, `focus-visible:*`, `focus-within:*`, atau `ring-*` pada elemen mana pun. |
| Kompres gambar WebP/AVIF dengan rasio aspek konsisten. | Jangan gunakan foto tidak beraturan atau stock image tidak relevan. |
| Gunakan teks overline/eyebrow bersih tanpa bingkai kapsul (`uppercase text-xs font-medium text-heading` atau `uppercase text-sm font-semibold text-white`). | Dilarang keras membungkus teks overline/eyebrow ke dalam pill badge buatan (`rounded-full px-3 py-1 backdrop-blur-md border border-white/20` atau `border-border bg-surface`). |
| Gunakan token warna semantik resmi `global.css` (`text-heading`, `bg-surface`, `border-border`, `bg-primary`, `bg-secondary`, `bg-warning`, `bg-success`, `bg-error`, dll.). | PERINGATAN KERAS: DILARANG membuat/memakai utility warna bawaan Tailwind seperti `bg-amber-*`, `text-amber-*`, `border-amber-*`, `border-blue-*`, `text-blue-*`, `border-emerald-*`, `text-emerald-*`, `bg-emerald-*`, `border-rose-*`, `text-rose-*`, `bg-rose-*`, `slate-*`, maupun warna ad-hoc sembarangan (`bg-white/15`, `border-white/20`, dll.). Wajib 100% menggunakan token tema resmi dari `src/styles/global.css`. |
| Gunakan semantik teks yang tepat (`<span>` atau `<a>`) untuk chip/tag informasi kecil jika memang dibutuhkan. | DILARANG KERAS menggunakan elemen `<div>` badge dengan kombinasi utility `rounded-[4px] px-2.5 py-0.5` untuk membungkus label/eyebrow (selain `<div>` seperti `<span>` dan `<a>` tidak dilarang selama semantik benar). |
| Terapkan *single-open accordion* dan *single-open sidebar dropdown*: membuka satu item otomatis menutup item sebelumnya yang sedang terbuka. | Dilarang membiarkan banyak accordion/dropdown terbuka secara bersamaan yang membuat halaman bertumpuk dan panjang (*multi-open bloat*). |
| Sederhanakan utility anak yang berulang pada grup tombol/tab menggunakan selector Tailwind v4 `*:` (seperti `*:not-last:*` dan `*:nth-[n]:*`) di level parent container. | Dilarang menduplikasi belasan utility styling tombol yang sama persis secara manual di setiap tag `<button>` `<div>` `<span>` `<a>` `<input>` `<ul>` `<li>` jika berada dalam satu grup container seragam (*boilerplate clutter*). |
| Batasi selector `*:` hanya untuk layout, dimensi, radius, border, dan base styling seragam; pasang state `hover:...` secara eksplisit langsung pada masing-masing elemen anak interaktif (`<a>`, `<button>`). | Dilarang menggabungkan utility `hover:` ke dalam selector `*:` di level parent (`*:hover:...` atau `hover:*:...`) karena merusak isolasi interaksi elemen. |
| Gunakan komponen terpusat `<Breadcrumb />` (`src/components/Breadcrumb.astro`) untuk semua navigasi jejak hierarki halaman. | Dilarang menduplikasi markup nav breadcrumb manual/inline secara berulang di setiap file halaman (*anti-DRY*). |
| Terapkan pola *Status Tabs & Segmented Control Zero-Load* (`<button type="button" role="tab">` di dalam `inline-flex bg-surface-subtle *:px-2.5 *:py-1 *:text-[11px] *:first:rounded-l-[4px] *:last:rounded-r-[4px]`) untuk seluruh filter status CMS. | Dilarang menggunakan tag anchor `<a>` yang memicu full page reload / browser navigation ("ngeload") untuk tab filter status in-page, dan dilarang menduplikasi padding serta border-radius ber-gap terpisah di setiap tab. |
| Gunakan 100% Tailwind utility classes dan classList manipulation (`classList.add('hidden')`, `classList.remove('hidden')`) untuk seluruh layout, dimensi, dan visibilitas elemen/modal. | DILARANG KERAS menggunakan inline `style="..."` di elemen mana pun (seperti `style="display: none;"`, `style="width: ...;"`, `style="color: ...;"`). |
| Pusatkan seluruh CSS khusus, aturan cetak `@page`, `@media print`, dan engine formulir A4 secara terpusat di `src/styles/global.css`. | DILARANG KERAS menyematkan blok `<style>` duplikat ratusan baris di `<head>` per-halaman. Halaman wajib bersih dan hanya mengonsumsi kelas semantik dari `global.css`. |
| Bungkus seluruh halaman menggunakan komponen layout terpusat (`Layout.astro`, `AdminLayout.astro`, atau `PrintLayout.astro`). | DILARANG KERAS menduplikasi root boilerplate `<!doctype html>`, `<html lang="id">`, `<head>`, dan `<body>` secara manual berulang-ulang di file halaman (`src/pages/**`). |
| Gunakan latar belakang solid `bg-surface` dengan garis 1px `border border-border` pada semua kartu (KPI, statistik, panel data). Tampilkan indikator status melalui teks angka metrik (`text-success`, `text-warning`, `text-error`) atau chip kecil. | Dilarang keras memakai background transparansi rendah (`bg-white/50`, `bg-surface/60`, `backdrop-blur-*`) atau mewarnai seluruh badan kartu dengan tint status (`bg-success-light`, `bg-warning-light`, `bg-error-light`) yang terlihat pudar dan kusam/berlumpur di dark mode. |
| Gunakan komponen terpusat `<Pagination />` (`src/components/Pagination.astro`) untuk seluruh navigasi halaman (tabel CMS, direktori, berita). Manfaatkan mode `getPageUrl` untuk link server atau `id` container untuk mode client-side zero-load. | Dilarang keras menyalin-tempel puluhan baris HTML tombol pagination mentah dan fungsi kalkulasi halaman berulang-ulang di setiap file halaman (*boilerplate pagination clutter*). |
| Gunakan tombol switch toggle (`role="switch" h-5 w-9 rounded-full bg-primary / bg-border`) untuk kolom status tabel CMS interaktif. | Dilarang menggunakan tombol teks status mentah ("Aktif"/"Nonaktif") pada kolom status tabel interaktif yang memboroskan ruang dan membingungkan interaksi. |
| Gunakan tombol aksi icon-only (`<Icon name="edit" />`, `<Icon name="trash" />`) berukuran proporsional (`h-7 w-7` atau `h-6.5 w-6.5`) pada kolom tindakan tabel dan baris hierarki navigasi. | Dilarang menulis tombol tindakan bertuliskan teks panjang ("Edit", "Hapus") pada kolom tindakan tabel data atau menyembunyikan aksi primer ke dalam menu 3-titik yang memperlambat alur kerja. |
| Pisahkan header halaman, modal, dan section menggunakan spasi natural (*breathing room* seperti `space-y-6`, `pb-6`, `py-4`) atau kontur kartu utuh (`border border-border rounded-[8px] bg-surface`). | DILARANG KERAS menggunakan garis pemisah horizontal ad-hoc seperti `border-b border-border` dan `border-t border-border` di mana pun (header halaman, card header, modal header/footer, pemisah section) yang memotong ritme visual layout. |
| Gunakan komponen terpusat `<Icon name="..." />` (`src/components/Icon.astro`) untuk seluruh kebutuhan ikon, dan terapkan pola 3-state interaktif pada tombol simpan (ikon disket saat *idle*, *spinner* saat *loading*, centang `<Icon name="check" />` saat *sukses*). | Dilarang keras menyalin inline SVG mentah berulang kali di template halaman, dan dilarang membuat tombol simpan statis tanpa visual feedback status (ikon disket/spinner/centang). |
| Gunakan `loading="eager"` dan `fetchpriority="high"` HANYA pada gambar pertama (hero / slide 1 / cover LCP utama), serta sertakan `width` dan `height` eksplisit pada seluruh `<img>`. | DILARANG KERAS menggunakan `loading="lazy"` pada gambar LCP atau membiarkan tag `<img>` tanpa atribut `width` dan `height` yang memicu Cumulative Layout Shift (CLS). |
| Muat gambar di bawah fold (*below-the-fold*), galeri, fasilitas, dan guru dengan `loading="lazy"` dan bungkus dalam kontainer ber-aspect ratio (`aspect-* bg-surface-subtle`). | Dilarang mengunduh seluruh aset gambar slider secara serentak di awal load tanpa evaluasi lazy (`data-src`). |
| Gunakan penutup berpasangan `<button ...></button>` pada seluruh elemen tombol interaktif, dots pagination, dan modal trigger. | DILARANG KERAS menulis `<button ... />` (*self-closing*) yang merupakan sintaks invalid HTML5 dan merusak pohon DOM browser. |
| Sertakan atribut `alt` deskriptif pada setiap `<img>`, `aria-label` pada tautan kartu foto (`<a>`), serta `title` pada `<iframe>` peta. | Dilarang membiarkan gambar tanpa atribut `alt`, form input tanpa `aria-label`/label, atau `<iframe>` tanpa atribut `title`. |
| Pindahkan pemanggilan Google Fonts dan stylesheet eksternal ke `<head>` file layout utama menggunakan `rel="preconnect"` dan `rel="stylesheet"`. | DILARANG KERAS menggunakan `@import url(...)` di dalam file `global.css` yang memblokir proses rendering CSS halaman (*critical render-blocking waterfall*). |
| Gunakan engine Anime.js terpusat (`src/scripts/animePublic.ts`) dengan kurva `inOutSine` (850ms–1000ms) serta per-property duration (`opacity: 480ms outSine`, `translateY: 920-1000ms inOutSine`) untuk entrance landai bergelombang dan bidirectional scroll. | Dilarang keras menggunakan easing agresif seperti `outQuart`/`outExpo` yang berakhir terlalu cepat atau mengerem mendadak, dilarang menyatukan durasi opacity dengan translateY yang menyebabkan teks remang-remang, dan dilarang animasi one-off yang mati saat di-scroll ke atas. |
| Terapkan arsitektur Tripartite Cloned Sets (3 set identik) dengan normalisasi posisi scroll otomatis (`normalizePosition`) serta dukungan gesture touch-swipe/mouse-drag pada seluruh carousel slider horizontal (Guru, Testimoni, Mitra/Kampus). | DILARANG KERAS menggunakan mekanisme rewind melompat ke awal (`scrollTo({ left: 0 })` saat mencapai ujung track) yang merusak kontinuitas visual, dan dilarang mengunci navigasi slider hanya pada tombol panah klik tanpa dukungan gestur sentuh/geser bebas. |
