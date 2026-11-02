import { meRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const { status } = useAuth();
  const { t } = useTranslation();

  return (
    <Screen>
      <ThemedText type="subtitle">{t('tabs.profile')}</ThemedText>
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : status === 'signed-in' ? (
        <MyProfile />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">{t('profile.signInPrompt')}</ThemedText>
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        </>
      )}
      <Button
        title={t('common.settings')}
        variant="secondary"
        onPress={() => router.push('/settings')}
      />
    </Screen>
  );
}

function MyProfile() {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { data: me, isPending } = useQuery(meRetrieveOptions());

  if (isPending || !me) {
    return <ActivityIndicator />;
  }

  return (
    <>
      <View>
        <ThemedText type="heading">{me.display_name}</ThemedText>
        <ThemedText themeColor="textSecondary">@{me.handle}</ThemedText>
      </View>
      {me.bio ? <ThemedText>{me.bio}</ThemedText> : null}
      <View style={styles.stats}>
        <ThemedText type="small">{t('profile.followers', { count: me.follower_count })}</ThemedText>
        <ThemedText type="small">{t('profile.following', { count: me.following_count })}</ThemedText>
      </View>
      <Button title={t('common.signOut')} variant="secondary" onPress={signOut} />
    </>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
});
