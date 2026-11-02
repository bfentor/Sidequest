import type { AndroidSymbol } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Read-only chips for an event's categories. */
export function CategoryChips({ slugs }: { slugs: string[] }) {
  const { bySlug } = useCategories();
  const theme = useTheme();
  const categories = slugs.flatMap((slug) => bySlug.get(slug) ?? []);

  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {categories.map((category) => (
        <ThemedView key={category.slug} type="backgroundElement" style={styles.chip}>
          {/* Icon names come from the server; an unknown one simply renders nothing. */}
          {category.icon ? (
            <SymbolView
              name={{
                web: category.icon as AndroidSymbol,
                android: category.icon as AndroidSymbol,
              }}
              size={16}
              tintColor={theme.textSecondary}
            />
          ) : null}
          <ThemedText type="small">{category.name}</ThemedText>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
});
