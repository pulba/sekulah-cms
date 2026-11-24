import fs from 'fs';
import path from 'path';

function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🔄 Preparing output for Cloudflare Pages (Advanced Mode)...');

// 1. Copy static assets from dist/client to dist root
copyRecursive('dist/client', 'dist');

// 2. Create dist/_worker.js pointing to the compiled server entry
const workerContent = `export { default } from './server/entry.mjs';\n`;
fs.writeFileSync('dist/_worker.js', workerContent);

// 3. Create _routes.json so Cloudflare Pages knows to route everything to _worker.js except static assets
const routesConfig = {
  version: 1,
  include: ['/*'],
  exclude: ['/_astro/*', '/images/*', '/favicon.*', '/robots.txt', '/_headers'],
};
fs.writeFileSync('dist/_routes.json', JSON.stringify(routesConfig, null, 2));

console.log('✅ Cloudflare Pages _worker.js and _routes.json prepared in dist/!');
