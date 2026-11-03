import {
  useForYouFeed,
  useTrendingFeed,
  useUpcomingFeed,
  type Event,
  type FeedFilters,
} from '@sidequest/api';
import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { EventCard } from '@/components/event-card';
import { FeedFilterBar, useFeedFilters } from '@/components/feed-filter-bar';
import { FeedList, type FeedQuery } from '@/components/feed-list';
import { IconButton } from '@/components/icon-button';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Welcome } from '@/components/welcome';
import { Spacing } from '@/constants/theme';
import { useCurrentPosition } from '@/hooks/use-current-position';

type Order = 'soonest' | 'forYou' | 'trending';

type EventFeedProps = { filters: FeedFilters; header: ReactElement; emptyText: string };

function EventFeed({
  query,
  header,
  emptyText,
}: Omit<EventFeedProps, 'filters'> & { query: FeedQuery<Event> }) {
  return (
    <FeedList
      query={query}
      header={header}
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={emptyText}
    />
  );
}

function SoonestFeed({ filters, ...props }: EventFeedProps) {
  return <EventFeed query={useUpcomingFeed(filters)} {...props} />;
}

function TrendingFeed({ filters, ...props }: EventFeedProps) {
  return <EventFeed query={useTrendingFeed(filters)} {...props} />;
}

function ForYouFeed({ filters, ...props }: EventFeedProps) {
  // Nearby events rank higher, if the user already shared their location.
  const { position } = useCurrentPosition();
  return <EventFeed query={useForYouFeed(position, filters)} {...props} />;
}

const FEEDS = { soonest: SoonestFeed, forYou: ForYouFeed, trending: TrendingFeed };

export default function UpcomingScreen() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const [chosenOrder, setOrder] = useState<Order>('soonest');
  const filterState = useFeedFilters();
  const filtered = Object.keys(filterState.filters).length > 0;
  const signedIn = status === 'signed-in';
  const order = !signedIn && chosenOrder === 'forYou' ? 'soonest' : chosenOrder;

  const orders: { value: Order; label: string }[] = [
    { value: 'soonest', label: t('upcoming.soonest') },
    ...(signedIn ? [{ value: 'forYou' as const, label: t('upcoming.forYou') }] : []),
    { value: 'trending', label: t('upcoming.trending') },
  ];

  const header = (
    <View style={styles.headerBlock}>
      <Welcome />
      <View style={styles.header}>
        <ThemedText type="subtitle">{t('tabs.upcoming')}</ThemedText>
        <View style={styles.actions}>
          <IconButton
            icon={{ ios: 'magnifyingglass', material: 'search' }}
            label={t('search.title')}
            size={28}
            onPress={() => router.push('/search')}
          />
          {signedIn ? (
            <IconButton
              icon={{ ios: 'plus.circle.fill', material: 'add_circle' }}
              label={t('eventForm.newEvent')}
              size={32}
              onPress={() => router.push('/events/new')}
            />
          ) : null}
        </View>
      </View>
      <SegmentedControl options={orders} value={order} onChange={setOrder} />
      <FeedFilterBar {...filterState} />
    </View>
  );

  const Feed = FEEDS[order];
  const emptyText = filtered
    ? t('filters.nothing')
    : {
        soonest: t('upcoming.empty'),
        forYou: t('upcoming.forYouEmpty'),
        trending: t('upcoming.trendingEmpty'),
      }[order];
  return <Feed filters={filterState.filters} header={header} emptyText={emptyText} />;
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
