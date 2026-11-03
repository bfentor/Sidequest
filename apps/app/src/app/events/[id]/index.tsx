import { eventsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-server';
import { useTranslation } from 'react-i18next';

import { EventDetails, EventMenu } from '@/components/event-details';
import { Screen } from '@/components/screen';
import { eventMetadata } from '@/lib/metadata';
import { goBack } from '@/lib/navigation';

/** Link previews and search engine tags, rendered on the server. */
export const generateMetadata: GenerateMetadataFunction = (_request, params) =>
  eventMetadata(String(params.id));

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: event } = useQuery(eventsRetrieveOptions({ path: { id: Number(id) } }));

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{
          title: event?.title ?? t('event.title'),
          headerRight: event
            ? () => <EventMenu event={event} onDeleted={() => goBack('/')} />
            : undefined,
        }}
      />
      <EventDetails id={Number(id)} />
    </Screen>
  );
}
