import 'dotenv/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'school-cms-media';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';

let s3Client: S3Client | null = null;

if (accountId && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export interface UploadResult {
  success: boolean;
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface ProcessedMediaResult {
  success: boolean;
  url: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Helper to save a single buffer both to local filesystem and Cloudflare R2 (for backup/sync).
 * Always returns relative /uploads/... path to prevent ISP DNS blocking & SSL errors (ERR_CERT_COMMON_NAME_INVALID).
 */
async function saveBuffer(buffer: Buffer | Uint8Array, key: string, mimeType: string): Promise<string> {
  const cleanKey = key.replace(/^\/?uploads\//, '').replace(/\\/g, '/');

  // 1. Always save to local public/uploads directory for fast, offline, and SSL-safe serving
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const targetDir = path.dirname(path.join(uploadsDir, cleanKey));
  await fs.mkdir(targetDir, { recursive: true });
  const localFilePath = path.join(uploadsDir, cleanKey);
  await fs.writeFile(localFilePath, buffer);

  // 2. Also sync to Cloudflare R2 if credentials are provided
  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
        Body: buffer,
        ContentType: mimeType,
      });
      await s3Client.send(command);
    } catch (err) {
      console.warn(`[STORAGE] Failed to sync to R2: ${cleanKey}`, err);
    }
  }

  return `/uploads/${cleanKey}`;
}

/**
 * Process media: generates date-based folder (YYYY/MM), generates thumbnail and medium variants for images,
 * and uploads to storage.
 */
export async function processAndUploadMedia(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessedMediaResult> {
  const extension = (path.extname(fileName) || '').toLowerCase().replace(/^\./, '') || 'bin';
  const cleanBase = path.basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 50);

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const folderPrefix = `${year}/${month}`;

  const isRasterImage = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff', 'image/bmp'].includes(mimeType)
    || ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff'].includes(extension);

  let originalUrl = '';
  let thumbnailUrl: string | null = null;
  let mediumUrl: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let finalSize = fileBuffer.byteLength;
  let finalMimeType = mimeType;
  let finalExtension = extension;
  let storageKey = `${folderPrefix}/${timestamp}_${cleanBase}.${extension}`;

  if (isRasterImage) {
    try {
      const imageInstance = sharp(fileBuffer);
      const metadata = await imageInstance.metadata();
      width = metadata.width || null;
      height = metadata.height || null;

      // 1. Original → compress to WebP with adaptive quality targeting ≤ 100KB
      const TARGET_SIZE = 100 * 1024; // 100 KB
      const MAX_WIDTH = 1920; // Cap resolution at 1920px wide for originals
      let compressedBuffer: Buffer;

      // First pass: resize to max width if needed, then WebP at quality 82
      const needsResize = (width || 0) > MAX_WIDTH;
      const baseSharp = () => needsResize
        ? sharp(fileBuffer).resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : sharp(fileBuffer);

      // Adaptive quality loop: 82 → 70 → 58 → 46 → 34
      const qualitySteps = [82, 70, 58, 46, 34];
      compressedBuffer = await baseSharp().webp({ quality: qualitySteps[0] }).toBuffer();

      for (let qi = 1; qi < qualitySteps.length; qi++) {
        if (compressedBuffer.byteLength <= TARGET_SIZE) break;
        compressedBuffer = await baseSharp().webp({ quality: qualitySteps[qi] }).toBuffer();
      }

      // If still over 100KB after lowest quality, do more aggressive resize
      if (compressedBuffer.byteLength > TARGET_SIZE) {
        compressedBuffer = await sharp(fileBuffer)
          .resize({ width: 1280, withoutEnlargement: true })
          .webp({ quality: 40 })
          .toBuffer();
      }

      // Last resort: 1024px at quality 35 for extremely detailed images
      if (compressedBuffer.byteLength > TARGET_SIZE) {
        compressedBuffer = await sharp(fileBuffer)
          .resize({ width: 1024, withoutEnlargement: true })
          .webp({ quality: 35 })
          .toBuffer();
      }

      // Read final dimensions after compression
      const finalMeta = await sharp(compressedBuffer).metadata();
      width = finalMeta.width || width;
      height = finalMeta.height || height;

      storageKey = `${folderPrefix}/${timestamp}_${cleanBase}.webp`;
      finalMimeType = 'image/webp';
      finalExtension = 'webp';
      finalSize = compressedBuffer.byteLength;
      originalUrl = await saveBuffer(compressedBuffer, storageKey, 'image/webp');

      // 2. Medium variant (max width 800px, WebP)
      const mediumBuffer = await sharp(fileBuffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const mediumKey = `${folderPrefix}/medium_${timestamp}_${cleanBase}.webp`;
      mediumUrl = await saveBuffer(mediumBuffer, mediumKey, 'image/webp');

      // 3. Thumbnail variant (max 300×300px cover crop, WebP)
      const thumbBuffer = await sharp(fileBuffer)
        .resize({ width: 300, height: 300, fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const thumbKey = `${folderPrefix}/thumb_${timestamp}_${cleanBase}.webp`;
      thumbnailUrl = await saveBuffer(thumbBuffer, thumbKey, 'image/webp');
    } catch {
      // Fallback if sharp fails to decode image
      storageKey = `${folderPrefix}/${timestamp}_${cleanBase}.${extension}`;
      originalUrl = await saveBuffer(fileBuffer, storageKey, mimeType);
      mediumUrl = originalUrl;
      thumbnailUrl = originalUrl;
      finalExtension = extension;
      finalMimeType = mimeType;
      finalSize = fileBuffer.byteLength;
    }
  } else {
    // Non-raster file (PDF, SVG, Video MP4, Docs)
    originalUrl = await saveBuffer(fileBuffer, storageKey, mimeType);
  }

  return {
    success: true,
    url: originalUrl,
    thumbnailUrl,
    mediumUrl,
    storageKey,
    fileSize: finalSize,
    mimeType: finalMimeType,
    extension: finalExtension,
    width,
    height,
  };
}

/**
 * Delete one or more files from both Cloudflare R2 and local storage.
 */
export async function deleteStorageFiles(keys: string[]): Promise<void> {
  for (const key of keys) {
    if (!key) continue;
    const cleanKey = key.replace(/^\/?uploads\//, '').replace(/\\/g, '/');

    // Delete from R2
    if (s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: cleanKey,
        });
        await s3Client.send(command);
      } catch (err) {
        console.warn(`[STORAGE] Failed to delete from R2: ${cleanKey}`, err);
      }
    }

    // Delete from local filesystem
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      const localPath = path.join(uploadsDir, cleanKey);
      await fs.unlink(localPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`[STORAGE] Failed to delete local file: ${cleanKey}`, err);
      }
    }
  }
}

/**
 * Backward compatible uploadFile function.
 */
export async function uploadFile(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string
): Promise<UploadResult> {
  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const processed = await processAndUploadMedia(buf, fileName, mimeType);

  return {
    success: true,
    url: processed.url,
    key: processed.storageKey,
    size: processed.fileSize,
    mimeType: processed.mimeType,
  };
}
