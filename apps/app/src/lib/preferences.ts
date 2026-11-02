import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

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

/** An on/off preference; `fallback` until the stored value has loaded. */
export function useBooleanPreference(key: string, fallback: boolean) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let current = true;
    preferences.get(key).then((stored) => {
      if (current && stored !== null) {
        setValue(stored === 'true');
      }
    });
    return () => {
      current = false;
    };
  }, [key]);

  const update = (next: boolean) => {
    setValue(next);
    void preferences.set(key, String(next));
  };
  return [value, update] as const;
}
