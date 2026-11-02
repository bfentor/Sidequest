import type { Notification } from '@sidequest/api';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';

function describe(notification: Notification, t: TFunction) {
  const name = notification.actor?.display_name ?? '';
  // A deleted event's title is kept in the message.
  const title = notification.event?.title ?? notification.message ?? '';
  switch (notification.kind) {
    case 'new_follower':
      return t('notifications.newFollower', { name });
    case 'follow_request':
      return t('notifications.followRequest', { name });
    case 'follow_accepted':
      return t('notifications.followAccepted', { name });
    case 'organization_invite':
      return t('notifications.organizationInvite', { name });
    case 'new_event':
      return t('notifications.newEvent', { name, title });
    case 'event_changed':
      return t('notifications.eventChanged', { title });
    case 'event_cancelled':
      return t('notifications.eventCancelled', { title });
    case 'event_postponed':
      return t('notifications.eventPostponed', { title });
    case 'co_host_invite':
      return t('notifications.coHostInvite', { name, title });
    case 'event_reminder':
      return t('notifications.eventReminder', { title });
    case 'waitlist_promoted':
      return t('notifications.waitlistPromoted', { title });
    case 'announcement':
      return t('notifications.announcement', { name, title, message: notification.message });
    case 'mention':
      return t('notifications.mention', { name });
    case 'comment':
      return t('notifications.comment', { name });
    case 'reaction':
      return t('notifications.reaction', { name });
  }
}

function open(notification: Notification) {
  if (notification.kind === 'follow_request') {
    router.push('/follow-requests');
  } else if (notification.kind === 'organization_invite') {
    router.push('/organizations');
  } else if (notification.post) {
    router.push({ pathname: '/posts/[id]', params: { id: notification.post } });
  } else if (notification.event) {
    router.push({ pathname: '/events/[id]', params: { id: notification.event.id } });
  } else if (notification.actor) {
    router.push({ pathname: '/profiles/[handle]', params: { handle: notification.actor.handle } });
  }
}

export function NotificationItem({ notification }: { notification: Notification }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();

  return (
    <Pressable
      onPress={() => open(notification)}
      style={({ pressed }) => [
        styles.item,
        !notification.read && { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Avatar
        name={notification.actor?.display_name ?? 'Sidequest'}
        image={notification.actor?.avatar}
        size={40}
      />
      <View style={styles.text}>
        <ThemedText>{describe(notification, t)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {format.dateTime(notification.created_at)}
        </ThemedText>
      </View>
      {!notification.read ? (
        <View
          style={[styles.dot, { backgroundColor: theme.tint }]}
          accessibilityLabel={t('notifications.unread')}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.7,
  },
});
