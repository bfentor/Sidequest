import type { Event } from '@sidequest/api';
import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatDistance, formatEventTime } from '@/lib/format';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type EventCardProps = {
  event: Event;
  /** Shown in the nearby feed. */
  distanceM?: number;
};

export function EventCard({ event, distanceM }: EventCardProps) {
  const place = [event.venue_name, distanceM !== undefined && formatDistance(distanceM)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={{ pathname: '/events/[id]', params: { id: event.id } }} asChild>
      <Pressable style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="tint">
            {formatEventTime(event.starts_at, event.ends_at)}
          </ThemedText>
          <ThemedText type="heading">{event.title}</ThemedText>
          {place ? (
            <ThemedText type="small" themeColor="textSecondary">
              {place}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            by {event.organizer.display_name}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
