import type { Post } from '@sidequest/api';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatPostedAt } from '@/lib/format';

import { EventCard } from './event-card';
import { ThemedText } from './themed-text';

export function PostCard({ post }: { post: Post }) {
  return (
    <View style={styles.post}>
      <View style={styles.byline}>
        <ThemedText type="smallBold">{post.author.display_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          @{post.author.handle} · {formatPostedAt(post.created_at)}
        </ThemedText>
      </View>
      {post.body ? <ThemedText>{post.body}</ThemedText> : null}
      {post.event ? <EventCard event={post.event} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  byline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
});
