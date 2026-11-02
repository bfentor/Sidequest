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

/** Follow / Following toggle that updates instantly and rolls back if the request fails. */
export function FollowButton({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = profilesRetrieveQueryKey({ path: { handle: profile.handle } });

  const setFollowed = (followed: boolean) =>
    queryClient.setQueryData<Profile>(queryKey, (old) =>
      old
        ? {
            ...old,
            is_followed: followed,
            follower_count: old.follower_count + (followed ? 1 : -1),
          }
        : old,
    );

  const toggle = useMutation({
    mutationFn: async (follow: boolean) => {
      const options = { path: { handle: profile.handle }, throwOnError: true } as const;
      await (follow ? profilesFollowCreate(options) : profilesFollowDestroy(options));
    },
    onMutate: (follow) => setFollowed(follow),
    onError: (_error, follow) => setFollowed(!follow),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (profile.is_blocked) {
    return null;
  }

  return (
    <Button
      title={profile.is_followed ? t('profile.followingButton') : t('profile.follow')}
      variant={profile.is_followed ? 'secondary' : 'primary'}
      onPress={() =>
        status === 'signed-in' ? toggle.mutate(!profile.is_followed) : router.push('/sign-in')
      }
    />
  );
}
