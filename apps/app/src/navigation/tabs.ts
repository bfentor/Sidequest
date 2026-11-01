import type { Href } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

export type TabDefinition = {
  /** Route file name inside `src/app/(tabs)/`. */
  name: string;
  href: Href;
  title: string;
  /** SF Symbol on iOS; Material Symbol on Android and web. */
  icon: { ios: SFSymbol; material: AndroidSymbol };
};

/** The main sections of the app, shared by the native and web tab bars. */
export const TABS: TabDefinition[] = [
  {
    name: 'index',
    href: '/',
    title: 'Upcoming',
    icon: { ios: 'calendar', material: 'calendar_month' },
  },
  {
    name: 'nearby',
    href: '/nearby',
    title: 'Nearby',
    icon: { ios: 'location', material: 'near_me' },
  },
  {
    name: 'following',
    href: '/following',
    title: 'Following',
    icon: { ios: 'person.2', material: 'group' },
  },
  {
    name: 'profile',
    href: '/profile',
    title: 'Profile',
    icon: { ios: 'person.crop.circle', material: 'person' },
  },
];
