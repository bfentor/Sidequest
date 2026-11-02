import { postsPartialUpdate, postsRetrieveOptions } from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { PostForm, type PostFieldErrors } from '@/components/post-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { goBack } from '@/lib/navigation';

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const post = useQuery(postsRetrieveOptions({ path: { id: Number(id) } }));

  if (post.isPending) {
    return <ActivityIndicator style={{ marginTop: 64 }} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      {post.data ? (
        <PostForm
          mode="edit"
          initial={post.data}
          submitLabel={t('common.save')}
          onSubmit={async (body) => {
            const { data, error } = await postsPartialUpdate({ path: { id: Number(id) }, body });
            if (!data) {
              return (error ?? {}) as PostFieldErrors;
            }
            queryClient.invalidateQueries();
            goBack('/following');
            return null;
          }}
        />
      ) : (
        <ThemedText themeColor="textSecondary">{t('posts.loadFailed')}</ThemedText>
      )}
    </Screen>
  );
}
