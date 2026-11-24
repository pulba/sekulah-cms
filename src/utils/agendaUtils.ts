/**
 * Utility functions for School Agenda Management
 * Editorial Precision Design System & Auto Status Computation
 */

export interface AgendaItem {
  id: number;
  title: string;
  description?: string | null;
  eventDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  location: string;
  isCompleted?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type AgendaStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface StatusMeta {
  key: AgendaStatus;
  label: string;
  badgeClass: string;
  textClass: string;
}

export const AGENDA_CATEGORIES = [
  'Semua',
  'Akademik',
  'Ujian & Evaluasi',
  'Kegiatan Siswa',
  'Rapat & Pertemuan',
  'Peringatan Hari Besar',
  'Workshop & Pelatihan',
] as const;

export type AgendaCategory = typeof AGENDA_CATEGORIES[number];

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_ID = [
  'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN',
  'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'
];

/**
 * Infer category from agenda title and description
 */
export function getAgendaCategory(title: string, description?: string | null): string {
  const text = `${title} ${description || ''}`.toLowerCase();

  if (/ujian|anbk|pas|pts|evaluasi|asesmen|ulangan|try out/.test(text)) {
    return 'Ujian & Evaluasi';
  }
  if (/rapat|pleno|koordinasi|sidang|musyawarah/.test(text)) {
    return 'Rapat & Pertemuan';
  }
  if (/workshop|pelatihan|lokakarya|diklat|peningkatan kompetensi|seminar/.test(text)) {
    return 'Workshop & Pelatihan';
  }
  if (/sumpah pemuda|upacara|hari guru|kemerdekaan|isra|maulid|pahlawan|kartini|peringatan/.test(text)) {
    return 'Peringatan Hari Besar';
  }
  if (/siswa|ekskul|ekstrakurikuler|p5|gelar karya|seni|osis|pramuka|lomba|olimpiade/.test(text)) {
    return 'Kegiatan Siswa';
  }
  if (/rapor|akademik|semester|kurikulum|mpls|kelulusan|ijazah/.test(text)) {
    return 'Akademik';
  }
  return 'Akademik';
}

/**
 * Format YYYY-MM-DD to parts for the Editorial date badge
 */
export function parseDateBadge(dateStr: string) {
  if (!dateStr) {
    return { day: '01', monthShort: 'JAN', monthLong: 'Januari', year: '2026', fullFormatted: '-' };
  }
  const [y, m, d] = dateStr.split('-');
  const monthIdx = Math.max(0, Math.min(11, (parseInt(m, 10) || 1) - 1));
  const day = d ? d.padStart(2, '0') : '01';
  const monthShort = MONTH_SHORT_ID[monthIdx] || 'JAN';
  const monthLong = MONTH_NAMES_ID[monthIdx] || 'Januari';
  const year = y || '2026';

  return {
    day,
    monthShort,
    monthLong,
    year,
    fullFormatted: `${parseInt(day, 10)} ${monthLong} ${year}`,
  };
}

/**
 * Check if the given date is today (Asia/Jakarta timezone)
 */
export function isAgendaToday(eventDate: string, endDate?: string | null, refDate: Date = new Date()): boolean {
  const currentStr = getLocalDateStr(refDate);
  const end = endDate || eventDate;
  return currentStr >= eventDate && currentStr <= end;
}

/**
 * Helper to get local YYYY-MM-DD
 */
export function getLocalDateStr(d: Date = new Date()): string {
  // Use Asia/Jakarta or system date
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 10);
}

/**
 * Compute real-time automatic agenda status
 * Rule:
 * - Before start date/time -> 'upcoming' (Akan Datang)
 * - Between start and end date/time -> 'ongoing' (Sedang Berlangsung)
 * - After end date/time -> 'completed' (Selesai)
 * - If manual override is explicitly cancelled -> 'cancelled'
 */
