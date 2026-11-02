import { useNearbyFeed, type LatLng } from '@sidequest/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EventCard } from '@/components/event-card';
import { FeedFilterBar, useFeedFilters } from '@/components/feed-filter-bar';
import { FeedList } from '@/components/feed-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentPosition } from '@/hooks/use-current-position';
import { useTheme } from '@/hooks/use-theme';

function Header() {
  const { t } = useTranslation();
  return <ThemedText type="subtitle">{t('tabs.nearby')}</ThemedText>;
}

export default function NearbyScreen() {
  const { permission, requestPermission, position, failed } = useCurrentPosition();
  const { t } = useTranslation();

  if (position) {
    return <NearbyFeed position={position} />;
  }

  return (
    <Screen>
      <Header />
      {!permission ? (
        <ActivityIndicator />
      ) : permission.granted ? (
        failed ? (
          <ThemedText themeColor="textSecondary">{t('nearby.locationFailed')}</ThemedText>
        ) : (
          <ActivityIndicator />
        )
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            {permission.canAskAgain ? t('nearby.askPermission') : t('nearby.permissionDenied')}
          </ThemedText>
          {permission.canAskAgain ? (
            <Button title={t('nearby.useMyLocation')} onPress={requestPermission} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const RADII_KM = [2, 5, 10, 25];

function NearbyFeed({ position }: { position: LatLng }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [radius, setRadius] = useState(10);
  const filterState = useFeedFilters();
  const feed = useNearbyFeed(position, radius, filterState.filters);

  return (
    <FeedList
      query={feed}
      header={
        <View style={styles.header}>
          <Header />
          <View style={styles.radii}>
            {RADII_KM.map((km) => (
              <Pressable
                key={km}
                role="radio"
                aria-checked={radius === km}
                onPress={() => setRadius(km)}
                style={[
                  styles.radius,
                  { backgroundColor: radius === km ? theme.backgroundSelected : 'transparent' },
                ]}>
                <ThemedText type="small">{t('nearby.within', { km })}</ThemedText>
              </Pressable>
            ))}
          </View>
          <FeedFilterBar {...filterState} />
        </View>
      }
      renderItem={(event) => <EventCard event={event} distanceM={event.distance_m} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={t('nearby.empty')}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
  },
  radii: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  radius: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
});
