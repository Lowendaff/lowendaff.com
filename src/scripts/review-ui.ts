import { bindRovingTabs, safeDecodeHash } from '../lib/ui-client';

function getStickyReadingOffset(): number {
  const headerH =
    document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 60;
  const toc = document.querySelector<HTMLElement>('.article-toc');
  const tocH = toc && toc.offsetParent ? toc.offsetHeight : 0;
  return headerH + tocH + 12;
}

function scrollElementBelowStickyBars(
  target: HTMLElement,
  behavior: ScrollBehavior,
) {
  const stickyOffset = getStickyReadingOffset();
  const rawTop =
    window.scrollY + target.getBoundingClientRect().top - stickyOffset;
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const destY = Math.max(0, Math.min(Math.round(rawTop), maxScroll));
  window.scrollTo({ top: destY, behavior });
  return destY;
}

// 1. Retire former expand-all URLs without changing selected tabs or targets.
function normalizeLegacyReviewUrl() {
  const url = new URL(location.href);
  let changed = url.searchParams.has('view');
  url.searchParams.delete('view');
  for (const key of ['return-route', 'return-tcp-route', 'outbound-route']) {
    const value = url.searchParams.get(key);
    if (value?.endsWith(':all')) {
      url.searchParams.set(key, value.slice(0, -4));
      changed = true;
    }
  }
  if (url.hash === '#offer' || url.hash === '#overview') {
    url.hash = 'purchase';
    changed = true;
    requestAnimationFrame(() => {
      const el = document.getElementById('purchase');
      if (el) scrollElementBelowStickyBars(el, 'instant');
    });
  }
  if (changed) history.replaceState(null, '', url);
}

// 2. Heading tooltip hints with shared page-level Escape / outside-pointer dismissal.
function initHintHeadings() {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>('[data-heading-hint]'),
  );
  if (!roots.length) return;

  const controllers = roots.map((root) => {
    const trigger = root.querySelector<HTMLButtonElement>(
      '[data-hint-trigger]',
    )!;
    const content = root.querySelector<HTMLElement>('[data-hint-content]')!;
    let pinned = false;
    let hovering = false;
    let dismissed = false;
    const render = () => {
      content.hidden =
        dismissed ||
        !(pinned || hovering || root.contains(document.activeElement));
    };
    root.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        hovering = true;
        dismissed = false;
        render();
      }
    });
    root.addEventListener('pointerleave', () => {
      hovering = false;
      render();
    });
    root.addEventListener('focusin', () => {
      dismissed = false;
      render();
    });
    root.addEventListener('focusout', () => {
      pinned = false;
      queueMicrotask(render);
    });
    trigger.addEventListener('click', () => {
      pinned = !pinned;
      dismissed = !pinned;
      render();
    });
    return {
      root,
      dismiss() {
        if (!pinned && !hovering && !root.contains(document.activeElement))
          return;
        pinned = false;
        dismissed = true;
        render();
      },
    };
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      controllers.forEach((c) => c.dismiss());
    }
  });
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node | null;
    controllers.forEach((c) => {
      if (!target || !c.root.contains(target)) c.dismiss();
    });
  });
}

