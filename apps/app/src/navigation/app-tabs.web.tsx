import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps } from 'expo-router/ui';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import classes from './app-tabs.module.css';
import { TABS } from './tabs';

/**
 * Responsive navigation for the web: a sidebar on desktop and a bottom bar on
 * phones. The switch happens in CSS (see app-tabs.module.css), so server and
 * client render identical markup.
 */
export default function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs asChild>
      <div className={classes.shell}>
        <TabList asChild>
          <NavBar>
            {TABS.map((tab) => (
              <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                <TabButton icon={tab.icon.material}>{t(`tabs.${tab.label}`)}</TabButton>
              </TabTrigger>
            ))}
          </NavBar>
        </TabList>
        <div className={classes.content}>
          <TabSlot style={styles.slot} />
        </div>
      </div>
    </Tabs>
  );
}

function NavBar({ children }: TabListProps) {
  return (
    <nav className={classes.nav}>
      <div className={classes.brand}>
        <ThemedText type="subtitle" themeColor="tint" style={styles.brand}>
          Sidequest
        </ThemedText>
      </div>
      {children}
    </nav>
  );
}

type TabButtonProps = Omit<ComponentProps<typeof Pressable>, 'children'> & {
  icon: AndroidSymbol;
  children: string;
  /** Injected by `<TabTrigger asChild>`. */
  isFocused?: boolean;
};

function TabButton({ icon, children, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.tint : theme.textSecondary;

  return (
    <Pressable {...props}>
      <div className={classes.tabButton}>
        <SymbolView name={{ web: icon }} tintColor={color} size={24} />
        <ThemedText type="smallBold" style={{ color }}>
          {children}
        </ThemedText>
      </div>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  brand: { fontSize: 24, lineHeight: 32 },
});
