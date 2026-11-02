import { postsDestroyMutation, type Post } from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';

import { Avatar } from './avatar';
import { ContentMenu } from './content-menu';
import { EventCard } from './event-card';
import { LikeButton } from './like-button';
import { RemoteImage } from './remote-image';
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
                {post.edited_at ? ` · ${t('posts.edited')}` : ''}
              </ThemedText>
            </View>
          </Pressable>
        </Link>
        <ContentMenu
          target={{ type: 'post', id: String(post.id) }}
          owner={post.author}
          ownActions={[
            {
              label: t('posts.edit'),
              onPress: () => router.push({ pathname: '/posts/[id]/edit', params: { id: post.id } }),
            },
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
      {post.images.length ? (
        <View style={styles.images}>
          {post.images.map((image) => (
            <RemoteImage
              key={image.id}
              image={image}
              contentFit="cover"
              style={[styles.image, post.images.length === 1 && styles.onlyImage]}
            />
          ))}
        </View>
      ) : null}
      {post.event ? <EventCard event={post.event} /> : null}
      <LikeButton post={post} />
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
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  image: {
    // Two per row; a single picture takes the whole width.
    flexBasis: '48%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: Spacing.two,
  },
  onlyImage: {
    aspectRatio: 4 / 3,
  },
});
