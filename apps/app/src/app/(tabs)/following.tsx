import { useFollowingFeed } from '@sidequest/api';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { FeedList } from '@/components/feed-list';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

function Header() {
  const { t } = useTranslation();
  return <ThemedText type="subtitle">{t('tabs.following')}</ThemedText>;
}

export default function FollowingScreen() {
  const { status } = useAuth();
  const { t } = useTranslation();

  if (status === 'signed-in') {
    return <FollowingFeed />;
  }

  return (
    <Screen>
      <Header />
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">{t('following.signInPrompt')}</ThemedText>
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        </>
      )}
    </Screen>
  );
}

function FollowingFeed() {
  const feed = useFollowingFeed();
  const { t } = useTranslation();

  return (
    <FeedList
      query={feed}
      header={<Header />}
      renderItem={(post) => <PostCard post={post} />}
      keyExtractor={(post) => String(post.id)}
      emptyText={t('following.empty')}
    />
  );
}
