import { eventsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { ContentMenu } from '@/components/content-menu';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useFormat } from '@/lib/format';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const {
    data: event,
    isPending,
    isError,
  } = useQuery(eventsRetrieveOptions({ path: { id: Number(id) } }));

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{
          title: event?.title ?? t('event.title'),
          headerRight: event
            ? () => (
                <ContentMenu
                  target={{ type: 'event', id: String(event.id) }}
                  owner={event.organizer}
                />
              )
            : undefined,
        }}
      />
      {isPending ? (
        <ActivityIndicator />
      ) : isError ? (
        <ThemedText themeColor="textSecondary">{t('event.loadFailed')}</ThemedText>
      ) : (
        <>
          <ThemedText type="smallBold" themeColor="tint">
            {format.eventTime(event.starts_at, event.ends_at)}
          </ThemedText>
          <ThemedText type="subtitle">{event.title}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {t('event.byOrganizerWithHandle', {
              name: event.organizer.display_name,
              handle: event.organizer.handle,
            })}
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
