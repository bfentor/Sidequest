import type { Event, LatLng } from '@sidequest/api';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Platform, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

type EventMapProps = {
  center: LatLng;
  radiusKm: number;
  events: Event[];
  onSelect: (event: Event) => void;
};

/** Roughly fits a circle of `radiusKm` around the center on a phone-sized map. */
export function zoomFor(radiusKm: number) {
  return Math.round(14 - Math.log2(radiusKm));
}

/**
 * Events with a location as markers, on Apple Maps (iOS) or Google Maps
 * (Android). Tapping a marker selects its event; on iOS that needs iOS 18,
 * older versions show the title only.
 */
export function EventMap({ center, radiusKm, events, onSelect }: EventMapProps) {
  const markers = events.flatMap((event) =>
    event.location
      ? [
          {
            id: String(event.id),
            title: event.title,
            coordinates: { latitude: event.location.lat, longitude: event.location.lng },
          },
        ]
      : [],
  );
  const cameraPosition = {
    coordinates: { latitude: center.lat, longitude: center.lng },
    zoom: zoomFor(radiusKm),
  };
  const select = (marker: { id?: string }) => {
    const event = events.find((candidate) => String(candidate.id) === marker.id);
    if (event) onSelect(event);
  };

  return Platform.OS === 'ios' ? (
    <AppleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      properties={{ isMyLocationEnabled: true }}
      onMarkerClick={select}
    />
  ) : (
    <GoogleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      properties={{ isMyLocationEnabled: true }}
      onMarkerClick={select}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    height: 360,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
});
