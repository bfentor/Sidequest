import type { Post } from '@sidequest/api';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';

import { Avatar } from './avatar';
import { EventCard } from './event-card';
import { ThemedText } from './themed-text';

export function PostCard({ post }: { post: Post }) {
  const format = useFormat();

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Avatar name={post.author.display_name} image={post.author.avatar} size={36} />
        <View style={styles.byline}>
          <ThemedText type="smallBold">{post.author.display_name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            @{post.author.handle} · {format.dateTime(post.created_at)}
          </ThemedText>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  byline: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
});
