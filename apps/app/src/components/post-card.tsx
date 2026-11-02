import { postsDestroyMutation, type Post } from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';

import { Avatar } from './avatar';
import { ContentMenu } from './content-menu';
import { EventCard } from './event-card';
import { ThemedText } from './themed-text';

export function PostCard({ post }: { post: Post }) {
  const format = useFormat();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const destroy = useMutation({
    ...postsDestroyMutation(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Link
          href={{ pathname: '/profiles/[handle]', params: { handle: post.author.handle } }}
          asChild>
          <Pressable style={styles.author}>
            <Avatar name={post.author.display_name} image={post.author.avatar} size={36} />
            <View style={styles.byline}>
              <ThemedText type="smallBold">{post.author.display_name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                @{post.author.handle} · {format.dateTime(post.created_at)}
              </ThemedText>
            </View>
          </Pressable>
        </Link>
        <ContentMenu
          target={{ type: 'post', id: String(post.id) }}
          owner={post.author}
          ownActions={[
            {
              label: t('posts.delete'),
              destructive: true,
              onPress: () => destroy.mutate({ path: { id: post.id } }),
              confirm: {
                title: t('posts.deleteConfirmTitle'),
                message: t('common.cannotBeUndone'),
                confirmLabel: t('common.delete'),
              },
            },
          ]}
        />
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
  author: {
    flex: 1,
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
