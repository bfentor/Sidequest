import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

import { TABS } from './tabs';

/** Platform-native tab bar on iOS and Android. */
export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      tintColor={theme.tint}
      indicatorColor={theme.backgroundElement}
      labelStyle={{ selected: { color: theme.tint } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.title}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon.ios} md={tab.icon.material} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
