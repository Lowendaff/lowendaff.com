import type { ReviewPlace } from '../lib/review-map';
import type { createReviewGlobe } from './review-globe';

export function initReviewMap() {
  const root = document.querySelector<HTMLElement>('[data-review-map]');
  if (!root) return;
  const { places } = JSON.parse(
    root.querySelector('[data-map-data]')!.textContent!,
  ) as { places: ReviewPlace[] };
  let globe: Awaited<ReturnType<typeof createReviewGlobe>> | undefined;
  let loading = false;

  const url = new URL(window.location.href);
  let type = ['vps', 'dedicated'].includes(url.searchParams.get('type') ?? '')
    ? url.searchParams.get('type')!
    : 'all';
  let selected = places.some(
    (place) => place.id === url.searchParams.get('place'),
  )
    ? url.searchParams.get('place')!
    : '';
  let hovered = '';

  const mapPlaces = places.map((place) => ({
    ...place,
    count: place.articles.length,
  }));

  const title = root.querySelector<HTMLElement>('[data-map-title]')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-map-clear]');
  const resultStatus = root.querySelector<HTMLElement>(
    '[data-map-result-status]',
  )!;
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
  const regionButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-map-select]'),
  );

  function render(updateUrl = true) {
    const activePlace = places.find((place) => place.id === selected);
    const activeButton = regionButtons.find(
      (btn) => btn.dataset.mapSelect === selected,
    );

    title.textContent = activePlace
      ? `${activePlace.city} 测评文章`
      : '测评文章列表';
    if (clearBtn) clearBtn.hidden = !selected;

    root
      ?.querySelectorAll<HTMLButtonElement>('[data-map-type]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(type === button.dataset.mapType),
        ),
      );

    let visibleCount = 0;
    for (const section of root!.querySelectorAll<HTMLElement>(
      '[data-map-place]',
    )) {
      const id = section.dataset.mapPlace!;
      let totalForType = 0;
      for (const article of section.querySelectorAll<HTMLElement>(
        '[data-map-article]',
      )) {
        article.hidden = type !== 'all' && type !== article.dataset.reviewType;
        if (!article.hidden) totalForType++;
      }

      const btn = regionButtons.find((b) => b.dataset.mapSelect === id);
      if (btn) {
        btn.setAttribute('aria-pressed', String(selected === id));
        const countEl = btn.querySelector('[data-place-count]');
        if (countEl) countEl.textContent = `${totalForType} 篇`;
        btn.classList.toggle('is-dimmed', totalForType === 0);
      }

      section.hidden =
        totalForType === 0 || Boolean(selected && id !== selected);
      if (!section.hidden) visibleCount += totalForType;
    }

    const emptyEl = root!.querySelector<HTMLElement>('[data-map-empty]')!;
    emptyEl.hidden = visibleCount > 0;
    emptyEl.textContent = activePlace
      ? '该城市暂无此类型的测试记录。'
      : '暂无此类型的测试记录。';

    const countryText = activeButton?.dataset.countryLabel ?? '全部地区';
    resultStatus.textContent = `${activePlace ? `${countryText} · ${activePlace.city}` : '全部地区'} · ${visibleCount} 条测评`;

    globe?.setPlaces(mapPlaces, hovered || selected);

    if (updateUrl) {
      const next = new URL(location.href);
      type === 'all'
        ? next.searchParams.delete('type')
        : next.searchParams.set('type', type);
      selected
        ? next.searchParams.set('place', selected)
        : next.searchParams.delete('place');
      history.replaceState(null, '', next);
    }
  }

  function select(id: string, fromGlobe = false) {
    if (!fromGlobe && selected === id) {
      selected = '';
      globe?.setPaused(false);
      render();
      return;
    }
    selected = id;
    render();
    const place = mapPlaces.find((entry) => entry.id === id);
    if (place) {
      globe?.focus(place);
      globe?.setPaused(true);
    }
    if (articlesScroll) articlesScroll.scrollTop = 0;

    if (fromGlobe) {
      const btn = regionButtons.find((b) => b.dataset.mapSelect === id);
      btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (window.innerWidth <= 960) {
        articlesPanel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  clearBtn?.addEventListener('click', () => {
    selected = '';
    globe?.setPaused(false);
    render();
  });

  root
    .querySelectorAll<HTMLButtonElement>('[data-map-type]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        type = button.dataset.mapType!;
        render();
      }),
    );

  regionButtons.forEach((button) => {
    const id = button.dataset.mapSelect!;
    button.addEventListener('click', () => select(id, false));
    button.addEventListener('pointerenter', () => {
      hovered = id;
      const place = mapPlaces.find((entry) => entry.id === id);
      if (place && !selected) {
        globe?.focus(place);
      }
      globe?.setPlaces(mapPlaces, id);
    });
    button.addEventListener('pointerleave', () => {
      if (hovered === id) hovered = '';
      globe?.setPlaces(mapPlaces, selected);
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
      const { createReviewGlobe } = await import('./review-globe');
      globe = await createReviewGlobe(root!, mapPlaces, (id) =>
        select(id, true),
      );
      globe.setPaused(Boolean(selected));
      status.hidden = true;
      controls.hidden = false;
      render(false);
      const place = mapPlaces.find((entry) => entry.id === selected);
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
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) globe?.destroy();
  });

  render(false);
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
