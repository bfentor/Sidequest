import {
  feedsFollowingListInfiniteQueryKey,
  postsLikeDestroy,
  postsLikeUpdate,
  postsRetrieveQueryKey,
  type Post,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Heart toggle with the like count; shows the new state while the request runs. */
export function LikeButton({ post }: { post: Post }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (like: boolean) => {
      const options = { path: { id: post.id }, throwOnError: true } as const;
      await (like ? postsLikeUpdate(options) : postsLikeDestroy(options));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: feedsFollowingListInfiniteQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: postsRetrieveQueryKey({ path: { id: post.id } }),
        }),
      ]),
  });

  // While the request runs (and the feed refetches), show what was tapped.
  const liked = toggle.isPending ? toggle.variables : post.is_liked;
  const count = post.like_count + Number(liked) - Number(post.is_liked);

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
