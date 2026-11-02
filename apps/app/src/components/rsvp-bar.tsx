import {
  eventsAttendanceDestroy,
  eventsAttendanceUpdate,
  eventsRetrieveQueryKey,
  feedsUpcomingListInfiniteQueryKey,
  meAttendingListInfiniteQueryKey,
  type AttendanceSummary,
  type Event,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';

import { Button } from './button';
import { ThemedText } from './themed-text';

type Wants = 'going' | 'interested' | null;

/** Going / Interested buttons for an event, updated instantly and confirmed by the server. */
export function RsvpBar({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = eventsRetrieveQueryKey({ path: { id: event.id } });
  const { attendance } = event;
  const mine = attendance.mine;

  const setAttendance = (summary: AttendanceSummary) =>
    queryClient.setQueryData<Event>(queryKey, (old) => old && { ...old, attendance: summary });

  const update = useMutation({
    mutationFn: async (wants: Wants) => {
      const options = { path: { id: event.id }, throwOnError: true } as const;
      const { data } = wants
        ? await eventsAttendanceUpdate({ ...options, body: { status: wants } })
        : await eventsAttendanceDestroy(options);
      return data;
    },
    onMutate: (wants) => {
      const previous = attendance;
      // Show the choice right away; the server's answer replaces it (e.g. waitlisted).
      setAttendance({ ...attendance, mine: wants });
      return { previous };
    },
    onError: (_error, _wants, context) => context && setAttendance(context.previous),
    onSuccess: (summary) => {
      setAttendance(summary);
      queryClient.invalidateQueries({ queryKey: feedsUpcomingListInfiniteQueryKey() });
      queryClient.invalidateQueries({ queryKey: meAttendingListInfiniteQueryKey() });
    },
  });

  const choose = (wants: 'going' | 'interested') => {
    if (status !== 'signed-in') {
      router.push('/sign-in');
      return;
    }
    const current = mine === 'waitlisted' ? 'going' : mine;
    update.mutate(current === wants ? null : wants);
  };

  const goingSelected = mine === 'going' || mine === 'waitlisted';

  return (
    <View style={styles.bar}>
      <View style={styles.buttons}>
        <View style={styles.button}>
          <Button
            title={mine === 'waitlisted' ? t('rsvp.waitlisted') : t('rsvp.going')}
            variant={goingSelected ? 'primary' : 'secondary'}
            onPress={() => choose('going')}
          />
        </View>
        <View style={styles.button}>
          <Button
            title={t('rsvp.interested')}
            variant={mine === 'interested' ? 'primary' : 'secondary'}
            onPress={() => choose('interested')}
          />
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {[
          t('rsvp.goingCount', { count: attendance.going }),
          t('rsvp.interestedCount', { count: attendance.interested }),
          event.capacity ? t('rsvp.capacity', { count: event.capacity }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      {attendance.is_full && !goingSelected ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('rsvp.fullHint')}
        </ThemedText>
      ) : null}
      {mine === 'waitlisted' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('rsvp.waitlistHint')}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
