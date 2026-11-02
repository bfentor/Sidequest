import { Stack, useLocalSearchParams } from 'expo-router';

import { ContentMenu } from '@/components/content-menu';
import { FollowButton } from '@/components/follow-button';
import { ProfileView } from '@/components/profile-view';

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          title: `@${handle}`,
          headerRight: () => (
            <ContentMenu target={{ type: 'profile', id: handle }} owner={{ handle }} />
          ),
        }}
      />
      <ProfileView
        handle={handle}
        hasHeader
        actions={(profile) => <FollowButton profile={profile} />}
      />
    </>
  );
}