// 3. Route target comboboxes with delegated list listeners & single active-open tracker.
function initRoutePickers() {
  const pickers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-route-picker]'),
  );
  if (!pickers.length) return;

  let activePicker: { root: HTMLElement; close: () => void } | null = null;

  pickers.forEach((root) => {
    const trigger = root.querySelector<HTMLButtonElement>(
      '[data-picker-trigger]',
    )!;
    const value = root.querySelector<HTMLElement>('[data-picker-value]')!;
    const list = root.querySelector<HTMLElement>('[data-picker-list]')!;
    const options = Array.from(
      list.querySelectorAll<HTMLElement>('[data-picker-option]'),
    );
    if (!options.length) return;

    let active = 0;
    let buffer = '';
    let typedAt = 0;
    const selected = () => Number(root.dataset.value || 0);

    const reflect = () => {
      const index = selected();
      const targetOption = options[index] ?? options[0];
      value.textContent = targetOption.querySelector('span')?.textContent ?? '';
      options.forEach((option, i) => {
        option.setAttribute('aria-selected', String(i === index));
      });
    };

    const highlight = (index: number) => {
      const prev = options[active];
      if (prev) prev.dataset.active = 'false';
      active = Math.min(options.length - 1, Math.max(0, index));
      const cur = options[active];
      cur.dataset.active = 'true';
      trigger.setAttribute('aria-activedescendant', cur.id);
      cur.scrollIntoView({ block: 'nearest' });
    };

    const close = () => {
      if (list.hidden) return;
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      buffer = '';
      if (activePicker?.root === root) activePicker = null;
    };

    const commit = (index: number) => {
      root.dataset.value = String(index);
      reflect();
      close();
      root.dispatchEvent(
        new CustomEvent('route-select', { bubbles: true, detail: index }),
      );
    };

    const open = () => {
      if (activePicker && activePicker.root !== root) {
        activePicker.close();
      }
      const rect = trigger.getBoundingClientRect();
      const below = innerHeight - rect.bottom - 16;
      const above = rect.top - 100;
      const up = below < 220 && above > below;
      root.dataset.side = up ? 'top' : 'bottom';
      list.style.maxHeight = `${Math.max(88, Math.min(320, up ? above : below))}px`;
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      activePicker = { root, close };
      highlight(selected());
    };

    trigger.addEventListener('click', () => {
      list.hidden ? open() : close();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!list.hidden) {
          event.preventDefault();
          close();
        }
        return;
      }
      if (event.key === 'Tab') {
        if (!list.hidden) commit(active);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        list.hidden ? open() : commit(active);
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (list.hidden) {
          open();
          if (event.key === 'Home') highlight(0);
          if (event.key === 'End') highlight(options.length - 1);
        } else {
          highlight(
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? options.length - 1
                : active + (event.key === 'ArrowDown' ? 1 : -1),
          );
        }
        return;
      }
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (list.hidden) open();
        const now = Date.now();
        buffer = now - typedAt > 700 ? event.key : buffer + event.key;
        typedAt = now;
        const needle = [...buffer].every((c) => c === buffer[0])
          ? buffer[0]
          : buffer;
        const match = options
          .map((_, i) => (active + i + 1) % options.length)
          .find((i) =>
            options[i]
              .textContent!.trim()
              .toLocaleLowerCase()
              .startsWith(needle.toLocaleLowerCase()),
          );
        if (match !== undefined) highlight(match);
      }
    });

    // Delegated option handlers on listbox (3 listeners per listbox instead of 3 * N).
    list.addEventListener('pointerdown', (event) => {
      if ((event.target as Element | null)?.closest('[data-picker-option]')) {
        event.preventDefault();
      }
    });
    list.addEventListener('click', (event) => {
      const opt = (event.target as Element | null)?.closest<HTMLElement>(
        '[data-picker-option]',
      );
      if (!opt) return;
      const idx = Number(opt.dataset.pickerOption);
      if (Number.isInteger(idx)) {
        commit(idx);
        trigger.focus({ preventScroll: true });
      }
    });
    list.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const opt = (event.target as Element | null)?.closest<HTMLElement>(
        '[data-picker-option]',
      );
      if (!opt) return;
      const idx = Number(opt.dataset.pickerOption);
      if (Number.isInteger(idx) && active !== idx) highlight(idx);
    });

    root.addEventListener('focusout', () => {
      queueMicrotask(() => {
        if (!root.contains(document.activeElement)) close();
      });
    });
    root.addEventListener('route-picker-close', close);
    root.addEventListener('route-picker-sync', reflect);
    root.hidden = false;
    reflect();
  });

  document.addEventListener('pointerdown', (event) => {
    if (activePicker && !activePicker.root.contains(event.target as Node)) {
      activePicker.close();
    }
  });
}

