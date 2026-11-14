async function verifyCarouselMotionPreference(page) {
  const report = [];
  const check = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const state = () =>
    page.locator('.product-viewport').evaluate((viewport) => {
      const frame = viewport.getBoundingClientRect();
      const cards = [...viewport.querySelectorAll('[data-product-brand]')];
      return {
        active: viewport.dataset.activeProduct,
        visible: cards
          .filter((card) => {
            const rect = card.getBoundingClientRect();
            return Math.abs(rect.left - frame.left) < 1;
          })
          .map((card) => card.dataset.productBrand),
        order: cards.map((card) => card.dataset.productBrand),
      };
    });
  const aligned = async (expected) => {
    const result = await state();
    check(result.active === expected, 'Active merchant stays in sync');
    check(
      result.visible.length === 1 && result.visible[0] === expected,
      'Visible merchant is preserved',
    );
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('http://127.0.0.1:4321/');
    const { order } = await state();
    await page.locator('[data-product-next]').click();
    await page.waitForTimeout(750);
    await aligned(order[1]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    await aligned(order[1]);
    await page.locator('.product-viewport').evaluate((viewport) => {
      viewport.scrollTo({
        left: viewport.clientWidth * 2,
        behavior: 'instant',
      });
    });
    await page.waitForTimeout(150);
    await aligned(order[2]);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(150);
    await aligned(order[2]);
    await page.locator('[data-product-next]').click();
    await page.waitForTimeout(750);
    await aligned(order[3]);
    // Interrupt the wrap transition; either nearest adjacent slide is valid.
    await page.locator('[data-product-next]').click();
    await page.waitForTimeout(180);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    const interrupted = await state();
    check(
      [order[3], order[0]].includes(interrupted.active),
      'Interrupted transition settles on a neighbor',
    );
    await aligned(interrupted.active);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(150);
    await aligned(interrupted.active);
    await page.locator('[data-product-prev]').click();
    await page.waitForTimeout(750);
    await aligned(
      order[
        (order.indexOf(interrupted.active) + order.length - 1) % order.length
      ],
    );
    report.push({
      width,
      preferenceRoundTrip: true,
      nativeScrollSync: true,
      interruptedWrap: true,
    });
  }
  return report;
}
