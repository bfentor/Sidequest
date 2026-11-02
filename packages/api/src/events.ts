/** Infinite-scrolling hooks for lists inside an event. */
import { useInfiniteQuery } from '@tanstack/react-query';

import { eventsAttendeesListInfiniteQueryKey } from './generated/@tanstack/react-query.gen';
import { eventsAttendeesList } from './generated/sdk.gen';
import { nextOffset } from './pagination';

/** Who's going to (or interested in) an event, people the viewer follows first. */
export function useAttendees(eventId: number, status: 'going' | 'interested') {
  const options = { path: { id: eventId }, query: { status } };
  return useInfiniteQuery({
    queryKey: eventsAttendeesListInfiniteQueryKey(options),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await eventsAttendeesList({
        ...options,
        query: { status, offset: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (page) => nextOffset(page.next),
  });
}
