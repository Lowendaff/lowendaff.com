async function verifyPages(page) {
  const context = await page
    .context()
    .browser()
    .newContext({ reducedMotion: 'reduce' });
  const p = await context.newPage();
  const report = { pages: [], interactions: [], errors: [] };
  p.on('pageerror', (error) => report.errors.push(error.message));
  const basePaths = [
    '/',
    '/exotic/',
    '/map/',
    '/tags/',
    '/ads/',
    '/components/',
  ];
  await p.goto('http://127.0.0.1:4323/');
  const reviewPaths = await p.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('[data-article][href^="/reviews/"]')].map(
        (el) => el.getAttribute('href'),
      ),
    ),
  ]);
  const paths = [...basePaths, ...reviewPaths];
  const forbidden = [
    '产品信息来自历史赞助素材',
    '历史内容设计预览',
    '测试与价格均以原记录日期为准',
    '全文档案',
    '价格、优惠与网络表现以原记录为准',
    '历史图片资源未成功获取',
    '暂未恢复',
    '原文未提供',
    '原站广告说明',
    '原站规则',
    '原站条款',
    '原站采用',
    '来自历史记录',
    '规范化摘录',
    '原始 CLI 日志',
    '历史标价',
    '历史优惠码',
    '未核验',
    '静态状态示例',
    '获取失败示例',
    '主题预览',
  ];
  try {
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await p.emulateMedia({ colorScheme: theme });
        for (const path of paths) {
          await p.goto('http://127.0.0.1:4323' + path);
          await p.evaluate(() => document.fonts.ready);
          const result = await p.evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            text: document.body.innerText,
            hiddenPanels: [
              ...document.querySelectorAll(
                '[data-review-panel],[data-bgp-panel]',
              ),
            ]
              .map((e) => e.textContent)
              .join('\n'),
            tables: document.querySelectorAll(
              '.full-review [data-source-table]',
            ).length,
            homeAds: document.querySelectorAll('[data-product-brand]').length,
            ads: Object.fromEntries(
              [...document.querySelectorAll('[data-ad-slot]')].map((e) => [
                e.getAttribute('data-ad-slot'),
                e.querySelectorAll('[data-ad-brand]').length,
              ]),
            ),
            sponsors: document.querySelectorAll('.sponsor-mark').length,
            footerPreview:
              document.querySelector('.site-footer a[href="/components/"]') !==
              null,
            articleDate: document
              .querySelector('.review-introduction')
              ?.textContent.trim(),
          }));
          if (result.scrollWidth > width)
            throw new Error(`Overflow ${path} ${width}`);
          for (const copy of forbidden)
            if ((result.text + result.hiddenPanels).includes(copy))
              throw new Error(`Leftover copy ${path}: ${copy}`);
          if (result.footerPreview)
            throw new Error('Preview footer link remains');
          if (path === '/' && result.homeAds !== 4)
            throw new Error('Home advertisements changed');
          if (path.startsWith('/reviews/')) {
            if (
              result.tables < 1 ||
              result.ads['article-top'] !== 3 ||
              result.ads['article-bottom'] !== 4 ||
              result.ads.sidebar !== 6 ||
              result.sponsors !== 5 ||
              !result.articleDate?.startsWith('测试时间：')
            )
              throw new Error(`Content mismatch ${path}`);
          }
          delete result.text;
          delete result.hiddenPanels;
          report.pages.push({ path, theme, ...result });
        }
      }
    }
    await p.goto('http://127.0.0.1:4323/');
    const totalRows = await p.locator('[data-article]').count();
    const visibleRows = () => p.locator('[data-article]:visible').count();
    if ((await visibleRows()) !== Math.min(20, totalRows))
      throw new Error('First page count');
    if (totalRows > 20) {
      await p.locator('[data-page-next]').click();
      if ((await visibleRows()) !== Math.min(20, totalRows - 20))
        throw new Error('Second page count');
    }
    report.interactions.push(`pagination verified (${totalRows} total)`);
    await p.goto('http://127.0.0.1:4323/tags/');
    if (totalRows > 0) {
      await p.locator('[data-tag-tab="country"]').click();
      const country = p
        .locator('[data-tag-kind="country"]:not([data-tag-value=""])')
        .first();
      await country.click();
      if (
        (await country.getAttribute('aria-pressed')) !== 'true' ||
        (await visibleRows()) === 0
      )
        throw new Error('Country filter failed');
      await p.locator('[data-clear-tags]').click();
      if ((await visibleRows()) !== Math.min(20, totalRows))
        throw new Error('Clear filter failed');
      report.interactions.push('country filter and reset');
    }
    for (const path of paths.filter((path) => path.startsWith('/reviews/'))) {
      await p.goto('http://127.0.0.1:4323' + path);
      await p.locator('[data-review-tab="network"]').click();
      await p.locator('[data-bgp-tab="IPv6"]').click();
      if (
        !(await p.locator('[data-bgp-panel="IPv6"]').isVisible()) ||
        !(await p.locator('[data-bgp-panel="IPv6"]').innerText()).includes(
          '暂无 IPv6 BGP 图',
        )
      )
        throw new Error('Missing BGP state');
      report.interactions.push(`${path} BGP empty state and switching`);
    }
    if (report.errors.length) throw new Error(report.errors.join('; '));
    return report;
  } finally {
    await context.close();
  }
}
