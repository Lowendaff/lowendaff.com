async function verifyCarouselLayout(page) {
  const base = 'http://127.0.0.1:4321/';
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const report = { layouts: [], orders: [], errors: [] };
  const onError = (error) => report.errors.push(error.message);
  page.on('pageerror', onError);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const theme of ['light', 'dark']) {
    await page.goto(base);
    await page.evaluate(
      (t) => localStorage.setItem('lowendaff-appearance', t),
      theme,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check((await page.goto(base)).status() === 200, 'Homepage HTTP');
      await page.locator('.product-viewport').hover();
      const result = await page
        .locator('.product-viewport')
        .evaluate((viewport) => {
          const r = viewport.getBoundingClientRect();
          const cards = [...viewport.querySelectorAll('[data-product-brand]')];
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            visible: cards.filter((c) => {
              const b = c.getBoundingClientRect();
              return b.left >= r.left - 1 && b.right <= r.right + 1;
            }).length,
            accessible: cards.filter((c) => !c.inert).length,
            buttons: viewport.closest('section').querySelectorAll('button')
              .length,
            noRedundantCTA: !viewport.querySelector(
              '.product-brand svg, .product-link',
            ),
            independentControls: [
              ...viewport.closest('section').querySelectorAll('button'),
            ].every((b) => !b.closest('a')),
            brands: cards.map((c) => c.dataset.productBrand),
            cloneHidden: viewport.querySelector('[data-carousel-clone]').inert,
            height: r.height,
            centeredControls: [
              ...viewport.closest('section').querySelectorAll('button'),
            ].every((button) => {
              const b = button.getBoundingClientRect();
              return (
                Math.abs(b.top + b.height / 2 - r.top - r.height / 2) < 1 &&
                b.left >= 0 &&
                b.right <= innerWidth
              );
            }),
          };
        });
      check(
        !result.overflow &&
          result.visible === 1 &&
          result.accessible === 1 &&
          result.buttons === 2 &&
          result.cloneHidden &&
          result.noRedundantCTA &&
          result.independentControls,
        `Single card layout ${width}: ${JSON.stringify(result)}`,
      );
      check(
        result.centeredControls,
        'Arrows vertically centered and inside screen',
      );
      if (width >= 1024)
        check(
          result.height >= 180 && result.height <= 200,
          'Compact desktop banner',
        );
      report.layouts.push({ theme, width, ...result });
    }
  }
  const order = await page
    .locator('[data-product-brand]')
    .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand));
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    JSON.stringify(order) ===
      JSON.stringify(
        await page
          .locator('[data-product-brand]')
          .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand)),
      ),
    'Resize preserves random order',
  );
  const browser = page.context().browser();
  for (const value of [0, 0.999999]) {
    const ctx = await browser.newContext();
    try {
      await ctx.addInitScript(`Math.random = () => ${value}`);
      const p = await ctx.newPage();
      await p.goto(base);
      const brands = await p
        .locator('[data-product-brand]')
        .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand));
      check(
        JSON.stringify([...brands].sort()) ===
          JSON.stringify(['DMIT', 'Evoxt', 'GoMami', 'ISIF Cloud']),
        'All sponsors retained',
      );
      report.orders.push(brands);
    } finally {
      await ctx.close();
    }
  }
  check(
    JSON.stringify(report.orders[0]) !== JSON.stringify(report.orders[1]),
    'Random input changes order',
  );
  for (const mode of ['no-js', 'reduced-motion']) {
    const ctx = await browser.newContext({
      javaScriptEnabled: mode !== 'no-js',
      reducedMotion: 'reduce',
      viewport: { width: 390, height: 844 },
    });
    try {
      const p = await ctx.newPage();
      await p.goto(base);
      check(
        (await p.locator('[data-carousel-ready]').count()) === 0 &&
          (await p.locator('[data-carousel-clone]').count()) === 0,
        'Static fallback ' + mode,
      );
      const cards = p.locator('[data-product-brand]');
      check((await cards.count()) === 4, 'Four fallback products');
      await cards.last().focus();
      check(
        await cards.last().evaluate((card) => {
          const c = card.getBoundingClientRect(),
            r = card.closest('.product-viewport').getBoundingClientRect();
          return !card.inert && c.left >= r.left - 1 && c.right <= r.right + 1;
        }),
        'Fallback last card reachable ' + mode,
      );
    } finally {
      await ctx.close();
    }
  }
  report.fallbacks = ['no-js', 'reduced-motion'];
  page.off('pageerror', onError);
  check(!report.errors.length, 'Browser exceptions');
  return report;
}
