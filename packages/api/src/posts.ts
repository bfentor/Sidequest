/** Infinite-scrolling hooks for posts and comments. */
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  eventsCommentsListInfiniteQueryKey,
  postsCommentsListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import { eventsCommentsList, postsCommentsList } from './generated/sdk.gen';
import { queryParam } from './pagination';

/** What comments are on: a post, or an event (its questions and comments). */
export type CommentParent = { type: 'post' | 'event'; id: number };

export function commentsQueryKey({ type, id }: CommentParent) {
  const options = { path: { id } };
  return type === 'post'
    ? postsCommentsListInfiniteQueryKey(options)
    : eventsCommentsListInfiniteQueryKey(options);
}

/** Comments on a post or event, oldest first. */
export function useComments(parent: CommentParent) {
  const list = parent.type === 'post' ? postsCommentsList : eventsCommentsList;
  return useInfiniteQuery({
    queryKey: commentsQueryKey(parent),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await list({
        path: { id: parent.id },
        query: { cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => queryParam(page.next, 'cursor'),
  });
}
