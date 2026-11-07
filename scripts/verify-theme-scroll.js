async function verifyThemeScroll(page) {
  const browser = page.context().browser();
  const report = { checks: [], errors: [] };
  const clickAt = async (p, selector, touch = false) => {
    const box = await p.locator(selector).boundingBox();
    if (!box) throw new Error(`Missing visible control: ${selector}`);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    if (touch) await p.touchscreen.tap(x, y);
    else await p.mouse.click(x, y);
  };
  const unchanged = async (p, before, label) => {
    const observed = await p.evaluate(async () => {
      const values = [];
      const start = performance.now();
      await new Promise((resolve) => {
        const sample = () => {
          values.push(scrollY);
          if (performance.now() - start >= 220) resolve();
          else requestAnimationFrame(sample);
        };
        sample();
      });
      return {
        values,
        height: document.documentElement.scrollHeight,
        focus: document.activeElement.id,
      };
    });
    const delta = Math.max(
      ...observed.values.map((y) => Math.abs(y - before.y)),
    );
    if (
      delta > 1 ||
      observed.height !== before.height ||
      observed.focus !== 'theme-toggle'
    )
      throw new Error(
        `${label}: scroll moved ${delta}px; before=${JSON.stringify(before)}, after=${JSON.stringify(observed)}`,
      );
    report.checks.push({
      label,
      scrollY: before.y,
      maxDeviation: delta,
      focusRestored: true,
    });
  };
  for (const width of [1440, 390]) {
    const touch = width === 390;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: touch,
      isMobile: touch,
      reducedMotion: 'no-preference',
      colorScheme: 'light',
    });
    try {
      const p = await context.newPage();
      p.on('pageerror', (e) => report.errors.push(e.message));
      for (const path of [
        '/',
        '/reviews/100tb-cn2/',
        '/reviews/panstarcloud-singapore/',
        '/tags/',
        '/ads/',
        '/components/',
      ]) {
        await p.goto('http://127.0.0.1:4321' + path);
        await p.evaluate(() => document.fonts.ready);
        for (const fraction of [0.5, 0.9]) {
          await p.evaluate(
            (f) =>
              scrollTo({
                top: (document.documentElement.scrollHeight - innerHeight) * f,
                behavior: 'instant',
              }),
            fraction,
          );
          for (const mode of ['dark', 'light', 'system']) {
            const before = await p.evaluate(() => ({
              y: scrollY,
              height: document.documentElement.scrollHeight,
            }));
            await clickAt(p, '#theme-toggle', touch);
            await clickAt(p, `[data-appearance-option="${mode}"]`, touch);
            await unchanged(p, before, `${width} ${path} ${fraction} ${mode}`);
            const applied = await p.evaluate(
              () => document.documentElement.dataset.appearance,
            );
            if (applied !== mode) throw new Error(`Theme not applied: ${mode}`);
          }
        }
      }
      await p.goto('http://127.0.0.1:4321/reviews/100tb-cn2/');
      await p.evaluate(() => scrollTo({ top: 1600, behavior: 'instant' }));
      for (const key of ['Escape', 'Enter']) {
        await clickAt(p, '#theme-toggle', touch);
        await p
          .locator('[data-appearance-option="dark"]')
          .evaluate((e) => e.focus({ preventScroll: true }));
        const before = await p.evaluate(() => ({
          y: scrollY,
          height: document.documentElement.scrollHeight,
        }));
        await p.keyboard.press(key);
        await unchanged(p, before, `${width} keyboard ${key}`);
      }
      // OS-driven and cross-tab changes must also retain the current reading position.
      await clickAt(p, '#theme-toggle', touch);
      await clickAt(p, '[data-appearance-option="system"]', touch);
      const before = await p.evaluate(() => ({
        y: scrollY,
        height: document.documentElement.scrollHeight,
      }));
      await p.emulateMedia({ colorScheme: 'dark' });
      await unchanged(p, before, `${width} system appearance change`);
      const sibling = await context.newPage();
      await sibling.goto('http://127.0.0.1:4321/');
      await sibling.evaluate(() =>
        localStorage.setItem('lowendaff-appearance', 'light'),
      );
      await p.bringToFront();
      await unchanged(p, before, `${width} cross-tab preference change`);
      if (
        (await p.evaluate(() => document.documentElement.dataset.theme)) !==
        'light'
      )
        throw new Error('Cross-tab theme did not apply');
    } finally {
      await context.close();
    }
  }
  if (report.errors.length) throw new Error(report.errors.join('; '));
  return report;
}
