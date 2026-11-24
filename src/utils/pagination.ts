/**
 * Helper Client-Side Pagination System
 * Sesuai Standar Design System: Editorial Precision & Zero-Load Architecture
 */

export interface ClientPaginationOptions {
  container: HTMLElement | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
}

/**
 * Render deretan tombol nomor halaman dengan windowing elipsis (...)
 */
export function renderPaginationButtonsHtml(validPage: number, totalPages: number): string {
  let html = "";
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (
      pageNum === 1 ||
      pageNum === totalPages ||
      (pageNum >= validPage - 1 && pageNum <= validPage + 1)
    ) {
      const isActive = pageNum === validPage;
      const classes = isActive
        ? "pagination-btn bg-primary text-white font-semibold shadow-xs"
        : "pagination-btn border border-border bg-surface text-heading hover:bg-surface-subtle";
      html += `<button type="button" data-page="${pageNum}" class="${classes}">${pageNum}</button>`;
    } else if (pageNum === validPage - 2 || pageNum === validPage + 2) {
      html += '<span class="px-1 text-muted text-xs select-none">...</span>';
    }
  }
  return html;
}

/**
 * Render seluruh bar pagination ke dalam elemen kontainer
 */
export function renderClientPaginationBar(options: ClientPaginationOptions): void {
  const { container, currentPage, totalPages, totalItems, pageSize, itemLabel = "data" } = options;
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = `
      <div class="flex items-center justify-between border-t border-border px-4 py-3 bg-surface text-xs text-muted">
        <span>Tidak ada ${itemLabel} untuk ditampilkan</span>
      </div>
    `;
    return;
  }

  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const fromIdx = (validPage - 1) * pageSize + 1;
  const toIdx = Math.min(validPage * pageSize, totalItems);

  let html = `
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-surface text-xs text-muted">
      <div>
        Menampilkan <span class="font-semibold text-heading">${fromIdx}</span>–<span class="font-semibold text-heading">${toIdx}</span> dari <span class="font-semibold text-heading">${totalItems}</span> ${itemLabel}
      </div>
  `;

  if (totalPages > 1) {
    html += `
      <div class="flex items-center gap-1.5 *:inline-flex *:h-[30px] *:items-center *:justify-center *:rounded-[6px] *:font-medium *:transition-colors *:text-xs">
        <button
          type="button"
          data-page="${validPage - 1}"
          class="pagination-btn border border-border px-2.5 ${validPage <= 1 ? "pointer-events-none opacity-40 bg-surface-subtle text-muted" : "bg-surface text-heading hover:bg-surface-subtle cursor-pointer"}"
          ${validPage <= 1 ? "disabled" : ""}
        >
          Sebelumnya
        </button>
        <div class="flex items-center gap-1 *:inline-flex *:h-[30px] *:min-w-[30px] *:px-2 *:items-center *:justify-center *:rounded-[6px] *:font-medium *:transition-colors *:text-xs *:cursor-pointer">
          ${renderPaginationButtonsHtml(validPage, totalPages)}
        </div>
        <button
          type="button"
          data-page="${validPage + 1}"
          class="pagination-btn border border-border px-2.5 ${validPage >= totalPages ? "pointer-events-none opacity-40 bg-surface-subtle text-muted" : "bg-surface text-heading hover:bg-surface-subtle cursor-pointer"}"
          ${validPage >= totalPages ? "disabled" : ""}
        >
          Selanjutnya
        </button>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}
