import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as prettier from 'prettier';
import { renderBenchReport } from '../src/lib/bench-report-import.ts';
import { assertUniqueReviewUrls } from '../src/lib/review-url.ts';
import { postsDirectory, readPosts } from './review-url-files.mjs';

const usage = `用法:
  npm run review:import -- --report <report.json> --meta <editorial.json> --out <output.mdx> [选项]

选项:
  --report <path>        lowendaff-bench --format json 生成的报告文件（必填）
  --meta <path>          社论元数据 JSON 文件（可与命令行参数组合）
  --out <path>           输出 .mdx 路径（例如 src/content/posts/vendor-hk-vps.mdx）
  --assets-dir <path>    BGP SVG 等静态资源输出目录（默认 public/archive-assets/<slug>）
  --asset-slug <slug>    正文中 /archive-assets/<slug>/ 引用的目录名（默认取 --out 文件名）
  --type <vps|dedicated> 覆盖自动识别的测评类型
  --title <text>         覆盖文章标题
  --vendor <name>        商家名称
  --country <ISO2>       两位国家/地区代码（如 HK、US、JP）
  --location <text>      实际机房地区说明
  --city <name>          地球地图标记城市名
  --lat <number>         纬度（-90..90）
  --lon <number>         经度（-180..180）
  --published-at <date>  发布日期 YYYY-MM-DD
  --tested-at <text>     真实测试日期（如 '2026-11-25 18:06 CST'）
  --publish              直接将生成文稿设为 draft: false（默认保持 draft: true）
  --overwrite            允许覆盖已存在的输出文件
  --dry-run              仅校验并打印摘要，不写入磁盘
  --help                 显示帮助
`;

const { values } = parseArgs({
  options: {
    report: { type: 'string' },
    meta: { type: 'string' },
    out: { type: 'string' },
    'assets-dir': { type: 'string' },
    'asset-slug': { type: 'string' },
    type: { type: 'string' },
    title: { type: 'string' },
    vendor: { type: 'string' },
    country: { type: 'string' },
    location: { type: 'string' },
    city: { type: 'string' },
    lat: { type: 'string' },
    lon: { type: 'string' },
    'published-at': { type: 'string' },
    'tested-at': { type: 'string' },
    publish: { type: 'boolean', default: false },
    overwrite: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

if (!values.report || !values.out) {
  console.error('缺少必填参数 --report 或 --out。\n');
  console.error(usage);
  process.exit(1);
}

const root = process.cwd();
const reportPath = resolve(root, values.report);
const outPath = resolve(root, values.out);
const defaultSlug = basename(outPath, extname(outPath))
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '');
const assetSlug = values['asset-slug'] ?? defaultSlug;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assetSlug)) {
  throw new Error(
    `Invalid asset slug "${assetSlug}"; use lowercase letters, digits and hyphens`,
  );
}
const assetsDir = values['assets-dir']
  ? resolve(root, values['assets-dir'])
  : resolve(root, 'public/archive-assets', assetSlug);

const rawReport = JSON.parse(await readFile(reportPath, 'utf8'));
const fileMeta = values.meta
  ? JSON.parse(await readFile(resolve(root, values.meta), 'utf8'))
  : {};

const mergedMeta = {
  ...fileMeta,
  ...(values.type ? { reviewType: values.type } : {}),
  ...(values.title ? { title: values.title } : {}),
  ...(values.vendor ? { vendor: values.vendor } : {}),
  ...(values.country !== undefined ? { country: values.country } : {}),
  ...(values.location ? { location: values.location } : {}),
  ...(values['published-at'] ? { publishedAt: values['published-at'] } : {}),
  ...(values['tested-at'] ? { testedAt: values['tested-at'] } : {}),
  ...(values.publish ? { draft: false } : {}),
};

if (values.city || values.lat !== undefined || values.lon !== undefined) {
  mergedMeta.geo = {
    ...(fileMeta.geo ?? {}),
    ...(values.city ? { city: values.city } : {}),
    ...(values.lat !== undefined ? { latitude: Number(values.lat) } : {}),
    ...(values.lon !== undefined ? { longitude: Number(values.lon) } : {}),
  };
}

const rendered = renderBenchReport(rawReport, mergedMeta, { assetSlug });

// Check URL uniqueness against existing collection posts when targeting src/content/posts
const relOut = relative(root, outPath).replaceAll('\\', '/');
const existingPosts = await readPosts(root);
assertUniqueReviewUrls([
  ...existingPosts
    .filter((entry) => !(values.overwrite && entry.file === relOut))
    .map(({ id, data }) => ({ id, data })),
  {
    id: relOut.startsWith(`${postsDirectory}/`) ? relOut : values.out,
    data: { kind: 'review', permalink: rendered.permalink },
  },
]);

const prettierConfig = (await prettier.resolveConfig(outPath)) ?? {};
const formattedMdx = await prettier.format(rendered.mdx, {
  ...prettierConfig,
  filepath: outPath,
});

if (!values['dry-run']) {
  if (!values.overwrite) {
    const exists = await stat(outPath).then(
      () => true,
      (err) => {
        if (err.code === 'ENOENT') return false;
        throw err;
      },
    );
    if (exists) {
      throw new Error(
        `输出文件已存在：${relOut}（如需重新生成覆盖，请传入 --overwrite）`,
      );
    }
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, formattedMdx, 'utf8');

  if (rendered.assets.length > 0) {
    await mkdir(assetsDir, { recursive: true });
    for (const asset of rendered.assets) {
      await writeFile(
        resolve(assetsDir, asset.filename),
        asset.content,
        'utf8',
      );
    }
  }
}

console.log(
  JSON.stringify(
    {
      dryRun: Boolean(values['dry-run']),
      out: relOut,
      permalink: rendered.permalink,
      reviewType: rendered.reviewType,
      draft: Boolean(rendered.frontmatter.draft),
      benchVersion: rendered.frontmatter.benchVersion,
      omittedSections: rendered.omittedSections,
      assets: rendered.assets.map((a) => a.publicPath),
    },
    null,
    2,
  ),
);
