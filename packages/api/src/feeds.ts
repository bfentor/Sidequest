/**
 * Infinite-scrolling hooks for the three feeds.
 *
 * The backend returns DRF-style pages with a `next` URL; each hook reads the
 * next page's cursor or offset from it.
 */
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  feedsFollowingListInfiniteQueryKey,
  feedsNearbyListInfiniteQueryKey,
  feedsUpcomingListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import { feedsFollowingList, feedsNearbyList, feedsUpcomingList } from './generated/sdk.gen';
import type { LatLng } from './generated/types.gen';
import { queryParam } from './pagination';

export function useUpcomingFeed() {
  return useInfiniteQuery({
    queryKey: feedsUpcomingListInfiniteQueryKey(),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await feedsUpcomingList({
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

export function useNearbyFeed(position: LatLng, radiusKm?: number) {
  const query = { lat: position.lat, lng: position.lng, radius_km: radiusKm };
  return useInfiniteQuery({
    queryKey: feedsNearbyListInfiniteQueryKey({ query }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await feedsNearbyList({
        query: { ...query, offset: pageParam },
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

export function useFollowingFeed({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: feedsFollowingListInfiniteQueryKey(),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await feedsFollowingList({
        query: { cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => queryParam(page.next, 'cursor'),
    enabled,
  });
}
