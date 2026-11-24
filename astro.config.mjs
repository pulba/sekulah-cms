// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

const isBuild = process.argv.includes('build') || process.argv.includes('preview');

// https://astro.build/config
export default defineConfig({
  site: 'https://sman1unggulan.sch.id',
  integrations: [icon()],
  devToolbar: {
    enabled: false,
  },
  adapter: isBuild
    ? cloudflare({ prerenderEnvironment: 'node' })
    : node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/*.db*', '**/local.db*', '**/*.sqlite*'],
      },
    },
  },
});

