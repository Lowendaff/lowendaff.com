async function verifyRoutes(page) {
  const report = { viewports: [], routes: [], errors: [] };
  const check = (value, message) => {
    if (!value) throw new Error(message);
  };
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/reviews/100tb-cn2/',
      '/reviews/panstarcloud-singapore/',
      '/components/',
    ]) {
      await page.goto('http://127.0.0.1:4321' + path);
      const result = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
        unlabeled: [...document.querySelectorAll('button')].filter(
          (b) => !b.textContent.trim() && !b.getAttribute('aria-label'),
        ).length,
      }));
      check(result.scroll === width, 'Page overflow ' + path + ' at ' + width);
      check(!result.unlabeled, 'Unlabeled button');
      report.viewports.push({ path, ...result });
    }
  }
  for (const slug of ['100tb-cn2', 'panstarcloud-singapore']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4321/reviews/' + slug + '/');
    for (const key of ['return-route', 'outbound-route']) {
      await page
        .locator(
          '[data-review-tab="' +
            (key === 'return-route' ? 'return' : 'outbound') +
            '"]',
        )
        .click();
      const root = page.locator('[data-route-explorer="' + key + '"]');
      const tabs = root.locator('[data-route-tab]');
      const count = await tabs.count();
      let options = 0;
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        check(
          (await tabs.nth(i).getAttribute('aria-selected')) === 'true',
          'Selected tab',
        );
        const select = root.locator('[data-route-picker="' + i + '"]');
        const n = await select.locator('[data-picker-option]').count();
        for (let j = 0; j < n; j++) {
          await select.locator('[data-picker-trigger]').click();
          await select.locator('[data-picker-option="' + j + '"]').click();
          check(
            (await root.locator('[data-route-record]:visible').count()) === 1,
            'One visible record',
          );
          check(
            (await root
              .locator('[data-route-record]:visible')
              .getAttribute('data-route-record')) === String(j),
            'Selected record',
          );
          options++;
        }
      }
      await tabs.nth(0).focus();
      await page.keyboard.press('End');
      check(
        (await tabs.last().getAttribute('aria-selected')) === 'true',
        'End key',
      );
      await page.keyboard.press('Home');
      check(
        (await tabs.first().getAttribute('aria-selected')) === 'true',
        'Home key',
      );
      await page.keyboard.press('ArrowRight');
      check(
        (await tabs.nth(1).getAttribute('aria-selected')) === 'true',
        'ArrowRight',
      );
      const selectedValue = await root
        .locator('[data-route-picker="1"]')
        .getAttribute('data-value');
      await page.reload();
      check(
        (await page
          .locator('[data-route-explorer="' + key + '"] [data-route-tab="1"]')
          .getAttribute('aria-selected')) === 'true',
        'URL tab persistence',
      );
      check(
        (await page
          .locator(
            '[data-route-explorer="' + key + '"] [data-route-picker="1"]',
          )
          .getAttribute('data-value')) === selectedValue,
        'URL target persistence',
      );
      report.routes.push({
        slug,
        key,
        groups: count,
        records: options,
        allTargetsPass: true,
        keyboard: true,
        urlReload: true,
        customPicker: true,
      });
    }
    await page.goto(
      'http://127.0.0.1:4321/reviews/' + slug + '/?return-route=0.5:999',
    );
    check(
      (await page
        .locator(
          '[data-route-explorer="return-route"] [data-route-record]:visible',
        )
        .count()) === 1,
      'Invalid URL fallback',
    );
  }
  const ctx = await page
    .context()
    .browser()
    .newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
  const plain = await ctx.newPage();
  await plain.goto('http://127.0.0.1:4321/reviews/100tb-cn2/');
  report.noJavaScript = {
    visibleRoutes: await plain.locator('[data-route-record]:visible').count(),
  };
  check(report.noJavaScript.visibleRoutes === 92, 'No-JS fallback');
  await ctx.close();
  check(
    report.errors.length === 0,
    'Browser errors ' + report.errors.join(';'),
  );
  return report;
}
