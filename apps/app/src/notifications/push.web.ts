// Expo's push service only reaches the iOS and Android apps.
export type PushSupport = 'ready' | 'denied' | 'ask' | 'unavailable';

export async function pushSupport(): Promise<PushSupport> {
  return 'unavailable';
}

export async function enablePush(): Promise<boolean> {
  return false;
}

export async function refreshPushRegistration() {}

export async function disablePush() {}

export async function forgetPushToken() {}
