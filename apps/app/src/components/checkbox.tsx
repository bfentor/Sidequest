import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Read by screen readers when the label isn't plain text. */
  accessibilityLabel?: string;
};

export function Checkbox({ checked, onChange, label, accessibilityLabel }: CheckboxProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        role="checkbox"
        aria-checked={checked}
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        onPress={() => onChange(!checked)}
        style={[
          styles.box,
          {
            borderColor: checked ? theme.tint : theme.textSecondary,
            backgroundColor: checked ? theme.tint : 'transparent',
          },
        ]}>
        {checked ? (
          <ThemedText style={{ color: theme.onTint, lineHeight: 18 }}>✓</ThemedText>
        ) : null}
      </Pressable>
      <View style={styles.label}>{label}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  box: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 6,
  },
  label: {
    flex: 1,
  },
});
