import { eventsRetrieveOptions, postsCreate } from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { PostForm, type PostFieldErrors } from '@/components/post-form';
import { Screen } from '@/components/screen';
import { goBack } from '@/lib/navigation';

/** Write a post; `?event=<id>` shares that event in it. */
export default function NewPostScreen() {
  const { event: eventId } = useLocalSearchParams<{ event?: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const event = useQuery({
    ...eventsRetrieveOptions({ path: { id: Number(eventId) } }),
    enabled: Boolean(eventId),
  });

  if (eventId && !event.data) {
    return <ActivityIndicator style={{ marginTop: 64 }} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <PostForm
        mode="create"
        initial={{ body: '', images: [], event: event.data ?? null }}
        submitLabel={t('posts.publish')}
        onSubmit={async (body) => {
          const { data, error } = await postsCreate({ body });
          if (!data) {
            return (error ?? {}) as PostFieldErrors;
          }
          queryClient.invalidateQueries();
          goBack('/following');
          return null;
        }}
      />
    </Screen>
  );
}
