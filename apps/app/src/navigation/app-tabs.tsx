import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/hooks/use-theme';

import { TABS } from './tabs';

/** Platform-native tab bar on iOS and Android. */
export default function AppTabs() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      tintColor={theme.tint}
      indicatorColor={theme.backgroundElement}
      labelStyle={{ selected: { color: theme.tint } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(`tabs.${tab.label}`)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon.ios} md={tab.icon.material} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
