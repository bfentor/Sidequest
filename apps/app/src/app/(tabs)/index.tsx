import { useUpcomingFeed } from '@sidequest/api';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';

import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';

export default function UpcomingScreen() {
  const feed = useUpcomingFeed();
  const { t } = useTranslation();
  const { status } = useAuth();

  return (
    <FeedList
      query={feed}
      header={
        <View style={styles.header}>
          <ThemedText type="subtitle">{t('tabs.upcoming')}</ThemedText>
          {status === 'signed-in' ? (
            <IconButton
              icon={{ ios: 'plus.circle.fill', material: 'add_circle' }}
              label={t('eventForm.newEvent')}
              size={32}
              onPress={() => router.push('/events/new')}
            />
          ) : null}
        </View>
      }
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={t('upcoming.empty')}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
