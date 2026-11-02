import { geocodeListOptions, type LatLng } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { LocationPin } from './location-pin';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';

export type Place = { address: string; location: LatLng | null };

type LocationSearchProps = {
  value: Place;
  onChange: (place: Place) => void;
};

/**
 * Address field that suggests places as you type and stores the chosen one's
 * coordinates, with a map to place or adjust the pin by hand.
 */
export function LocationSearch({ value, onChange }: LocationSearchProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState(value.address);
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  // Where the map looks: the picked suggestion, not every move of the pin.
  const [mapCenter, setMapCenter] = useState<LatLng | null>(value.location);
  const [mapOpen, setMapOpen] = useState(value.location !== null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    ...geocodeListOptions({ query: { q: debounced } }),
    enabled: open && debounced.length >= 3,
    staleTime: 60 * 60 * 1000,
  });

  return (
    <View style={styles.field}>
      <TextField
        label={t('eventForm.address')}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
          // Typing a new address forgets the old coordinates until a match is picked.
          onChange({ address: text, location: null });
        }}
        autoCorrect={false}
      />
      {value.location ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('eventForm.locationSet')}
        </ThemedText>
      ) : query.trim() ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('eventForm.locationHint')}
        </ThemedText>
      ) : null}
      {open && results.isFetching ? <ActivityIndicator /> : null}
      {open && results.data?.length ? (
        <View style={[styles.results, { backgroundColor: theme.backgroundElement }]}>
          {results.data.map((place) => (
            <Pressable
              key={`${place.lat},${place.lng}`}
              role="option"
              onPress={() => {
                const location = { lat: place.lat, lng: place.lng };
                setQuery(place.label);
                setOpen(false);
                setMapCenter(location);
                setMapOpen(true);
                onChange({ address: place.label, location });
              }}
              style={({ pressed }) => [styles.result, pressed && { opacity: 0.6 }]}>
              <ThemedText type="small">{place.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {mapOpen ? (
        <>
          <LocationPin
            value={value.location}
            center={mapCenter}
            onChange={(location) => onChange({ address: value.address, location })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('eventForm.mapHint')}
          </ThemedText>
        </>
      ) : (
        <Button
          title={t('eventForm.placeOnMap')}
          variant="secondary"
          onPress={() => setMapOpen(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  results: {
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  result: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
