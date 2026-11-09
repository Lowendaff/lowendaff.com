/** Shared by the content schema, authoring commands and CI. */
export function normalizeReviewTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[#*0-9]\uFE0F?\u20E3/gu, '-')
    .replace(/[^a-z0-9\p{Script=Han}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000'))
    return false;
  const value = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(value.valueOf()) && value.toISOString().slice(0, 10) === date
  );
}

export function reviewTestDate(testedAt: unknown): string {
  const date =
    typeof testedAt === 'string'
      ? testedAt.match(/^(\d{4}-\d{2}-\d{2})(?:$|[ T])/)?.[1]
      : undefined;
  if (!date || !validDate(date))
    throw new Error(
      'testedAt must start with a valid YYYY-MM-DD test date; publication/build dates are not substitutes',
    );
  return date;
}

export function generateReviewPermalink(
  title: unknown,
  testedAt: unknown,
): string {
  if (typeof title !== 'string')
    throw new Error('A title is required to generate the URL');
  const name = normalizeReviewTitle(title);
  if (!name)
    throw new Error(
      'The title must contain Chinese characters, Latin letters or digits',
    );
  return `/reviews/${name}-${reviewTestDate(testedAt).replaceAll('-', '')}/`;
}

export function isReviewPermalink(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = value.match(
    /^\/reviews\/([a-z0-9\p{Script=Han}]+(?:-[a-z0-9\p{Script=Han}]+)*)-(\d{4})(\d{2})(\d{2})\/$/u,
  );
  return Boolean(
    match &&
    normalizeReviewTitle(match[1]) === match[1] &&
    validDate(`${match[2]}-${match[3]}-${match[4]}`),
  );
}

/** Only former review paths can be reserved as aliases; no arbitrary redirects. */
export function isReviewAlias(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\/reviews\/[a-z0-9\p{Script=Han}]+(?:-[a-z0-9\p{Script=Han}]+)*\/$/u.test(
      value,
    ) &&
    value.normalize('NFKC') === value
  );
}

export type ReviewAddress = {
  kind?: string;
  permalink?: string;
  redirectFrom?: string[];
};

export function assertUniqueReviewUrls(
  entries: { id: string; data: ReviewAddress }[],
): void {
  const owners = new Map<string, string>();
  for (const { id, data } of entries) {
    if (data.kind === 'archive-reference') continue;
    if (!isReviewPermalink(data.permalink))
      throw new Error(
        `${id}: missing or invalid permalink; run npm run urls:fill`,
      );
    for (const url of [data.permalink, ...(data.redirectFrom ?? [])]) {
      if (!isReviewAlias(url))
        throw new Error(`${id}: invalid redirectFrom URL: ${url}`);
      const previous = owners.get(url);
      if (previous)
        throw new Error(`Duplicate review URL ${url}: ${previous} and ${id}`);
      owners.set(url, id);
    }
  }
}
