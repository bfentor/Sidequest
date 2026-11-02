import { eventsPartialUpdate, eventsRetrieveOptions } from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { EventForm, type EventFieldErrors } from '@/components/event-form';
import { Screen } from '@/components/screen';
import { goBack } from '@/lib/navigation';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const event = useQuery(eventsRetrieveOptions({ path: { id: Number(id) } }));

  if (!event.data) {
    return <ActivityIndicator style={{ marginTop: 64 }} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <EventForm
        mode="edit"
        initial={event.data}
        submitLabel={t('common.save')}
        onSubmit={async (body) => {
          const { error } = await eventsPartialUpdate({ path: { id: Number(id) }, body });
          if (error) {
            return error as EventFieldErrors;
          }
          queryClient.invalidateQueries();
          goBack({ pathname: '/events/[id]', params: { id } });
          return null;
        }}
      />
    </Screen>
  );
}
