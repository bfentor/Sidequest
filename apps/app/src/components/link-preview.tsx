import type { LinkPreview as LinkPreviewData } from '@sidequest/api';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** The page a post links to: its picture, site, title and description. Opens the page. */
export function LinkPreview({ preview }: { preview: LinkPreviewData }) {
  const theme = useTheme();

  return (
    <Pressable
      role="link"
      accessibilityLabel={preview.title}
      onPress={() => Linking.openURL(preview.url)}
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {preview.image_url ? (
        <Image
          source={{ uri: preview.image_url }}
          style={[styles.image, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      <View style={styles.text}>
        {preview.site_name ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {preview.site_name}
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold" numberOfLines={2}>
          {preview.title}
        </ThemedText>
        {preview.description ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {preview.description}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: '100%',
    // The size Open Graph pictures are usually made for.
    aspectRatio: 1.91,
  },
  text: {
    gap: 2,
    padding: Spacing.three,
  },
});
