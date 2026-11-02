import { useNearbyFeed, type LatLng } from '@sidequest/api';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/button';
import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useCurrentPosition } from '@/hooks/use-current-position';

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

function NearbyFeed({ position }: { position: LatLng }) {
  const feed = useNearbyFeed(position);
  const { t } = useTranslation();

  return (
    <FeedList
      query={feed}
      header={<Header />}
      renderItem={(event) => <EventCard event={event} distanceM={event.distance_m} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={t('nearby.empty')}
    />
  );
}
