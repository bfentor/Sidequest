import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  notificationsListInfiniteQueryKey,
  notificationsUnreadRetrieveOptions,
} from './generated/@tanstack/react-query.gen';
import { notificationsList } from './generated/sdk.gen';
import { queryParam } from './pagination';

/** The signed-in user's inbox, newest first. */
export function useNotifications({ enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: notificationsListInfiniteQueryKey(),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await notificationsList({
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

/** How many notifications are unread; checked every minute while enabled. */
export function useUnreadCount({ enabled = true } = {}) {
  const { data } = useQuery({
    ...notificationsUnreadRetrieveOptions(),
    enabled,
    refetchInterval: 60_000,
  });
  return enabled ? (data?.unread ?? 0) : 0;
}
