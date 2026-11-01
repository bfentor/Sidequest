import { useUpcomingFeed } from '@sidequest/api';

import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { ThemedText } from '@/components/themed-text';

export default function UpcomingScreen() {
  const feed = useUpcomingFeed();

  return (
    <FeedList
      query={feed}
      header={<ThemedText type="subtitle">Upcoming</ThemedText>}
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText="No upcoming events yet."
    />
  );
}
