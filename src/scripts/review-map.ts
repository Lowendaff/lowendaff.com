import {
  filterReviewPlaces,
  type FilteredReviewPlace,
  type MapReviewFilter,
  type ReviewPlace,
} from '../lib/review-map.ts';
import { isReviewType } from '../lib/review-types.ts';
import type { createReviewGlobe } from './review-globe';

export function initReviewMap(loadGlobe?: typeof createReviewGlobe) {
  const root = document.querySelector<HTMLElement>('[data-review-map]');
  if (!root) return;
  const { places } = JSON.parse(
    root.querySelector('[data-map-data]')!.textContent!,
  ) as { places: ReviewPlace[] };
  let globe: Awaited<ReturnType<typeof createReviewGlobe>> | undefined;
  let loading = false;

  let type: MapReviewFilter = 'all';
  let selected = '';
  let hovered = '';
  let filteredPlaces: FilteredReviewPlace[] = [];

  const parseType = (value: string | null): MapReviewFilter =>
    isReviewType(value) ? value : 'all';

  function restoreFromUrl() {
    const url = new URL(window.location.href);
    type = parseType(url.searchParams.get('type'));
    filteredPlaces = filterReviewPlaces(places, type);
    const requestedPlace = url.searchParams.get('place') ?? '';
    selected = filteredPlaces.some((place) => place.id === requestedPlace)
      ? requestedPlace
      : '';
    if (hovered && !filteredPlaces.some((place) => place.id === hovered)) {
      hovered = '';
    }
  }

  restoreFromUrl();

  const title = root.querySelector<HTMLElement>('[data-map-title]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-map-clear]');
  const resultStatus = root.querySelector<HTMLElement>(
    '[data-map-result-status]',
  )!;
  const placeCountEl = root.querySelector<HTMLElement>(
    '[data-map-place-count]',
  );
  const countryCountEl = root.querySelector<HTMLElement>(
    '[data-map-country-count]',
  );
  const articleCountEl = root.querySelector<HTMLElement>(
    '[data-map-article-count]',
  );
  const regionBadgeEl = root.querySelector<HTMLElement>(
    '[data-map-region-badge]',
  );
  const regionListEl = root.querySelector<HTMLElement>(
    '[data-map-region-list]',
  );
  const regionsEmptyEl = root.querySelector<HTMLElement>(
    '[data-map-regions-empty]',
  );
  const tagsLinkEl = root.querySelector<HTMLAnchorElement>(
    '[data-map-tags-link]',
  );
  const articlesFrame = root.querySelector<HTMLElement>(
    '[data-map-articles-frame]',
  );
  const articlesScroll = root.querySelector<HTMLElement>(
    '[data-map-articles-scroll]',
  );
  const articlesPanel = root.querySelector<HTMLElement>(
    '[data-map-articles-panel]',
  );
  const status = root.querySelector<HTMLElement>('[data-globe-status]')!;
  const statusText = root.querySelector<HTMLElement>(
    '[data-globe-status-text]',
  )!;
  const retry = root.querySelector<HTMLButtonElement>('[data-globe-retry]')!;
  const controls = root.querySelector<HTMLElement>('[data-globe-controls]')!;
  const typeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-map-type]'),
  );
  const regionButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-map-select]'),
  );
  const regionButtonById = new Map(
    regionButtons.map((btn) => [btn.dataset.mapSelect!, btn]),
  );
  const placeSections = Array.from(
    root.querySelectorAll<HTMLElement>('[data-map-place]'),
  );
  const sectionById = new Map(
    placeSections.map((sec) => [sec.dataset.mapPlace!, sec]),
  );

  function syncListOrder(orderedIds: string[]) {
    if (regionListEl && orderedIds.length > 1) {
      const currentOrder = Array.from(
        regionListEl.querySelectorAll<HTMLButtonElement>('[data-map-select]'),
      )
        .filter((btn) => !btn.hidden)
        .map((btn) => btn.dataset.mapSelect!);
      if (
        currentOrder.length === orderedIds.length &&
        currentOrder.some((id, idx) => id !== orderedIds[idx])
      ) {
        for (const id of orderedIds) {
          const btn = regionButtonById.get(id);
          if (btn) regionListEl.append(btn);
        }
      }
    }
    if (articlesScroll && orderedIds.length > 1) {
      const emptyNode = root!.querySelector<HTMLElement>('[data-map-empty]');
      const currentSections = Array.from(
        articlesScroll.querySelectorAll<HTMLElement>('[data-map-place]'),
      )
        .filter((sec) => orderedIds.includes(sec.dataset.mapPlace!))
        .map((sec) => sec.dataset.mapPlace!);
      if (
        currentSections.length === orderedIds.length &&
        currentSections.some((id, idx) => id !== orderedIds[idx])
      ) {
        for (const id of orderedIds) {
          const sec = sectionById.get(id);
          if (sec) {
            emptyNode
              ? articlesScroll.insertBefore(sec, emptyNode)
              : articlesScroll.append(sec);
          }
        }
      }
    }
  }

  function updateScrollEdges() {
    if (!articlesFrame || !articlesScroll) return;
    const { scrollTop, scrollHeight, clientHeight } = articlesScroll;
    articlesFrame.dataset.scrollUp = String(clientHeight > 0 && scrollTop > 2);
    articlesFrame.dataset.scrollDown = String(
      clientHeight > 0 && scrollHeight - clientHeight - scrollTop > 2,
    );
  }

  function render(updateUrl = true) {
    filteredPlaces = filterReviewPlaces(places, type);
    const filteredById = new Map(
      filteredPlaces.map((place) => [place.id, place]),
    );
    if (selected && !filteredById.has(selected)) {
      selected = '';
      globe?.setPaused(false);
    }
    if (hovered && !filteredById.has(hovered)) {
      hovered = '';
    }

    const activePlace = selected ? filteredById.get(selected) : undefined;
    const activeButton = selected ? regionButtonById.get(selected) : undefined;

    title.textContent = activePlace
      ? `${activePlace.city} 测评文章`
      : '测评文章列表';
    if (clearBtn) clearBtn.hidden = !activePlace;

    typeButtons.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(type === button.dataset.mapType),
      ),
    );

    const totalForFilter = filteredPlaces.reduce(
      (sum, place) => sum + place.count,
      0,
    );
    const countriesForFilter = new Set(
      filteredPlaces.map((place) => place.country).filter(Boolean),
    ).size;
    if (placeCountEl) placeCountEl.textContent = String(filteredPlaces.length);
    if (countryCountEl) countryCountEl.textContent = String(countriesForFilter);
    if (articleCountEl) articleCountEl.textContent = String(totalForFilter);
    if (regionBadgeEl)
      regionBadgeEl.textContent = String(filteredPlaces.length);
    if (regionListEl) regionListEl.hidden = filteredPlaces.length === 0;
    if (regionsEmptyEl) {
      regionsEmptyEl.hidden = filteredPlaces.length > 0;
      regionsEmptyEl.textContent =
        places.length > 0 ? '暂无此类型的已测评地区。' : '暂无已测评地区。';
    }

    let visibleCount = 0;
    for (const section of placeSections) {
      const id = section.dataset.mapPlace!;
      let totalForType = 0;
      for (const article of section.querySelectorAll<HTMLElement>(
        '[data-map-article]',
      )) {
        article.hidden = type !== 'all' && type !== article.dataset.reviewType;
        if (!article.hidden) totalForType++;
      }

      const btn = regionButtonById.get(id);
      if (btn) {
        btn.hidden = totalForType === 0;
        btn.disabled = totalForType === 0;
        btn.setAttribute(
          'aria-pressed',
          String(Boolean(activePlace && activePlace.id === id)),
        );
        const countEl = btn.querySelector('[data-place-count]');
        if (countEl) countEl.textContent = `${totalForType} 篇`;
      }

      section.hidden =
        totalForType === 0 || Boolean(activePlace && id !== activePlace.id);
      if (!section.hidden) visibleCount += totalForType;
    }

    syncListOrder(filteredPlaces.map((place) => place.id));

    const emptyEl = root!.querySelector<HTMLElement>('[data-map-empty]')!;
    emptyEl.hidden = visibleCount > 0;
    emptyEl.textContent =
      places.length === 0
        ? '暂无测试记录。'
        : activePlace
          ? '该城市暂无此类型的测试记录。'
          : '暂无此类型的测试记录。';

    const countryText = activeButton?.dataset.countryLabel ?? '全部地区';
    resultStatus.textContent = `${activePlace ? `${countryText} · ${activePlace.city}` : '全部地区'} · ${visibleCount} 条测评`;

    if (tagsLinkEl) {
      const tagsParams = new URLSearchParams();
      if (type !== 'all') tagsParams.set('type', type);
      if (activePlace?.country) tagsParams.set('country', activePlace.country);
      const qs = tagsParams.toString();
      tagsLinkEl.setAttribute('href', qs ? `/tags/?${qs}` : '/tags/');
    }

    globe?.setPlaces(filteredPlaces, hovered || selected);
    updateScrollEdges();

    if (updateUrl) {
      const next = new URL(location.href);
      type === 'all'
        ? next.searchParams.delete('type')
        : next.searchParams.set('type', type);
      selected
        ? next.searchParams.set('place', selected)
        : next.searchParams.delete('place');
      if (next.href !== location.href) {
        history.replaceState(null, '', next);
      }
    }
  }

  function select(id: string, fromGlobe = false) {
    if (!fromGlobe && selected === id) {
      selected = '';
      globe?.setPaused(false);
      render();
      return;
    }
    const place = filteredPlaces.find((entry) => entry.id === id);
    if (!place) return;
    selected = id;
    render();
    globe?.focus(place);
    globe?.setPaused(true);
    if (articlesScroll) articlesScroll.scrollTop = 0;

    if (fromGlobe) {
      const btn = regionButtonById.get(id);
      btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (window.innerWidth <= 960) {
        articlesPanel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  function chooseType(nextType: MapReviewFilter) {
    if (nextType === type) return;
    type = nextType;
    hovered = '';
    render();
    const activePlace = filteredPlaces.find((entry) => entry.id === selected);
    if (activePlace) {
      globe?.focus(activePlace);
    } else if (filteredPlaces.length > 0) {
      globe?.resetHome();
    }
    if (articlesScroll) articlesScroll.scrollTop = 0;
  }

  clearBtn?.addEventListener('click', () => {
    selected = '';
    globe?.setPaused(false);
    render();
  });

  typeButtons.forEach((button, index) => {
    button.addEventListener('click', () =>
      chooseType(parseType(button.dataset.mapType ?? null)),
    );
    button.addEventListener('keydown', (event) => {
      const target =
        event.key === 'ArrowRight'
          ? (index + 1) % typeButtons.length
          : event.key === 'ArrowLeft'
            ? (index - 1 + typeButtons.length) % typeButtons.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? typeButtons.length - 1
                : -1;
      if (target < 0) return;
      event.preventDefault();
      chooseType(parseType(typeButtons[target].dataset.mapType ?? null));
      typeButtons[target].focus({ preventScroll: true });
    });
  });

  regionButtons.forEach((button) => {
    const id = button.dataset.mapSelect!;
    button.addEventListener('click', () => select(id, false));
    button.addEventListener('pointerenter', () => {
      const place = filteredPlaces.find((entry) => entry.id === id);
      if (!place) return;
      hovered = id;
      if (!selected) {
        globe?.focus(place);
      }
      globe?.setPlaces(filteredPlaces, id);
    });
    button.addEventListener('pointerleave', () => {
      if (hovered === id) hovered = '';
      globe?.setPlaces(filteredPlaces, selected);
    });
  });

  function unavailable() {
    globe = undefined;
    status.hidden = false;
    controls.hidden = true;
    statusText.textContent = '暂时无法显示 3D 地球，仍可在右侧浏览各地区测评。';
    retry.hidden = false;
  }

  async function load() {
    if (loading || globe) return;
    loading = true;
    status.hidden = false;
    retry.hidden = true;
    statusText.textContent = '正在加载地球…';
    try {
      const createGlobe =
        loadGlobe ?? (await import('./review-globe')).createReviewGlobe;
      globe = await createGlobe(root!, filteredPlaces, (id) =>
        select(id, true),
      );
      globe.setPaused(Boolean(selected));
      status.hidden = true;
      controls.hidden = false;
      render(false);
      const place = filteredPlaces.find((entry) => entry.id === selected);
      if (place) globe.focus(place);
    } catch (error) {
      console.warn('Review globe unavailable', error);
      unavailable();
    } finally {
      loading = false;
    }
  }

  retry.addEventListener('click', load);
  root.addEventListener('globe-unavailable', unavailable);
  window.addEventListener('popstate', () => {
    restoreFromUrl();
    render(false);
    const activePlace = filteredPlaces.find((entry) => entry.id === selected);
    globe?.setPaused(Boolean(activePlace));
    if (activePlace) globe?.focus(activePlace);
    else if (filteredPlaces.length > 0) globe?.resetHome();
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) globe?.destroy();
  });

  if (articlesScroll) {
    articlesScroll.addEventListener('scroll', updateScrollEdges, {
      passive: true,
    });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(updateScrollEdges).observe(articlesScroll);
    }
  }

  render(true);
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        void load();
      }
    },
    { rootMargin: '150px' },
  );
  observer.observe(root.querySelector('[data-globe-scene]')!);
}
