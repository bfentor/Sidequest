import { useFollowList } from '@sidequest/api';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedList } from './feed-list';
import { ProfileRow } from './profile-row';

type FollowListScreenProps = { handle: string; direction: 'followers' | 'following' };

export function FollowListScreen({ handle, direction }: FollowListScreenProps) {
  const { t } = useTranslation();
  const list = useFollowList(handle, direction);
  const title =
    direction === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle');

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FeedList
        query={list}
        hasHeader
        renderItem={(profile) => <ProfileRow profile={profile} />}
        keyExtractor={(profile) => profile.handle}
        emptyText={direction === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}
      />
    </>
  );
}
