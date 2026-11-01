import { eventsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { formatEventTime } from '@/lib/format';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isPending, isError } = useQuery(
    eventsRetrieveOptions({ path: { id: Number(id) } }),
  );

  return (
    <Screen hasHeader>
      <Stack.Screen options={{ title: event?.title ?? 'Event' }} />
      {isPending ? (
        <ActivityIndicator />
      ) : isError ? (
        <ThemedText themeColor="textSecondary">This event couldn&apos;t be loaded.</ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold" themeColor="tint">
            {formatEventTime(event.starts_at, event.ends_at)}
          </ThemedText>
          <ThemedText type="subtitle">{event.title}</ThemedText>
          <ThemedText themeColor="textSecondary">
            by {event.organizer.display_name} (@{event.organizer.handle})
          </ThemedText>
          {event.venue_name || event.address ? (
            <ThemedText>{[event.venue_name, event.address].filter(Boolean).join(', ')}</ThemedText>
          ) : null}
          {event.description ? <ThemedText>{event.description}</ThemedText> : null}
        </>
      )}
    </Screen>
  );
}
