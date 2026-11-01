import type { LatLng } from '@sidequest/api';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/**
 * The device's approximate position, once the user has granted permission.
 * Permission is never requested automatically; call `requestPermission` from
 * a user action.
 */
export function useCurrentPosition() {
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [position, setPosition] = useState<LatLng | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      return;
    }
    let cancelled = false;
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        if (!cancelled) setPosition({ lat: coords.latitude, lng: coords.longitude });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [permission?.granted]);

  return { permission, requestPermission, position, failed };
}
