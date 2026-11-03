import type { Event } from '@sidequest/api';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

import { useEventPanel } from './event-panel';
import { FriendsGoing } from './friends-going';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type EventCardProps = {
  event: Event;
  /** Shown in the nearby feed. */
  distanceM?: number;
};

export function EventCard({ event, distanceM }: EventCardProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const place = [event.venue_name, distanceM !== undefined && format.distance(distanceM)]
    .filter(Boolean)
    .join(' · ');
  const going = event.attendance.going;
  const panel = useEventPanel();
  const theme = useTheme();
  const selected = panel?.selected === event.id;

  const card = (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: selected ? theme.tint : 'transparent' }]}>
      <ThemedText type="smallBold" themeColor={event.status === 'active' ? 'tint' : 'danger'}>
        {event.status === 'active'
          ? format.eventTime(event.starts_at, event.ends_at)
          : `${t(`eventStatus.${event.status ?? 'active'}`)} · ${format.eventTime(event.starts_at, event.ends_at)}`}
      </ThemedText>
      {!event.published_at ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('eventStatus.draft')}
        </ThemedText>
      ) : null}
      <ThemedText type="heading">{event.title}</ThemedText>
      {place ? (
        <ThemedText type="small" themeColor="textSecondary">
          {place}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {[
          t('common.byOrganizer', { name: event.organizer.display_name }),
          going > 0 ? t('rsvp.goingCount', { count: going }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      <FriendsGoing attendance={event.attendance} />
    </ThemedView>
  );

  // Wide desktop browsers show the event beside the feed; elsewhere it opens as a page.
  if (panel) {
    return (
      <Pressable
        role="link"
        aria-current={selected}
        onPress={() => panel.open(event.id)}
        style={({ pressed }) => pressed && styles.pressed}>
        {card}
      </Pressable>
    );
  }
  return (
    <Link href={{ pathname: '/events/[id]', params: { id: event.id } }} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>{card}</Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    // Coloured when the card's event is open in the side panel.
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
