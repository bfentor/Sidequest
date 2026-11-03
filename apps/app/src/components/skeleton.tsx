import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

import { ThemedView } from './themed-view';

/** A grey shape where content is still loading. */
function Bone({ width = '100%', height = 16 }: { width?: DimensionValue; height?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: Spacing.two,
        backgroundColor: theme.backgroundSelected,
      }}
    />
  );
}

/**
 * Pulses its children gently (unless reduce motion is on), and tells screen
 * readers that content is loading.
 */
function Pulse({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
    }
  }, [reducedMotion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View role="progressbar" aria-label={t('common.loading')} style={[styles.list, style]}>
      {children}
    </Animated.View>
  );
}

/** A few card-shaped placeholders, for feeds and lists. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <Pulse>
      {Array.from({ length: count }, (_, index) => (
        <ThemedView key={index} type="backgroundElement" style={styles.card}>
          <Bone width="40%" height={14} />
          <Bone width="75%" height={24} />
          <Bone width="55%" height={14} />
        </ThemedView>
      ))}
    </Pulse>
  );
}

/** A page-shaped placeholder: a picture, a title and some lines. */
export function SkeletonPage() {
  return (
    <Pulse>
      <Bone height={180} />
      <Bone width="35%" height={14} />
      <Bone width="80%" height={32} />
      <Bone width="50%" height={16} />
      <Bone height={44} />
      <Bone width="90%" />
      <Bone width="70%" />
    </Pulse>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
