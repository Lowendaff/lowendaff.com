import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';
import { siteIndexable } from '../lib/site';
import { siteIdentity } from '../lib/seo';
import { renderPostAiMarkdown } from '../lib/ai-markdown';

export const GET: APIRoute = async ({ site }) => {
  if (!siteIndexable) {
    return new Response(
      `# ${siteIdentity.name}\n\n本站当前构建未开放收录。\n`,
      {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      },
    );
  }
  const posts = await getPublishedPosts();
  const sections = posts.map((post) => renderPostAiMarkdown(post, site!));
  const header = [
    `# ${siteIdentity.name} — 全站服务器实测语料汇编`,
    '',
    `> ${siteIdentity.description}`,
    '> 授权协议：除服务商商标与基准脚本原始输出外，原创内容采用 CC BY 4.0 许可协议（https://creativecommons.org/licenses/by/4.0/）。引用请保留规范链接与实测采样日期。',
    '',
  ].join('\n');

  const content = posts.length
    ? `${header}\n${sections.join('\n\n---\n\n')}`
    : `${header}\n暂无已发布的测试记录。\n`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
