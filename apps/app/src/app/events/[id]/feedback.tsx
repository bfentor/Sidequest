import { eventsFeedbackRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Stars } from '@/components/event-feedback';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

/** What people who went thought of the event, without names (hosts only). */
export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const { data, isPending, isError } = useQuery(
    eventsFeedbackRetrieveOptions({ path: { id: Number(id) } }),
  );

  if (isPending) {
    return <ActivityIndicator style={styles.loading} />;
  }

  return (
    <Screen hasHeader>
      {isError ? (
        <ThemedText themeColor="textSecondary">{t('errors.unexpected')}</ThemedText>
      ) : data.count === 0 ? (
        <ThemedText themeColor="textSecondary">{t('feedback.empty')}</ThemedText>
      ) : (
        <>
          <View style={styles.summary}>
            <ThemedText type="title">{format.rating(data.average ?? 0)}</ThemedText>
            <View>
              <Stars value={Math.round(data.average ?? 0)} size={20} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('feedback.count', { count: data.count })}
              </ThemedText>
            </View>
          </View>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = data.ratings[rating - 1] ?? 0;
            return (
              <View
                key={rating}
                style={styles.row}
                accessibilityLabel={`${t('feedback.stars', { count: rating })}: ${count}`}>
                <ThemedText type="small" style={styles.rowLabel}>
                  {rating}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${(count / data.count) * 100}%`, backgroundColor: theme.tint },
                    ]}
                  />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary" style={styles.rowCount}>
                  {count}
                </ThemedText>
              </View>
            );
          })}
          {data.comments.length ? (
            <ThemedText type="smallBold">{t('feedback.comments')}</ThemedText>
          ) : null}
          {data.comments.map((comment, index) => (
            <ThemedView key={index} type="backgroundElement" style={styles.comment}>
              <Stars value={comment.rating} size={14} />
              <ThemedText>{comment.comment}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {format.dateTime(comment.created_at)}
              </ThemedText>
            </ThemedView>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 64,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    width: 12,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
  rowCount: {
    width: 28,
    textAlign: 'right',
  },
  comment: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
