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
    const box = await p.locator('.atlas-globe-stage').boundingBox();
    const centerX = box ? box.x + box.width / 2 : 526;
    const centerY = box ? box.y + box.height / 2 : 480;
    const blankX = box ? box.x + 18 : 168;
    const blankY = box ? box.y + 18 : 230;
    await p.mouse.move(5, 5);
    await verify('idle rotation', true);
    await p.mouse.move(centerX, centerY);
    await verify('sphere hover pauses', false);
    await p.mouse.move(blankX, blankY);
    await verify('blank map area resumes', true);
    await p.mouse.move(5, 5);
    await p.keyboard.press('Tab');
    await p.locator('canvas').focus();
    await verify('keyboard focus pauses', false);
    await p.mouse.move(5, 8);
    await verify('returning to mouse resumes', true);
    await p.mouse.move(centerX, centerY);
    await p.waitForTimeout(100);
    await p.locator('.atlas-marker').first().click();
    await p.waitForSelector('[data-map-clear]:not([hidden])');
    await p.mouse.move(5, 5);
    await p.waitForTimeout(2300);
    await verify('selected city resumes spin after focus hold', true);
    await p.locator('[data-map-clear]').click();
    await p.waitForSelector('[data-map-clear][hidden]', { state: 'attached' });
    await p.mouse.move(5, 8);
    await p.waitForTimeout(2300);
    await verify('clearing selection continues spin', true);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await verify('Windows reduced motion keeps ambient spin', true);
    if (results.some((result) => !result.passed)) {
      throw new Error(JSON.stringify(results));
    }
    return results;
  } finally {
    await browser.close();
  }
}
