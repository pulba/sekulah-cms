import { animate, stagger } from 'animejs';

/**
 * Public School Portal - Anime.js Refined Physics Engine
 * Follows Rule 16 from DESIGN-SYSTEM.md:
 * - Prinsip Bukit & Lembah: inOutSine 920ms-1000ms (siap landai -> meluncur tenang -> menempel landai)
 * - Per-Property Duration: opacity 480ms (outSine), translateY 920ms-1000ms (inOutSine)
 * - Auto-Discovery: Otomatis mendeteksi kartu konten & section di seluruh halaman publik
 * - Wave Delay: Otomatis menghitung stagger bergelombang 100ms-130ms antar kolom grid
 * - Bidirectional Scroll: Otomatis re-arm saat keluar viewport >100px (scroll ke bawah & ke atas)
 * - Stats Counter: Count up angka statistik dengan format id-ID
 */

function autoDiscoverPublicElements() {
  const main = document.querySelector('main');
  if (!main) return;

  // 1. Auto-tag section headers (h2 + subtitle / badge) di bawah fold
  const sectionHeaders = main.querySelectorAll<HTMLElement>(
    'section:not(:first-of-type) > .mx-auto > div:first-child, section:not(:first-of-type) header, main .section-header'
  );
  sectionHeaders.forEach((sh) => {
    if (!sh.classList.contains('reveal-on-scroll') && !sh.hasAttribute('data-reveal')) {
      sh.classList.add('reveal-on-scroll');
      if (!sh.hasAttribute('data-reveal-delay')) {
        sh.setAttribute('data-reveal-delay', '0');
      }
    }
  });

  // 2. Auto-tag kartu berita, artikel, prestasi, galeri, fasilitas, agenda, ekskul, guru, alumni
  const gridCards = main.querySelectorAll<HTMLElement>(
    'article, .grid > div:not(.col-span-full), .grid > a:not(.col-span-full), [data-card]'
  );
  gridCards.forEach((card) => {
    // Hindari tombol pagination, filter tabs, modal, slider, atau inline container non-card
    if (
      card.closest('nav') ||
      card.closest('[role="tablist"]') ||
      card.closest('.fixed') ||
      card.closest('[id$="-slider-track"], #hero-slider') ||
      card.classList.contains('pagination')
    ) {
      return;
    }

    if (!card.classList.contains('reveal-on-scroll') && !card.hasAttribute('data-reveal')) {
      card.classList.add('reveal-on-scroll');
    }
  });

  // 3. Auto-tag accordion / FAQ items
  const accordions = main.querySelectorAll<HTMLElement>('[data-accordion-item], details');
  accordions.forEach((acc) => {
    if (!acc.classList.contains('reveal-on-scroll') && !acc.hasAttribute('data-reveal')) {
      acc.classList.add('reveal-on-scroll');
    }
  });
}

