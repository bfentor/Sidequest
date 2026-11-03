import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { screenStyles } from './screen';
import { SkeletonList } from './skeleton';
import { ThemedText } from './themed-text';

/** The parts of a TanStack infinite query over paginated results that a feed needs. */
export type FeedQuery<T> = {
  data?: { pages: { results: T[] }[] };
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
};

type FeedListProps<T> = {
  query: FeedQuery<T>;
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  header?: ReactElement;
  emptyText: string;
  /** Set when a navigation header already handles the top inset. */
  hasHeader?: boolean;
};

/** Infinite-scrolling, pull-to-refresh list for any of the feeds. */
export function FeedList<T>({
  query,
  renderItem,
  keyExtractor,
  header,
  emptyText,
  hasHeader,
}: FeedListProps<T>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const items = query.data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => renderItem(item)}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={
        query.isPending ? (
          <View style={styles.skeleton}>
            <SkeletonList />
          </View>
        ) : query.isError ? (
          <View style={styles.status}>
            <ThemedText themeColor="textSecondary">{t('feed.loadFailed')}</ThemedText>
            <Button
              title={t('common.tryAgain')}
              variant="secondary"
              onPress={() => query.refetch()}
            />
          </View>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.status}>
            {emptyText}
          </ThemedText>
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator /> : undefined}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            query.refetch();
          }}
        />
      }
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        screenStyles.content,
        {
          paddingTop: (hasHeader ? 0 : insets.top) + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    paddingTop: Spacing.three,
  },
  status: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
    textAlign: 'center',
  },
});
