import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearance } from '@/lib/appearance';

/** Light or dark: the appearance chosen in Settings, or the device's. */
export function useColorScheme() {
  const system = useSystemColorScheme();
  const chosen = useAppearance();
  return chosen === 'system' ? system : chosen;
}
