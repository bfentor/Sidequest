import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ConfirmDialog } from './confirm-dialog';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type MenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** Ask before running the action. */
  confirm?: { title: string; message?: string; confirmLabel: string };
};

type ActionMenuProps = {
  visible: boolean;
  onClose: () => void;
  actions: MenuAction[];
  title?: string;
};

/** A list of actions in a sheet: at the bottom on phones, centred on wide screens. */
export function ActionMenu({ visible, onClose, actions, title }: ActionMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<MenuAction | null>(null);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={t('common.cancel')}>
          <ThemedView
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.two }]}
            onStartShouldSetResponder={() => true}>
            {title ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
                {title}
              </ThemedText>
            ) : null}
            {actions.map((action) => (
              <Pressable
                key={action.label}
                role="menuitem"
                onPress={() => {
                  onClose();
                  if (action.confirm) {
                    setConfirming(action);
                  } else {
                    action.onPress();
                  }
                }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText style={action.destructive && { color: theme.danger }}>
                  {action.label}
                </ThemedText>
              </Pressable>
            ))}
            <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />
            <Pressable
              role="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.item,
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <ThemedText themeColor="textSecondary">{t('common.cancel')}</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
      {confirming?.confirm ? (
        <ConfirmDialog
          visible
          title={confirming.confirm.title}
          message={confirming.confirm.message}
          confirmLabel={confirming.confirm.confirmLabel}
          destructive={confirming.destructive}
          onConfirm={confirming.onPress}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
    marginBottom: 0,
  },
  title: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  item: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  separator: {
    height: 1,
    marginVertical: Spacing.one,
  },
});
