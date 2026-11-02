import {
  eventsFeedbackMineRetrieveOptions,
  eventsFeedbackMineRetrieveQueryKey,
  eventsFeedbackMineUpdate,
  type Event,
  type MyFeedback,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { IconButton } from './icon-button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Five stars to pick a rating from, or to show one when `onChange` is left out. */
export function Stars({
  value,
  onChange,
  size = 28,
}: {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const icons = [1, 2, 3, 4, 5].map((star) => {
    const filled = value !== null && star <= value;
    return {
      star,
      color: filled ? theme.tint : theme.textSecondary,
      icon: filled
        ? ({ ios: 'star.fill', material: 'star' } as const)
        : ({ ios: 'star', material: 'star_border' } as const),
    };
  });

  if (!onChange) {
    return (
      <View
        style={styles.stars}
        role="img"
        accessibilityLabel={t('feedback.stars', { count: value ?? 0 })}>
        {icons.map(({ star, icon, color }) => (
          <SymbolView
            key={star}
            name={{ ios: icon.ios, android: icon.material, web: icon.material }}
            size={size}
            tintColor={color}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.stars} role="radiogroup">
      {icons.map(({ star, icon, color }) => (
        <IconButton
          key={star}
          icon={icon}
          label={t('feedback.stars', { count: star })}
          size={size}
          color={color}
          onPress={() => onChange(star)}
        />
      ))}
    </View>
  );
}

/** "How was it?" on an event that has ended, for people who were going. */
export function EventFeedback({ event }: { event: Event }) {
  const { status } = useAuth();
  const ended = new Date(event.ends_at) <= new Date();
  const mine = useQuery({
    ...eventsFeedbackMineRetrieveOptions({ path: { id: event.id } }),
    enabled: status === 'signed-in' && ended,
  });

  if (!mine.data?.can_give) {
    return null;
  }
  // Remounts with the saved answer after sending, which shows the thank-you.
  return <FeedbackForm key={mine.dataUpdatedAt} eventId={event.id} saved={mine.data} />;
}

function FeedbackForm({ eventId, saved }: { eventId: number; saved: MyFeedback }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(saved.rating);
  const [comment, setComment] = useState(saved.comment);
  const send = useMutation({
    mutationFn: async () =>
      (
        await eventsFeedbackMineUpdate({
          path: { id: eventId },
          body: { rating: rating ?? 0, comment },
          throwOnError: true,
        })
      ).data,
    onSuccess: (data) =>
      queryClient.setQueryData(eventsFeedbackMineRetrieveQueryKey({ path: { id: eventId } }), data),
  });
  const unchanged = saved.rating !== null && rating === saved.rating && comment === saved.comment;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t('feedback.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('feedback.hint')}
      </ThemedText>
      <Stars value={rating} onChange={setRating} />
      {rating !== null ? (
        <TextField
          label={t('feedback.comment')}
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={1000}
          style={styles.comment}
        />
      ) : null}
      {unchanged ? (
        <ThemedText role="status">{t('feedback.thanks')}</ThemedText>
      ) : (
        <Button
          title={saved.rating === null ? t('feedback.send') : t('feedback.update')}
          disabled={rating === null}
          loading={send.isPending}
          onPress={() => send.mutate()}
        />
      )}
      {send.isError ? <ThemedText themeColor="danger">{t('errors.unexpected')}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  stars: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  comment: {
    minHeight: 80,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
});
