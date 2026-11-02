import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'sidequest.';

/**
 * Small, non-secret settings kept on the device (localStorage on the web).
 * Secrets such as the session token use auth/token-storage instead.
 */
export const preferences = {
  get: (key: string) => AsyncStorage.getItem(PREFIX + key),
  set: (key: string, value: string) => AsyncStorage.setItem(PREFIX + key, value),
  remove: (key: string) => AsyncStorage.removeItem(PREFIX + key),
};
