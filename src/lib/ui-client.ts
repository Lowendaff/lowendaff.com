/** Safely decode a URL hash fragment without throwing URIError on malformed percent sequences. */
export function safeDecodeHash(raw = window.location.hash): string {
  const trimmed = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return '';
  }
}

/** Check whether dark appearance is currently active (explicit user choice or system preference). */
export function isDarkActive(): boolean {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

type ThemeSubscriber = (dark: boolean) => void;
let themeSubscribers: Set<ThemeSubscriber> | undefined;

/** Subscribe to theme or system color-scheme changes using a single shared page observer. */
export function onThemeChange(
  callback: ThemeSubscriber,
  signal?: AbortSignal,
): () => void {
  if (!themeSubscribers) {
    themeSubscribers = new Set();
    const notify = () => {
      const dark = isDarkActive();
      themeSubscribers?.forEach((fn) => fn(dark));
    };
    new MutationObserver(notify).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-appearance'],
    });
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', notify);
  }
  themeSubscribers.add(callback);
  const unsubscribe = () => {
    themeSubscribers?.delete(callback);
  };
  signal?.addEventListener('abort', unsubscribe, { once: true });
  return unsubscribe;
}

/** Bind ArrowLeft / ArrowRight / Home / End roving keyboard navigation across a group of buttons. */
export function bindRovingTabs<T extends HTMLElement>(
  buttons: T[],
  onSelect: (index: number, button: T) => void,
  options?: {
    preventScroll?: boolean;
    twoItemToggle?: boolean;
    signal?: AbortSignal;
  },
) {
  if (!buttons.length) return;
  buttons.forEach((button, index) => {
    button.addEventListener(
      'keydown',
      (event) => {
        const len = buttons.length;
        let next = -1;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = len - 1;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          if (options?.twoItemToggle && len === 2) {
            next = 1 - index;
          } else {
            next = (index + (event.key === 'ArrowRight' ? 1 : -1) + len) % len;
          }
        }
        if (next < 0) return;
        event.preventDefault();
        onSelect(next, buttons[next]);
        buttons[next].focus(
          options?.preventScroll ? { preventScroll: true } : undefined,
        );
      },
      options?.signal ? { signal: options.signal } : undefined,
    );
  });
}

/** Fisher-Yates shuffle of direct element children while keeping DOM & tab order synchronized. */
export function shuffleChildren(container: HTMLElement) {
  const items = Array.from(container.children);
  if (items.length <= 1) return;
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  container.append(...items);
}
