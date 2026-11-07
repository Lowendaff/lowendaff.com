async function verifyCarouselControls(page) {
  const report = { layouts: [] };
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4321/');
    const brands = await page
      .locator('[data-product-brand]')
      .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand));
    await page.evaluate(() => {
      window.__adActivations = [];
      document.querySelectorAll('.product-card').forEach((card) =>
        card.addEventListener('click', (event) => {
          event.preventDefault();
          window.__adActivations.push(card.href);
        }),
      );
    });
    const expect = (brand) =>
      page.waitForFunction(
        (b) =>
          document.querySelector('.product-viewport').dataset.activeProduct ===
          b,
        brand,
      );
    const geometry = await page
      .locator('.product-carousel')
      .evaluate((carousel) => {
        const r = carousel.getBoundingClientRect();
        return [...carousel.querySelectorAll('button')].every((button) => {
          const b = button.getBoundingClientRect();
          return (
            b.width >= 44 &&
            b.height >= 44 &&
            b.left >= 0 &&
            b.right <= innerWidth &&
            Math.abs(b.top + b.height / 2 - r.top - r.height / 2) < 1 &&
            !button.closest('a')
          );
        });
      });
    check(geometry, 'Overlay buttons centered, within screen and independent');
    await page.locator('[data-product-prev]').click();
    await expect(brands[3]);
    await page.locator('[data-product-next]').click();
    await expect(brands[0]);
    await page.locator('[data-product-next]').click();
    await expect(brands[1]);
    await page.locator('[data-product-prev]').click();
    await expect(brands[0]);
    await page.locator('[data-product-prev]').focus();
    await page.keyboard.press('Enter');
    await expect(brands[3]);
    check(
      (await page.evaluate(() => window.__adActivations.length)) === 0,
      'Controls do not activate advertiser',
    );
    const active = page.locator('[data-product-brand]:not([inert])');
    const href = await active.getAttribute('href');
    await active.click();
    check(
      (await page.evaluate(() => window.__adActivations.length)) === 1,
      'Entire card activates advertiser link',
    );
    await page.locator('[data-product-next]').click();
    await expect(brands[0]);
    await page.mouse.move(0, 0);
    await page.waitForFunction(
      (b) =>
        document.querySelector('.product-viewport').dataset.activeProduct === b,
      brands[1],
      { timeout: 7500 },
    );
    check(
      JSON.stringify(brands) ===
        JSON.stringify(
          await page
            .locator('[data-product-brand]')
            .evaluateAll((cards) => cards.map((c) => c.dataset.productBrand)),
        ),
      'Controls preserve random order',
    );
    report.layouts.push({
      width,
      geometry,
      backwardWrap: true,
      forwardWrap: true,
      keyboard: true,
      adActivations: 1,
      href,
      autoResumesAfterPointer: true,
    });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(
    () => !document.querySelector('[data-carousel-clone]'),
  );
  await page.locator('[data-product-next]').click();
  await page.locator('[data-product-prev]').click();
  check(
    await page.locator('.product-carousel').evaluate((carousel) => {
      const r = carousel.getBoundingClientRect();
      return [...carousel.querySelectorAll('button')].every((b) => {
        const c = b.getBoundingClientRect();
        return (
          c.left >= 0 &&
          c.right <= innerWidth &&
          Math.abs(c.top + c.height / 2 - r.top - r.height / 2) < 1
        );
      });
    }),
    'Reduced-motion controls stay fixed while native content scrolls',
  );
  report.reducedMotionControls = true;
  return report;
}
