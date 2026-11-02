import { useUpcomingFeed } from '@sidequest/api';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';

import { EventCard } from '@/components/event-card';
import { FeedFilterBar, useFeedFilters } from '@/components/feed-filter-bar';
import { FeedList } from '@/components/feed-list';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function UpcomingScreen() {
  const filterState = useFeedFilters();
  const feed = useUpcomingFeed(filterState.filters);
  const filtered = Object.keys(filterState.filters).length > 0;
  const { t } = useTranslation();
  const { status } = useAuth();

  return (
    <FeedList
      query={feed}
      header={
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('tabs.upcoming')}</ThemedText>
            <View style={styles.actions}>
              <IconButton
                icon={{ ios: 'magnifyingglass', material: 'search' }}
                label={t('search.title')}
                size={28}
                onPress={() => router.push('/search')}
              />
              {status === 'signed-in' ? (
                <IconButton
                  icon={{ ios: 'plus.circle.fill', material: 'add_circle' }}
                  label={t('eventForm.newEvent')}
                  size={32}
                  onPress={() => router.push('/events/new')}
                />
              ) : null}
            </View>
          </View>
          <FeedFilterBar {...filterState} />
        </View>
      }
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={filtered ? t('filters.nothing') : t('upcoming.empty')}
    />
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
