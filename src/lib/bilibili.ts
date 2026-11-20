// Only a video identifier and its optional part cross the embed boundary.
export function bilibiliUrls(input: string) {
  const idPattern = /^BV[0-9A-Za-z]{10}$/;
  let bvid = input;
  let part = 1;
  if (!idPattern.test(bvid)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return;
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(
        url.hostname,
      )
    )
      return;
    bvid = /^\/video\/(BV[0-9A-Za-z]{10})\/?$/.exec(url.pathname)?.[1] ?? '';
    if (!bvid) return;
    const parts = url.searchParams.getAll('p');
    if (parts.length > 1 || (parts.length && !/^[1-9]\d*$/.test(parts[0])))
      return;
    part = Number(parts[0] ?? 1);
    if (!Number.isSafeInteger(part)) return;
  }
  const page = new URL('/video/' + bvid + '/', 'https://www.bilibili.com');
  if (part > 1) page.searchParams.set('p', String(part));
  const player = new URL('https://player.bilibili.com/player.html');
  player.searchParams.set('bvid', bvid);
  player.searchParams.set('p', String(part));
  player.searchParams.set('autoplay', '0');
  player.searchParams.set('poster', '0');
  return { page: page.href, player: player.href, part };
}