// 4. Carrier route explorers with active-only ResizeObserver.
function initRouteExplorers() {
  document
    .querySelectorAll<HTMLElement>('[data-route-explorer]')
    .forEach((root) => {
      const tabs = Array.from(
        root.querySelectorAll<HTMLButtonElement>('[data-route-tab]'),
      );
      const panels = Array.from(
        root.querySelectorAll<HTMLElement>('[data-route-panel]'),
      );
      const selectors = Array.from(
        root.querySelectorAll<HTMLElement>('[data-route-picker]'),
      );
      if (!tabs.length) return;
      let selected = 0;
      const key = root.dataset.routeExplorer || 'routes';

      const restore = () => {
        const initial = new URLSearchParams(location.search)
          .get(key)
          ?.split(':');
        if (!initial) return;
        const group = Number(initial[0]);
        selected =
          Number.isInteger(group) && group >= 0 && group < tabs.length
            ? group
            : 0;
        const target = Number(initial[1]);
        const count = selectors[selected].querySelectorAll(
          '[data-picker-option]',
        ).length;
        selectors[selected].dataset.value = String(
          Number.isInteger(target) && target >= 0 && target < count
            ? target
            : 0,
        );
      };

      const scrollFrames = new Map<HTMLElement, HTMLElement>();
      const boundScroll = new WeakSet<HTMLElement>();
      const pending = new Set<HTMLElement>();
      let frameRequest = 0;
      const measure = () => {
        frameRequest = 0;
        pending.forEach((viewport) => {
          const frame = scrollFrames.get(viewport);
          if (!frame) return;
          const visible = viewport.clientWidth > 0 && viewport.clientHeight > 0;
          frame.dataset.scrollLeft = String(visible && viewport.scrollLeft > 1);
          frame.dataset.scrollRight = String(
            visible &&
              viewport.scrollWidth -
                viewport.clientWidth -
                viewport.scrollLeft >
                1,
          );
          frame.dataset.scrollUp = String(visible && viewport.scrollTop > 1);
          frame.dataset.scrollDown = String(
            visible &&
              viewport.scrollHeight -
                viewport.clientHeight -
                viewport.scrollTop >
                1,
          );
          if (visible) {
            frame.style.setProperty(
              '--route-header-height',
              `${viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0}px`,
            );
          }
        });
        pending.clear();
      };
      const schedule = (viewport: HTMLElement) => {
        pending.add(viewport);
        if (!frameRequest) frameRequest = requestAnimationFrame(measure);
      };
      const resizeObserver = new ResizeObserver((entries) => {
        entries.forEach(({ target }) => {
          const viewport = target.matches('.data-table')
            ? (target as HTMLElement)
            : target.closest<HTMLElement>('.data-table');
          if (viewport) schedule(viewport);
        });
      });
      const syncActiveObserver = () => {
        resizeObserver.disconnect();
        const activePanel = panels[selected];
        if (!activePanel || activePanel.hidden) return;
        const activeVal = selectors[selected]?.dataset.value;
        const activeRecord = activePanel.querySelector<HTMLElement>(
          `[data-route-record="${CSS.escape(activeVal || '0')}"]`,
        );
        const frame =
          activeRecord?.querySelector<HTMLElement>('[data-route-table]');
        const viewport = frame?.querySelector<HTMLElement>('.data-table');
        const table = viewport?.querySelector('table');
        if (!frame || !viewport || !table) return;
        scrollFrames.set(viewport, frame);
        if (!boundScroll.has(viewport)) {
          boundScroll.add(viewport);
          viewport.addEventListener('scroll', () => schedule(viewport), {
            passive: true,
          });
        }
        resizeObserver.observe(viewport);
        resizeObserver.observe(table);
        schedule(viewport);
      };

      const render = (sync = true) => {
        tabs.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === selected));
          tab.tabIndex = i === selected ? 0 : -1;
        });
        panels.forEach((panel, i) => {
          panel.hidden = i !== selected;
          selectors[i].dispatchEvent(new Event('route-picker-close'));
          selectors[i].dispatchEvent(new Event('route-picker-sync'));
          panel
            .querySelectorAll<HTMLElement>('[data-route-record]')
            .forEach((record) => {
              record.hidden =
                record.dataset.routeRecord !== selectors[i].dataset.value;
            });
        });
        if (sync) {
          const url = new URL(location.href);
          url.searchParams.set(
            key,
            `${selected}:${selectors[selected].dataset.value}`,
          );
          history.replaceState(null, '', url);
        }
        syncActiveObserver();
      };

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
          selected = i;
          render();
        });
      });
      bindRovingTabs(tabs, (next) => {
        selected = next;
        render();
      });
      selectors.forEach((select) =>
        select.addEventListener('route-select', () => render()),
      );

      const parentPanel = root.closest<HTMLElement>('[data-review-panel]');
      if (parentPanel) {
        new MutationObserver(() => {
          if (!parentPanel.hidden) syncActiveObserver();
        }).observe(parentPanel, {
          attributes: true,
          attributeFilter: ['hidden'],
        });
      }

      root.classList.add('enhanced');
      restore();
      render(false);
    });
}

