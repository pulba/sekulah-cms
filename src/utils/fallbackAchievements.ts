export interface FallbackAchievement {
  id: number;
  title: string;
  year: string;
  organization: string;
  name: string;
  photoUrl: string;
  description: string;
  type?: 'achievement';
  isPublicConsent?: boolean;
}

export const fallbackAchievements: FallbackAchievement[] = [
  {
    id: 1,
    title: "Medali Emas Olimpiade Sains Nasional (OSN) Bidang Kebumian",
    year: "2026",
    organization: "Pusat Prestasi Nasional (Puspresnas)",
    name: "Muhammad Farhan & Tim Riset",
    photoUrl: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=800&q=80",
    description: "Meraih nilai teori dan observasi geologi lapangan tertinggi se-Indonesia pada ajang Olimpiade Sains Nasional tingkat nasional.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 2,
    title: "Juara 1 Lomba Karya Tulis Ilmiah Nasional (LKTIN) Riset Terbarukan",
    year: "2026",
    organization: "Kementerian ESDM & ITB",
    name: "Alya Khairunnisa & Tim KIR",
    photoUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
    description: "Inovasi membran filtrasi air limbah ramah lingkungan berbahan biomassa limbah pertanian lokal.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 3,
    title: "Medali Perak International Junior Science Olympiad (IJSO) Global",
    year: "2025",
    organization: "IJSO International Committee",
    name: "Annisa Maharani",
    photoUrl: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=800&q=80",
    description: "Mewakili Indonesia dan meraih perak pada kompetisi sains multidisiplin bergengsi tingkat dunia.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 4,
    title: "Juara 1 & Best Algorithm National Youth Robotic & AI Innovation",
    year: "2026",
    organization: "Kemenristekdikti & ITS",
    name: "Rizky Pratama & Tim Robotika",
    photoUrl: "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80",
    description: "Menciptakan robot autonomous pemilah sampah cerdas berbasis Computer Vision dan Machine Learning.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 5,
    title: "Best Speaker & 1st Place National Schools Debating Championship",
    year: "2025",
    organization: "Puspresnas Kemendikbudristek",
    name: "Clarissa Aurelia",
    photoUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&q=80",
    description: "Tampil unggul dalam babak final debat parlemen bahasa Inggris tingkat pelajar se-Indonesia.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 6,
    title: "Medali Emas Olimpiade Matematika Nasional & Best Theory Category",
    year: "2026",
    organization: "FMIPA Universitas Indonesia",
    name: "Bagas Dwi Nugroho",
    photoUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
    description: "Menyelesaikan seluruh soal analisis kombinatorika dan geometri fraktal dengan pembuktian matematis sempurna.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 7,
    title: "Juara 1 FLS2N Nasional Kategori Musik Tradisional Nusantara",
    year: "2025",
    organization: "Balai Pengembangan Talenta Indonesia",
    name: "Sanggar Seni Genta Swara",
    photoUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
    description: "Harmonisasi aransemen karawitan kontemporer yang mengangkat narasi pelestarian hutan adat nusantara.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 8,
    title: "Medali Emas O2SN Atletik Lari 100 Meter Putra Tingkat Nasional",
    year: "2025",
    organization: "Kemenpora & Kemendikbudristek",
    name: "Danish Ahmad Fauzan",
    photoUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
    description: "Mencatatkan rekor waktu 10,68 detik pada nomor sprint putra Olimpiade Olahraga Siswa Nasional.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 9,
    title: "Juara 1 Lomba Inovasi IoT Pelajar & Sensor Kualitas Udara",
    year: "2025",
    organization: "Institut Teknologi Sepuluh Nopember",
    name: "Satria Bagus Pambudi",
    photoUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    description: "Prototipe sistem pemantauan polusi udara kota berbasis sensor LoRaWAN mandiri energi matahari.",
    type: 'achievement',
    isPublicConsent: true,
  },
  {
    id: 10,
    title: "Medali Emas Olimpiade Sains Nasional (OSN) Bidang Astronomi",
    year: "2026",
    organization: "Pusat Prestasi Nasional Kemendikbudristek",
    name: "Kayla Azzahra & Tim Riset",
    photoUrl: "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=800&q=80",
    description: "Meraih nilai tertinggi analisis fotometri bintang variabel dan mekanika orbital teleskop modern.",
    type: 'achievement',
    isPublicConsent: true,
  },
];

