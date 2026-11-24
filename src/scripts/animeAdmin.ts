import { animate, stagger } from 'animejs';

/**
 * CMS Admin Dashboard & Management Pages - Anime.js Physics Engine
 * Follows Rule 16 from DESIGN-SYSTEM.md:
 * - Prinsip Bukit & Lembah: inOutSine (smooth gradual acceleration & zero-impact soft landing)
 * - Per-Property Duration:
 *   - Opacity: 400ms-450ms outSine (instantly crisp & readable)
 *   - TranslateY: 750ms-850ms inOutSine (gentle & stable)
 * - Table rows micro-stagger for silky smooth zero-reload status tab transitions
 * - Modal dialogs scale & fade entrance
 */
export function initAdminAnimations() {
  if (typeof window === 'undefined') return;

  // 1. WELCOME BANNER & PAGE HEADER ENTRANCE
  const welcomeBanner = document.querySelector<HTMLElement>('main h1, .space-y-6 > div:first-child h1, [data-admin-header]');
  if (welcomeBanner && !welcomeBanner.dataset.animeDone) {
    welcomeBanner.dataset.animeDone = 'true';
    const bannerContainer = welcomeBanner.closest('.space-y-1\\.5, .space-y-1, div') as HTMLElement;
    if (bannerContainer) {
      animate(bannerContainer, {
        opacity: {
          from: 0,
          to: 1,
          duration: 450,
          ease: 'outSine',
        },
        translateY: {
          from: 14,
          to: 0,
          duration: 800,
          ease: 'inOutSine',
        },
      });
    }
  }

  // 2. STATUS TABS & FILTER CONTROLS ENTRANCE
  const filterBars = document.querySelectorAll<HTMLElement>('[role="tablist"], div:has(> .status-tab-btn)');
  filterBars.forEach((fb) => {
    if (fb.dataset.animeFilterDone) return;
    fb.dataset.animeFilterDone = 'true';
    animate(fb, {
      opacity: {
        from: 0,
        to: 1,
        duration: 420,
        ease: 'outSine',
      },
      translateY: {
        from: 10,
        to: 0,
        duration: 720,
        ease: 'inOutSine',
      },
      delay: 50,
    });
  });

  // 3. KPI METRIC CARDS STAGGER
  const kpiContainer = document.querySelector<HTMLElement>('[data-admin-kpi-grid]');
  if (kpiContainer && !kpiContainer.dataset.animeKpiDone) {
    kpiContainer.dataset.animeKpiDone = 'true';
    const kpiCards = Array.from(kpiContainer.querySelectorAll<HTMLElement>('[data-kpi-card]'));
    if (kpiCards.length > 0) {
      animate(kpiCards, {
        opacity: {
          from: 0,
          to: 1,
          duration: 450,
          ease: 'outSine',
        },
        translateY: {
          from: 18,
          to: 0,
          duration: 850,
          ease: 'inOutSine',
        },
        scale: {
          from: 0.97,
          to: 1,
          duration: 850,
          ease: 'inOutSine',
        },
        delay: stagger(90, { start: 60 }),
      });
    }
  }

  // 4. KPI NUMBER COUNTER ANIMATION
  const kpiNumbers = document.querySelectorAll<HTMLElement>('.font-display.text-3xl.font-bold, [data-kpi-number]');
  kpiNumbers.forEach((el) => {
    if (el.dataset.counterDone) return;
    el.dataset.counterDone = 'true';

    const raw = el.innerText.trim();
    const num = parseInt(raw.replace(/\./g, '').replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const obj = { count: 0 };
      animate(obj, {
        count: num,
        duration: 1100,
        ease: 'inOutSine',
        onUpdate: () => {
          el.innerText = Math.round(obj.count).toLocaleString('id-ID');
        },
      });
    }
  });

  // 5. DASHBOARD PANELS, FORMS & TABLES CONTAINER ENTRANCE
  const panels = document.querySelectorAll<HTMLElement>(
    'main .rounded-\\[10px\\].border:not(article *):not([data-no-panel-anime]), main .rounded-\\[8px\\].border:not(a):not(article *):not([data-no-panel-anime]), [data-admin-panel]'
  );
  if (panels.length > 0) {
    const toAnimatePanels: HTMLElement[] = [];
    panels.forEach((p) => {
      if (!p.dataset.animePanelDone && !p.closest('[data-admin-kpi-grid]')) {
        p.dataset.animePanelDone = 'true';
        toAnimatePanels.push(p);
      }
    });

    if (toAnimatePanels.length > 0) {
      animate(toAnimatePanels.slice(0, 6), {
        opacity: {
          from: 0,
          to: 1,
          duration: 450,
          ease: 'outSine',
        },
        translateY: {
          from: 16,
          to: 0,
          duration: 800,
          ease: 'inOutSine',
        },
        delay: stagger(75, { start: 120 }),
      });
    }
  }

  // 6. TABLE ROWS MICRO-STAGGER ENTRANCE (Max 15 rows for high-fps responsiveness)
  const tables = document.querySelectorAll<HTMLTableElement>('main table');
  tables.forEach((tbl) => {
    if (tbl.dataset.animeRowsDone) return;
    tbl.dataset.animeRowsDone = 'true';

    const rows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>('tbody tr')).slice(0, 15);
    if (rows.length > 0) {
      animate(rows, {
        opacity: {
          from: 0,
          to: 1,
          duration: 400,
          ease: 'outSine',
        },
        translateY: {
          from: 10,
          to: 0,
          duration: 750,
          ease: 'inOutSine',
        },
        delay: stagger(28, { start: 100 }),
      });
    }
  });

  // 7. MODAL DIALOGS SMOOTH ENTRANCE OBSERVER
  initModalAnimeObserver();
}

/**
 * Observes DOM mutations for modal dialogs becoming visible (removing `hidden` class)
 * and animates modal box gracefully with scale 0.96 -> 1 and soft inOutSine landing.
 */
let modalObserverAttached = false;
function initModalAnimeObserver() {
  if (modalObserverAttached) return;
  modalObserverAttached = true;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target as HTMLElement;
        if (target.classList && target.classList.contains('fixed') && !target.classList.contains('hidden')) {
          // Look for modal dialog box inside
          const modalBox = target.querySelector<HTMLElement>(
            '.relative.rounded-\\[12px\\], .rounded-\\[10px\\], [role="dialog"] > div'
          );
          if (modalBox && !modalBox.dataset.animeModalActive) {
            modalBox.dataset.animeModalActive = 'true';
            animate(modalBox, {
              opacity: {
                from: 0,
                to: 1,
                duration: 380,
                ease: 'outSine',
              },
              scale: {
                from: 0.96,
                to: 1,
                duration: 400,
                ease: 'inOutSine',
              },
              translateY: {
                from: 10,
                to: 0,
                duration: 400,
                ease: 'inOutSine',
              },
              onComplete: () => {
                delete modalBox.dataset.animeModalActive;
              },
            });
          }
        }
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class'],
  });
}
