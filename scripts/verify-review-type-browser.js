async function verifyReviewTypes(page) {
  const context = await page.context().browser().newContext({
    reducedMotion: 'reduce',
  });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (error) => errors.push(error.message));
  const base = 'http://127.0.0.1:4399';
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const visible = () => p.locator('[data-article]:visible').count();
  const choose = (type) => p.locator(`[data-review-type="${type}"]`).click();
  const visit = async (path) => {
    await p.goto(base + path);
    await p.locator('[data-type-filter]:visible').waitFor();
  };
  const layouts = [];
  try {
    const counts = await (
      await p.request.get(base + '/review-type-fixture.json')
    ).json();
    const total = counts.vps + counts.dedicated;
    await visit('/');
    assert((await visible()) === 20, 'All page 1: 20 records');
    await p.locator('[data-page-next]').click();
    assert((await visible()) === Math.min(20, total - 20), 'All page 2');
    await choose('vps');
    assert((await visible()) === 20, 'Changing type resets pagination');
    assert(!new URL(p.url()).searchParams.has('page'), 'Page reset URL');
    await p.locator('[data-page-next]').click();
    assert((await visible()) === Math.min(20, counts.vps - 20), 'VPS page 2');
    await choose('dedicated');
    assert(
      (await visible()) === Math.min(20, counts.dedicated),
      'Dedicated records',
    );
    assert(
      (await p.locator('.record-pagination').isVisible()) ===
        counts.dedicated > 20,
      'Dedicated pagination',
    );
    await p.goBack();
    assert(
      (await visible()) === Math.min(20, counts.vps - 20),
      'History restores VPS page 2',
    );
    await p.goForward();
    assert(
      (await visible()) === Math.min(20, counts.dedicated),
      'History restores dedicated',
    );
    await p.reload();
    await p.locator('[data-type-filter]:visible').waitFor();
    assert(
      (await visible()) === Math.min(20, counts.dedicated),
      'Reload restores type',
    );
    await visit('/?type=invalid&page=999');
    assert(!new URL(p.url()).searchParams.has('type'), 'Invalid type removed');
    assert((await visible()) === ((total - 1) % 20) + 1, 'Page clamped');
    await p.locator('[data-review-type=""]').focus();
    await p.keyboard.press('End');
    assert(
      (await visible()) === Math.min(20, counts.dedicated),
      'End selects dedicated',
    );
    await p.keyboard.press('ArrowLeft');
    assert((await visible()) === 20, 'ArrowLeft selects VPS');

    await visit('/tags/?type=dedicated&merchant=Fixture%20Beta&country=US');
    assert((await visible()) === 1, 'Type/merchant/country intersection');
    assert(
      (await p
        .locator(
          '[data-tag-kind="merchant"][data-tag-value="Fixture Beta"] [data-tag-count]',
        )
        .textContent()) === '1',
      'Merchant count reflects type and country',
    );
    await p.locator('[data-tag-tab="country"]').click();
    assert(
      (await p
        .locator(
          '[data-tag-kind="country"][data-tag-value="JP"] [data-tag-count]',
        )
        .textContent()) === '1',
      'Country count reflects type and merchant',
    );
    await choose('vps');
    assert((await visible()) === 0, 'Empty intersection');
    assert(await p.locator('#empty-results').isVisible(), 'Empty state');
    await p.locator('[data-clear-tags]').click();
    assert((await visible()) === 20, 'Clear all filters');
    assert(await p.locator('[data-clear-tags]').isDisabled(), 'Clear disabled');

    for (const type of ['vps', 'dedicated']) {
      await p.goto(`${base}/reviews/type-verification-${type}-1-20261108/`);
      assert(
        await p.locator(`[data-review-kind="${type}"]`).isVisible(),
        'Header label',
      );
      assert(
        (await p.locator(`a[href="/?type=${type}#reviews"]`).count()) === 2,
        'Return links preserve type',
      );
    }
    for (const width of [320, 390, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await p.emulateMedia({ colorScheme: theme });
        for (const path of [
          '/',
          '/tags/',
          '/reviews/type-verification-dedicated-1-20261108/',
        ]) {
          await p.goto(base + path);
          await p.evaluate(() => document.fonts.ready);
          const metrics = await p.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            targets: [...document.querySelectorAll('[data-review-type]')].map(
              (button) => button.getBoundingClientRect().height,
            ),
          }));
          assert(!metrics.overflow, `Overflow ${width} ${theme} ${path}`);
          assert(
            metrics.targets.every((height) => height >= 44),
            'Touch target',
          );
          layouts.push({ width, theme, path, ...metrics });
          if (path === '/' && width !== 320) {
            await p.locator('#reviews').scrollIntoViewIfNeeded();
            await p.screenshot({
              path: `test-results/review-types/home-${width}-${theme}.png`,
            });
          }
        }
      }
    }
    const noJS = await page
      .context()
      .browser()
      .newContext({ javaScriptEnabled: false });
    try {
      const fallback = await noJS.newPage();
      await fallback.goto(base);
      assert(
        (await fallback.locator('[data-article]:visible').count()) === total,
        'No JS shows all records',
      );
      assert(
        !(await fallback.locator('[data-type-filter]').isVisible()),
        'No JS hides inactive filter',
      );
    } finally {
      await noJS.close();
    }
    assert(!errors.length, `Browser errors: ${errors.join(', ')}`);
    return {
      passed: true,
      interactions:
        'pagination, type, combined filters, URL/history, keyboard, empty state, no-JS, header labels',
      layouts,
      errors,
    };
  } finally {
    await context.close();
  }
}
