import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
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
            <View style={{ flex: 1 }}>
              <Button title={t('profile.edit')} onPress={() => router.push('/edit-profile')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('organizations.title')}
                variant="secondary"
                onPress={() => router.push('/organizations')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.settings')}
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            </View>
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
