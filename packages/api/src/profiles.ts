import { useInfiniteQuery } from '@tanstack/react-query';

import {
  meFollowRequestsListInfiniteQueryKey,
  profilesEventsListInfiniteQueryKey,
  profilesFollowersListInfiniteQueryKey,
  profilesFollowingListInfiniteQueryKey,
  profilesPostsListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import {
  meFollowRequestsList,
  profilesEventsList,
  profilesFollowersList,
  profilesFollowingList,
  profilesPostsList,
} from './generated/sdk.gen';
import { nextOffset, queryParam } from './pagination';

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
    getNextPageParam: (page) => nextOffset(page.next),
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

/** People asking to follow the signed-in user's private profile, newest first. */
export function useFollowRequests() {
  return useInfiniteQuery({
    queryKey: meFollowRequestsListInfiniteQueryKey(),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await meFollowRequestsList({
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
