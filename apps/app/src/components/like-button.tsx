import { postsLikeDestroy, postsLikeUpdate, type Post } from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateCachedPost } from '@/lib/post-cache';

import { ThemedText } from './themed-text';

/** Heart toggle with the like count; every copy of the post shows the change straight away. */
export function LikeButton({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const show = (liked: boolean) =>
    updateCachedPost(queryClient, post.id, (cached) => ({
      ...cached,
      is_liked: liked,
      like_count: Math.max(0, cached.like_count + (liked ? 1 : 0) - (cached.is_liked ? 1 : 0)),
    }));
  const toggle = useMutation({
    mutationFn: async (like: boolean) => {
      const options = { path: { id: post.id }, throwOnError: true } as const;
      await (like ? postsLikeUpdate(options) : postsLikeDestroy(options));
    },
    onMutate: (like) => {
      show(like);
      return { previous: post.is_liked };
    },
    onError: (_error, _like, context) => context && show(context.previous),
  });

  const liked = post.is_liked;
  const count = post.like_count;

  return (
    <Pressable
      role="button"
      aria-pressed={liked}
      accessibilityLabel={liked ? t('posts.unlike') : t('posts.like')}
      hitSlop={8}
      onPress={() => (status === 'signed-in' ? toggle.mutate(!liked) : router.push('/sign-in'))}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={
          liked
            ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
            : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
        }
        size={20}
        tintColor={liked ? theme.danger : theme.textSecondary}
      />
      {count > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.6,
  },
});
