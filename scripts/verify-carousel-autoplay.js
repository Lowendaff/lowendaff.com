async function verifyCarouselAutoplay(page) {
  const report = { loops: [] };
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4321/');
    await page.mouse.move(0, 0);
    await page.locator('.product-viewport').scrollIntoViewIfNeeded();
    const order = await page
      .locator('[data-product-brand]')
      .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand));
    await page.evaluate(() => {
      window.__carouselTrace = { running: true, samples: [], timing: null };
      const track = document.querySelector('.product-grid');
      const sample = () => {
        const trace = window.__carouselTrace;
        trace.samples.push(
          new DOMMatrixReadOnly(getComputedStyle(track).transform).m41,
        );
        const animation = track.getAnimations()[0];
        if (animation) trace.timing = animation.effect.getTiming();
        if (trace.running) requestAnimationFrame(sample);
      };
      sample();
    });
    const visited = [order[0]];
    for (const brand of [...order.slice(1), order[0]]) {
      await page.waitForFunction(
        (expected) =>
          document.querySelector('.product-viewport').dataset.activeProduct ===
          expected,
        brand,
        { timeout: 7500 },
      );
      visited.push(brand);
    }
    const trace = await page.evaluate(() => {
      const trace = window.__carouselTrace;
      trace.running = false;
      const width = document.querySelector('.product-viewport').clientWidth;
      const positive = trace.samples
        .slice(1)
        .map((x, i) => ({
          from: trace.samples[i],
          to: x,
          delta: x - trace.samples[i],
        }))
        .filter((s) => s.delta > 1);
      return {
        samples: trace.samples.length,
        width,
        resets: positive,
        minX: Math.min(...trace.samples),
        timing: trace.timing,
      };
    });
    check(
      trace.resets.length === 1 &&
        trace.resets[0].from < -3.8 * trace.width &&
        Math.abs(trace.resets[0].to) < 1,
      'Only invisible end-to-start reset; no reverse travel',
    );
    check(
      trace.minX < -3.8 * trace.width,
      'Last card advances toward first-card clone',
    );
    check(
      trace.timing.duration === 650 && trace.timing.easing.includes('0.22'),
      'Natural easing and duration',
    );
    report.loops.push({ width, visited, ...trace });
  }
  await page.locator('.product-viewport').hover();
  const current = await page
    .locator('.product-viewport')
    .getAttribute('data-active-product');
  await page.waitForTimeout(5500);
  check(
    (await page
      .locator('.product-viewport')
      .getAttribute('data-active-product')) === current,
    'Hover pause',
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    (brand) =>
      document.querySelector('.product-viewport').dataset.activeProduct !==
      brand,
    current,
    { timeout: 7500 },
  );
  report.hoverPauseResume = true;
  await page.locator('.product-viewport').focus();
  const focused = await page
    .locator('.product-viewport')
    .getAttribute('data-active-product');
  await page.waitForTimeout(5500);
  check(
    (await page
      .locator('.product-viewport')
      .getAttribute('data-active-product')) === focused,
    'Focus pause',
  );
  report.focusPause = true;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(
    () => !document.querySelector('[data-carousel-clone]'),
  );
  check(
    (await page.locator('[data-carousel-clone]').count()) === 0,
    'Motion preference removes animation duplicate',
  );
  check(
    (await page.locator('[data-product-brand][inert]').count()) === 0,
    'All original links accessible in reduced mode',
  );
  report.liveReducedMotion = true;
  return report;
}
