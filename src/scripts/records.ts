export {};
const root = document.querySelector<HTMLElement>('[data-record-list]');
if (root) {
  const PAGE_SIZE = 20;
  const filters = root.dataset.filters === 'true';
  const rows = [...root.querySelectorAll<HTMLElement>('[data-article]')];
  const chips = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-tag-kind]'),
  ];
  const previous = root.querySelector<HTMLButtonElement>('[data-page-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-page-next]');
  const tabs = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-tag-tab]'),
  ];
  let category = 'merchant';
  let merchant = '';
  let country = '';
  let page = 1;
  const valid = (kind: string, value: string) =>
    chips.some(
      (chip) =>
        chip.dataset.tagKind === kind && chip.dataset.tagValue === value,
    );
  const restore = () => {
    const params = new URLSearchParams(location.search);
    category = params.get('by') === 'country' ? 'country' : 'merchant';
    merchant =
      filters && valid('merchant', params.get('merchant') || '')
        ? params.get('merchant') || ''
        : '';
    country =
      filters && valid('country', params.get('country') || '')
        ? params.get('country') || ''
        : '';
    const requestedPage = Number(params.get('page') || 1);
    page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
  };
  const render = (mode: 'push' | 'replace') => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tagTab === category;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document
      .querySelectorAll<HTMLElement>('[data-tag-panel]')
      .forEach((panel) => {
        panel.hidden = panel.dataset.tagPanel !== category;
      });
    const resultLink = document.querySelector('[data-tag-results]');
    const matches = rows.filter(
      (row) =>
        (!merchant || row.dataset.merchant === merchant) &&
        (!country || row.dataset.region === country),
    );
    if (resultLink) resultLink.textContent = `查看 ${matches.length} 条记录 ↓`;
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const visible = new Set(
      matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    );
    rows.forEach((row) => {
      row.hidden = !visible.has(row);
    });
    chips.forEach((chip) => {
      const selected =
        chip.dataset.tagValue ===
        (chip.dataset.tagKind === 'merchant' ? merchant : country);
      chip.setAttribute('aria-pressed', String(selected));
    });
    const count = root.querySelector('#result-count');
    if (count)
      count.textContent = `${matches.length} 条记录 · 每页 ${PAGE_SIZE} 条`;
    const empty = root.querySelector<HTMLElement>('#empty-results');
    if (empty) empty.hidden = matches.length > 0;
    const pagination = root.querySelector<HTMLElement>('.record-pagination');
    if (pagination) pagination.hidden = pages <= 1;
    if (previous) previous.disabled = page === 1;
    if (next) next.disabled = page === pages;
    const status = root.querySelector('[data-page-status]');
    if (status) status.textContent = `${page} / ${pages}`;
    const reset =
      document.querySelector<HTMLButtonElement>('[data-clear-tags]');
    if (reset) reset.disabled = !merchant && !country;
    const selection = document.querySelector('[data-selection-summary]');
    if (selection) {
      const countryChip = chips.find(
        (chip) =>
          chip.dataset.tagKind === 'country' &&
          chip.dataset.tagValue === country,
      );
      selection.textContent =
        [merchant, country ? countryChip?.dataset.tagLabel : '']
          .filter(Boolean)
          .join(' · ') || '全部记录';
    }
    const url = new URL(location.href);
    // Retired search parameters must not leave invisible filters behind.
    ['q', 'region', 'country', 'merchant', 'page', 'by'].forEach((key) =>
      url.searchParams.delete(key),
    );
    if (filters && category === 'country') url.searchParams.set('by', category);
    if (merchant) url.searchParams.set('merchant', merchant);
    if (country) url.searchParams.set('country', country);
    if (page > 1) url.searchParams.set('page', String(page));
    if (url.href !== location.href)
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
  };
  const focusRecords = () => {
    const title = root.querySelector<HTMLElement>('#reviews-title');
    title?.focus({ preventScroll: true });
    root.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const selectTab = (tab: HTMLButtonElement) => {
    category = tab.dataset.tagTab || 'merchant';
    render('push');
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const target =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
              tabs.length;
      selectTab(tabs[target]);
      tabs[target].focus();
    });
  });
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const value = chip.dataset.tagValue || '';
      if (chip.dataset.tagKind === 'merchant')
        merchant = merchant === value ? '' : value;
      else country = country === value ? '' : value;
      page = 1;
      render('push');
    }),
  );
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-reset-filters], [data-clear-tags]',
    )
    .forEach((button) =>
      button.addEventListener('click', () => {
        merchant = country = '';
        page = 1;
        render('push');
        document
          .querySelector<HTMLButtonElement>(`[data-tag-kind="${category}"]`)
          ?.focus();
      }),
    );
  previous?.addEventListener('click', () => {
    page--;
    render('push');
    focusRecords();
  });
  next?.addEventListener('click', () => {
    page++;
    render('push');
    focusRecords();
  });
  window.addEventListener('popstate', () => {
    restore();
    render('replace');
  });
  restore();
  render('replace');
  document
    .querySelector<HTMLElement>('[data-tag-filters]')
    ?.removeAttribute('hidden');
}
