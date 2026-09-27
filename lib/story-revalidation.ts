/* bitesite/lib/story-revalidation.ts */

import { revalidatePath } from 'next/cache';

/**
 * Refresh every public page that lists or shows Stories. Call after a committed change that
 * makes a Story appear or disappear: the home page (latest Stories), the Story list, every Story
 * page (the Story itself and the related-Story lists on the others) and the sitemap. Store pages
 * do not render Stories.
 */
export function revalidatePublicStoryRoutes(slug?: string | null) {
  revalidatePath('/');
  revalidatePath('/stories');
  if (slug) revalidatePath(`/stories/${slug}`);
  revalidatePath('/stories/[slug]', 'page');
  revalidatePath('/sitemap.xml');
}
