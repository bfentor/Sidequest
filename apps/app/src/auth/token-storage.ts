import * as SecureStore from 'expo-secure-store';

const KEY = 'sidequest.session-token';

/** Persists the session token in the iOS Keychain / Android Keystore. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
