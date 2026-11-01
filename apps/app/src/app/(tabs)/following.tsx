import { useFollowingFeed } from '@sidequest/api';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { FeedList } from '@/components/feed-list';
import { PostCard } from '@/components/post-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

const header = <ThemedText type="subtitle">Following</ThemedText>;

export default function FollowingScreen() {
  const { status } = useAuth();

  if (status === 'signed-in') {
    return <FollowingFeed />;
  }

  return (
    <Screen>
      {header}
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Sign in to see posts and events from the people and organizations you follow.
          </ThemedText>
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        </>
      )}
    </Screen>
  );
}

function FollowingFeed() {
  const feed = useFollowingFeed();

  return (
    <FeedList
      query={feed}
      header={header}
      renderItem={(post) => <PostCard post={post} />}
      keyExtractor={(post) => String(post.id)}
      emptyText="Nothing here yet. Follow some people or organizations to fill your feed."
    />
  );
}
