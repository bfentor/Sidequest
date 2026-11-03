import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { Button } from './button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Asks before doing something hard to undo. Works the same on every platform. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <ThemedView style={styles.dialog} role="alertdialog" onStartShouldSetResponder={() => true}>
          <ThemedText type="heading">{title}</ThemedText>
          {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button title={t('common.cancel')} variant="secondary" onPress={onCancel} />
            </View>
            <View style={styles.button}>
              <Button
                title={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                onPress={() => {
                  onCancel();
                  onConfirm();
                }}
              />
            </View>
          </View>
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
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
