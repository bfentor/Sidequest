/** Infinite-scrolling hooks for lists of and inside events. */
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  eventsAttendeesListInfiniteQueryKey,
  meAttendingListInfiniteQueryKey,
  meEventsListInfiniteQueryKey,
  meSavedListInfiniteQueryKey,
} from './generated/@tanstack/react-query.gen';
import {
  eventsAttendeesList,
  meAttendingList,
  meEventsList,
  meSavedList,
} from './generated/sdk.gen';
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

const MY_EVENT_LISTS = {
  /** Events the signed-in user or their organizations host, drafts included. */
  hosting: { list: meEventsList, key: meEventsListInfiniteQueryKey },
  /** Going, interested or waitlisted. */
  attending: { list: meAttendingList, key: meAttendingListInfiniteQueryKey },
  saved: { list: meSavedList, key: meSavedListInfiniteQueryKey },
};

export type MyEventList = keyof typeof MY_EVENT_LISTS;

/** The signed-in user's own event lists, upcoming (soonest first) or past (latest first). */
export function useMyEvents(which: MyEventList, when: 'upcoming' | 'past') {
  const { list, key } = MY_EVENT_LISTS[which];
  return useInfiniteQuery({
    queryKey: key({ query: { when } }),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await list({
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
