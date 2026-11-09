import type { AnalyticsProvider } from '../lib/analytics';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/** Native page navigation creates a fresh document; no extra SPA page_view is sent. */
export function initializeAnalytics() {
  const element = document.getElementById('site-analytics-config');
  if (!element || element.dataset.initialized === 'true') return;
  const config: { allowedHosts: string[]; providers: AnalyticsProvider[] } =
    JSON.parse(element.textContent || '{}');
  if (!config.allowedHosts.includes(location.hostname)) return;
  element.dataset.initialized = 'true';

  const append = (
    name: string,
    src: string,
    attributes: Record<string, string> = {},
  ) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    for (const [key, value] of Object.entries(attributes))
      script.setAttribute(key, value);
    script.dataset.analyticsProvider = name;
    document.head.append(script);
  };
  const google = config.providers.filter((provider) => provider.type === 'ga4');
  if (google.length) {
    const target = window as AnalyticsWindow;
    target.dataLayer = target.dataLayer || [];
    target.gtag =
      target.gtag ||
      function (..._args: unknown[]) {
        target.dataLayer!.push(arguments);
      };
    target.gtag('js', new Date());
    for (const provider of google)
      target.gtag('config', provider.measurementId);
    append(
      google[0].name,
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(google[0].measurementId)}`,
    );
  }
  for (const provider of config.providers) {
    if (provider.type === 'script')
      append(provider.name, provider.src, provider.attributes);
  }
}
