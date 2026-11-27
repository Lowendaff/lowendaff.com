import { shuffleChildren } from '../lib/ui-client';

// 1. Activate deferred non-blocking font stylesheets.
document
  .querySelectorAll<HTMLLinkElement>('link[data-deferred-fonts]')
  .forEach((link) => {
    link.media = 'all';
  });

// 2. Shuffle independent commercial & sponsor containers once on load.
document
  .querySelectorAll<HTMLElement>(
    '[data-ad-stack], [data-home-ads], [data-sponsor-grid]',
  )
  .forEach((container) => shuffleChildren(container));

// 3. Theme switcher & mobile navigation menus (mutually exclusive popovers).
const picker = document.querySelector<HTMLDetailsElement>('.theme-picker');
const mobileNav = document.querySelector<HTMLDetailsElement>('.mobile-nav');
const pickerSummary = picker?.querySelector('summary');
const pickerButtons = picker?.querySelectorAll<HTMLButtonElement>(
  '[data-appearance-option]',
);
const rootEl = document.documentElement;
const appearanceKey = 'lowendaff-appearance';

const normalizeAppearance = (value: string | null | undefined) =>
  value === 'light' || value === 'dark' ? value : 'system';

const applyAppearance = (value: string | null | undefined) => {
  const appearance = normalizeAppearance(value);
  rootEl.dataset.appearance = appearance;
  if (appearance === 'system') delete rootEl.dataset.theme;
  else rootEl.dataset.theme = appearance;

  document
    .querySelectorAll<HTMLMetaElement>('[data-theme-color]')
    .forEach((meta) => {
      const mode =
        appearance === 'system' ? meta.dataset.themeColor : appearance;
      meta.content = mode === 'dark' ? '#191919' : '#f6f5f4';
    });

  const label = { system: '跟随系统', light: '浅色', dark: '深色' }[appearance];
  pickerSummary?.setAttribute('aria-label', `外观：${label}`);
  pickerSummary?.setAttribute('title', `外观：${label}`);
  pickerButtons?.forEach((button) =>
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.appearanceOption === appearance),
    ),
  );
};

if (picker) {
  applyAppearance(rootEl.dataset.appearance);
  picker.hidden = false;
  pickerButtons?.forEach((button) =>
    button.addEventListener('click', () => {
      const appearance = normalizeAppearance(button.dataset.appearanceOption);
      applyAppearance(appearance);
      try {
        if (appearance === 'system') localStorage.removeItem(appearanceKey);
        else localStorage.setItem(appearanceKey, appearance);
      } catch {
        /* Current-page switching still works when storage is unavailable. */
      }
      picker.open = false;
      // Restore keyboard focus without moving the current reading position.
      pickerSummary?.focus({ preventScroll: true });
    }),
  );
  window.addEventListener('storage', (event) => {
    if (event.key === appearanceKey || event.key === null)
      applyAppearance(event.newValue);
  });
  picker.addEventListener('focusout', (event) => {
    if (
      event.relatedTarget instanceof Node &&
      !picker.contains(event.relatedTarget)
    )
      picker.open = false;
  });
  picker.addEventListener('toggle', () => {
    if (picker.open && mobileNav) mobileNav.open = false;
  });
}

if (mobileNav) {
  mobileNav.addEventListener('toggle', () => {
    if (mobileNav.open && picker) picker.open = false;
    mobileNav
      .querySelector('summary')
      ?.setAttribute('aria-label', mobileNav.open ? '关闭导航' : '打开导航');
  });
  mobileNav.addEventListener('focusout', (event) => {
    if (
      event.relatedTarget instanceof Node &&
      !mobileNav.contains(event.relatedTarget)
    )
      mobileNav.open = false;
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (picker?.open) {
    picker.open = false;
    pickerSummary?.focus({ preventScroll: true });
  }
  if (mobileNav?.open) {
    mobileNav.open = false;
    mobileNav.querySelector('summary')?.focus({ preventScroll: true });
  }
});

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node)) return;
  if (picker?.open && !picker.contains(event.target)) picker.open = false;
  if (mobileNav?.open && !mobileNav.contains(event.target))
    mobileNav.open = false;
});

// 4. Delegated clipboard copy buttons.
const copyTimers = new WeakMap<HTMLButtonElement, number>();
document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('[data-copy]');
  if (!button) return;
  const status =
    button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
  const prevTimer = copyTimers.get(button);
  if (prevTimer) window.clearTimeout(prevTimer);
  try {
    await navigator.clipboard.writeText(button.dataset.copy || '');
    if (status) {
      status.textContent = '已复制';
      copyTimers.set(
        button,
        window.setTimeout(() => {
          status.textContent = '';
        }, 2200),
      );
    }
  } catch {
    if (status) status.textContent = '复制失败，请选中文字手动复制';
  }
});

// 5. Progressive Web Share API enhancement.
if (typeof navigator.share === 'function') {
  document
    .querySelectorAll<HTMLButtonElement>('[data-native-share]')
    .forEach((button) => {
      button.hidden = false;
      button.addEventListener('click', async () => {
        try {
          await navigator.share({
            title: button.dataset.shareTitle || document.title,
            text: button.dataset.shareText || '',
            url: button.dataset.shareUrl || window.location.href,
          });
        } catch {
          // User dismissed native share sheet.
        }
      });
    });
}
