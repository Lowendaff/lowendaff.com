/** Indexing is an explicit release setting, independent of build optimization. */
export const siteIndexable =
  import.meta.env.PROD && import.meta.env.PUBLIC_SITE_INDEXABLE === 'true';

export function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
}
