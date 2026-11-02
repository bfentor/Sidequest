import { Platform, Share } from 'react-native';

/** Opens the share sheet with a link. Resolves to 'copied' only on the web fallback. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied'> {
  // iOS shares `url` as a link and `message` as text; Android only takes `message`.
  await Share.share(
    Platform.OS === 'ios' ? { title, message: title, url } : { title, message: `${title}\n${url}` },
  );
  return 'shared';
}
