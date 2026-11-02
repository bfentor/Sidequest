import type { FeedFilters } from '@sidequest/api';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';
import { timeWindow, type TimeWindow } from '@/lib/time-windows';

import { ThemedText } from './themed-text';

type ChipProps = { label: string; selected: boolean; onPress: () => void };

function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={selected}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.tint : theme.backgroundElement }]}>
      <ThemedText type="small" style={selected && { color: theme.onTint }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Filter state for a feed, turned into API filters. */
export function useFeedFilters() {
  const [when, setWhen] = useState<TimeWindow>('any');
  const [free, setFree] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  // The window is computed when the choice changes, not on every render.
  const [now, setNow] = useState(() => new Date());

  const filters = useMemo<FeedFilters>(() => {
    const window = timeWindow(when, now);
    return {
      ...(categories.length ? { category: categories } : {}),
      ...(free ? { free: true } : {}),
      ...(window
        ? { starts_after: window[0].toISOString(), starts_before: window[1].toISOString() }
        : {}),
    };
  }, [when, now, free, categories]);

  return {
    filters,
    when,
    setWhen: (next: TimeWindow) => {
      setNow(new Date());
      setWhen(next);
    },
    free,
    setFree,
    categories,
    toggleCategory: (slug: string) =>
      setCategories((current) =>
        current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
      ),
  };
}

type FeedFilterBarProps = ReturnType<typeof useFeedFilters>;

/** Quick time filters, free only, and categories, in two scrollable rows. */
export function FeedFilterBar({
  when,
  setWhen,
  free,
  setFree,
  categories,
  toggleCategory,
}: FeedFilterBarProps) {
  const { t } = useTranslation();
  const { categories: all } = useCategories();
  const windows = ['today', 'tonight', 'weekend'] as const;

  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {windows.map((window) => (
          <Chip
            key={window}
            label={t(`filters.${window}`)}
            selected={when === window}
            onPress={() => setWhen(when === window ? 'any' : window)}
          />
        ))}
        <Chip label={t('filters.free')} selected={free} onPress={() => setFree(!free)} />
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {all.map((category) => (
          <Chip
            key={category.slug}
            label={category.name}
            selected={categories.includes(category.slug)}
            onPress={() => toggleCategory(category.slug)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
});
