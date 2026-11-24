import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1. Users & Hak Akses Admin (Kluster B1)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Firebase UID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['super_admin', 'editor'] }).notNull().default('editor'),
  avatarUrl: text('avatar_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 2. Kategori Berita & Artikel
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 3. Berita & Artikel (Kluster A2)
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(), // JSON Tiptap atau sanitized HTML
  coverImage: text('cover_image'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  publishedAt: text('published_at'),
  viewCount: integer('view_count').notNull().default(0),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  deletedAt: text('deleted_at'), // Soft delete timestamp
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 4. Agenda Sekolah (Kluster A2)
export const agendas = sqliteTable('agendas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: text('event_date').notNull(), // Tanggal Mulai format YYYY-MM-DD
  endDate: text('end_date'), // Tanggal Selesai opsional format YYYY-MM-DD
  startTime: text('start_time'), // format HH:mm
  endTime: text('end_time'),
  location: text('location').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at'),
});

// 5. Pengumuman Cepat / Running Banner (Kluster A2)
export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  linkUrl: text('link_url'),
  linkText: text('link_text'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isUrgent: integer('is_urgent', { mode: 'boolean' }).notNull().default(false),
  expiresAt: text('expires_at'), // format YYYY-MM-DD atau ISO string untuk auto-expiry
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 6. Direktori Guru & Tenaga Kependidikan (Kluster A3)
export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nip: text('nip'),
  position: text('position').notNull(), // misal "Kepala Sekolah", "Guru Madya"
  category: text('category', { enum: ['guru', 'tendik', 'pimpinan'] }).notNull().default('guru'),
  subject: text('subject'), // misal "Matematika", "Bahasa Inggris"
  photoUrl: text('photo_url'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 7. Prestasi Siswa & Tracer Study Alumni (Kluster A3)
export const studentsAlumni = sqliteTable('students_alumni', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['achievement', 'alumni'] }).notNull(),
  title: text('title').notNull(), // Judul Prestasi atau Jurusan/Instansi Alumni
  year: text('year').notNull(), // Tahun prestasi atau kelulusan
  organization: text('organization'), // Penyelenggara lomba atau PTN/Perusahaan
  photoUrl: text('photo_url'),
  description: text('description'),
  isPublicConsent: integer('is_public_consent', { mode: 'boolean' }).default(true), // PII consent
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 8. Halaman Statis Kustom (Kluster A4)
export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(), // e.g. "visi-misi", "fasilitas", "kurikulum"
  title: text('title').notNull(),
  content: text('content').notNull(),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});



// 9. Galeri Media Foto & YouTube (Kluster A4)
export const galleries = sqliteTable('galleries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  type: text('type', { enum: ['image', 'youtube'] }).notNull().default('image'),
  mediaUrl: text('media_url').notNull(),
  caption: text('caption'),
  albumName: text('album_name').default('Umum'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 10. Dokumen & Unduhan Publik (Kluster A4)
export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: text('file_size'), // e.g. "2.4 MB"
  fileType: text('file_type').default('PDF'),
  category: text('category').default('Umum'), // e.g. "Kalender Akademik", "Silabus"
  downloadCount: integer('download_count').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 11. Pengaturan Identitas & Layout (Kluster B2)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // e.g. "school_name", "npsn", "logo_url", "address"
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});



// 12. Audit Trail Keamanan (Kluster C1)
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, LOGIN
  entity: text('entity').notNull(), // article, agenda, teacher, setting, user
  entityId: text('entity_id'),
  details: text('details'), // JSON string ringkasan data yang diubah
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 13. Sesi Staf & Manajemen Token (Sprint 1 Keamanan)
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // 32-byte secure random hex
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userEmail: text('user_email').notNull(),
  userName: text('user_name').notNull(),
  role: text('role', { enum: ['super_admin', 'editor'] }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at').notNull(), // Unix timestamp (seconds)
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 14. Pencatatan Percobaan Login & Rate Limiting (Sprint 1 Keamanan)
export const loginAttempts = sqliteTable('login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ipAddress: text('ip_address').notNull(),
  email: text('email'),
  attemptedAt: integer('attempted_at').notNull(), // Unix timestamp (seconds)
  isSuccess: integer('is_success', { mode: 'boolean' }).notNull().default(false),
});

