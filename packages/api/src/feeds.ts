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
  meEventsListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import {
  feedsFollowingList,
  feedsNearbyList,
  feedsUpcomingList,
  meEventsList,
} from './generated/sdk.gen';
import type { LatLng } from './generated/types.gen';
import { queryParam } from './pagination';

/** Narrows the upcoming and nearby feeds. */
export type FeedFilters = {
  /** Category slugs; events in any of them. */
  category?: string[];
  /** ISO times: events going on during this window. */
  starts_after?: string;
  starts_before?: string;
  free?: boolean;
};

export function useUpcomingFeed(filters: FeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: feedsUpcomingListInfiniteQueryKey({ query: filters }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await feedsUpcomingList({
        query: { ...filters, cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => queryParam(page.next, 'cursor'),
  });
}

export function useNearbyFeed(position: LatLng, radiusKm?: number, filters: FeedFilters = {}) {
  const query = { lat: position.lat, lng: position.lng, radius_km: radiusKm, ...filters };
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

export function useFollowingFeed({ enabled = true, hidePast = false } = {}) {
  const query = hidePast ? { hide_past: true } : {};
  return useInfiniteQuery({
    queryKey: feedsFollowingListInfiniteQueryKey({ query }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await feedsFollowingList({
        query: { ...query, cursor: pageParam },
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

/** Events the signed-in user or their organizations host, drafts included. */
export function useManagedEvents(when: 'upcoming' | 'past') {
  return useInfiniteQuery({
    queryKey: meEventsListInfiniteQueryKey({ query: { when } }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await meEventsList({
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
