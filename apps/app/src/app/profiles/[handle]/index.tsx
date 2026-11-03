import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/button';

import { ContentMenu } from '@/components/content-menu';
import { FollowButton } from '@/components/follow-button';
import { ProfileView } from '@/components/profile-view';
import { useActingProfiles } from '@/hooks/use-acting-profiles';

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { t } = useTranslation();
  const acting = useActingProfiles().find((profile) => profile.handle === handle);
  const isAdmin = acting?.role === 'admin';

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
        actions={(profile) => (
          <>
            <View style={{ flex: 1 }}>
              <FollowButton profile={profile} />
            </View>
            {acting && acting.role !== 'self' ? (
              <View style={{ flex: 1 }}>
                <Button
                  title={t('dashboard.title')}
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/profiles/[handle]/dashboard', params: { handle } })
                  }
                />
              </View>
            ) : null}
            {isAdmin ? (
              <View style={{ flex: 1 }}>
                <Button
                  title={t('organizations.manage')}
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/organizations/[handle]/manage', params: { handle } })
                  }
                />
              </View>
            ) : null}
          </>
        )}
      />
    </>
  );
}
