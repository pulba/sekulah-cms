import { db, users, categories, articles, agendas, announcements, teachers, settings, extracurriculars, facilities, studentsAlumni, studentEnrollmentStats, graduationTracerStats } from './index';
import { fallbackAchievements } from '../utils/fallbackAchievements';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../server/auth';

async function seed() {
  console.log('🌱 Melakukan seeding data awal sekolah...');

  // 1. Setting Identitas Sekolah
  const initialSettings = [
    { key: 'school_name', value: 'SMAN 1 Unggulan', description: 'Nama resmi sekolah' },
    { key: 'city', value: 'Jakarta', description: 'Kota/Kabupaten sekolah' },
    { key: 'province', value: 'DKI Jakarta', description: 'Provinsi sekolah' },
    { key: 'npsn', value: '20101234', description: 'Nomor Pokok Sekolah Nasional' },
    { key: 'accreditation', value: 'A (Unggul)', description: 'Status akreditasi BAN-S/M' },
    { key: 'address', value: 'Jl. Pendidikan No. 45, Kota Pendidikan', description: 'Alamat kampus' },
    { key: 'email', value: 'info@sman1unggulan.sch.id', description: 'Email resmi sekolah' },
    { key: 'phone', value: '(021) 555-0199', description: 'Nomor telepon pelayanan' },
    { key: 'stat_1_value', value: '1.250+', description: 'Nilai statistik 1' },
    { key: 'stat_1_label', value: 'Siswa Aktif', description: 'Label statistik 1' },
    { key: 'stat_1_desc', value: 'Tersebar di seluruh rombel kelas binaan', description: 'Keterangan statistik 1' },
    { key: 'stat_2_value', value: '88%', description: 'Nilai statistik 2' },
    { key: 'stat_2_label', value: 'Diterima PTN Favorit', description: 'Label statistik 2' },
    { key: 'stat_2_desc', value: 'Jalur SNBP, SNBT, dan Talenta Mandiri', description: 'Keterangan statistik 2' },
    { key: 'stat_3_value', value: '76', description: 'Nilai statistik 3' },
    { key: 'stat_3_label', value: 'Tenaga Pendidik', description: 'Label statistik 3' },
    { key: 'stat_3_desc', value: 'Guru tersertifikasi kompetensi resmi', description: 'Keterangan statistik 3' },
    { key: 'stat_4_value', value: '54', description: 'Nilai statistik 4' },
    { key: 'stat_4_label', value: 'Piala Prestasi 2025', description: 'Label statistik 4' },
    { key: 'stat_4_desc', value: 'Capaian riset, olimpiade, dan seni budaya', description: 'Keterangan statistik 4' },
    { key: 'principal_welcome_active', value: 'true', description: 'Status aktif seksi sambutan beranda' },
    { key: 'principal_name', value: 'Dr. H. Sulaiman, M.Pd.', description: 'Nama Kepala Sekolah' },
    { key: 'principal_title', value: 'Kepala Sekolah SMAN 1 Unggulan', description: 'Jabatan Kepala Sekolah' },
    { key: 'principal_photo', value: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80', description: 'Foto pimpinan sekolah' },
    { key: 'principal_welcome_quote', value: 'Selamat datang di portal resmi institusi kami. Kami berkomitmen menyelenggarakan ekosistem pendidikan berstandar tinggi yang mengintegrasikan kecakapan teknologi, kedalaman riset, dan budi pekerti luhur.', description: 'Kutipan sambutan kepala sekolah' },
    { key: 'principal_welcome_button', value: 'Baca Profil Selengkapnya', description: 'Label tombol sambutan' },
    { key: 'principal_welcome_url', value: '/profil', description: 'Tautan tombol sambutan' },
    { key: 'school_profile_active', value: 'true', description: 'Status aktif seksi sekilas profil & video di beranda' },
    { key: 'school_profile_title', value: 'Membina Generasi Unggul, Berkarakter & Berdaya Saing Global', description: 'Judul seksi profil beranda' },
    { key: 'school_profile_desc', value: 'SMAN 1 Unggulan mengintegrasikan kurikulum riset mutakhir, penguasaan sains dan teknologi kecerdasan buatan, serta pembinaan akhlak mulia dalam ekosistem kampus modern berstandar nasional.', description: 'Narasi ringkas profil sekolah' },
    { key: 'school_vision', value: 'Menjadi pusat keunggulan pendidikan yang melahirkan cendekiawan berakhlak mulia, berjiwa riset, dan kompetitif di kancah internasional.', description: 'Visi utama sekolah' },
    { key: 'school_mission', value: 'Menyelenggarakan pembelajaran berbasis riset sains terapan dan literasi digital global\nMenempa kepribadian siswa yang berintegritas, mandiri, dan berjiwa pemimpin\nMenyediakan ekosistem kampus berwawasan lingkungan hijau dengan fasilitas modern', description: 'Misi utama sekolah' },
    { key: 'school_video_url', value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', description: 'Tautan video profil resmi YouTube' },
    { key: 'school_video_thumbnail', value: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80', description: 'Thumbnail cover video profil' },
    { key: 'school_profile_cta_text', value: 'Selengkapnya Tentang Sekolah', description: 'Teks tombol CTA profil' },
    { key: 'school_profile_cta_url', value: '/profil', description: 'Tautan tombol CTA profil' },
    { key: 'alumni_section_active', value: 'true', description: 'Status aktif seksi testimoni alumni di beranda' },
    { key: 'alumni_section_title', value: 'Kisah Inspiratif & Jejak Langkah Alumni', description: 'Judul seksi testimoni alumni' },
    { key: 'alumni_section_desc', value: 'Mendengar pengalaman dan cerita sukses para lulusan yang kini berkiprah di perguruan tinggi ternama serta dunia profesional global.', description: 'Deskripsi seksi alumni beranda' },
    { key: 'theme_preset', value: 'emerald', description: 'Preset tema tampilan aktif' },
    { key: 'primary_color', value: '#064734', description: 'Identitas warna utama sekolah' },
    { key: 'secondary_color', value: '#E0FFC2', description: 'Identitas warna pendukung sekolah' },
    { key: 'tertiary_color', value: '#D9F45B', description: 'Identitas warna aksen sekolah' },
    { key: 'theme_mode', value: 'light', description: 'Mode tampilan default (light, dark, system)' },
  ];

  for (const s of initialSettings) {
    await db.insert(settings).values(s).onConflictDoNothing();
  }

  // 2. Akun Super Admin & Editor (Sprint 1 RBAC)
  const defaultAdminHash = await hashPassword('admin123');
  const defaultEditorHash = await hashPassword('editor123');

  const adminUser = {
    id: 'admin_initial_01',
    email: 'admin@sman1unggulan.sch.id',
    name: 'Administrator IT',
    passwordHash: defaultAdminHash,
    role: 'super_admin' as const,
    isActive: true,
  };
  await db.insert(users).values(adminUser).onConflictDoUpdate({
    target: users.email,
    set: { passwordHash: defaultAdminHash },
  });

  const editorUser = {
    id: 'editor_initial_01',
    email: 'editor@sman1unggulan.sch.id',
    name: 'Staf Redaksi & Humas',
    passwordHash: defaultEditorHash,
    role: 'editor' as const,
    isActive: true,
  };
  await db.insert(users).values(editorUser).onConflictDoUpdate({
    target: users.email,
    set: { passwordHash: defaultEditorHash },
  });

  // 3. Kategori
  const initialCategories = [
    { name: 'Prestasi', slug: 'prestasi' },
    { name: 'Akademik', slug: 'akademik' },
    { name: 'Fasilitas', slug: 'fasilitas' },
    { name: 'Kesiswaan', slug: 'kesiswaan' },
  ];

  for (const cat of initialCategories) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }

  // 4. Pengumuman Cepat
  await db.insert(announcements).values({
    text: 'Pendaftaran Peserta Didik Baru (PPDB) Jalur Afirmasi & Zonasi dibuka mulai 10 November 2026.',
    linkUrl: '/ppdb',
    linkText: 'Lihat Alur & Syarat',
    isActive: true,
    isUrgent: true,
  }).onConflictDoNothing();

  // 5. Agenda Sekolah
  const initialAgendas = [
    {
      title: 'Peringatan Hari Sumpah Pemuda & Gelar Karya P5',
      description: 'Pentas seni kebudayaan nusantara dan pameran proyek profil pelajar pancasila.',
      eventDate: '2026-10-28',
      endDate: null,
      startTime: '07:30',
      endTime: '13:00',
      location: 'Auditorium Graha Widya',
      isCompleted: false,
    },
    {
      title: 'Rapat Pleno Orang Tua/Wali Murid Evaluasi Tengah Semester',
      description: 'Penyampaian capaian rapor tengah semester dan pemetaan minat siswa.',
      eventDate: '2026-11-04',
      endDate: null,
      startTime: '08:30',
      endTime: '11:30',
      location: 'Aula Pertemuan Gedung B',
      isCompleted: false,
    },
    {
      title: 'Simulasi Asesmen Nasional Berbasis Komputer (ANBK)',
      description: 'Uji coba sinkronisasi server dan gladi bersih pengerjaan soal asesmen literasi-numerasi.',
      eventDate: '2026-11-12',
      endDate: '2026-11-13',
      startTime: '08:00',
      endTime: '14:30',
      location: 'Lab Komputer 1 & 2',
      isCompleted: false,
    },
    {
      title: 'Workshop Peningkatan Kompetensi Guru & Kurikulum Merdeka',
      description: 'Pelatihan penyusunan modul ajar diferensiasi dan pemanfaatan media pembelajaran digital.',
      eventDate: '2026-11-20',
      endDate: null,
      startTime: '09:00',
      endTime: '15:00',
      location: 'Ruang Multimedia Lantai 2',
      isCompleted: false,
    },
    {
      title: 'Penilaian Akhir Semester (PAS) Ganjil TA 2026/2027',
      description: 'Pekan evaluasi belajar semester ganjil seluruh jenjang kelas X, XI, dan XII.',
      eventDate: '2026-12-01',
      endDate: '2026-12-10',
      startTime: '07:30',
      endTime: '12:00',
      location: 'Ruang Kelas X, XI, XII',
      isCompleted: false,
    },
    {
      title: 'Pembagian Rapor & Evaluasi Hasil Belajar Semester Ganjil',
      description: 'Penyerahan laporan hasil evaluasi semester ganjil kepada orang tua dan wali siswa.',
      eventDate: '2026-12-19',
      endDate: null,
      startTime: '08:00',
      endTime: '12:00',
      location: 'Ruang Kelas Masing-masing',
      isCompleted: false,
    },
  ];

  for (const a of initialAgendas) {
    const exists = await db.select().from(agendas).where(eq(agendas.title, a.title)).limit(1).then(r => r[0]);
    if (!exists) {
      await db.insert(agendas).values(a);
    }
  }

  // 6. Guru & Tenaga Kependidikan
  const initialTeachers = [
    {
      name: 'Dr. H. Sulaiman, M.Pd.',
      nip: '197508122000031002',
      position: 'Kepala Sekolah',
      subject: 'Manajemen Pendidikan',
      orderNumber: 1,
      isActive: true,
    },
    {
      name: 'Dra. Sri Wahyuni, M.Si.',
      nip: '198003152005012004',
      position: 'Wakil Kepala Sekolah Kurikulum',
      subject: 'Fisika',
      orderNumber: 2,
      isActive: true,
    },
    {
      name: 'Budi Santoso, S.Pd.',
      nip: '198811202010011009',
      position: 'Guru Pengampu',
      subject: 'Matematika Peminatan',
      orderNumber: 3,
      isActive: true,
    },
  ];

  for (const t of initialTeachers) {
    await db.insert(teachers).values(t).onConflictDoNothing();
  }

  // 7. Artikel Berita Awal
  const initialArticles = [
    {
      slug: 'siswa-raih-medali-emas-osn-astronomi-2026',
      title: 'Delegasi Siswa Raih Medali Emas Olimpiade Sains Nasional (OSN) Bidang Astronomi',
      summary: 'Raihan gemilang siswa binaan tim olimpiade sekolah menorehkan peringkat pertama nasional setelah rangkaian kompetisi ketat selama lima hari.',
      content: `<p>Prestasi membanggakan kembali ditorehkan oleh siswa-siswi SMAN 1 Unggulan di kancah nasional. Dalam ajang Olimpiade Sains Nasional (OSN) yang berlangsung pada pertengahan Oktober 2026, delegasi sekolah berhasil menyabet Medali Emas pada cabang Astronomi.</p><p>Kompetisi yang diikuti oleh lebih dari 500 peserta terbaik dari seluruh penjuru Indonesia ini menguji pemahaman mendalam tentang mekanika benda langit, astrofisika observasional, dan analisis data citra teleskopik.</p><h3>Dukungan Pembinaan Berkelanjutan</h3><p>Kepala Sekolah, Dr. H. Sulaiman, M.Pd., menyampaikan apresiasi setinggi-tingginya kepada tim pembina dan orang tua siswa. "Keberhasilan ini adalah buah dari ketekunan latihan di laboratorium sains dan kerja keras pendampingan guru selama berbulan-bulan," tuturnya.</p><p>Sekolah berkomitmen terus memfasilitasi minat dan bakat riset sains generasi muda demi mencetak calon ilmuwan yang berdaya saing global.</p>`,
      coverImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      categoryId: 1, // Prestasi
      authorId: 'admin_initial_01',
      status: 'published' as const,
      publishedAt: '2026-10-22 09:00:00',
      viewCount: 142,
      metaTitle: 'Juara 1 OSN Astronomi 2026 — SMAN 1 Unggulan',
      metaDescription: 'Dokumentasi raihan medali emas olimpiade sains nasional bidang astronomi siswa SMAN 1 Unggulan.',
    },
    {
      slug: 'sosialisasi-alur-pendaftaran-snbp-2027',
      title: 'Sosialisasi Alur Pendaftaran Seleksi Masuk PTN Melalui Jalur Prestasi (SNBP)',
      summary: 'Bimbingan konseling menyelenggarakan pendampingan komprehensif bagi seluruh wali murid kelas XII guna pemetaan jurusan perguruan tinggi.',
      content: `<p>Menjelang pembukaan seleksi masuk perguruan tinggi negeri tahun ajaran baru, unit Bimbingan dan Konseling (BK) menyelenggarakan sosialisasi alur Seleksi Nasional Berdasarkan Prestasi (SNBP).</p><p>Acara yang berlangsung di Auditorium Graha Widya dihadiri oleh ratusan orang tua dan murid kelas XII dengan antusiasme tinggi.</p><h3>Fokus Pemetaan Minat dan Portofolio</h3><p>Materi yang disampaikan meliputi pembobotan nilai rapor semester 1 hingga 5, sertifikasi prestasi kejuaraan yang diakui kementerian, serta analisis rasio kelulusan di program studi kedokteran, teknik, dan humaniora favorit.</p>`,
      coverImage: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1200&q=80',
      categoryId: 2, // Akademik
      authorId: 'admin_initial_01',
      status: 'published' as const,
      publishedAt: '2026-10-18 10:30:00',
      viewCount: 98,
      metaTitle: 'Sosialisasi Alur SNBP 2027 — Panduan Wali Murid',
      metaDescription: 'Informasi dan tahapan bimbingan seleksi masuk PTN jalur prestasi SNBP di SMAN 1 Unggulan.',
    },
    {
      slug: 'revitalisasi-laboratorium-komputasi-dan-ai',
      title: 'Revitalisasi Laboratorium Komputasi dan AI untuk Pembelajaran Berbasis Riset',
      summary: 'Sekolah meresmikan ruang laboratorium terpadu berdaya komputasi tinggi demi mendukung riset sains data dan kurikulum kecerdasan buatan.',
      content: `<p>Sebagai langkah konkret merespons perkembangan teknologi masa depan, SMAN 1 Unggulan meresmikan fasilitas Laboratorium Komputasi Terpadu dan AI pada pekan lalu.</p><p>Laboratorium ini dilengkapi dengan 40 unit komputer berdaya komputasi tinggi, koneksi internet serat optik berkecepatan 1 Gbps, serta perangkat lunak pengembangan sains data.</p><h3>Kurikulum Berorientasi Proyek</h3><p>Fasilitas ini tidak hanya digunakan untuk mata pelajaran informatika reguler, namun juga menjadi sentra pelatihan ekstrakurikuler robotika, pemrograman kecerdasan buatan, dan kompetisi keamanan siber.</p>`,
      coverImage: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
      categoryId: 3, // Fasilitas
      authorId: 'admin_initial_01',
      status: 'published' as const,
      publishedAt: '2026-10-12 14:15:00',
      viewCount: 215,
      metaTitle: 'Laboratorium Komputasi & AI Baru — SMAN 1 Unggulan',
      metaDescription: 'Peresmian laboratorium sains data dan kecerdasan buatan untuk mendukung pembelajaran riset siswa.',
    },
  ];

  for (const art of initialArticles) {
    await db.insert(articles).values(art).onConflictDoNothing();
  }

  // 7. Data Ekstrakurikuler Unggulan
  const initialEkskul = [
    {
      name: 'Tim Robotika & Riset Ilmiah (KIR)',
      category: 'Sains & Robotik',
      schedule: 'Setiap Jumat, 15.30 - 17.30 WIB',
      coach: 'Ir. Hendra Gunawan, S.Kom.',
      description: 'Pengembangan mikrokontroler Arduino, IoT cerdas, otomasi robot, dan riset teknologi terapan berstandar kompetisi nasional.',
      imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=80',
      orderNumber: 1,
      isActive: true,
    },
    {
      name: 'Paskibra Samapta Nusantara',
      category: 'Kepemimpinan',
      schedule: 'Selasa & Sabtu, 15.30 - 17.30 WIB',
      coach: 'Kapten (Purn) Danu Wibowo',
      description: 'Menempa kedisiplinan prima, formasi baris-berbaris protokoler kepresidenan, dan integritas kepemimpinan karakter bangsa.',
      imageUrl: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80',
      orderNumber: 2,
      isActive: true,
    },
    {
      name: 'Pramuka Gugus Depan 01-199',
      category: 'Kepanduan',
      schedule: 'Setiap Sabtu, 08.00 - 11.00 WIB',
      coach: 'Drs. Bambang Sudirman',
      description: 'Pendidikan kepanduan kepemimpinan alam terbuka, survival, navigasi darat, pionering, dan pengabdian masyarakat tangguh.',
      imageUrl: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80',
      orderNumber: 3,
      isActive: true,
    },
    {
      name: 'Klub Bola Basket Putra & Putri',
      category: 'Olahraga',
      schedule: 'Senin & Kamis, 16.00 - 18.00 WIB',
      coach: 'Coach Aris Pratama, S.Or.',
      description: 'Pembinaan intensif teknik dasar fundamental basket, strategi bertahan/menyerang, dan persiapan turnamen DBL regional.',
      imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
      orderNumber: 4,
      isActive: true,
    },
    {
      name: 'Paduan Suara & Orkestra Gita Cendekia',
      category: 'Kesenian',
      schedule: 'Rabu & Jumat, 15.30 - 17.30 WIB',
      coach: 'Elisa Maharani, S.Sn.',
      description: 'Eksplorasi olah vokal paduan suara harmonis 4 suara, ansambel musik akustik, dan repertoar musik daerah hingga klasik.',
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
      orderNumber: 5,
      isActive: true,
    },
    {
      name: 'Palang Merah Remaja (PMR Wira)',
      category: 'Kemanusiaan',
      schedule: 'Setiap Rabu, 15.30 - 17.00 WIB',
      coach: 'Ns. Siti Rahma, S.Kep.',
      description: 'Keterampilan pertolongan pertama pada kecelakaan (P3K), kesiapsiagaan bencana, donor darah, dan bakti sosial kesehatan.',
      imageUrl: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80',
      orderNumber: 6,
      isActive: true,
    },
  ];

  for (const eks of initialEkskul) {
    const existing = await db.select().from(extracurriculars).where(eq(extracurriculars.name, eks.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(extracurriculars).values(eks);
    }
  }

  // 8. Data Fasilitas Sekolah Unggulan
  const initialFacilities = [
    {
      name: 'Laboratorium Komputasi AI & Multimedia',
      category: 'Laboratorium',
      location: 'Gedung Teknologi Lt. 2',
      capacity: '40 PC High-Performance',
      description: 'Sentra komputasi riset sains data dan AI dengan jaringan internet gigabit dedicated, proyektor laser interaktif, dan pendingin server.',
      imageUrl: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80',
      orderNumber: 1,
      isActive: true,
    },
    {
      name: 'Perpustakaan Digital Graha Cendekia',
      category: 'Ruang Belajar',
      location: 'Gedung Utama Sayap Timur',
      capacity: '120 Pembaca & 10.000+ Koleksi',
      description: 'Ruang baca bernuansa tenang dilengkapi akses e-journal internasional, bilik riset individu, katalog otomatis OPAC, dan kafe literasi.',
      imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
      orderNumber: 2,
      isActive: true,
    },
    {
      name: 'Laboratorium Sains Terpadu (Fisika, Kimia, Biologi)',
      category: 'Laboratorium',
      location: 'Gedung Graha Riset Lt. 1 & 2',
      capacity: '36 Siswa per Laboratorium',
      description: 'Dilengkapi lemari asam standar internasional, spektrofotometer, mikroskop binokuler digital, serta stasiun pengujian biokimia aman.',
      imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
      orderNumber: 3,
      isActive: true,
    },
    {
      name: 'Gelanggang Olahraga & Lapangan Multifungsi',
      category: 'Olahraga',
      location: 'Area Terbuka Kompleks Barat',
      capacity: '800 Penonton Tribun',
      description: 'Lapangan serbaguna beralas standar kompetisi untuk pertandingan bola basket, voli, dan futsal dilengkapi lampu sorot malam hari.',
      imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
      orderNumber: 4,
      isActive: true,
    },
    {
      name: 'Auditorium Graha Utama',
      category: 'Penunjang',
      location: 'Gedung Serbaguna Pusat',
      capacity: '750 Kursi Ergonomis',
      description: 'Gedung pertemuan representatif berakustik prima dengan panggung pentas seni megah, videotron LED 6x3m, dan sistem tata suara digital.',
      imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
      orderNumber: 5,
      isActive: true,
    },
    {
      name: 'Poliklinik UKS Berstandar Puskesmas',
      category: 'Kesehatan & Ibadah',
      location: 'Gedung Penunjang Lt. 1',
      capacity: '6 Tempat Tidur Rawat',
      description: 'Fasilitas kesehatan sekolah dengan tenaga medis perawat siaga, tabung oksigen, obat-obatan esensial, dan rekam medis digital siswa.',
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
      orderNumber: 6,
      isActive: true,
    },
  ];

  for (const fac of initialFacilities) {
    const existing = await db.select().from(facilities).where(eq(facilities.name, fac.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(facilities).values(fac);
    }
  }

  // 7. Prestasi Siswa & Tracer Study Alumni
  const initialStudentsAlumni = [
    {
      name: 'dr. Farhan Ramadhan',
      type: 'alumni' as const,
      title: 'Dokter Residen Bedah Saraf',
      organization: 'RSUPN Dr. Cipto Mangunkusumo / FK UI',
      year: '2018',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
      description: 'Pembiasaan riset mandiri dan keteladanan bapak ibu guru di SMAN 1 Unggulan menjadi modal utama saya menempuh jenjang kedokteran yang menuntut stamina mental serta ketelitian tingkat tinggi.',
      isPublicConsent: true,
    },
    {
      name: 'Alisha Salsabila, B.Eng',
      type: 'alumni' as const,
      title: 'Robotics & Embedded Systems Engineer',
      organization: 'Mitsubishi Electric Tokyo / STEI ITB',
      year: '2020',
      photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
      description: 'Laboratorium komputer dan bimbingan klub robotika di sekolah ini luar biasa progresif. Kami dilatih memecahkan persoalan riil dengan teknologi terkini sejak bangku kelas X.',
      isPublicConsent: true,
    },
    {
      name: 'Muhammad Rayhan Pratama, S.Kom',
      type: 'alumni' as const,
      title: 'Senior Cloud Solutions Architect',
      organization: 'Unicorn Tech Indonesia / Fasilkom UI',
      year: '2019',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      description: 'Bukan hanya unggul di ruang kelas sains, atmosfer organisasi OSIS dan kegiatan kepemimpinan di sekolah membentuk cara berpikir terstruktur, kerja tim, dan ketahanan karier saya.',
      isPublicConsent: true,
    },
    {
      name: 'Nabila Zahra Putri, S.Farm',
      type: 'alumni' as const,
      title: 'Peneliti Formulasi Farmasi Klinis',
      organization: 'Fakultas Farmasi Universitas Gadjah Mada',
      year: '2021',
      photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
      description: 'Guru-guru selalu memberi ruang apresiasi bagi minat riset siswa. Pendampingan intensif olimpiade kimia menjadi gerbang utama saya mendapatkan beasiswa penuh di kampus impian.',
      isPublicConsent: true,
    },
    {
      name: 'Kayla Azzahra & Tim Riset Astronomi',
      type: 'achievement' as const,
      title: 'Medali Emas Olimpiade Sains Nasional (OSN) Astronomi 2026',
      organization: 'Pusat Prestasi Nasional Kemendikbudristek',
      year: '2026',
      photoUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80',
      description: 'Meraih skor tertinggi nasional dalam pengolahan citra spektrum galaksi dan mekanika orbit teleskopik.',
      isPublicConsent: true,
    },
    {
      name: 'Satria Bagus Pambudi',
      type: 'achievement' as const,
      title: 'Juara 1 Lomba Inovasi IoT Pelajar Indonesia',
      organization: 'Institut Teknologi Sepuluh Nopember (ITS)',
      year: '2025',
      photoUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80',
      description: 'Menciptakan prototipe stasiun pemantau kualitas udara berbasis sensor LoRaWAN bertenaga panel surya mandiri.',
      isPublicConsent: true,
    },
  ];

  for (const record of initialStudentsAlumni) {
    const existing = await db
      .select()
      .from(studentsAlumni)
      .where(eq(studentsAlumni.name, record.name))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(studentsAlumni).values(record);
    }
  }

  for (const item of fallbackAchievements) {
    const existing = await db
      .select()
      .from(studentsAlumni)
      .where(eq(studentsAlumni.title, item.title))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(studentsAlumni).values({
        name: item.name,
        type: 'achievement',
        title: item.title,
        organization: item.organization,
        year: item.year,
        photoUrl: item.photoUrl,
        description: item.description,
        isPublicConsent: true,
      });
    }
  }

  // 10. Rekapitulasi Kesiswaan (Dapodik) & Kelanjutan Lulusan (Tracer Study Cohort)
  const initialEnrollment = [
    { academicYear: '2026/2027', totalStudents: 1250, maleCount: 610, femaleCount: 640, rombelCount: 36, source: 'Dapodik Kemendikbudristek', isActive: true },
    { academicYear: '2025/2026', totalStudents: 1225, maleCount: 600, femaleCount: 625, rombelCount: 36, source: 'Dapodik Kemendikbudristek', isActive: false },
  ];
  for (const item of initialEnrollment) {
    await db.insert(studentEnrollmentStats).values(item).onConflictDoNothing();
  }

  const initialTracer = [
    { graduationYear: '2025', totalGraduates: 200, ptnAcceptedUnique: 176, ptsAccepted: 14, workingCount: 6, entrepreneurCount: 4, notes: 'Jalur SNBP, SNBT, dan Talenta Mandiri', isActive: true },
    { graduationYear: '2024', totalGraduates: 195, ptnAcceptedUnique: 166, ptsAccepted: 18, workingCount: 7, entrepreneurCount: 4, notes: 'Jalur SNBP dan UTBK-SNBT', isActive: false },
  ];
  for (const item of initialTracer) {
    await db.insert(graduationTracerStats).values(item).onConflictDoNothing();
  }

  console.log('✅ Seeding data awal berhasil tuntas.');
}

seed().catch((err) => {
  console.error('❌ Gagal melakukan seeding:', err);
  process.exit(1);
});
