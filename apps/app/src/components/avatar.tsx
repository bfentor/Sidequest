import type { Image as ApiImage } from '@sidequest/api';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type AvatarProps = {
  name: string;
  image?: ApiImage | null;
  size?: number;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

/** A profile picture, or the name's initials when there isn't one. */
export function Avatar({ name, image, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (image) {
    return (
      <Image
        source={{ uri: image.url }}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
        style={[shape, { backgroundColor: theme.backgroundElement }]}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fallback, shape, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }} themeColor="textSecondary">
        {initials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
