## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Command Trigger: `*: <file>` atau `/dry-star <file>`

Ketika pengguna mengirim pesan dengan trigger `*: <file>`, `/dry-star <file>`, atau `@dry-star <file>` (contoh: `*: @[src/pages/admin/agenda/index.astro]` atau `/dry-star src/pages/admin/...`):
1. **Langsung Eksekusi Tanpa Basa-Basi**: Baca file target secara lengkap.
2. **Identifikasi Duplikasi**: Temukan grup elemen bersaudara (sibling elements) yang mengulang utility Tailwind serupa (misal: grup tombol, form input, baris tabel `<tr>` -> `<th>`/`<td>`, badge, pagination, tab filter).
3. **Pindahkan ke Parent via Tailwind v4 `*:`**: Pindahkan utility dimensi, layout, padding/margin, border, radius, tipografi dasar, dan base transition ke parent container menggunakan child selector `*:` (dikombinasikan dengan `*:first:`, `*:last:`, `*:not-last:`, `*:nth-[n]:`).
4. **Isolasi State Interaktif**: Dilarang keras menggabungkan `hover:` ke dalam `*:` di level parent (`*:hover:...` dilarang). State `hover:...` serta variant aktif/inaktif WAJIB tetap dipasang eksplisit pada elemen anak interaktif (`<a>`, `<button>`).
5. **Simpan Otomatis**: Terapkan refactoring ke file tersebut menggunakan `edit_file` dan laporkan ringkasan singkat dalam 2-3 baris saja.
