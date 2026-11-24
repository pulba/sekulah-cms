export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'file' | 'textarea' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
  conditionalRule: 'always' | 'if_boarding' | 'if_smk' | 'if_ma' | 'if_tahfidz' | 'if_prestasi';
  order: number;
  isActive: boolean;
  isSystem: boolean; // System fields like full_name, nik, phone_student cannot be deleted
  validationRule?: string;
  helpText?: string;
}

export interface FormStep {
  step: number;
  key: string;
  title: string;
  description: string;
  fields: FormField[];
}

export interface RegistrationPath {
  key: string;
  name: string;
  quotaPercent: number;
  description?: string;
  isActive: boolean;
}

export interface RegistrationWave {
  id: string;
  name: string;
  startDate: string; // Format YYYY-MM-DD (aktif mulai 00:00:00 WIB)
  endDate: string;   // Format YYYY-MM-DD (aktif hingga 23:59:59 WIB)
  description?: string;
  benefit?: string;
  quota?: number;
  status: 'active' | 'draft' | 'archived';
  isActive: boolean;
}

export interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  maxSizeMb: number;
  acceptedFormats: string[];
  required: boolean;
  conditionalRule: 'always' | 'if_smk' | 'if_tahfidz' | 'if_prestasi';
}

export interface PpdbFullConfig {
  version: number;
  schoolType: string;
  schoolName: string;
  academicYear: string;
  portalMode: 'auto' | 'manual'; // 'auto': server calculates status; 'manual': operator override
  status: 'opened' | 'closed' | 'upcoming';
  activeWave: string;
  startDate: string;
  endDate: string;
  totalQuota: string;
  waves: RegistrationWave[];
  paths: RegistrationPath[];
  services: {
    boardingAvailableInSchool: boolean;
    boardingEnabledInPpdb: boolean;
    boardingDescription: string;
    majors: string[]; // for SMK
    programs: string[]; // for MA/SMA
  };
  steps: FormStep[];
  documents: RequiredDocument[];
  updatedAt: string;
}

export interface PortalResolutionResult {
  portalMode: 'auto' | 'manual';
  effectiveStatus: 'opened' | 'upcoming' | 'closed';
  activeWave: RegistrationWave | null;
  nextWave: RegistrationWave | null;
  allWaves: RegistrationWave[];
  serverDateWib: string; // YYYY-MM-DD
  reason: string;
}

/**
 * Format tanggal dalam zona waktu Indonesia Barat (WIB: UTC+7)
 */
