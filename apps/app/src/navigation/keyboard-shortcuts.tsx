import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { TABS } from './tabs';

/** Whether a key press is meant for a text field (or uses a modifier), not for shortcuts. */
function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    target?.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
  );
}

/**
 * Keyboard shortcuts for the website (used by app-tabs.web.tsx only): / search, n new event, 1–5 the tabs,
 * Esc closes the side panel, ? lists them all.
 */
export function KeyboardShortcuts({ onEscape }: { onEscape: () => void }) {
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const { status } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setHelpOpen(false);
        onEscape();
        return;
      }
      if (isTyping(event)) return;
      const tab = TABS[Number(event.key) - 1];
      let href: Href | null = tab ? tab.href : null;
      if (event.key === '/') href = '/search';
      if (event.key === 'n' && status === 'signed-in') href = '/events/new';
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
      } else if (href) {
        event.preventDefault();
        router.push(href);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape, status]);

  const shortcuts = [
    ['/', t('shortcuts.search')],
    ['n', t('shortcuts.newEvent')],
    ['1–5', t('shortcuts.tabs')],
    ['Esc', t('shortcuts.close')],
    ['?', t('shortcuts.help')],
  ];

  return (
    <Modal
      visible={helpOpen}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={() => setHelpOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setHelpOpen(false)}>
        <ThemedView style={styles.dialog} role="dialog" aria-label={t('shortcuts.title')}>
          <ThemedText type="heading">{t('shortcuts.title')}</ThemedText>
          {shortcuts.map(([key, label]) => (
            <View key={key} style={styles.row}>
              <ThemedView type="backgroundElement" style={styles.key}>
                <ThemedText type="code">{key}</ThemedText>
              </ThemedView>
              <ThemedText>{label}</ThemedText>
            </View>
          ))}
          <Button title={t('common.done')} variant="secondary" onPress={() => setHelpOpen(false)} />
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  key: {
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
});
