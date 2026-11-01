import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = ScrollViewProps & {
  /** Set when a navigation header already handles the top inset. */
  hasHeader?: boolean;
};

/** Scrollable page whose content is centred and width-limited on large screens. */
export function Screen({ hasHeader, contentContainerStyle, children, ...props }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        screenStyles.content,
        {
          paddingTop: (hasHeader ? 0 : insets.top) + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
        contentContainerStyle,
      ]}
      {...props}>
      {children}
    </ScrollView>
  );
}

export const screenStyles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
});
