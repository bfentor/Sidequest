// Metro warns about the image URLs inside; they're for default icons and controls this map doesn't use.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { cameraFor, type LocationPinProps } from './location-pin.shared';

type LoadedMap = {
  L: typeof import('leaflet');
  map: import('leaflet').Map;
  pin: import('leaflet').LayerGroup;
};

/** A map with the event's pin (OpenStreetMap via Leaflet); clicking the map moves the pin there. */
export function LocationPin({ value, center, onChange }: LocationPinProps) {
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  // The latest callback, for the click handler registered once.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let created: LoadedMap | null = null;
    // Leaflet touches `window` when imported, so it loads in the browser only.
    import('leaflet').then((L) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on('click', ({ latlng }) => onChangeRef.current({ lat: latlng.lat, lng: latlng.lng }));
      created = { L, map, pin: L.layerGroup().addTo(map) };
      setLoaded(created);
    });
    return () => {
      cancelled = true;
      created?.map.remove();
    };
  }, []);

  useEffect(() => {
    const { lat, lng, zoom } = cameraFor(center);
    loaded?.map.setView([lat, lng], zoom);
  }, [loaded, center]);

  useEffect(() => {
    if (!loaded) return;
    const { L, pin } = loaded;
    pin.clearLayers();
    if (value) {
      L.circleMarker([value.lat, value.lng], {
        radius: 9,
        color: theme.background,
        weight: 2,
        fillColor: theme.tint,
        fillOpacity: 1,
      }).addTo(pin);
    }
  }, [loaded, value, theme]);

  // Leaflet draws into a DOM element of its own.
  return <div ref={container} style={{ ...MAP_STYLE, backgroundColor: theme.backgroundElement }} />;
}

const MAP_STYLE = {
  height: 240,
  borderRadius: Spacing.three,
  overflow: 'hidden',
  cursor: 'crosshair',
  // Keeps Leaflet's panes below the app's navigation and dialogs.
  zIndex: 0,
} as const;