// 15. Pustaka Media / Media Library Terpusat
export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull(),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  mediumUrl: text('medium_url'),
  fileSize: integer('file_size').notNull(), // Ukuran dalam bytes
  fileType: text('file_type').notNull(), // MIME type (misal: image/jpeg, application/pdf)
  fileExtension: text('file_extension').notNull(), // jpg, png, pdf, mp4
  category: text('category').notNull().default('Umum'), // 'Logo & Atribut', 'Foto Kegiatan', 'Dokumen PPDB & Beasiswa', 'Materi Pembelajaran', 'Umum'
  title: text('title'),
  description: text('description'),
  altText: text('alt_text'), // Teks alternatif untuk aksesibilitas dan SEO
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false), // Dokumen sensitif seperti formulir PPDB
  uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  uploaderName: text('uploader_name'),
  storageKey: text('storage_key'),
  width: integer('width'),
  height: integer('height'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});




// 16. Banner Slider Hero Beranda (Kluster B2)
export const heroSlides = sqliteTable('hero_slides', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tagline: text('tagline'),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  imageUrl: text('image_url').notNull(),
  linkUrl: text('link_url'),
  linkText: text('link_text'),
  linkUrl2: text('link_url_2'),
  linkText2: text('link_text_2'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});




// 17. Ekstrakurikuler Sekolah (Kluster A3/Supporting Content)
export const extracurriculars = sqliteTable('extracurriculars', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Olahraga', 'Kesenian', 'Sains & Robotik', 'Kepanduan', 'Keagamaan', 'Kepemimpinan'
  schedule: text('schedule'), // e.g. "Jumat & Sabtu, 15.30 WIB"
  coach: text('coach'), // Nama Pembina / Pelatih
  description: text('description'),
  imageUrl: text('image_url'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});




// 18. Fasilitas Kampus & Sarana Prasarana (Kluster A4/Supporting Content)
export const facilities = sqliteTable('facilities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Laboratorium', 'Ruang Belajar', 'Olahraga', 'Penunjang', 'Kesehatan & Ibadah'
  location: text('location'), // e.g. "Gedung A Lantai 2"
  capacity: text('capacity'), // e.g. "40 Siswa" / "500 Orang"
  description: text('description'),
  imageUrl: text('image_url'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});




