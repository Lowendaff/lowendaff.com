import {
  isReviewType,
  reviewTypeLabels,
  type ReviewType,
} from '../lib/review-types';
import { bindRovingTabs } from '../lib/ui-client';
const root = document.querySelector<HTMLElement>('[data-record-list]');
if (root) {
  const PAGE_SIZE = 20;
  const filters = root.dataset.filters === 'true';
  const rows = [...root.querySelectorAll<HTMLElement>('[data-article]')];
  const chips = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-tag-kind]'),
  ];
  const allCountriesButtons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-country-all]'),
  ];
  const previous = root.querySelector<HTMLButtonElement>('[data-page-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-page-next]');
  const tabs = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-tag-tab]'),
  ];
  const typeButtons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-review-type]'),
  ];
  let reviewType: ReviewType | '' = '';
  let category = 'all';
  let merchant = '';
  let country = '';
  let page = 1;
  let cloudSignature = '';
  const valid = (kind: string, value: string) =>
    chips.some(
      (chip) =>
        chip.dataset.tagKind === kind && chip.dataset.tagValue === value,
    );
  const validCountry = (value: string) =>
    valid('country', value) ||
    Boolean(
      value &&
      document.querySelector(`[data-stamp-code="${CSS.escape(value)}"]`),
    );
  const restore = () => {
    const params = new URLSearchParams(location.search);
    const requestedType = params.get('type');
    reviewType = isReviewType(requestedType) ? requestedType : '';
    const byParam = params.get('by');
    category =
      byParam === 'country' || byParam === 'merchant' ? byParam : 'all';
    merchant =
      filters && valid('merchant', params.get('merchant') || '')
        ? params.get('merchant') || ''
        : '';
    country =
      filters && validCountry(params.get('country') || '')
        ? params.get('country') || ''
        : '';
    const requestedPage = Number(params.get('page') || 1);
    page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
  };
  const render = (mode: 'push' | 'replace') => {
    typeButtons.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.reviewType === reviewType),
      ),
    );
    const prevCategory = root.dataset.activeCategory;
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
    const matches: HTMLElement[] = [];
    let typeTotalCount = 0;
    let crossMerchantTotal = 0;
    let crossCountryTotal = 0;
    const typeByMerchant = new Map<string, number>();
    const typeByCountry = new Map<string, number>();
    const crossMerchantCount = new Map<string, number>();
    const crossCountryCount = new Map<string, number>();
    for (const row of rows) {
      if (reviewType && row.dataset.type !== reviewType) continue;
      typeTotalCount++;
      const rowMerchant = row.dataset.merchant;
      const rowRegion = row.dataset.region;
      if (rowMerchant !== undefined) {
        typeByMerchant.set(
          rowMerchant,
          (typeByMerchant.get(rowMerchant) ?? 0) + 1,
        );
      }
      if (rowRegion !== undefined) {
        typeByCountry.set(rowRegion, (typeByCountry.get(rowRegion) ?? 0) + 1);
      }
      const matchesMerchant = !merchant || rowMerchant === merchant;
      const matchesCountry = !country || rowRegion === country;
      if (matchesCountry) {
        crossMerchantTotal++;
        if (rowMerchant !== undefined) {
          crossMerchantCount.set(
            rowMerchant,
            (crossMerchantCount.get(rowMerchant) ?? 0) + 1,
          );
        }
      }
      if (matchesMerchant) {
        crossCountryTotal++;
        if (rowRegion !== undefined) {
          crossCountryCount.set(
            rowRegion,
            (crossCountryCount.get(rowRegion) ?? 0) + 1,
          );
        }
      }
      if (matchesMerchant && matchesCountry) {
        matches.push(row);
      }
    }
    if (resultLink) resultLink.textContent = `查看 ${matches.length} 条记录`;
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const visible = new Set(
      matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    );
    rows.forEach((row) => {
      row.hidden = !visible.has(row);
    });
    allCountriesButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(!country));
      const badge = button.querySelector('[data-country-all-count]');
      if (badge) badge.textContent = String(typeTotalCount);
    });
    let activeMerchantNodes = 0;
    let activeCountryNodes = 0;
    chips.forEach((chip) => {
      const kind = chip.dataset.tagKind;
      const value = chip.dataset.tagValue || '';
      const selected =
        value === (kind === 'merchant' ? merchant : country) && Boolean(value);
      chip.setAttribute('aria-pressed', String(selected));
      const typeMatches =
        (kind === 'merchant' ? typeByMerchant : typeByCountry).get(value) ?? 0;
      if (typeMatches > 0) {
        if (kind === 'merchant') activeMerchantNodes++;
        else activeCountryNodes++;
      }
      if (tabs.length) {
        chip.hidden =
          (category !== 'all' && kind !== category) ||
          (!selected && typeMatches === 0);
      } else {
        chip.hidden = !selected && typeMatches === 0;
      }
      const count = chip.querySelector('[data-tag-count]');
      if (count) {
        const filteredCount =
          kind === 'merchant'
            ? value
              ? (crossMerchantCount.get(value) ?? 0)
              : crossMerchantTotal
            : value
              ? (crossCountryCount.get(value) ?? 0)
              : crossCountryTotal;
        count.textContent = String(filteredCount);
      }
    });
    const tabCounts: Record<string, number> = {
      all: activeMerchantNodes + activeCountryNodes,
      merchant: activeMerchantNodes,
      country: activeCountryNodes,
    };
    document
      .querySelectorAll<HTMLElement>('[data-tag-tab-count]')
      .forEach((badge) => {
        const key = badge.dataset.tagTabCount ?? '';
        if (key in tabCounts) badge.textContent = String(tabCounts[key]);
      });
    const visibleChips = chips.filter((chip) => !chip.hidden);
    const cloudEmpty =
      document.querySelector<HTMLElement>('[data-cloud-empty]');
    if (cloudEmpty) cloudEmpty.hidden = visibleChips.length > 0;
    const nextSignature = visibleChips
      .map((chip) => `${chip.dataset.tagKind}:${chip.dataset.tagValue}`)
      .join('|');
    if (prevCategory !== category || cloudSignature !== nextSignature) {
      root.dataset.activeCategory = category;
      cloudSignature = nextSignature;
      window.dispatchEvent(new CustomEvent('tag-cloud-relayout'));
    }
    const feedCarousel = root.querySelector<HTMLElement>(
      '[data-feed-carousel]',
    );
    if (feedCarousel) feedCarousel.hidden = matches.length === 0;
    const count = root.querySelector('#result-count');
    if (count)
      count.textContent = `${matches.length} 条记录${pages > 1 ? ` · 每页 ${PAGE_SIZE} 条` : ''}`;
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
    if (reset) reset.disabled = !merchant && !country && !reviewType;
    const selection = document.querySelector('[data-selection-summary]');
    if (selection) {
      const countryChip = chips.find(
        (chip) =>
          chip.dataset.tagKind === 'country' &&
          chip.dataset.tagValue === country,
      );
      selection.textContent =
        [
          reviewType ? reviewTypeLabels[reviewType] : '',
          merchant,
          country ? countryChip?.dataset.tagLabel : '',
        ]
          .filter(Boolean)
          .join(' · ') || '全部记录';
    }
    const url = new URL(location.href);
    // Retired search parameters must not leave invisible filters behind.
    ['q', 'region', 'country', 'merchant', 'page', 'by', 'type'].forEach(
      (key) => url.searchParams.delete(key),
    );
    if (filters && (category === 'country' || category === 'merchant'))
      url.searchParams.set('by', category);
    if (merchant) url.searchParams.set('merchant', merchant);
    if (reviewType) url.searchParams.set('type', reviewType);
    if (country) url.searchParams.set('country', country);
    if (page > 1) url.searchParams.set('page', String(page));
    if (url.href !== location.href)
      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
    window.dispatchEvent(
      new CustomEvent('record-filter-change', {
        detail: { country, merchant, reviewType },
      }),
    );
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
  const selectType = (button: HTMLButtonElement) => {
    const value = button.dataset.reviewType ?? '';
    reviewType = isReviewType(value) ? value : '';
    page = 1;
    render('push');
  };
  typeButtons.forEach((button) => {
    button.addEventListener('click', () => selectType(button));
  });
  bindRovingTabs(typeButtons, (_, button) => selectType(button), {
    preventScroll: true,
  });
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab));
  });
  bindRovingTabs(tabs, (_, tab) => selectTab(tab));
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
  allCountriesButtons.forEach((button) =>
    button.addEventListener('click', () => {
      if (!country) return;
      country = '';
      page = 1;
      render('push');
    }),
  );
  window.addEventListener('set-record-country', (event) => {
    const nextCountry =
      (event as CustomEvent<{ country?: string }>).detail?.country || '';
    const resolved = filters && validCountry(nextCountry) ? nextCountry : '';
    if (country === resolved) return;
    country = resolved;
    page = 1;
    render('push');
  });
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-reset-filters], [data-clear-tags]',
    )
    .forEach((button) =>
      button.addEventListener('click', () => {
        merchant = country = '';
        reviewType = '';
        page = 1;
        render('push');
        typeButtons[0]?.focus({ preventScroll: true });
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
    .querySelector<HTMLElement>('[data-type-filter]')
    ?.removeAttribute('hidden');
  document
    .querySelector<HTMLElement>('[data-tag-filters]')
    ?.removeAttribute('hidden');
}
