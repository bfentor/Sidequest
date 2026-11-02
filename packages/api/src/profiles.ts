import { useInfiniteQuery } from '@tanstack/react-query';

import {
  profilesEventsListInfiniteQueryKey,
  profilesFollowersListInfiniteQueryKey,
  profilesFollowingListInfiniteQueryKey,
  profilesPostsListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import {
  profilesEventsList,
  profilesFollowersList,
  profilesFollowingList,
  profilesPostsList,
} from './generated/sdk.gen';
import { queryParam } from './pagination';

/** A profile's posts, newest first. */
export function useProfilePosts(handle: string) {
  const path = { handle };
  return useInfiniteQuery({
    queryKey: profilesPostsListInfiniteQueryKey({ path }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await profilesPostsList({
        path,
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

/** Events a profile organizes: upcoming soonest first, or past newest first. */
export function useProfileEvents(handle: string, when: 'upcoming' | 'past') {
  const path = { handle };
  return useInfiniteQuery({
    queryKey: profilesEventsListInfiniteQueryKey({ path, query: { when } }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await profilesEventsList({
        path,
        query: { when, offset: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (page) => {
      const offset = queryParam(page.next, 'offset');
      return offset === undefined ? undefined : Number(offset);
    },
  });
}

/** Who follows a profile, or whom it follows; most recent first. */
export function useFollowList(handle: string, direction: 'followers' | 'following') {
  const path = { handle };
  const list = direction === 'followers' ? profilesFollowersList : profilesFollowingList;
  const key =
    direction === 'followers'
      ? profilesFollowersListInfiniteQueryKey({ path })
      : profilesFollowingListInfiniteQueryKey({ path });
  return useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await list({
        path,
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
