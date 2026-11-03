import {
  commentsDestroy,
  commentsQueryKey,
  eventsCommentsCreate,
  feedsFollowingListInfiniteQueryKey,
  postsCommentsCreate,
  postsRetrieveQueryKey,
  useComments,
  type Comment,
  type CommentParent,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

import { RichText } from './rich-text';
import { SkeletonList } from './skeleton';
import { ActingAsPicker } from './acting-as-picker';
import { Avatar } from './avatar';
import { Button } from './button';
import { ContentMenu } from './content-menu';
import type { MenuAction } from './action-menu';
import { ThemedText } from './themed-text';

function CommentRow({ comment, onDelete }: { comment: Comment; onDelete: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const remove: MenuAction = {
    label: t('comments.delete'),
    destructive: true,
    onPress: onDelete,
    confirm: {
      title: t('comments.deleteConfirm'),
      message: t('common.cannotBeUndone'),
      confirmLabel: t('common.delete'),
    },
  };

  return (
    <View style={styles.comment}>
      <Link href={{ pathname: '/profiles/[handle]', params: { handle: comment.author.handle } }}>
        <Avatar name={comment.author.display_name} image={comment.author.avatar} size={32} />
      </Link>
      <View style={styles.commentBody}>
        <ThemedText type="small">
          <ThemedText type="smallBold">{comment.author.display_name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            · {format.dateTime(comment.created_at)}
          </ThemedText>
        </ThemedText>
        <RichText>{comment.body}</RichText>
      </View>
      <ContentMenu
        target={{ type: 'comment', id: String(comment.id) }}
        owner={comment.author}
        ownActions={[remove]}
        extraActions={comment.can_delete ? [remove] : []}
      />
    </View>
  );
}

type CommentsProps = {
  parent: CommentParent;
  title: string;
  placeholder: string;
};

/** A comment thread, oldest first, with a box to add one (as yourself or an organization). */
export function Comments({ parent, title, placeholder }: CommentsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const comments = useComments(parent);
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState<string>();
  const [error, setError] = useState<string>();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(parent) }),
      // Posts show how many comments they have.
      ...(parent.type === 'post'
        ? [
            queryClient.invalidateQueries({
              queryKey: postsRetrieveQueryKey({ path: { id: parent.id } }),
            }),
            queryClient.invalidateQueries({ queryKey: feedsFollowingListInfiniteQueryKey() }),
          ]
        : []),
    ]);
  const send = useMutation({
    mutationFn: async () => {
      const options = {
        path: { id: parent.id },
        body: { body, ...(author ? { author_handle: author } : {}) },
      };
      const { error } =
        parent.type === 'post'
          ? await postsCommentsCreate(options)
          : await eventsCommentsCreate(options);
      if (error) {
        const messages = Object.values(error as Record<string, string[]>).flat();
        throw new Error(messages.join('\n') || t('errors.unexpected'));
      }
    },
    onMutate: () => setError(undefined),
    onSuccess: () => {
      setBody('');
      return refresh();
    },
    onError: (failure) => setError(failure.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => commentsDestroy({ path: { id }, throwOnError: true }),
    onSuccess: refresh,
  });

  const all = comments.data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{title}</ThemedText>
      {comments.isPending ? <SkeletonList count={2} /> : null}
      {all.map((comment) => (
        <CommentRow key={comment.id} comment={comment} onDelete={() => remove.mutate(comment.id)} />
      ))}
      {comments.hasNextPage ? (
        <Pressable role="button" onPress={() => comments.fetchNextPage()}>
          <ThemedText type="small" themeColor="tint">
            {t('comments.more')}
          </ThemedText>
        </Pressable>
      ) : null}
      {comments.isSuccess && !all.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('comments.none')}
        </ThemedText>
      ) : null}
      {status === 'signed-in' ? (
        <View style={styles.composer}>
          <ActingAsPicker label={t('comments.commentAs')} value={author} onChange={setAuthor} />
          <TextInput
            accessibilityLabel={placeholder}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <Button
            title={t('comments.send')}
            disabled={!body.trim()}
            loading={send.isPending}
            onPress={() => send.mutate()}
          />
        </View>
      ) : (
        <Pressable role="link" onPress={() => router.push('/sign-in')}>
          <ThemedText type="small" themeColor="tint">
            {t('comments.signInToComment')}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  commentBody: {
    flex: 1,
    gap: Spacing.half,
  },
  composer: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 72,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
