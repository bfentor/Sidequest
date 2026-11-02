import type { Href } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

export type TabDefinition = {
  /** Route file name inside `src/app/(tabs)/`. */
  name: string;
  href: Href;
  /** Key under `tabs` in the translation files. */
  label: 'upcoming' | 'nearby' | 'following' | 'notifications' | 'profile';
  /** SF Symbol on iOS; Material Symbol on Android and web. */
  icon: { ios: SFSymbol; material: AndroidSymbol };
};

/** The main sections of the app, shared by the native and web tab bars. */
export const TABS: TabDefinition[] = [
  {
    name: 'index',
    href: '/',
    label: 'upcoming',
    icon: { ios: 'calendar', material: 'calendar_month' },
  },
  {
    name: 'nearby',
    href: '/nearby',
    label: 'nearby',
    icon: { ios: 'location', material: 'near_me' },
  },
  {
    name: 'following',
    href: '/following',
    label: 'following',
    icon: { ios: 'person.2', material: 'group' },
  },
  {
    name: 'notifications',
    href: '/notifications',
    label: 'notifications',
    icon: { ios: 'bell', material: 'notifications' },
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'profile',
    icon: { ios: 'person.crop.circle', material: 'person' },
  },
];
