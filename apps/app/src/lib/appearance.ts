import { useSyncExternalStore } from 'react';
import { Appearance as SystemAppearance } from 'react-native';

import { preferences } from './preferences';

export type Appearance = 'system' | 'light' | 'dark';

const PREFERENCE_KEY = 'appearance';
const listeners = new Set<() => void>();
let current: Appearance = 'system';

function apply(appearance: Appearance) {
  current = appearance;
  // Phones: keyboards, date pickers and alerts follow too (the web has no such switch).
  if (typeof SystemAppearance.setColorScheme === 'function') {
    SystemAppearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }
  listeners.forEach((listener) => listener());
}

/** Light, dark, or whatever the device uses; remembered on this device. */
export async function setAppearance(appearance: Appearance) {
  apply(appearance);
  await preferences.set(PREFERENCE_KEY, appearance);
}

/** Applies the saved choice; call once when the app starts. */
export async function restoreAppearance() {
  const saved = await preferences.get(PREFERENCE_KEY);
  if (saved === 'light' || saved === 'dark') {
    apply(saved);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen appearance (`system` means follow the device). */
export function useAppearance() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'system' as const,
  );
}
