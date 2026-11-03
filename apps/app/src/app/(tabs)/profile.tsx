import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { ProfileAction } from '@/components/profile-header';
import { ProfileView } from '@/components/profile-view';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useMe } from '@/hooks/use-me';

export default function ProfileTab() {
  const { status } = useAuth();
  const { t } = useTranslation();
  const me = useMe();

  if (me) {
    return (
      <ProfileView
        handle={me.handle}
        actions={() => (
          <>
            <ProfileAction>
              <Button title={t('profile.edit')} onPress={() => router.push('/edit-profile')} />
            </ProfileAction>
            <ProfileAction>
              <Button
                title={t('myEvents.title')}
                variant="secondary"
                onPress={() => router.push('/my-events')}
              />
            </ProfileAction>
            <ProfileAction>
              <Button
                title={t('organizations.title')}
                variant="secondary"
                onPress={() => router.push('/organizations')}
              />
            </ProfileAction>
            <ProfileAction>
              <Button
                title={t('common.settings')}
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            </ProfileAction>
          </>
        )}
      />
    );
  }

  return (
    <Screen>
      <ThemedText type="subtitle">{t('tabs.profile')}</ThemedText>
      {status === 'signed-out' ? (
        <>
          <ThemedText themeColor="textSecondary">{t('profile.signInPrompt')}</ThemedText>
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
          <Button
            title={t('common.settings')}
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        </>
      ) : (
        <ActivityIndicator />
      )}
    </Screen>
  );
}
