import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconButtonProps = {
  /** SF Symbol on iOS; Material Symbol on Android and web. */
  icon: { ios: SFSymbol; material: AndroidSymbol };
  /** Read out by screen readers, since the button has no text. */
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
};

export function IconButton({ icon, label, onPress, size = 20, color }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: icon.ios, android: icon.material, web: icon.material }}
        size={size}
        tintColor={color ?? theme.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.5,
  },
});
