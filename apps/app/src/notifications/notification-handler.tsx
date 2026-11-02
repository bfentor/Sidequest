import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/auth/auth-provider';

import { refreshPushRegistration } from './push';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function open(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string') {
    // The API builds these paths (notifications/push.py `link`) from the app's routes.
    router.push(url as Href);
  }
}

/** Opens the screen a tapped push notification points to, and keeps the push token current. */
export function NotificationHandler() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'signed-in') {
      refreshPushRegistration();
    }
  }, [status]);

  useEffect(() => {
    // The app may have been started by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);

  return null;
}
