import { pushDevicesCreate, pushDevicesDestroy } from '@sidequest/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { preferences } from '@/lib/preferences';

export type PushSupport = 'ready' | 'denied' | 'ask' | 'unavailable';

const TOKEN_KEY = 'push-token';

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

/** Whether push can be turned on: needs a real phone and the EAS project (`eas init`). */
export async function pushSupport(): Promise<PushSupport> {
  if (!Device.isDevice || !projectId()) {
    return 'unavailable';
  }
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    return 'ready';
  }
  return canAskAgain ? 'ask' : 'denied';
}

/** Asks for permission if needed and registers this phone with the API. */
export async function enablePush(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const { error } = await pushDevicesCreate({ body: { token } });
  if (error) {
    return false;
  }
  await preferences.set(TOKEN_KEY, token);
  return true;
}

/** Re-registers on start-up, in case the token changed or another account used this phone. */
export async function refreshPushRegistration() {
  if ((await pushSupport()) === 'ready') {
    await enablePush();
  }
}

/** Stops pushes to this phone, e.g. when signing out. */
export async function disablePush() {
  const token = await preferences.get(TOKEN_KEY);
  if (token) {
    await pushDevicesDestroy({ path: { token } });
  }
  await forgetPushToken();
}

/** Forgets this phone's registration locally (the server already did, e.g. account deleted). */
export async function forgetPushToken() {
  await preferences.remove(TOKEN_KEY);
}
