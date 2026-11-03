import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

const subscribe = () => () => {};

/**
 * The server can't know the visitor's color scheme, so render 'light' on the
 * server and during hydration, then switch to the real value on the client:
 * the appearance chosen in Settings, or the browser's.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const colorScheme = useRNColorScheme();
  const chosen = useAppearance();

  if (!hasHydrated) return 'light';
  return chosen === 'system' ? colorScheme : chosen;
}