export function calculateAgendaStatus(
  item: {
    eventDate: string;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    isCompleted?: boolean;
  },
  now: Date = new Date()
): AgendaStatus {
  const todayStr = getLocalDateStr(now);
  const startDate = item.eventDate;
  const endDate = item.endDate || item.eventDate;

  // 1. If past the end date entirely
  if (todayStr > endDate) {
    return 'completed';
  }

  // 2. If before the start date entirely
  if (todayStr < startDate) {
    return 'upcoming';
  }

  // 3. We are within [startDate, endDate]
  // If multi-day and currently between the dates
  if (todayStr >= startDate && todayStr <= endDate) {
    // If times are specified and it is the single-day event or edge days
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;

    if (todayStr === startDate && item.startTime && currentTimeStr < item.startTime) {
      return 'upcoming';
    }

    if (todayStr === endDate && item.endTime && currentTimeStr > item.endTime) {
      return 'completed';
    }

    return 'ongoing';
  }

  // Fallback to isCompleted flag if present
  return item.isCompleted ? 'completed' : 'upcoming';
}

/**
 * Get display metadata for status
 */
export function getStatusMeta(status: AgendaStatus): StatusMeta {
  switch (status) {
    case 'upcoming':
      return {
        key: 'upcoming',
        label: 'Akan Datang',
        badgeClass: 'bg-primary-light text-primary border border-primary/20',
        textClass: 'text-primary',
      };
    case 'ongoing':
      return {
        key: 'ongoing',
        label: 'Sedang Berlangsung',
        badgeClass: 'bg-success-light text-success-text border border-success/30',
        textClass: 'text-success',
      };
    case 'completed':
      return {
        key: 'completed',
        label: 'Selesai',
        badgeClass: 'bg-surface-subtle text-muted border border-border',
        textClass: 'text-muted',
      };
    case 'cancelled':
      return {
        key: 'cancelled',
        label: 'Dibatalkan',
        badgeClass: 'bg-error-light text-error-text border border-error/30',
        textClass: 'text-error',
      };
  }
}

/**
 * Format time range in Indonesian standard WIB
 */
export function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  if (!startTime && !endTime) return 'Waktu menyesuaikan';
  if (startTime && !endTime) return `${startTime} WIB - Selesai`;
  return `${startTime} - ${endTime} WIB`;
}

/**
 * Generate Google Calendar Add Event URL
 */
export function generateGoogleCalendarUrl(agenda: {
  title: string;
  description?: string | null;
  location: string;
  eventDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const cleanDate = (d: string) => d.replace(/-/g, '');
  const cleanTime = (t?: string | null) => (t ? t.replace(/:/g, '') + '00' : '000000');

  const startIso = agenda.startTime
    ? `${cleanDate(agenda.eventDate)}T${cleanTime(agenda.startTime)}`
    : cleanDate(agenda.eventDate);

  const endTargetDate = agenda.endDate || agenda.eventDate;
  const endIso = agenda.endTime
    ? `${cleanDate(endTargetDate)}T${cleanTime(agenda.endTime)}`
    : agenda.startTime
    ? `${cleanDate(endTargetDate)}T${cleanTime(agenda.startTime)}`
    : cleanDate(endTargetDate);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: agenda.title,
    details: agenda.description || `Agenda resmi sekolah: ${agenda.title}`,
    location: agenda.location,
    dates: `${startIso}/${endIso}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate .ics calendar download data URL
 */
export function generateIcsDataUrl(agenda: {
  id: number;
  title: string;
  description?: string | null;
  location: string;
  eventDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const cleanDate = (d: string) => d.replace(/-/g, '');
  const cleanTime = (t?: string | null) => (t ? t.replace(/:/g, '') + '00' : '000000');

  const dtStart = agenda.startTime
    ? `${cleanDate(agenda.eventDate)}T${cleanTime(agenda.startTime)}`
    : `${cleanDate(agenda.eventDate)}T080000`;

  const endDate = agenda.endDate || agenda.eventDate;
  const dtEnd = agenda.endTime
    ? `${cleanDate(endDate)}T${cleanTime(agenda.endTime)}`
    : `${cleanDate(endDate)}T170000`;

  const cleanText = (str?: string | null) => (str || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SMAN 1 Unggulan//Agenda Sekolah//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:agenda-${agenda.id}@sman1unggulan.sch.id`,
    `DTSTAMP:${cleanDate(getLocalDateStr())}T000000Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanText(agenda.title)}`,
    `DESCRIPTION:${cleanText(agenda.description)}`,
    `LOCATION:${cleanText(agenda.location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

