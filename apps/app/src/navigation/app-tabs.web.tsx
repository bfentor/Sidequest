import { eventsRetrieveOptions, useUnreadCount } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Link, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps } from 'expo-router/ui';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { EventDetails, EventMenu } from '@/components/event-details';
import { EventPanelProvider } from '@/components/event-panel';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import classes from './app-tabs.module.css';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { TABS } from './tabs';

// From this width, events open in a panel beside the feed instead of on their own page.
const PANEL_MIN_WIDTH = 1200;

/**
 * Responsive navigation for the web: a sidebar on desktop and a bottom bar on
 * phones. The switch happens in CSS (see app-tabs.module.css), so server and
 * client render identical markup. Wide screens also get a side panel for
 * event details, and every screen keyboard shortcuts.
 */
export default function AppTabs() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const unread = useUnreadCount({ enabled: status === 'signed-in' });
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const [selected, setSelected] = useState<number | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const wide = width >= PANEL_MIN_WIDTH;
  const panel = useMemo(() => ({ selected, open: setSelected, close }), [selected, close]);

  // Another page, another context: the panel closes.
  const [panelPath, setPanelPath] = useState(pathname);
  if (panelPath !== pathname) {
    setPanelPath(pathname);
    setSelected(null);
  }

  return (
    <EventPanelProvider value={wide ? panel : null}>
      <KeyboardShortcuts onEscape={close} />
      <Tabs asChild>
        <div className={classes.shell}>
          <TabList asChild>
            <NavBar>
              {TABS.map((tab) => (
                <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
                  <TabButton
                    icon={tab.icon.material}
                    badge={tab.name === 'notifications' ? unread : 0}>
                    {t(`tabs.${tab.label}`)}
                  </TabButton>
                </TabTrigger>
              ))}
            </NavBar>
          </TabList>
          <div className={classes.content}>
            <TabSlot style={styles.slot} />
          </div>
          {wide && selected !== null ? (
            <aside className={classes.panel} aria-label={t('event.title')}>
              <View style={styles.panelBar}>
                <Link href={{ pathname: '/events/[id]', params: { id: selected } }}>
                  <ThemedText type="small" themeColor="tint">
                    {t('event.openPage')}
                  </ThemedText>
                </Link>
                <View style={styles.panelActions}>
                  <PanelMenu id={selected} onDeleted={close} />
                  <IconButton
                    icon={{ ios: 'xmark', material: 'close' }}
                    label={t('event.closePanel')}
                    onPress={close}
                  />
                </View>
              </View>
              <ScrollView contentContainerStyle={styles.panelContent}>
                <EventDetails key={selected} id={selected} />
              </ScrollView>
            </aside>
          ) : null}
        </div>
      </Tabs>
    </EventPanelProvider>
  );
}

/** The event's menu, once it has loaded (it's already cached by the details). */
function PanelMenu({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { data: event } = useQuery(eventsRetrieveOptions({ path: { id } }));
  return event ? <EventMenu event={event} onDeleted={onDeleted} /> : null;
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
  /** A count shown next to the label, e.g. unread notifications. */
  badge?: number;
  /** Injected by `<TabTrigger asChild>`. */
  isFocused?: boolean;
};

function TabButton({ icon, children, badge = 0, isFocused, ...props }: TabButtonProps) {
  const theme = useTheme();
  const color = isFocused ? theme.tint : theme.textSecondary;

  return (
    <Pressable {...props}>
      <div className={classes.tabButton}>
        <SymbolView name={{ web: icon }} tintColor={color} size={24} />
        <span className={classes.label}>
          <ThemedText type="smallBold" style={{ color }}>
            {children}
          </ThemedText>
        </span>
        {badge > 0 ? (
          <span className={classes.badge} style={{ backgroundColor: theme.tint }}>
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </div>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  panelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  panelContent: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  brand: { fontSize: 24, lineHeight: 32 },
});
