import { promises as fs } from 'fs';
import path from 'path';

export interface StoredDocumentMeta {
  originalName: string;
  mimeType: string;
  size: number;
  fileName: string;
  uploadedAt: string;
}

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'ppdb-documents');

// Allowlist format berkas persyaratan PPDB
export const ALLOWED_DOC_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
export const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_DOC_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Sanitasi nama berkas agar aman dari path traversal dan karakter terlarang.
 */
export function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName).trim();
  const ext = (path.extname(base) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const nameWithoutExt = path.basename(base, path.extname(base))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 60);

  return ext ? `${nameWithoutExt}.${ext}` : nameWithoutExt;
}

/**
 * Validasi keabsahan berkas yang diunggah
 */
export function validateUploadedDocument(
  file: File | { name: string; type: string; size: number },
  docLabel: string
): { valid: boolean; error?: string } {
  if (!file || !file.name || file.size <= 0) {
    return { valid: false, error: `Berkas ${docLabel} tidak ditemukan atau kosong.` };
  }

  // 1. Validasi Ukuran Berkas (Maksimal 2 MB)
  if (file.size > MAX_DOC_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Ukuran berkas ${docLabel} (${sizeMb} MB) melebihi batas maksimal yang diizinkan (2 MB).`,
    };
  }

  // 2. Validasi Ekstensi
  const ext = (path.extname(file.name) || '').toLowerCase().replace(/^\./, '');
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Format berkas ${docLabel} (.${ext || 'tidak diketahui'}) tidak didukung. Harap unggah berkas berformat PDF, JPG, JPEG, PNG, atau WEBP.`,
    };
  }

  // 3. Validasi Tipe MIME
  const rawMime = (file.type || '').toLowerCase();
  // Khusus beberapa browser yang tidak menyertakan mime lengkap atau mengirim octet-stream untuk pdf
  if (rawMime && rawMime !== 'application/octet-stream') {
    if (!ALLOWED_DOC_MIMES.includes(rawMime)) {
      return {
        valid: false,
        error: `Tipe konten ${docLabel} (${rawMime}) tidak valid. Hanya berkas PDF atau gambar yang diizinkan.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Simpan berkas persyaratan ke direktori terisolasi pendaftar
 */
export async function savePpdbDocument(
  registrationNumber: string,
  docType: 'kk' | 'akta' | 'skl' | 'additional',
  file: File
): Promise<{ success: boolean; filePath: string; meta: StoredDocumentMeta }> {
  const safeReg = registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.join(STORAGE_ROOT, safeReg);
  await fs.mkdir(targetDir, { recursive: true });

  const safeOriginal = sanitizeFileName(file.name);
  const ext = (path.extname(safeOriginal) || '').toLowerCase();
  const finalFileName = `${docType}_${Date.now()}${ext}`;
  const fullPath = path.join(targetDir, finalFileName);

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  await fs.writeFile(fullPath, buffer);

  // Simpan / update metadata index di folder siswa
  const meta: StoredDocumentMeta = {
    originalName: file.name,
    mimeType: file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
    size: buffer.byteLength,
    fileName: finalFileName,
    uploadedAt: new Date().toISOString(),
  };

  const metaFile = path.join(targetDir, `meta_${docType}.json`);
  await fs.writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf-8');

  return { success: true, filePath: fullPath, meta };
}

/**
 * Baca berkas persyaratan yang tersimpan berdasarkan nomor registrasi dan jenis dokumen
 */
export async function getPpdbDocument(
  registrationNumber: string,
  docType: 'kk' | 'akta' | 'skl' | 'additional'
): Promise<{ buffer: Buffer; meta: StoredDocumentMeta } | null> {
  const safeReg = registrationNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.join(STORAGE_ROOT, safeReg);
  const metaFile = path.join(targetDir, `meta_${docType}.json`);

  try {
    const metaRaw = await fs.readFile(metaFile, 'utf-8');
    const meta: StoredDocumentMeta = JSON.parse(metaRaw);
    const fullPath = path.join(targetDir, meta.fileName);
    const buffer = await fs.readFile(fullPath);
    return { buffer, meta };
  } catch {
    // Fallback: periksa file dengan prefix docType jika meta belum terbuat
    try {
      const files = await fs.readdir(targetDir);
      const match = files.find((f) => f.startsWith(`${docType}_`));
      if (!match) return null;

      const fullPath = path.join(targetDir, match);
      const buffer = await fs.readFile(fullPath);
      const ext = (path.extname(match) || '').toLowerCase();
      const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
      const meta: StoredDocumentMeta = {
        originalName: match,
        mimeType: mime,
        size: buffer.byteLength,
        fileName: match,
        uploadedAt: new Date().toISOString(),
      };
      return { buffer, meta };
    } catch {
      return null;
    }
  }
}
