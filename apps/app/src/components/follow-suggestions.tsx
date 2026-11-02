import {
  meSuggestionsListOptions,
  profilesRetrieveOptions,
  type Profile,
  type ProfileKindEnum,
} from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { FollowButton } from './follow-button';
import { ProfileRow } from './profile-row';

/**
 * A suggested profile with a Follow button. Each one is seeded into its
 * profile query, which FollowButton updates, so the button reflects taps.
 */
function SuggestionRow({ profile, updatedAt }: { profile: Profile; updatedAt: number }) {
  const { data = profile } = useQuery({
    ...profilesRetrieveOptions({ path: { handle: profile.handle } }),
    initialData: profile,
    initialDataUpdatedAt: updatedAt,
    staleTime: 60 * 1000,
  });
  return <ProfileRow profile={data} action={<FollowButton profile={data} />} />;
}

type FollowSuggestionsProps = {
  /** Show at most this many. */
  limit?: number;
  kind?: ProfileKindEnum;
  /** Shown above the list, only when there are suggestions. */
  title?: ReactNode;
  /** Shown instead of the list when there's no one to suggest. */
  empty?: ReactNode;
};

/** "Who to follow" for the signed-in user. Renders `empty` (or nothing) when there's no one to suggest. */
export function FollowSuggestions({ limit, kind, title, empty = null }: FollowSuggestionsProps) {
  const suggestions = useQuery(meSuggestionsListOptions({ query: kind ? { kind } : {} }));

  if (suggestions.isPending) {
    return title ? null : <ActivityIndicator />;
  }
  const profiles = (suggestions.data ?? []).slice(0, limit);
  if (!profiles.length) {
    return empty;
  }
  return (
    <>
      {title}
      {profiles.map((profile) => (
        <SuggestionRow
          key={profile.handle}
          profile={profile}
          updatedAt={suggestions.dataUpdatedAt}
        />
      ))}
    </>
  );
}
