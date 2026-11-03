import { profilesEventsListOptions, profilesRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEB_URL } from '@/lib/config';
import { useFormat } from '@/lib/format';

// Upcoming events shown before "See all".
const SHOWN = 10;

/**
 * A profile's upcoming public events, without the app around them, for
 * organizations to put on their own website in an iframe (the snippet is on
 * their dashboard). Events open on Sidequest in a new tab.
 */
export default function EmbedScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const profile = useQuery(profilesRetrieveOptions({ path: { handle } }));
  const events = useQuery(
    profilesEventsListOptions({ path: { handle }, query: { when: 'upcoming', limit: SHOWN } }),
  );
  // Unlisted events are only for people with the link.
  const shown = (events.data?.results ?? []).filter((event) => event.visibility === 'public');
  const open = (path: string) => Linking.openURL(`${WEB_URL}${path}`);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      <ThemedText type="smallBold">
        {t('embed.title', { name: profile.data?.display_name ?? `@${handle}` })}
      </ThemedText>
      {events.isPending ? <ActivityIndicator /> : null}
      {events.isSuccess && !shown.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('embed.empty')}
        </ThemedText>
      ) : null}
      {shown.map((event) => (
        <Pressable
          key={event.id}
          role="link"
          onPress={() => open(`/events/${event.id}`)}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.event}>
            <ThemedText type="small" themeColor="tint">
              {format.eventTime(event.starts_at, event.ends_at)}
            </ThemedText>
            <ThemedText type="smallBold">{event.title}</ThemedText>
            {event.venue_name || event.address ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[event.venue_name, event.address].filter(Boolean).join(', ')}
              </ThemedText>
            ) : null}
          </ThemedView>
        </Pressable>
      ))}
      <View style={styles.footer}>
        <Pressable role="link" onPress={() => open(`/profiles/${handle}`)}>
          <ThemedText type="small" themeColor="tint">
            {t('embed.seeAll')}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  event: {
    gap: 2,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