// 5. BGP IPv4/IPv6 perspective tabs.
function initBgpPerspectives() {
  document.querySelectorAll<HTMLElement>('[data-bgp]').forEach((root) => {
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-bgp-tab]'),
    );
    const panels = Array.from(
      root.querySelectorAll<HTMLElement>('[data-bgp-panel]'),
    );
    if (!tabs.length) return;
    let selected =
      new URLSearchParams(location.search).get('bgp') === 'IPv6' ? 1 : 0;
    const render = () => {
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === selected));
        tab.tabIndex = i === selected ? 0 : -1;
      });
      panels.forEach((panel, i) => {
        panel.hidden = i !== selected;
      });
    };
    const choose = (i: number) => {
      selected = i;
      render();
      const url = new URL(location.href);
      url.searchParams.set('bgp', tabs[i].dataset.bgpTab!);
      history.replaceState(null, '', url);
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => choose(i));
    });
    bindRovingTabs(tabs, (next) => choose(next), { twoItemToggle: true });
    render();
  });
}

// 6. Chapter sub-panel tabs & deep-link sub-section reveal respecting sticky bars.
function initReviewPanels() {
  document
    .querySelectorAll<HTMLElement>('[data-review-panels]')
    .forEach((root) => {
      const key = root.dataset.reviewPanels!;
      const tabs = Array.from(
        root.querySelectorAll<HTMLButtonElement>('[data-review-tab]'),
      );
      const panels = Array.from(
        root.querySelectorAll<HTMLElement>('[data-review-panel]'),
      );
      if (!tabs.length) return;
      const params = new URLSearchParams(location.search);
      let selected = Math.max(
        0,
        tabs.findIndex((tab) => tab.dataset.reviewTab === params.get(key)),
      );
      const render = (sync = false) => {
        panels.forEach((panel, i) => {
          panel.hidden = i !== selected;
        });
        tabs.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === selected));
          tab.tabIndex = i === selected ? 0 : -1;
        });
        if (sync) {
          const url = new URL(location.href);
          url.searchParams.set(key, tabs[selected].dataset.reviewTab!);
          history.replaceState(null, '', url);
        }
      };
      const choose = (i: number) => {
        selected = i;
        render(true);
      };
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => choose(i));
      });
      bindRovingTabs(tabs, (next) => choose(next));

      const revealHash = () => {
        const hash = safeDecodeHash();
        if (!hash) return;
        const target = document.getElementById(hash);
        if (!target) return;
        const index = panels.findIndex(
          (p) => p === target || p.contains(target),
        );
        if (index >= 0) {
          selected = index;
          render();
          target.closest('details')?.setAttribute('open', '');
          target.querySelector('details')?.setAttribute('open', '');
          requestAnimationFrame(() =>
            scrollElementBelowStickyBars(target, 'instant'),
          );
        }
      };
      window.addEventListener('hashchange', revealHash);
      root.classList.add('enhanced');
      render();
      revealHash();
    });
}

