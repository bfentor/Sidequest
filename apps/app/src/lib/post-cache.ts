import type { Post } from '@sidequest/api';
import type { QueryClient } from '@tanstack/react-query';

function isPost(value: object): value is Post {
  return 'like_count' in value && 'is_liked' in value && 'author' in value;
}

/** `value` with the post `id` replaced by `patch(post)`, or `value` itself if it isn't in there. */
function replaceIn(value: unknown, id: number, patch: (post: Post) => Post): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const replaced = replaceIn(item, id, patch);
      changed ||= replaced !== item;
      return replaced;
    });
    return changed ? next : value;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (isPost(value) && value.id === id) {
    return patch(value);
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = replaceIn(item, id, patch);
    changed ||= next[key] !== item;
  }
  return changed ? next : value;
}

/**
 * Changes every cached copy of a post at once: the following and hashtag
 * feeds, profile pages and the post's own page all show the same thing.
 */
export function updateCachedPost(
  queryClient: QueryClient,
  id: number,
  patch: (post: Post) => Post,
) {
  queryClient.setQueriesData({}, (data: unknown) =>
    data === undefined ? data : replaceIn(data, id, patch),
  );
}
