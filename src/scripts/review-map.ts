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
  const mapPlaces = places.map((place) => ({
    ...place,
    count: place.articles.length,
  }));
  const filters = root.querySelector<HTMLElement>('[data-map-filters]')!;
  filters.hidden = false;
  const dialog = root.querySelector<HTMLDialogElement>('[data-map-dialog]')!;
  const title = root.querySelector<HTMLElement>('[data-map-title]')!;
  const openers = root.querySelectorAll<HTMLButtonElement>('[data-map-open]');
  let returnPlace = '';
  let returnFocus: HTMLElement | null = null;
  let previousOverflow = '';
  let scrollLocked = false;
  const status = root.querySelector<HTMLElement>('[data-globe-status]')!;
  const statusText = root.querySelector<HTMLElement>(
    '[data-globe-status-text]',
  )!;
  const retry = root.querySelector<HTMLButtonElement>('[data-globe-retry]')!;
  const controls = root.querySelector<HTMLElement>('[data-globe-controls]')!;
  function render(updateUrl = true) {
    const place = places.find((place) => place.id === selected);
    const citySection = [
      ...root!.querySelectorAll<HTMLElement>('[data-map-place]'),
    ].find((section) => section.dataset.mapPlace === selected);
    title.textContent = place ? citySection!.dataset.cityLabel! : '测评城市';
    dialog.classList.toggle('has-city', Boolean(place));
    root!
      .querySelectorAll<HTMLButtonElement>('[data-map-type]')
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
      const id = section.dataset.mapPlace;
      let count = 0;
      for (const article of section.querySelectorAll<HTMLElement>(
        '[data-map-article]',
      )) {
        article.hidden = type !== 'all' && type !== article.dataset.reviewType;
        if (!article.hidden) count++;
      }
      section.hidden = !count || Boolean(selected && id !== selected);
      if (!section.hidden) visibleCount += count;
      const countLabel = section.querySelector('[data-place-count]');
      if (countLabel) countLabel.textContent = `${count} 条`;
      section
        .querySelector('[data-map-select]')
        ?.setAttribute('aria-pressed', String(selected === id));
    }
    root!.querySelector<HTMLElement>('[data-map-empty]')!.hidden =
      visibleCount > 0;
    root!.querySelector('[data-map-empty]')!.textContent = place
      ? '这个城市暂无此类型的测试记录。'
      : '暂无此类型的测试记录。';
    const resultStatus = root!.querySelector<HTMLElement>(
      '[data-map-result-status]',
    )!;
    resultStatus.hidden = false;
    resultStatus.textContent = `${place ? citySection!.dataset.countryLabel : '全部地区'} · ${visibleCount} 条测评`;
    globe?.setPlaces(mapPlaces, selected);
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
  function open() {
    globe?.setPaused(true);
    if (!dialog.open) {
      if (!scrollLocked) {
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        scrollLocked = true;
      }
      dialog.showModal();
    }
    title.focus({ preventScroll: true });
    root!.querySelector('.atlas-dialog-body')!.scrollTop = 0;
  }
  function select(id: string) {
    if (!dialog.open) {
      returnPlace = id;
      returnFocus = null;
    }
    selected = id;
    type = 'all';
    render();
    const place = mapPlaces.find((entry) => entry.id === id);
    if (place) globe?.focus(place);
    open();
  }
  openers.forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      returnPlace = '';
      returnFocus = button;
      selected = '';
      render();
      open();
    });
  });
  root
    .querySelector('[data-map-close]')!
    .addEventListener('click', () => dialog.close());
  let backdropDown = false;
  const outside = (event: PointerEvent | MouseEvent) => {
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  };
  dialog.addEventListener('pointerdown', (event) => {
    backdropDown = event.target === dialog && outside(event);
  });
  dialog.addEventListener('click', (event) => {
    if (backdropDown && event.target === dialog && outside(event))
      dialog.close();
    backdropDown = false;
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    document.documentElement.style.overflow = previousOverflow;
    scrollLocked = false;
    selected = '';
    render();
    const marker = [
      ...root!.querySelectorAll<HTMLButtonElement>('[data-place-id]'),
    ].find((button) => button.dataset.placeId === returnPlace);
    (
      marker ??
      returnFocus ??
      root!.querySelector<HTMLElement>('[data-globe-viewport] canvas')
    )?.focus({ preventScroll: true });
    globe?.setPaused(false);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
    ].filter((element) => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === title)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  root
    .querySelectorAll<HTMLButtonElement>('[data-map-type]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        type = button.dataset.mapType!;
        render();
      }),
    );
  root
    .querySelectorAll<HTMLButtonElement>('[data-map-select]')
    .forEach((button) => {
      button.disabled = false;
      button.addEventListener('click', () => select(button.dataset.mapSelect!));
    });
  function unavailable() {
    globe = undefined;
    status.hidden = false;
    controls.hidden = true;
    statusText.textContent = '暂时无法显示 3D 地球，仍可浏览各城市测评。';
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
      globe = await createReviewGlobe(root!, mapPlaces, select);
      globe.setPaused(dialog.open);
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
  if (selected) open();
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
