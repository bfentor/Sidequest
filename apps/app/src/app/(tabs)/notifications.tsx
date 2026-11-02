import {
  notificationsReadCreate,
  notificationsUnreadRetrieveQueryKey,
  useNotifications,
} from '@sidequest/api';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { FeedList } from '@/components/feed-list';
import { NotificationItem } from '@/components/notification-item';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { enablePush, pushSupport, type PushSupport } from '@/notifications/push';

export default function NotificationsScreen() {
  const { status } = useAuth();
  const { t } = useTranslation();

  if (status === 'signed-in') {
    return <Inbox />;
  }

  return (
    <Screen>
      <ThemedText type="subtitle">{t('tabs.notifications')}</ThemedText>
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">{t('notifications.signInPrompt')}</ThemedText>
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        </>
      )}
    </Screen>
  );
}

function Inbox() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notifications = useNotifications();

  // Everything shown counts as seen once the inbox has been open for a moment.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(async () => {
        await notificationsReadCreate({ body: {} });
        queryClient.invalidateQueries({ queryKey: notificationsUnreadRetrieveQueryKey() });
      }, 1500);
      return () => clearTimeout(timer);
    }, [queryClient]),
  );

  return (
    <FeedList
      query={notifications}
      header={
        <View>
          <ThemedText type="subtitle">{t('tabs.notifications')}</ThemedText>
          <PushPrompt />
        </View>
      }
      renderItem={(notification) => <NotificationItem notification={notification} />}
      keyExtractor={(notification) => String(notification.id)}
      emptyText={t('notifications.empty')}
    />
  );
}

/** Offers push notifications on phones where they're possible but not on yet. */
function PushPrompt() {
  const { t } = useTranslation();
  const [support, setSupport] = useState<PushSupport>('unavailable');

  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);

  if (support === 'ask') {
    return (
      <View>
        <ThemedText themeColor="textSecondary">{t('notifications.pushPrompt')}</ThemedText>
        <Button
          title={t('notifications.enablePush')}
          onPress={async () => setSupport((await enablePush()) ? 'ready' : await pushSupport())}
        />
      </View>
    );
  }
  if (support === 'denied') {
    return <ThemedText themeColor="textSecondary">{t('notifications.pushDenied')}</ThemedText>;
  }
  return null;
}
