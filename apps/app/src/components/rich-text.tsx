import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { ThemedText } from './themed-text';

// The same patterns as the API's (posts/text.py): @handles, #tags in any language, and web links.
const TOKENS =
  /(?<![\p{L}\p{N}_@])@([A-Za-z0-9_]{1,30})(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_#&])#([\p{L}\p{N}_]{1,50})|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"])/gu;

/** Splits text into plain strings and tappable mentions, hashtags and links. */
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKENS)) {
    const [whole, handle, tag, url] = match;
    if (match.index > last) parts.push(text.slice(last, match.index));
    const onPress = handle
      ? () =>
          router.push({ pathname: '/profiles/[handle]', params: { handle: handle.toLowerCase() } })
      : tag
        ? () => router.push({ pathname: '/hashtags/[tag]', params: { tag } })
        : () => Linking.openURL(url);
    parts.push(
      <ThemedText key={match.index} role="link" themeColor="tint" onPress={onPress}>
        {whole}
      </ThemedText>,
    );
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Text someone wrote, with @mentions, #hashtags and links that open. */
export function RichText({ children }: { children: string }) {
  return <ThemedText>{linkify(children)}</ThemedText>;
}
