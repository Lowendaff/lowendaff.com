import { readFile } from 'node:fs/promises';
import { glob, type Loader } from 'astro/loaders';
import { parseReadableReview } from '../lib/readable-review';

/** Preserve Astro's file watching/rendering while enriching readable review entries. */
export function postsLoader(): Loader {
  const files = glob({ base: './src/content/posts', pattern: '*.mdx' });
  return {
    name: 'posts-with-readable-reviews',
    async load(context) {
      // Recompute derived data on a full reload, including parser/schema changes.
      context.store.clear();
      await files.load({
        ...context,
        async parseData(entry) {
          if (entry.data.format !== 'review-markdown')
            return context.parseData(entry);
          if (!entry.filePath)
            throw new Error(`Missing source path for ${entry.id}`);
          const source = await readFile(entry.filePath, 'utf8');
          const review = parseReadableReview(
            source,
            entry.data,
            entry.id,
            entry.filePath,
          );
          return context.parseData({
            ...entry,
            data: { ...entry.data, review },
          });
        },
      });
    },
  };
}
