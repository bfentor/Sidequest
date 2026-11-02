import { eventsCreate, eventsRetrieveOptions } from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { EventForm, type EventFieldErrors } from '@/components/event-form';
import { Screen } from '@/components/screen';

/** Create an event; `?from=<id>` starts from a copy of an existing one (Duplicate). */
export default function NewEventScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const source = useQuery({
    ...eventsRetrieveOptions({ path: { id: Number(from) } }),
    enabled: Boolean(from),
  });

  if (from && !source.data) {
    return <ActivityIndicator style={{ marginTop: 64 }} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <EventForm
        mode="create"
        initial={source.data}
        submitLabel={t('eventForm.publish')}
        onSubmit={async (body) => {
          const { data, error } = await eventsCreate({ body });
          if (!data) {
            return (error ?? {}) as EventFieldErrors;
          }
          queryClient.invalidateQueries();
          router.replace({ pathname: '/events/[id]', params: { id: data.id } });
          return null;
        }}
      />
    </Screen>
  );
}
