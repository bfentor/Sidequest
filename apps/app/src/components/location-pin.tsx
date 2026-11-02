import type { LatLng } from '@sidequest/api';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

import { cameraFor, type LocationPinProps } from './location-pin.shared';

/** A map with the event's pin; tapping the map moves the pin there. */
export function LocationPin({ value, center, onChange }: LocationPinProps) {
  const cameraPosition = useMemo(() => {
    const { lat, lng, zoom } = cameraFor(center);
    return { coordinates: { latitude: lat, longitude: lng }, zoom };
  }, [center]);
  const markers = value
    ? [{ id: 'pin', coordinates: { latitude: value.lat, longitude: value.lng } }]
    : [];
  const pick = ({ coordinates }: { coordinates: { latitude?: number; longitude?: number } }) => {
    if (coordinates.latitude !== undefined && coordinates.longitude !== undefined) {
      onChange({ lat: coordinates.latitude, lng: coordinates.longitude } satisfies LatLng);
    }
  };

  return Platform.OS === 'ios' ? (
    <AppleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      onMapClick={pick}
    />
  ) : (
    <GoogleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      onMapClick={pick}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    height: 240,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
});
