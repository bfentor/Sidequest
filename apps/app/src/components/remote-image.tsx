import type { Image as ApiImage } from '@sidequest/api';
import { Image, type ImageProps } from 'expo-image';

type RemoteImageProps = Omit<ImageProps, 'source'> & {
  image: ApiImage;
};

/**
 * An uploaded picture. expo-image caches it in memory and on disk, and the
 * known size keeps the layout from jumping while it loads.
 */
export function RemoteImage({ image, style, ...props }: RemoteImageProps) {
  return (
    <Image
      source={{ uri: image.url, width: image.width, height: image.height }}
      cachePolicy="memory-disk"
      transition={150}
      style={[{ aspectRatio: image.width / image.height }, style]}
      {...props}
    />
  );
}