// 7. Sticky chapter TOC scroll-spy & smooth anchor navigation.
function initArticleToc() {
  const toc = document.querySelector<HTMLElement>('.article-toc');
  const mobileToc = document.querySelector<HTMLDetailsElement>('.mobile-toc');
  const tocLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('.article-toc a[data-toc-id]'),
  );
  const mobileLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('.mobile-toc a[data-toc-id]'),
  );
  const sections = tocLinks
    .map((link) => {
      const id = link.dataset.tocId ?? '';
      const el = id ? document.getElementById(id) : null;
      return el ? { id, el } : null;
    })
    .filter((item): item is { id: string; el: HTMLElement } => item !== null);

  if (!sections.length) return;

  let currentId = '';
  let rafId = 0;
  let lockedId = '';
  let lockTargetY = 0;
  let lockUntil = 0;
  let pinnedId = '';
  let pinnedScrollY = -1;

  const setActive = (id: string) => {
    if (!id || id === currentId) return;
    currentId = id;
    for (const link of tocLinks) {
      if (link.dataset.tocId === id) {
        link.setAttribute('aria-current', 'true');
        if (toc && toc.scrollWidth > toc.clientWidth) {
          const targetLeft =
            link.offsetLeft - toc.clientWidth / 2 + link.offsetWidth / 2;
          toc.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: 'smooth',
          });
        }
      } else {
        link.removeAttribute('aria-current');
      }
    }
    for (const link of mobileLinks) {
      if (link.dataset.tocId === id) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  };

  const scrollToSection = (id: string, pushHash: boolean) => {
    const target = sections.find((s) => s.id === id);
    if (!target) return;
    if (mobileToc?.open) mobileToc.open = false;

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const destY = scrollElementBelowStickyBars(
      target.el,
      reduced ? 'instant' : 'smooth',
    );

    lockedId = id;
    lockTargetY = destY;
    lockUntil = performance.now() + 1100;
    pinnedId = id;
    pinnedScrollY = destY;
    setActive(id);

    if (pushHash) {
      const next = new URL(window.location.href);
      next.hash = id;
      history.pushState(null, '', next);
    }
  };

  const updateOnScroll = () => {
    rafId = 0;
    const now = performance.now();
    if (lockedId && now < lockUntil) {
      if (Math.abs(window.scrollY - lockTargetY) <= 3) {
        lockedId = '';
      } else {
        setActive(lockedId);
        return;
      }
    } else if (lockedId) {
      lockedId = '';
    }

    if (pinnedId && Math.abs(window.scrollY - pinnedScrollY) <= 12) {
      setActive(pinnedId);
      return;
    }
    pinnedId = '';

    const threshold = getStickyReadingOffset() + 24;
    let active = sections[0].id;
    for (const section of sections) {
      if (section.el.getBoundingClientRect().top <= threshold) {
        active = section.id;
      }
    }
    if (
      window.scrollY > 40 &&
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 16
    ) {
      active = sections[sections.length - 1].id;
    }
    setActive(active);
  };

  const requestUpdate = () => {
    if (!rafId) rafId = window.requestAnimationFrame(updateOnScroll);
  };

  const clearProgrammaticLock = () => {
    lockedId = '';
    pinnedId = '';
  };

  for (const link of [...tocLinks, ...mobileLinks]) {
    link.addEventListener('click', (event) => {
      const id = link.dataset.tocId;
      if (!id) return;
      event.preventDefault();
      scrollToSection(id, true);
    });
  }

  window.addEventListener('wheel', clearProgrammaticLock, { passive: true });
  window.addEventListener('touchmove', clearProgrammaticLock, {
    passive: true,
  });
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('hashchange', () => {
    const hashId = safeDecodeHash();
    if (hashId && sections.some((s) => s.id === hashId)) {
      scrollToSection(hashId, false);
    } else {
      requestUpdate();
    }
  });

  const initialHash = safeDecodeHash();
  if (initialHash && sections.some((s) => s.id === initialHash)) {
    window.requestAnimationFrame(() => scrollToSection(initialHash, false));
  } else {
    updateOnScroll();
  }
}

normalizeLegacyReviewUrl();
initHintHeadings();
initRoutePickers();
initRouteExplorers();
initBgpPerspectives();
initReviewPanels();
initArticleToc();
