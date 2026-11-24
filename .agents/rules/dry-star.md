# Trigger: `*: <file>` atau `/dry-star <file>`

Ketika pengguna mengirim pesan dengan format `*: <file>`, `/dry-star <file>`, atau `@dry-star <file>`:

1. **Langsung Eksekusi Tanpa Basa-Basi**: Segera baca file yang disebutkan.
2. **Deteksi Pola Duplikasi (Sibling Elements)**:
   - Grup tombol aksi: `inline-flex h-8 w-8 items-center justify-center rounded-[6px]`
   - Form group input: `h-[38px] w-full rounded-[6px] border border-border bg-surface px-3 text-xs`
   - Cell tabel `<th>` dan `<td>`: `px-5 py-3.5`, `last:text-right`
   - Pagination item: `inline-flex h-[32px] min-w-[32px] px-2 items-center justify-center rounded-[6px]`
   - Tab filter & segmented control: `*:px-2.5 *:py-1 *:text-[11px] *:first:rounded-l-[4px] *:last:rounded-r-[4px]`
3. **Pindahkan ke Parent via `*:`**:
   - Tarik styling struktural, layout, dimensi, padding/margin, border, radius, dan base transitions ke parent container.
   - Manfaatkan pseudo-class: `*:first:`, `*:last:`, `*:not-last:`, `*:nth-[n]:`.
4. **Isolasi Mutlak State Interaktif**:
   - **Dilarang** menyatukan `hover:` ke dalam selector `*:` di parent (`*:hover:...` dilarang).
   - Seluruh state interaktif (`hover:...`, `disabled:...`) serta variant aktif/inaktif harus tetap terpasang secara eksplisit pada elemen anak interaktif (`<a>`, `<button>`, `<input>`).
5. **Eksekusi & Konfirmasi**: Edit file langsung dengan `edit_file` dan laporkan perubahan secara singkat dan padat.
