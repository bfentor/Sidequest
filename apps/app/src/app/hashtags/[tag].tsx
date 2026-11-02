import { useHashtagFeed } from '@sidequest/api';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedList } from '@/components/feed-list';
import { PostCard } from '@/components/post-card';

/** Posts with one #hashtag, newest first. */
export default function HashtagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { t } = useTranslation();
  const feed = useHashtagFeed(tag);

  return (
    <>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <FeedList
        query={feed}
        hasHeader
        renderItem={(post) => <PostCard post={post} />}
        keyExtractor={(post) => String(post.id)}
        emptyText={t('hashtags.empty')}
      />
    </>
  );
}
