import type { APIRoute } from 'astro';
import { promises as fs } from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const prerender = false;

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'sekulah';

let s3Client: S3Client | null = null;
if (accountId && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

const MIME_MAP: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
};

export const GET: APIRoute = async ({ params }) => {
  const filePath = params.path;
  if (!filePath) {
    return new Response('Not found', { status: 404 });
  }

  // Sanitize path against directory traversal
  const cleanPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const localFile = path.join(process.cwd(), 'public', 'uploads', cleanPath);
  const ext = (cleanPath.split('.').pop() || '').toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  // 1. Try local disk
  try {
    const buffer = await fs.readFile(localFile);
    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Not found locally, try streaming from R2 and cache locally
    if (s3Client) {
      try {
        const res = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: cleanPath.replace(/\\/g, '/'),
          })
        );

        if (res.Body) {
          const stream = res.Body as any;
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          // Cache locally for subsequent requests
          try {
            await fs.mkdir(path.dirname(localFile), { recursive: true });
            await fs.writeFile(localFile, buffer);
          } catch (writeErr) {
            console.warn('[FALLBACK] Failed to cache file locally:', writeErr);
          }

          return new Response(buffer, {
            headers: {
              'Content-Type': res.ContentType || contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      } catch (err: any) {
        console.warn(`[FALLBACK] Object not found in R2: ${cleanPath}`, err.message);
      }
    }
  }

  return new Response('File not found', { status: 404 });
};