// 19. Data Registrasi Calon Siswa PPDB / PPDBM (Kluster C2 Keamanan & Integritas Data)
export const registrations = sqliteTable(
  'registrations',
  {
    id: text('id').primaryKey(), // ID unik UUID v4
    registrationNumber: text('registration_number').notNull().unique(), // Format server e.g. REG-2026-XXXXXX
    academicYear: text('academic_year').notNull(), // e.g. "2026/2027"
    wave: text('wave').default('Gelombang 1'), // e.g. "Gelombang 1", "Gelombang 2"
    regType: text('reg_type').notNull(), // 'Baru' | 'Pindahan'
    admissionPath: text('admission_path').notNull(), // Jalur pendaftaran yang diverifikasi server
    schoolType: text('school_type').notNull(), // Satuan: SMA, SMK, MA, SMP, MTS, SD, MI
    majorChoice1: text('major_choice_1'), // Pilihan kompetensi keahlian 1 (SMK/MA)
    majorChoice2: text('major_choice_2'), // Pilihan kompetensi keahlian 2 (SMK/MA)
    isBoarding: integer('is_boarding', { mode: 'boolean' }).notNull().default(false), // Layanan asrama

    // Identitas Calon Siswa (PII Sensitif)
    fullName: text('full_name').notNull(),
    nik: text('nik').notNull(), // Tepat 16 digit string pengenal (bukan angka/int)
    nisn: text('nisn'), // 10 digit string pengenal
    gender: text('gender').notNull(), // 'L' | 'P'
    birthPlace: text('birth_place').notNull(),
    birthDate: text('birth_date').notNull(), // Format ISO YYYY-MM-DD
    religion: text('religion').notNull(),
    prevSchool: text('prev_school').notNull(), // Asal sekolah / madrasah

    // Data Orang Tua & Wali
    fatherName: text('father_name').notNull(),
    fatherNik: text('father_nik'),
    fatherStatus: text('father_status'), // 'Hidup' | 'Meninggal'
    fatherEducation: text('father_education'),
    fatherJob: text('father_job'),
    fatherIncome: text('father_income'),
    fatherPhone: text('father_phone'),

    motherName: text('mother_name').notNull(),
    motherNik: text('mother_nik'),
    motherStatus: text('mother_status'),
    motherEducation: text('mother_education'),
    motherJob: text('mother_job'),
    motherIncome: text('mother_income'),
    motherPhone: text('mother_phone'),

    guardianName: text('guardian_name'),
    guardianNik: text('guardian_nik'),
    guardianJob: text('guardian_job'),
    guardianPhone: text('guardian_phone'),

    // Kontak & Domisili Calon Siswa
    address: text('address').notNull(),
    rtRw: text('rt_rw'),
    village: text('village').notNull(),
    district: text('district').notNull(),
    city: text('city').notNull(),
    province: text('province'),
    postalCode: text('postal_code'),
    phoneStudent: text('phone_student').notNull(),
    emailStudent: text('email_student'),

    // Berkas Lampiran
    fileKk: text('file_kk'),
    fileAkta: text('file_akta'),
    fileSkl: text('file_skl'),
    fileAdditional: text('file_additional'),

    // Integritas, Status & Audit
    status: text('status', { enum: ['submitted', 'verified', 'accepted', 'rejected'] }).notNull().default('submitted'),
    registrationStatus: text('registration_status', { enum: ['submitted', 'draft'] }).notNull().default('submitted'),
    verificationStatus: text('verification_status', { enum: ['pending', 'revision_required', 'verified'] }).notNull().default('pending'),
    selectionStatus: text('selection_status', { enum: ['not_announced', 'accepted', 'rejected', 'waitlist'] }).notNull().default('not_announced'),
    verificationCode: text('verification_code'), // Kode akses rahasia calon siswa (e.g. KOD-7X92)
    revisionNotes: text('revision_notes'), // Catatan instruksi perbaikan berkas dari verifikator
    verifiedBy: text('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: text('verified_at'),
    notes: text('notes'),
    configSnapshot: text('config_snapshot'), // Snapshot konfigurasi lembaga & PPDB saat form dikirim

    createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex('reg_number_unique_idx').on(table.registrationNumber),
    uniqueIndex('nik_academic_year_unique_idx').on(table.nik, table.academicYear),
  ]
);

// 20. Versi & Riwayat Konfigurasi Formulir PPDB (Dynamic Form Builder & Versioning)
export const ppdbFormVersions = sqliteTable('ppdb_form_versions', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  schoolType: text('school_type').notNull(),
  configJson: text('config_json').notNull(), // JSON lengkap 7 tahapan, field, opsi dropdown, aturan tampil
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  publishedAt: text('published_at'),
  publishedBy: text('published_by').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 21. Navigasi Website / Dynamic Navbar (Kluster B2)
export const navigationItems = sqliteTable('navigation_items', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull().default('default'),
  label: text('label').notNull(),
  type: text('type', { enum: ['page', 'dropdown'] }).notNull().default('page'),
  href: text('href'),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  showDesktop: integer('show_desktop', { mode: 'boolean' }).notNull().default(true),
  showMobile: integer('show_mobile', { mode: 'boolean' }).notNull().default(true),
  openInNewTab: integer('open_in_new_tab', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});


// 22. Pengumuman Kelulusan Siswa Tingkat Akhir (Kelas 12 / Kelas 9 / Kelas 6)
export const graduations = sqliteTable('graduations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  academicYear: text('academic_year').notNull(), // e.g. "2025/2026"
  nisn: text('nisn').notNull(), // 10 digit NISN
  nis: text('nis'), // Nomor Induk Siswa lokal
  name: text('name').notNull(), // Nama Lengkap Siswa
  className: text('class_name').notNull(), // e.g. "XII MIPA 1", "XII RPL 2"
  major: text('major'), // e.g. "MIPA", "IPS", "Teknik Komputer & Jaringan"
  gender: text('gender'), // 'L' | 'P'
  birthPlace: text('birth_place'),
  birthDate: text('birth_date'),
  status: text('status', { enum: ['LULUS', 'TIDAK_LULUS', 'DITUNDA'] }).notNull().default('LULUS'),
  letterNumber: text('letter_number'), // No. SKL / No. SK Kelulusan
  averageScore: text('average_score'), // Nilai rata-rata rapor/ijazah
  notes: text('notes'), // Catatan tambahan / Keterangan
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});


// 23. Bursa Kerja Khusus (BKK) & Kemitraan Industri (Khusus Satuan SMK)
export const bkkOpportunities = sqliteTable('bkk_opportunities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  companyName: text('company_name').notNull(),
  companyLogo: text('company_logo'),
  type: text('type', { enum: ['lowongan', 'magang', 'mitra_mou'] }).notNull().default('lowongan'),
  location: text('location').notNull(),
  salaryRange: text('salary_range'),
  deadline: text('deadline'),
  quota: text('quota'),
  requirements: text('requirements').notNull(),
  contactPerson: text('contact_person'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});


// 24. Ma'had & Kepesantrenan / Program Keagamaan (Khusus Madrasah MA/MTS & Boarding School)
export const mahadPrograms = sqliteTable('mahad_programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull().default('Tahfidz'),
  target: text('target'),
  schedule: text('schedule'),
  mentor: text('mentor'),
  description: text('description'),
  imageUrl: text('image_url'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 25. Rekapitulasi Data Siswa Periodik (SSOT Dapodik/EMIS Kesiswaan)
export const studentEnrollmentStats = sqliteTable('student_enrollment_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  academicYear: text('academic_year').notNull().unique(), // e.g. "2025/2026", "2026/2027"
  totalStudents: integer('total_students').notNull(),
  maleCount: integer('male_count'),
  femaleCount: integer('female_count'),
  rombelCount: integer('rombel_count'),
  source: text('source').default('Dapodik'), // e.g. "Dapodik Cut-Off 31 Agustus"
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 26. Rekapitulasi Kelanjutan Lulusan / Tracer Cohort (SSOT PTN / BKK)
export const graduationTracerStats = sqliteTable('graduation_tracer_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  graduationYear: text('graduation_year').notNull().unique(), // e.g. "2024", "2025"
  totalGraduates: integer('total_graduates').notNull(), // Penyebut
  ptnAcceptedUnique: integer('ptn_accepted_unique').notNull().default(0), // Pembilang PTN
  ptsAccepted: integer('pts_accepted').default(0),
  workingCount: integer('working_count').default(0), // Untuk SMK
  entrepreneurCount: integer('entrepreneur_count').default(0),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// 27. Mitra & Rekanan Kerja Sama (Perguruan Tinggi, Industri, Instansi)
export const partners = sqliteTable('partners', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull().default('Perguruan Tinggi'),
  logoUrl: text('logo_url').notNull(),
  websiteUrl: text('website_url'),
  description: text('description'),
  orderNumber: integer('order_number').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});



