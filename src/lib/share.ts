export interface ShareInput {
  title: string;
  url: string;
  verdict?: string;
  description?: string;
  price?: string;
}

export interface ShareLinks {
  shareTitle: string;
  tweetText: string;
  twitterHref: string;
  telegramHref: string;
  readableUrl: string;
}

function clampSummary(raw: string, maxChars: number): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const chars = [...normalized];
  if (chars.length <= maxChars) return normalized;
  return `${chars
    .slice(0, maxChars - 1)
    .join('')
    .replace(/[，。、；：！？,.;:!?\s]+$/u, '')}…`;
}

export function buildShareLinks(input: ShareInput): ShareLinks {
  const cleanTitle = input.title
    .replace(/^(?:\p{Regional_Indicator}{2}\s*)+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  const headline = input.price
    ? `${cleanTitle}（${input.price.trim()}）`
    : cleanTitle;
  const summarySource =
    input.verdict?.trim() || input.description?.trim() || '';
  const summary = clampSummary(summarySource, 88);
  const tweetText = summary ? `${headline} — ${summary}` : headline;

  const twitterParams = new URLSearchParams({
    text: tweetText,
    url: input.url,
  });
  const telegramParams = new URLSearchParams({
    url: input.url,
    text: headline,
  });

  let readableUrl = input.url;
  try {
    readableUrl = decodeURI(input.url);
  } catch {
    readableUrl = input.url;
  }

  return {
    shareTitle: cleanTitle,
    tweetText,
    twitterHref: `https://twitter.com/intent/tweet?${twitterParams.toString()}`,
    telegramHref: `https://t.me/share/url?${telegramParams.toString()}`,
    readableUrl,
  };
}
