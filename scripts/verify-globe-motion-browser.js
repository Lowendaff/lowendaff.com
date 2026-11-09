async function verifyGlobeMotion(page) {
  const browser = await page
    .context()
    .browser()
    .browserType()
    .launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'no-preference',
  });
  const p = await context.newPage();
  const results = [];
  const sample = () => p.locator('[data-globe-coordinates]').textContent();
  async function verify(name, moving) {
    await p.waitForTimeout(200);
    const before = await sample();
    await p.waitForTimeout(1600);
    const after = await sample();
    results.push({
      name,
      before,
      after,
      passed: (before !== after) === moving,
    });
  }
  try {
    await p.goto('http://127.0.0.1:4321/map/');
    await p.waitForSelector('[data-globe-controls]:not([hidden])');
    await p.mouse.move(5, 5);
    await verify('idle rotation', true);
    await p.mouse.move(720, 480);
    await verify('sphere hover pauses', false);
    await p.mouse.move(180, 400);
    await verify('blank map area resumes', true);
    await p.mouse.move(5, 5);
    await p.keyboard.press('Tab');
    await p.locator('canvas').focus();
    await verify('keyboard focus pauses', false);
    await p.mouse.move(5, 8);
    await verify('returning to mouse resumes', true);
    await p.mouse.move(720, 480);
    await p.waitForTimeout(100);
    await p.locator('.atlas-marker').click();
    await p.waitForSelector('dialog[open]');
    await p.waitForTimeout(1000);
    await p.mouse.move(5, 5);
    await verify('review dialog pauses', false);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog').open);
    await p.mouse.move(5, 8);
    await verify('closing dialog resumes', true);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await verify('reduced motion pauses', false);
    if (results.some((result) => !result.passed)) {
      throw new Error(JSON.stringify(results));
    }
    return results;
  } finally {
    await browser.close();
  }
}
