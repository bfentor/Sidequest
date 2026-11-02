import {
  profilesFollowCreate,
  profilesFollowDestroy,
  profilesRetrieveQueryKey,
  type Profile,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';

import { Button } from './button';

type FollowState = 'following' | 'requested' | 'none';

function stateOf(profile: Profile): FollowState {
  return profile.is_followed ? 'following' : profile.is_requested ? 'requested' : 'none';
}

/**
 * Follow / Requested / Following toggle. Private profiles get a request; the
 * button updates instantly and rolls back if the request fails.
 */
export function FollowButton({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = profilesRetrieveQueryKey({ path: { handle: profile.handle } });
  const state = stateOf(profile);

  const show = (next: FollowState) =>
    queryClient.setQueryData<Profile>(queryKey, (old) =>
      old
        ? {
            ...old,
            is_followed: next === 'following',
            is_requested: next === 'requested',
            follower_count:
              old.follower_count + (next === 'following' ? 1 : 0) - (old.is_followed ? 1 : 0),
          }
        : old,
    );

  const toggle = useMutation({
    mutationFn: async (follow: boolean) => {
      const options = { path: { handle: profile.handle }, throwOnError: true } as const;
      await (follow ? profilesFollowCreate(options) : profilesFollowDestroy(options));
    },
    onMutate: (follow) => {
      show(follow ? (profile.is_private ? 'requested' : 'following') : 'none');
      return { previous: state };
    },
    onError: (_error, _follow, context) => context && show(context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (profile.is_blocked) {
    return null;
  }

  const title = {
    following: t('profile.followingButton'),
    requested: t('profile.requested'),
    none: t('profile.follow'),
  }[state];

  return (
    <Button
      title={title}
      variant={state === 'none' ? 'primary' : 'secondary'}
      onPress={() =>
        status === 'signed-in' ? toggle.mutate(state === 'none') : router.push('/sign-in')
      }
    />
  );
}
