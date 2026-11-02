import type { Event, LatLng } from '@sidequest/api';
// Metro warns about the image URLs inside; they're for default icons and controls this map doesn't use.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EventMapProps = {
  center: LatLng;
  radiusKm: number;
  events: Event[];
  onSelect: (event: Event) => void;
};

type LoadedMap = {
  L: typeof import('leaflet');
  map: import('leaflet').Map;
  markers: import('leaflet').LayerGroup;
};

/** Roughly fits a circle of `radiusKm` around the center on a phone-sized map. */
export function zoomFor(radiusKm: number) {
  return Math.round(14 - Math.log2(radiusKm));
}

/**
 * Events with a location as markers on an OpenStreetMap map (Leaflet).
 * Clicking a marker selects its event.
 */
export function EventMap({ center, radiusKm, events, onSelect }: EventMapProps) {
  const theme = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);

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
      created = { L, map, markers: L.layerGroup().addTo(map) };
      setLoaded(created);
    });
    return () => {
      cancelled = true;
      created?.map.remove();
    };
  }, []);

  useEffect(() => {
    loaded?.map.setView([center.lat, center.lng], zoomFor(radiusKm));
  }, [loaded, center.lat, center.lng, radiusKm]);

  useEffect(() => {
    if (!loaded) return;
    const { L, markers } = loaded;
    markers.clearLayers();
    for (const event of events) {
      if (!event.location) continue;
      L.circleMarker([event.location.lat, event.location.lng], {
        radius: 9,
        color: theme.background,
        weight: 2,
        fillColor: theme.tint,
        fillOpacity: 1,
      })
        .bindTooltip(event.title)
        .on('click', () => onSelect(event))
        .addTo(markers);
    }
  }, [loaded, events, theme, onSelect]);

  // Leaflet draws into a DOM element of its own.
  return <div ref={container} style={{ ...MAP_STYLE, backgroundColor: theme.backgroundElement }} />;
}

const MAP_STYLE = {
  height: 360,
  borderRadius: Spacing.three,
  overflow: 'hidden',
  // Keeps Leaflet's panes below the app's navigation and dialogs.
  zIndex: 0,
} as const;
