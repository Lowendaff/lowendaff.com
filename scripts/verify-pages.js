async function verifyPages(page) {
  const context = await page
    .context()
    .browser()
    .newContext({ reducedMotion: 'reduce' });
  const p = await context.newPage();
  const report = { pages: [], interactions: [], errors: [] };
  p.on('pageerror', (error) => report.errors.push(error.message));
  const paths = [
    '/',
    '/reviews/100tb-cn2/',
    '/reviews/panstarcloud-singapore/',
    '/tags/',
    '/ads/',
    '/components/',
  ];
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
            const expected = path.includes('100tb') ? 105 : 106;
            if (
              result.tables !== expected ||
              result.ads['article-top'] !== 3 ||
              result.ads['article-bottom'] !== 4 ||
              result.ads.sidebar !== 7 ||
              result.sponsors !== 11 ||
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
    const visibleRows = () => p.locator('[data-article]:visible').count();
    if ((await visibleRows()) !== 20) throw new Error('First page count');
    await p.locator('[data-page-next]').click();
    if ((await visibleRows()) !== 20) throw new Error('Second page count');
    await p.locator('[data-page-next]').click();
    if ((await visibleRows()) !== 2) throw new Error('Third page count');
    report.interactions.push('pagination 20/20/2');
    await p.goto('http://127.0.0.1:4323/tags/');
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
    if ((await visibleRows()) !== 20) throw new Error('Clear filter failed');
    report.interactions.push('country filter and reset');
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
