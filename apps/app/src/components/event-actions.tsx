import type { Event } from '@sidequest/api';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { eventIcs, googleCalendarUrl } from '@/lib/calendar';
import { WEB_URL } from '@/lib/config';
import { saveTextFile } from '@/lib/save-file';
import { shareLink } from '@/lib/share';

import { ActionMenu } from './action-menu';
import { Button } from './button';
import { ThemedText } from './themed-text';

function eventUrl(event: Pick<Event, 'id'>) {
  return `${WEB_URL}/events/${event.id}`;
}

/**
 * "Add to calendar" (a calendar file or Google Calendar), "Share", and for
 * signed-in people, posting about the event to their followers.
 */
export function EventActions({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = eventUrl(event);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if ((await shareLink(event.title, url)) === 'copied') setCopied(true);
  };

  return (
    <View style={styles.column}>
      <View style={styles.row}>
        <View style={styles.button}>
          <Button
            title={t('eventActions.addToCalendar')}
            variant="secondary"
            onPress={() => setCalendarOpen(true)}
          />
        </View>
        <View style={styles.button}>
          <Button title={t('eventActions.share')} variant="secondary" onPress={share} />
        </View>
      </View>
      {status === 'signed-in' && event.status !== 'cancelled' ? (
        <Button
          title={t('eventActions.postAbout')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/posts/new', params: { event: event.id } })}
        />
      ) : null}
      {copied ? (
        <ThemedText type="small" themeColor="textSecondary" role="status">
          {t('eventActions.linkCopied')}
        </ThemedText>
      ) : null}
      <ActionMenu
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        title={t('eventActions.addToCalendar')}
        actions={[
          {
            label: t('eventActions.calendarFile'),
            onPress: () =>
              saveTextFile(`event-${event.id}.ics`, eventIcs(event, url), 'text/calendar'),
          },
          {
            label: t('eventActions.googleCalendar'),
            onPress: () => Linking.openURL(googleCalendarUrl(event, url)),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
