import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/config';

import { Button } from './button';
import { ThemedText } from './themed-text';

/**
 * What Sidequest is, above the upcoming events, for signed-out visitors to
 * the website: a sign-up button, and the app's store pages once it's out.
 */
export function Welcome() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const theme = useTheme();

  if (status !== 'signed-out') {
    return null;
  }
  const stores = [
    { url: APP_STORE_URL, label: t('welcome.appStore') },
    { url: PLAY_STORE_URL, label: t('welcome.playStore') },
  ].filter((store) => store.url);

  return (
    <View style={[styles.hero, { borderColor: theme.backgroundElement }]}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={styles.icon}
        accessibilityLabel="Sidequest"
      />
      <ThemedText type="subtitle" role="heading" aria-level={1}>
        {t('welcome.title')}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{t('welcome.tagline')}</ThemedText>
      <View style={styles.points}>
        {[t('welcome.pointNearby'), t('welcome.pointFollow'), t('welcome.pointFriends')].map(
          (point) => (
            <ThemedText key={point}>✓ {point}</ThemedText>
          ),
        )}
      </View>
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button
            title={t('welcome.signUp')}
            onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'sign-up' } })}
          />
        </View>
        {stores.map((store) => (
          <View key={store.url} style={styles.button}>
            <Button
              title={store.label}
              variant="secondary"
              onPress={() => Linking.openURL(store.url)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    borderWidth: 2,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  points: {
    gap: Spacing.one,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexGrow: 1,
    flexBasis: 160,
  },
});
