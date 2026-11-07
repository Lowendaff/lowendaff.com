async function verifyReviewInteractions(page) {
  const check = (value, label) => {
    if (!value) throw new Error(label);
  };
  const report = { pages: [], hints: [], picker: {}, errors: [] };
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [slug, total] of [
    ['100tb-cn2', 105],
    ['panstarcloud-singapore', 106],
  ]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      'http://127.0.0.1:4321/reviews/' +
        slug +
        '/?view=all&return-route=0:1:all',
    );
    const text = await page.locator('.review-body').innerText();
    for (const label of [
      '赞助推广',
      '合作伙伴',
      '赞助内容 · 产品详情以商家页面为准',
      '分类查看完整测试数据',
      '按检测类别查找服务',
      '展开全部',
      '方案与优惠',
      'CLOUD & CONNECTIVITY',
    ])
      check(!text.includes(label), 'Removed copy ' + label);
    check(
      !new URL(page.url()).searchParams.has('view'),
      'Retire old view parameter',
    );
    check(
      !new URL(page.url()).searchParams.get('return-route').includes('all'),
      'Retire old route expansion',
    );
    check(
      (await page
        .locator('[data-expand-review],[data-route-expand],.inline-offer')
        .count()) === 0,
      'No expand controls or offer',
    );
    check(
      (await page.locator('[data-source-table]').count()) === total,
      'Retained static tables',
    );
    for (const group of ['hardware', 'unlock', 'speed', 'routing'])
      check(
        (await page
          .locator(
            '[data-review-panels="' + group + '"] [data-review-panel]:visible',
          )
          .count()) === 1,
        'One panel ' + group,
      );
    check(
      (await page
        .locator(
          '[data-route-explorer="return-route"] [data-route-record]:visible',
        )
        .count()) === 1,
      'One route from old URL',
    );
    for (const tab of ['cloudflare', 'apple', 'regional']) {
      await page.locator('[data-review-tab="' + tab + '"]').click();
      check(
        (await page
          .locator('[data-review-panels="speed"] .panel-source-title')
          .count()) === 0,
        'No repeated speed title',
      );
      check(
        (await page
          .locator('[data-review-panel="' + tab + '"]')
          .locator('table')
          .count()) > 0,
        'Retained speed data ' + tab,
      );
    }
    for (const id of ['speed-hint', 'routing-hint']) {
      const trigger = page.locator('[aria-describedby="' + id + '"]');
      const hint = page.locator('#' + id);
      await page.mouse.move(0, 0);
      await page.locator('.review-heading h1').click();
      check(!(await hint.isVisible()), 'Hint initially hidden');
      await trigger.hover();
      check(await hint.isVisible(), 'Hover hint');
      await hint.hover();
      check(await hint.isVisible(), 'Pointer can enter hint');
      await page.keyboard.press('Escape');
      check(!(await hint.isVisible()), 'Dismiss hint by Escape');
      await page.mouse.move(0, 0);
      await trigger.focus();
      check(await hint.isVisible(), 'Focus hint');
      await page.keyboard.press('Escape');
      check(!(await hint.isVisible()), 'Dismiss focused hint');
      await trigger.press('Tab');
      report.hints.push({
        slug,
        id,
        hover: true,
        hoverable: true,
        keyboard: true,
        escape: true,
      });
    }
    await page.goto('http://127.0.0.1:4321/reviews/' + slug + '/#offer');
    check(
      new URL(page.url()).hash === '#purchase',
      'Old offer anchor maps to purchase',
    );
    check(
      (await page.locator('.purchase-details a').first().count()) === 1,
      'Purchase source link retained',
    );
    report.pages.push({
      slug,
      tables: total,
      removedCopy: true,
      noExpansion: true,
      sourcePurchase: true,
    });
  }
  await page.goto('http://127.0.0.1:4321/reviews/100tb-cn2/');
  await page.setViewportSize({ width: 390, height: 844 });
  const picker = page.locator(
    '[data-route-explorer="return-route"] [data-route-picker="0"]',
  );
  const trigger = picker.locator('[data-picker-trigger]');
  const options = picker.locator('[data-picker-option]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  check(
    (await trigger.getAttribute('aria-expanded')) === 'true',
    'Keyboard opens list',
  );
  await page.keyboard.press('End');
  check(
    (await trigger.getAttribute('aria-activedescendant')) ===
      (await options.last().getAttribute('id')),
    'End active option',
  );
  await page.keyboard.press('Escape');
  check(
    (await picker.getAttribute('data-value')) === '0',
    'Escape cancels pending selection',
  );
  await trigger.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  check(
    (await picker.getAttribute('data-value')) ===
      String((await options.count()) - 1),
    'Enter commits choice',
  );
  check(
    (await trigger.getAttribute('aria-expanded')) === 'false',
    'Closes after commit',
  );
  check(
    await trigger.evaluate((e) => e === document.activeElement),
    'Focus remains on trigger',
  );
  await page.reload();
  check(
    (await picker.getAttribute('data-value')) ===
      String((await options.count()) - 1),
    'URL restores custom selection',
  );
  await trigger.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  check(
    (await picker.getAttribute('data-value')) === '0',
    'Tab commits pending choice',
  );
  await trigger.click();
  await page.locator('.chapter-heading h2').first().click();
  check(
    (await trigger.getAttribute('aria-expanded')) === 'false',
    'Outside click closes',
  );
  await page
    .locator('[data-route-explorer="return-route"] [data-route-tab="3"]')
    .click();
  const publicPicker = page.locator(
    '[data-route-explorer="return-route"] [data-route-picker="3"]',
  );
  const publicTrigger = publicPicker.locator('[data-picker-trigger]');
  await publicTrigger.focus();
  await page.keyboard.press('g');
  const active = await publicTrigger.getAttribute('aria-activedescendant');
  check(
    (await page.locator('#' + active).innerText())
      .toLowerCase()
      .startsWith('g'),
    'Typeahead',
  );
  await page.keyboard.press('Enter');
  report.picker = {
    keyboard: true,
    escapeCancel: true,
    enterCommit: true,
    tabCommit: true,
    typeahead: true,
    outsideClose: true,
    urlReload: true,
  };
  const touchContext = await page
    .context()
    .browser()
    .newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
  const touch = await touchContext.newPage();
  await touch.goto('http://127.0.0.1:4321/reviews/100tb-cn2/');
  const hintButton = touch.locator('[aria-describedby="speed-hint"]');
  await hintButton.tap();
  check(await touch.locator('#speed-hint').isVisible(), 'Touch hint opens');
  await hintButton.tap();
  check(!(await touch.locator('#speed-hint').isVisible()), 'Touch hint closes');
  const touchPicker = touch.locator(
    '[data-route-explorer="return-route"] [data-route-picker="0"]',
  );
  await touchPicker.locator('[data-picker-trigger]').tap();
  await touchPicker.locator('[data-picker-option="2"]').tap();
  check(
    (await touchPicker.getAttribute('data-value')) === '2',
    'Touch option selects',
  );
  report.picker.touch = true;
  await touchContext.close();
  check(
    report.errors.length === 0,
    'Browser exceptions ' + report.errors.join(';'),
  );
  return report;
}
