import type { Image as ApiImage } from '@sidequest/api';
import { Image, type ImageProps } from 'expo-image';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

type RemoteImageProps = Omit<ImageProps, 'source'> & {
  image: ApiImage;
};

/**
 * An uploaded picture. expo-image caches it in memory and on disk, and the
 * known size keeps the layout from jumping while it loads. Screen readers
 * skip it unless it has an `accessibilityLabel` (covers are decorative; the
 * title or name beside them says what they are).
 */
export function RemoteImage({ image, style, ...props }: RemoteImageProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Image
      source={{ uri: image.url, width: image.width, height: image.height }}
      cachePolicy="memory-disk"
      transition={reducedMotion ? 0 : 150}
      accessible={Boolean(props.accessibilityLabel)}
      // On the web this becomes the alt text; empty marks the picture as decorative.
      accessibilityLabel=""
      style={[{ aspectRatio: image.width / image.height }, style]}
      {...props}
    />
  );
}