export function getWibDateString(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Evaluasi status portal dan gelombang aktif di sisi server
 * Memisahkan secara ketat antara status portal (buka/segera/tutup) dan gelombang pendaftar.
 */
export function resolvePpdbPortal(
  config: PpdbFullConfig,
  now = new Date()
): PortalResolutionResult {
  const portalMode = config.portalMode || 'auto';
  const serverDateWib = getWibDateString(now);

  // Helper: gelombang dapat digunakan jika belum diarsipkan atau bukan draf
  const isWaveUsable = (w: RegistrationWave) =>
    w.status !== 'archived' && w.status !== 'draft' && w.isActive !== false;

  const allWaves = (config.waves || []).filter((w) => w.status !== 'archived');
  const sortedWaves = [...allWaves].sort((a, b) => a.startDate.localeCompare(b.startDate));

  let effectiveStatus: 'opened' | 'upcoming' | 'closed' = 'closed';
  let activeWave: RegistrationWave | null = null;
  let nextWave: RegistrationWave | null = null;
  let reason = '';

  // Identifikasi gelombang yang dipilih admin sebagai acuan portal
  const chosenWave = sortedWaves.find(
    (w) => w.name === config.activeWave || w.id === config.activeWave
  ) || sortedWaves[0] || null;

  if (portalMode === 'manual') {
    effectiveStatus = config.status || 'opened';
    activeWave = chosenWave;

    if (effectiveStatus === 'opened' && !activeWave) {
      effectiveStatus = 'closed';
      reason = 'Tidak ada gelombang pendaftaran yang tersedia.';
    } else if (effectiveStatus === 'opened') {
      reason = `Portal dibuka secara manual oleh operator (${activeWave?.name || 'Gelombang Aktif'}).`;
    } else if (effectiveStatus === 'upcoming') {
      reason = 'Portal disetel dalam mode Segera Dibuka oleh operator.';
      nextWave = sortedWaves.find((w) => isWaveUsable(w) && w.startDate > serverDateWib) || activeWave || null;
    } else {
      reason = 'Portal ditutup secara manual oleh operator sekolah.';
    }
  } else {
    // MODE OTOMATIS: Dihitung secara objektif dari tanggal server WIB vs jadwal gelombang
    // 1. Jika gelombang yang dipilih portal aktif hari ini, gunakan gelombang tersebut
    if (chosenWave && isWaveUsable(chosenWave) && serverDateWib >= chosenWave.startDate && serverDateWib <= chosenWave.endDate) {
      activeWave = chosenWave;
      effectiveStatus = 'opened';
      reason = `Periode ${activeWave.name} sedang berlangsung hingga ${activeWave.endDate} pukul 23.59.59 WIB.`;
    }
    // 2. Jika tidak, cari gelombang lain yang jadwalnya sedang berlangsung hari ini
    else {
      activeWave = sortedWaves.find(
        (w) => isWaveUsable(w) && serverDateWib >= w.startDate && serverDateWib <= w.endDate
      ) || null;

      if (activeWave) {
        effectiveStatus = 'opened';
        reason = `Periode ${activeWave.name} sedang berlangsung hingga ${activeWave.endDate} pukul 23.59.59 WIB.`;
      } else {
        // 3. Jika belum berlangsung, periksa apakah ada gelombang mendatang (countdown)
        nextWave = (chosenWave && isWaveUsable(chosenWave) && serverDateWib < chosenWave.startDate)
          ? chosenWave
          : sortedWaves.find((w) => isWaveUsable(w) && serverDateWib < w.startDate) || null;

        if (nextWave) {
          effectiveStatus = 'upcoming';
          reason = `Pendaftaran segera dibuka. ${nextWave.name} dimulai pada ${nextWave.startDate} pukul 00.00.00 WIB.`;
        } else {
          effectiveStatus = 'closed';
          reason = 'Seluruh periode gelombang pendaftaran telah berakhir atau belum ada gelombang aktif berikutnya.';
        }
      }
    }
  }

  return {
    portalMode,
    effectiveStatus,
    activeWave,
    nextWave,
    allWaves: sortedWaves,
    serverDateWib,
    reason,
  };
}

export function getDefaultPpdbConfig(schoolType: string, schoolName = 'SMAN 1 Unggulan', boardingAvailable = false): PpdbFullConfig {
  const normType = (schoolType || 'SMA').toUpperCase();

  // 1. Paths per school type
  let paths: RegistrationPath[] = [];
  if (normType === 'SMK') {
    paths = [
      { key: 'rapor_vokasi', name: 'Prestasi Nilai Rapor Kejuruan', quotaPercent: 60, isActive: true, description: 'Seleksi gabungan rata-rata nilai rapor SMP/MTs semester 1-5' },
      { key: 'kemitraan_dudi', name: 'Kemitraan Kelas Industri (DUDI)', quotaPercent: 15, isActive: true, description: 'Jalur khusus binaan mitra dunia usaha & industri' },
      { key: 'domisili', name: 'Domisili Terdekat & Afirmasi', quotaPercent: 15, isActive: true, description: 'Prioritas calon siswa di sekitar radius kampus SMK' },
      { key: 'kejuaraan', name: 'Prestasi Kejuaraan LKS / Vokasi', quotaPercent: 10, isActive: true, description: 'Juara lomba kompetensi siswa atau kejuaraan bidang sains & seni' },
    ];
  } else if (normType === 'MA') {
    paths = [
      { key: 'cbt_reguler', name: 'Reguler CBT & Pengetahuan Agama', quotaPercent: 40, isActive: true, description: 'Tes potensi akademik daring & uji baca Al-Qur\'an Kemenag' },
      { key: 'tahfidz', name: 'Prestasi Tahfidz Al-Qur\'an', quotaPercent: 30, isActive: true, description: 'Khusus hafidz/hafidzah minimal 3 Juz ber-syahadah resmi' },
      { key: 'afirmasi_kemenag', name: 'Afirmasi Santri Prasejahtera (KIP)', quotaPercent: 20, isActive: true, description: 'Bantuan santri pemegang kartu program Indonesia pintar' },
      { key: 'mapk', name: 'Program Keagamaan Khusus (MAPK)', quotaPercent: 10, isActive: true, description: 'Pendidikan intensif kitab kuning & bahasa Arab' },
    ];
  } else {
    // Default SMA & umum
    paths = [
      { key: 'zonasi', name: 'Zonasi Domisili (Kartu Keluarga)', quotaPercent: 50, isActive: true, description: 'Jarak tempat tinggal domisili ke sekolah sesuai KK' },
      { key: 'prestasi', name: 'Prestasi Akademik & Riset', quotaPercent: 30, isActive: true, description: 'Nilai rapor semester 1-5 & piagam penghargaan kejuaraan' },
      { key: 'afirmasi', name: 'Afirmasi Keluarga Prasejahtera (DTKS)', quotaPercent: 15, isActive: true, description: 'Pemegang KIP, PKH, atau terdaftar DTKS Kemensos' },
      { key: 'mutasi', name: 'Perpindahan Tugas Orang Tua / Mutasi', quotaPercent: 5, isActive: true, description: 'Surat penugasan resmi kedinasan orang tua/wali' },
    ];
  }

  // 2. Layanan & Program
  const defaultMajors = normType === 'SMK'
    ? [
        'Rekayasa Perangkat Lunak (RPL)',
        'Desain Komunikasi Visual (DKV)',
        'Teknik Kendaraan Ringan Otomotif (TKRO)',
        'Manajemen Perkantoran & Bisnis Digital',
      ]
    : [];

  const defaultPrograms = normType === 'MA'
    ? ['Tahfidz Intensif', 'Kajian Kitab Kuning', 'Peminatan IPA Madrasah', 'Peminatan Keagamaan']
    : ['MIPA Unggulan Riset', 'IPS Global & Kewirausahaan', 'Bahasa & Budaya'];

  // 3. Tahapan 7-Step Form
  const steps: FormStep[] = [
    {
      step: 1,
      key: 'pendaftaran',
      title: 'Pendaftaran',
      description: 'Pilihan jenis pendaftaran, jalur masuk, NIK, dan asal sekolah',
      fields: [
        { id: 'reg_type', label: 'Jenis Pendaftaran', type: 'select', required: true, options: ['Baru', 'Pindahan'], conditionalRule: 'always', order: 1, isActive: true, isSystem: true },
        { id: 'admission_path', label: 'Jalur Pendaftaran', type: 'select', required: true, options: paths.map(p => p.name), conditionalRule: 'always', order: 2, isActive: true, isSystem: true },
        { id: 'nik', label: 'NIK / Nomor KITAS Calon Siswa', type: 'text', required: true, placeholder: '16 digit angka sesuai Kartu Keluarga', conditionalRule: 'always', order: 3, isActive: true, isSystem: true, validationRule: 'exact_16_digits' },
        { id: 'prev_school', label: 'Nama Sekolah Asal', type: 'text', required: true, placeholder: 'Contoh: SMP Negeri 1 / MTs Negeri 2', conditionalRule: 'always', order: 4, isActive: true, isSystem: true },
        { id: 'major_choice_1', label: 'Pilihan Program Keahlian 1', type: 'select', required: normType === 'SMK', options: defaultMajors, conditionalRule: 'if_smk', order: 5, isActive: normType === 'SMK', isSystem: false },
        { id: 'major_choice_2', label: 'Pilihan Program Keahlian 2 (Cadangan)', type: 'select', required: false, options: defaultMajors, conditionalRule: 'if_smk', order: 6, isActive: normType === 'SMK', isSystem: false },
      ],
    },
    {
      step: 2,
      key: 'data_pribadi',
      title: 'Data Pribadi',
      description: 'Identitas lengkap calon murid sesuai Akta Kelahiran resmi',
      fields: [
        { id: 'full_name', label: 'Nama Lengkap Calon Siswa', type: 'text', required: true, placeholder: 'Sesuai Akta Kelahiran / Ijazah', conditionalRule: 'always', order: 1, isActive: true, isSystem: true, validationRule: 'text_min_3' },
        { id: 'nisn', label: 'NISN (Nomor Induk Siswa Nasional)', type: 'text', required: false, placeholder: '10 digit NISN Dapodik / EMIS', conditionalRule: 'always', order: 2, isActive: true, isSystem: false, validationRule: 'exact_10_digits' },
        { id: 'gender', label: 'Jenis Kelamin', type: 'select', required: true, options: ['Laki-laki', 'Perempuan'], conditionalRule: 'always', order: 3, isActive: true, isSystem: true },
        { id: 'birth_place', label: 'Tempat Lahir', type: 'text', required: true, placeholder: 'Kota / Kabupaten Lahir', conditionalRule: 'always', order: 4, isActive: true, isSystem: true },
        { id: 'birth_date', label: 'Tanggal Lahir', type: 'date', required: true, conditionalRule: 'always', order: 5, isActive: true, isSystem: true, validationRule: 'past_date' },
        { id: 'religion', label: 'Agama', type: 'select', required: true, options: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'], conditionalRule: 'always', order: 6, isActive: true, isSystem: true },
      ],
    },
    {
      step: 3,
      key: 'data_ayah',
      title: 'Data Ayah',
      description: 'Identitas, status, pendidikan, dan pekerjaan ayah kandung',
      fields: [
        { id: 'father_name', label: 'Nama Ayah Kandung', type: 'text', required: true, placeholder: 'Nama lengkap ayah', conditionalRule: 'always', order: 1, isActive: true, isSystem: true },
        { id: 'father_nik', label: 'NIK Ayah', type: 'text', required: false, placeholder: '16 digit NIK KTP', conditionalRule: 'always', order: 2, isActive: true, isSystem: false },
        { id: 'father_status', label: 'Status Ayah', type: 'select', required: true, options: ['Masih Hidup', 'Meninggal Dunia'], conditionalRule: 'always', order: 3, isActive: true, isSystem: false },
        { id: 'father_education', label: 'Pendidikan Terakhir Ayah', type: 'select', required: false, options: ['SD / Sederajat', 'SMP / Sederajat', 'SMA / SMK / MA', 'D3 / Diploma', 'S1 / Sarjana', 'S2 / Magister', 'S3 / Doktor', 'Lainnya'], conditionalRule: 'always', order: 4, isActive: true, isSystem: false },
        { id: 'father_job', label: 'Pekerjaan Utama Ayah', type: 'select', required: false, options: ['PNS / TNI / Polri', 'Karyawan Swasta', 'Wiraswasta / Pedagang', 'Petani / Peternak', 'Buruh / Pekerja Lepas', 'Pensiunan', 'Lainnya'], conditionalRule: 'always', order: 5, isActive: true, isSystem: false },
        { id: 'father_income', label: 'Penghasilan Bulanan Ayah', type: 'select', required: false, options: ['Kurang dari Rp 1.000.000', 'Rp 1.000.000 - Rp 3.000.000', 'Rp 3.000.000 - Rp 5.000.000', 'Rp 5.000.000 - Rp 10.000.000', 'Diatas Rp 10.000.000'], conditionalRule: 'always', order: 6, isActive: true, isSystem: false },
        { id: 'father_phone', label: 'Nomor Telepon / WhatsApp Ayah', type: 'text', required: false, placeholder: '081234567890', conditionalRule: 'always', order: 7, isActive: true, isSystem: false },
      ],
    },
    {
      step: 4,
      key: 'data_ibu',
      title: 'Data Ibu',
      description: 'Identitas, status, pendidikan, dan pekerjaan ibu kandung',
      fields: [
        { id: 'mother_name', label: 'Nama Ibu Kandung', type: 'text', required: true, placeholder: 'Nama lengkap ibu', conditionalRule: 'always', order: 1, isActive: true, isSystem: true },
        { id: 'mother_nik', label: 'NIK Ibu', type: 'text', required: false, placeholder: '16 digit NIK KTP', conditionalRule: 'always', order: 2, isActive: true, isSystem: false },
        { id: 'mother_status', label: 'Status Ibu', type: 'select', required: true, options: ['Masih Hidup', 'Meninggal Dunia'], conditionalRule: 'always', order: 3, isActive: true, isSystem: false },
        { id: 'mother_education', label: 'Pendidikan Terakhir Ibu', type: 'select', required: false, options: ['SD / Sederajat', 'SMP / Sederajat', 'SMA / SMK / MA', 'D3 / Diploma', 'S1 / Sarjana', 'S2 / Magister', 'Lainnya'], conditionalRule: 'always', order: 4, isActive: true, isSystem: false },
        { id: 'mother_job', label: 'Pekerjaan Utama Ibu', type: 'select', required: false, options: ['Ibu Rumah Tangga', 'PNS / ASN', 'Karyawan Swasta', 'Wiraswasta / Pedagang', 'Petani / Peternak', 'Lainnya'], conditionalRule: 'always', order: 5, isActive: true, isSystem: false },
        { id: 'mother_income', label: 'Penghasilan Bulanan Ibu', type: 'select', required: false, options: ['Tidak Berpenghasilan', 'Kurang dari Rp 1.000.000', 'Rp 1.000.000 - Rp 3.000.000', 'Rp 3.000.000 - Rp 5.000.000', 'Diatas Rp 5.000.000'], conditionalRule: 'always', order: 6, isActive: true, isSystem: false },
        { id: 'mother_phone', label: 'Nomor Telepon / WhatsApp Ibu', type: 'text', required: false, placeholder: '081234567890', conditionalRule: 'always', order: 7, isActive: true, isSystem: false },
      ],
    },
    {
      step: 5,
      key: 'kontak_layanan',
      title: 'Kontak & Layanan',
      description: 'Alamat domisili, kontak calon siswa, dan pilihan asrama/boarding',
      fields: [
        { id: 'address', label: 'Alamat Tempat Tinggal (Sesuai KK)', type: 'textarea', required: true, placeholder: 'Jalan, Gang, No. Rumah', conditionalRule: 'always', order: 1, isActive: true, isSystem: true },
        { id: 'rt_rw', label: 'RT / RW', type: 'text', required: false, placeholder: '001 / 002', conditionalRule: 'always', order: 2, isActive: true, isSystem: false },
        { id: 'village', label: 'Desa / Kelurahan', type: 'text', required: true, placeholder: 'Nama kelurahan', conditionalRule: 'always', order: 3, isActive: true, isSystem: true },
        { id: 'district', label: 'Kecamatan', type: 'text', required: true, placeholder: 'Nama kecamatan', conditionalRule: 'always', order: 4, isActive: true, isSystem: true },
        { id: 'city', label: 'Kota / Kabupaten', type: 'text', required: true, placeholder: 'Kota / Kabupaten', conditionalRule: 'always', order: 5, isActive: true, isSystem: true },
        { id: 'postal_code', label: 'Kode Pos', type: 'text', required: false, placeholder: '60123', conditionalRule: 'always', order: 6, isActive: true, isSystem: false },
        { id: 'phone_student', label: 'Nomor WhatsApp Calon Siswa', type: 'text', required: true, placeholder: '081234567890', conditionalRule: 'always', order: 7, isActive: true, isSystem: true, validationRule: 'indonesian_phone' },
        { id: 'email_student', label: 'Alamat Email Calon Siswa', type: 'text', required: false, placeholder: 'siswa@email.com', conditionalRule: 'always', order: 8, isActive: true, isSystem: false },
        { id: 'apply_boarding', label: 'Pendaftaran Layanan Asrama / Pesantren', type: 'checkbox', required: false, conditionalRule: 'if_boarding', order: 9, isActive: boardingAvailable, isSystem: false, helpText: 'Centang jika menghendaki fasilitas tempat tinggal asrama terpadu.' },
      ],
    },
    {
      step: 6,
      key: 'dokumen',
      title: 'Dokumen',
      description: 'Pindaian berkas persyaratan wajib dan pendukung pendaftaran',
      fields: [
        { id: 'file_kk', label: 'Kartu Keluarga (KK)', type: 'file', required: true, conditionalRule: 'always', order: 1, isActive: true, isSystem: true, helpText: 'Format PDF / JPG, maksimal 2 MB' },
        { id: 'file_akta', label: 'Akta Kelahiran', type: 'file', required: true, conditionalRule: 'always', order: 2, isActive: true, isSystem: true, helpText: 'Format PDF / JPG, maksimal 2 MB' },
        { id: 'file_skl', label: 'Surat Keterangan Lulus (SKL) / Legalisir Rapor', type: 'file', required: true, conditionalRule: 'always', order: 3, isActive: true, isSystem: true, helpText: 'Format PDF / JPG, maksimal 2 MB' },
        { id: 'file_butawarna', label: 'Surat Keterangan Bebas Buta Warna (Dokter)', type: 'file', required: normType === 'SMK', conditionalRule: 'if_smk', order: 4, isActive: normType === 'SMK', isSystem: false, helpText: 'Wajib untuk jurusan teknologi & rekayasa' },
        { id: 'file_tahfidz', label: 'Syahadah Tahfidz / Piagam Kemenag', type: 'file', required: false, conditionalRule: 'if_tahfidz', order: 5, isActive: normType === 'MA', isSystem: false, helpText: 'Khusus bagi pendaftar Jalur Tahfidz Al-Qur\'an' },
        { id: 'file_prestasi', label: 'Sertifikat Prestasi Kejuaraan / Kartu KIP (Jika Ada)', type: 'file', required: false, conditionalRule: 'if_prestasi', order: 6, isActive: true, isSystem: false, helpText: 'Format PDF / JPG, maksimal 2 MB' },
      ],
    },
    {
      step: 7,
      key: 'konfirmasi',
      title: 'Konfirmasi',
      description: 'Verifikasi kelengkapan data, pakta integritas, dan pengiriman resmi',
      fields: [
        { id: 'agreement', label: 'Pakta Integritas Keabsahan Data', type: 'checkbox', required: true, conditionalRule: 'always', order: 1, isActive: true, isSystem: true, helpText: 'Pernyataan bahwa seluruh data adalah benar dan absah secara hukum.' },
      ],
    },
  ];

  // 4. Katalog Dokumen
  const documents: RequiredDocument[] = [
    { id: 'file_kk', name: 'Kartu Keluarga (KK)', description: 'Pindaian KK asli yang terbit minimal 1 tahun sebelum pendaftaran', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: true, conditionalRule: 'always' },
    { id: 'file_akta', name: 'Akta Kelahiran', description: 'Pindaian akta kelahiran pencatatan sipil calon siswa', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: true, conditionalRule: 'always' },
    { id: 'file_skl', name: 'SKL / Legalisir Rapor', description: 'Surat Keterangan Lulus SMP/MTs atau pindaian rapor semester 1-5', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: true, conditionalRule: 'always' },
    { id: 'file_butawarna', name: 'Surat Bebas Buta Warna', description: 'Surat keterangan dokter untuk pendaftar jurusan vokasi teknik & rekayasa', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: normType === 'SMK', conditionalRule: 'if_smk' },
    { id: 'file_tahfidz', name: 'Syahadah Tahfidz', description: 'Sertifikat tahfidz Al-Qur\'an minimal 3 Juz dari lembaga resmi Kemenag', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: false, conditionalRule: 'if_tahfidz' },
    { id: 'file_prestasi', name: 'Piagam Prestasi / Kartu DTKS', description: 'Sertifikat kejuaraan tingkat kab/prov/nasional atau bukti KIP/PKH', maxSizeMb: 2, acceptedFormats: ['.pdf', '.jpg', '.jpeg', '.png'], required: false, conditionalRule: 'if_prestasi' },
  ];

  // 5. Gelombang Pendaftaran
  const waves: RegistrationWave[] = [
    {
      id: 'wave_1',
      name: 'Gelombang 1',
      startDate: '2026-10-27',
      endDate: '2026-11-26',
      description: 'Pendaftaran gelombang awal (Jalur Prestasi / Early Bird)',
      benefit: 'Pendaftaran gelombang awal sesuai ketentuan sekolah (Bebas tes awal / Potongan DPP)',
      quota: 150,
      status: 'active',
      isActive: true,
    },
    {
      id: 'wave_2',
      name: 'Gelombang 2',
      startDate: '2026-11-27',
      endDate: '2026-12-26',
      description: 'Pendaftaran kuota reguler',
      benefit: 'Jalur Seleksi Reguler & Penelusuran Minat Bakat Siswa Baru',
      quota: 150,
      status: 'active',
      isActive: false,
    },
    {
      id: 'wave_3',
      name: 'Gelombang 3',
      startDate: '2026-12-27',
      endDate: '2027-01-25',
      description: 'Pendaftaran gelombang pemenuhan kuota',
      benefit: 'Jalur Pemenuhan Alokasi Sisa Kuota Rombel Sekolah',
      quota: 60,
      status: 'draft',
      isActive: false,
    },
  ];

  return {
    version: 1,
    schoolType: normType,
    schoolName,
    academicYear: '2026/2027',
    portalMode: 'auto',
    status: 'opened',
    activeWave: 'Gelombang 1',
    startDate: waves[0].startDate,
    endDate: waves[0].endDate,
    totalQuota: '360 Siswa Baru (10 Rombel)',
    waves,
    paths,
    services: {
      boardingAvailableInSchool: boardingAvailable,
      boardingEnabledInPpdb: boardingAvailable,
      boardingDescription: 'Layanan tempat tinggal asrama santri/siswa terpadu lengkap dengan pembinaan karakter dan ibadah harian.',
      majors: defaultMajors,
      programs: defaultPrograms,
    },
    steps,
    documents,
    updatedAt: new Date().toISOString(),
  };
}