export function initPublicAnimations() {
  if (typeof window === 'undefined') return;

  // 0. Auto discover elements across all public pages
  autoDiscoverPublicElements();

  // Track scroll direction for natural entrance direction
  let lastScrollY = window.scrollY;
  let scrollDirection: 'down' | 'up' = 'down';

  const updateScrollDir = () => {
    const curY = window.scrollY;
    if (Math.abs(curY - lastScrollY) > 3) {
      scrollDirection = curY > lastScrollY ? 'down' : 'up';
      lastScrollY = curY;
    }
  };
  window.addEventListener('scroll', updateScrollDir, { passive: true });

  // 1. HERO ENTRANCE ANIMATION (On Load / Page Swap - skip #hero-slider)
  const heroSection = document.querySelector('section[aria-label="Hero Utama"], .hero-section, main > section:first-of-type');
  if (heroSection && heroSection.id !== 'hero-slider' && !heroSection.hasAttribute('data-anime-hero-done')) {
    heroSection.setAttribute('data-anime-hero-done', 'true');

    const heroElements = heroSection.querySelectorAll('h1, p, .hero-badge, a.btn-cta, button, .hero-action');
    if (heroElements.length > 0) {
      animate(heroElements, {
        opacity: {
          from: 0,
          to: 1,
          duration: 480,
          ease: 'outSine',
        },
        translateY: {
          from: 20,
          to: 0,
          duration: 880,
          ease: 'inOutSine',
        },
        delay: stagger(100, { start: 100 }),
      });
    }
  }

  // 2. NUMBER COUNTER ANIMATION FOR STATS (Bidirectional Re-trigger)
  const statCards = document.querySelectorAll<HTMLElement>('[data-stat-value], .stat-number');
  if (statCards.length > 0) {
    const statObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            if (target.dataset.counterDone) return;
            target.dataset.counterDone = 'true';

            const rawText = target.getAttribute('data-stat-value') || target.innerText.trim();
            const numericMatch = rawText.match(/[\d.,]+/);
            if (numericMatch) {
              const cleaned = numericMatch[0].replace(/\./g, '').replace(',', '.');
              const targetVal = parseFloat(cleaned);
              if (!isNaN(targetVal) && targetVal > 0) {
                const prefix = rawText.slice(0, numericMatch.index);
                const suffix = rawText.slice((numericMatch.index || 0) + numericMatch[0].length);
                const obj = { val: 0 };
                const isDecimal = numericMatch[0].includes(',');

                animate(obj, {
                  val: targetVal,
                  duration: 1250,
                  ease: 'inOutSine',
                  onUpdate: () => {
                    const formatted = isDecimal
                      ? obj.val.toFixed(1).replace('.', ',')
                      : Math.round(obj.val).toLocaleString('id-ID');
                    target.innerText = `${prefix}${formatted}${suffix}`;
                  },
                });
              }
            }
          } else {
            // When leaving viewport completely, re-arm so it counts up again when scrolling back
            const rect = entry.boundingClientRect;
            if (rect.bottom < -60 || rect.top > window.innerHeight + 60) {
              delete target.dataset.counterDone;
            }
          }
        });
      },
      { threshold: 0.15 }
    );

    statCards.forEach((c) => statObserver.observe(c));
  }

  // 3. BIDIRECTIONAL SCROLL REVEAL WITH PER-PROPERTY DURATION & WAVE DELAYS
  const revealElements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll, [data-reveal]');
  if (revealElements.length === 0) return;

  // Batch all layout reads before DOM style writes to prevent forced reflow
  const vh = window.innerHeight;
  const rects = Array.from(revealElements).map((el) => el.getBoundingClientRect());

  revealElements.forEach((el, idx) => {
    const rect = rects[idx];
    const isCurrentlyVisible = rect.top < vh && rect.bottom > 0;

    if (!isCurrentlyVisible) {
      el.style.opacity = '0';
      el.style.transform = rect.top >= vh ? 'translateY(24px)' : 'translateY(-20px)';
      el.style.willChange = 'opacity, transform';
      delete el.dataset.animeRevealed;
    } else {
      el.dataset.animeRevealed = 'true';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }
  });

  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLElement;

        if (entry.isIntersecting) {
          // If already currently showing, skip
          if (el.dataset.animeRevealed === 'true') return;
          el.dataset.animeRevealed = 'true';

          // Extract specified delay (wave or waterfall)
          let delayMs = 0;
          const explicitDelay = el.getAttribute('data-reveal-delay');
          if (explicitDelay !== null) {
            delayMs = parseInt(explicitDelay, 10) || 0;
          } else {
            // Auto-wave delay for sibling cards in same grid/flex container
            const parent = el.parentElement;
            if (parent && parent.children.length > 1) {
              const siblings = Array.from(parent.children).filter((c) =>
                c.classList.contains('reveal-on-scroll') || c.hasAttribute('data-reveal')
              );
              const idx = siblings.indexOf(el);
              if (idx > 0) {
                // Determine rough column count from grid classes if possible
                let colCount = 3;
                if (parent.classList.contains('sm:grid-cols-2') || parent.classList.contains('grid-cols-2')) colCount = 2;
                if (parent.classList.contains('lg:grid-cols-4') || parent.classList.contains('xl:grid-cols-4')) colCount = 4;
                if (parent.classList.contains('lg:grid-cols-5')) colCount = 5;

                const colIndex = idx % colCount;
                const rowIndex = Math.floor(idx / colCount);
                // Beautiful fluid wave: column wave 110ms + row propagation 50ms
                delayMs = colIndex * 110 + rowIndex * 50;
              }
            }
          }

          // Gentle rolling hill entrance (offset 24px down on scroll down, -20px on scroll up)
          const startOffset = scrollDirection === 'up' ? -20 : 24;

          // Mass/inertia aware: large featured cards take 1000ms, standard cards take 920ms
          const isLargeCard =
            el.classList.contains('lg:col-span-7') ||
            el.classList.contains('min-h-[280px]') ||
            el.hasAttribute('data-large-card') ||
            (el.getAttribute('data-reveal-delay') === '100' && el.parentElement?.classList.contains('grid-cols-12'));
          const slideDuration = isLargeCard ? 1000 : 920;

          // Per-Property Duration: Opacity fast & crisp (480ms), Position slow & landai (920-1000ms inOutSine)
          animate(el, {
            opacity: {
              from: 0,
              to: 1,
              duration: 480,
              ease: 'outSine',
            },
            translateY: {
              from: startOffset,
              to: 0,
              duration: slideDuration,
              ease: 'inOutSine',
            },
            delay: delayMs,
          });
        } else {
          // Reset when scrolled completely out of view (both above and below)
          const rect = entry.boundingClientRect;
          const isFarAbove = rect.bottom < -100;
          const isFarBelow = rect.top > window.innerHeight + 100;

          if (isFarAbove || isFarBelow) {
            delete el.dataset.animeRevealed;
            el.style.opacity = '0';
            el.style.transform = isFarBelow ? 'translateY(24px)' : 'translateY(-20px)';
          }
        }
      });
    },
    {
      threshold: 0.05,
      rootMargin: '15px 0px -25px 0px',
    }
  );

  revealElements.forEach((el) => {
    scrollObserver.observe(el);
  });
}
