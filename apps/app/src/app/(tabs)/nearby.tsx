import { useNearbyFeed, type LatLng } from '@sidequest/api';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/button';
import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useCurrentPosition } from '@/hooks/use-current-position';

const header = <ThemedText type="subtitle">Nearby</ThemedText>;

export default function NearbyScreen() {
  const { permission, requestPermission, position, failed } = useCurrentPosition();

  if (position) {
    return <NearbyFeed position={position} />;
  }

  return (
    <Screen>
      {header}
      {!permission ? (
        <ActivityIndicator />
      ) : permission.granted ? (
        failed ? (
          <ThemedText themeColor="textSecondary">Couldn&apos;t determine your location.</ThemedText>
        ) : (
          <ActivityIndicator />
        )
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            {permission.canAskAgain
              ? 'Share your location to see events around you. It is only used to sort events and is never stored.'
              : 'Location access is turned off for Sidequest. Enable it in your settings to see events around you.'}
          </ThemedText>
          {permission.canAskAgain ? (
            <Button title="Use my location" onPress={requestPermission} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function NearbyFeed({ position }: { position: LatLng }) {
  const feed = useNearbyFeed(position);

  return (
    <FeedList
      query={feed}
      header={header}
      renderItem={(event) => <EventCard event={event} distanceM={event.distance_m} />}
      keyExtractor={(event) => String(event.id)}
      emptyText="No events near you right now."
    />
  );
}
