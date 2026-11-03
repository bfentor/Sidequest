import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const CHART_HEIGHT = 56;
const GAP = 2;
// Columns never get wider than this, however wide the tile.
const MAX_COLUMN = 24;

type StatTileProps = {
  title: string;
  /** The headline number. */
  value: number;
  /** Under the number, e.g. "Last 30 days". */
  caption: string;
  /** One value per day, oldest first, with the matching ISO dates. */
  daily: number[];
  days: string[];
};

/**
 * A headline number with a column per day under it. Tapping (or hovering
 * over) a column shows that day's value.
 */
export function StatTile({ title, value, caption, daily, days }: StatTileProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...daily);
  const slot = daily.length ? (width - GAP * (daily.length - 1)) / daily.length : 0;
  const column = Math.max(1, Math.min(MAX_COLUMN, slot));
  const radius = Math.min(4, column / 2);

  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="title">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {selected === null
          ? caption
          : t('dashboard.day', { date: format.date(days[selected]), count: daily[selected] })}
      </ThemedText>
      <View
        style={styles.chart}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityLabel={t('dashboard.chartLabel', {
          title,
          total: daily.reduce((sum, n) => sum + n, 0),
        })}>
        {width
          ? daily.map((count, index) => (
              <Pressable
                key={days[index]}
                accessibilityLabel={t('dashboard.day', {
                  date: format.date(days[index]),
                  count,
                })}
                onPress={() => setSelected(selected === index ? null : index)}
                onHoverIn={() => setSelected(index)}
                onHoverOut={() => setSelected(null)}
                style={[styles.slot, { width: slot }]}>
                {count ? (
                  <View
                    style={{
                      width: column,
                      height: Math.max(2, (count / max) * CHART_HEIGHT),
                      backgroundColor: theme.tint,
                      borderTopLeftRadius: radius,
                      borderTopRightRadius: radius,
                      opacity: selected === null || selected === index ? 1 : 0.4,
                    }}
                  />
                ) : null}
              </Pressable>
            ))
          : null}
      </View>
      <View style={[styles.baseline, { backgroundColor: theme.textSecondary }]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 220,
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: GAP,
    height: CHART_HEIGHT,
    marginTop: Spacing.two,
  },
  slot: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  baseline: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.4,
  },
});
