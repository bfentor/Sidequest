import { postsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Comments } from '@/components/comments';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const post = useQuery(postsRetrieveOptions({ path: { id: Number(id) } }));

  return (
    <Screen hasHeader>
      {post.isPending ? (
        <ActivityIndicator />
      ) : post.data ? (
        <>
          <PostCard post={post.data} />
          <Comments
            parent={{ type: 'post', id: post.data.id }}
            title={t('comments.title')}
            placeholder={t('comments.placeholder')}
          />
        </>
      ) : (
        <ThemedText themeColor="textSecondary">{t('posts.loadFailed')}</ThemedText>
      )}
    </Screen>
  );
}
