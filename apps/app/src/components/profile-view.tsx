import {
  organizationsMembersListOptions,
  profilesRetrieveOptions,
  useProfileEvents,
  useProfilePosts,
  type Profile,
} from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';

import { EventCard } from './event-card';
import { FeedList } from './feed-list';
import { PostCard } from './post-card';
import { ProfileHeader } from './profile-header';
import { ProfileRow } from './profile-row';
import { Screen } from './screen';
import { SkeletonPage } from './skeleton';
import { SegmentedControl } from './segmented-control';
import { ThemedText } from './themed-text';

type Tab = 'posts' | 'events' | 'past' | 'members';

type ProfileViewProps = {
  handle: string;
  /** Buttons under the name, given the loaded profile. */
  actions?: (profile: Profile) => ReactNode;
  /** Set when a navigation header already handles the top inset. */
  hasHeader?: boolean;
};

/** A profile's header with its posts, upcoming events and past events below. */
export function ProfileView({ handle, actions, hasHeader }: ProfileViewProps) {
  const { t } = useTranslation();
  const profile = useQuery(profilesRetrieveOptions({ path: { handle } }));
  const [tab, setTab] = useState<Tab>('posts');
  const me = useMe();

  if (!profile.data) {
    return (
      <Screen hasHeader={hasHeader}>
        {profile.isError ? (
          <ThemedText themeColor="textSecondary">{t('profile.notFound')}</ThemedText>
        ) : (
          <SkeletonPage />
        )}
      </Screen>
    );
  }

  const locked =
    profile.data.is_private && !profile.data.is_followed && me?.handle !== profile.data.handle;

  if (locked) {
    return (
      <Screen hasHeader={hasHeader}>
        <ProfileHeader profile={profile.data} actions={actions?.(profile.data)} />
        <ThemedText type="heading">{t('profile.privateAccount')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('profile.privateHint')}</ThemedText>
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: Spacing.three, paddingBottom: Spacing.two }}>
      <ProfileHeader profile={profile.data} actions={actions?.(profile.data)} />
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'posts', label: t('profile.tabs.posts') },
          { value: 'events', label: t('profile.tabs.events') },
          { value: 'past', label: t('profile.tabs.past') },
          ...(profile.data.kind === 'organization'
            ? [{ value: 'members' as const, label: t('organizations.members') }]
            : []),
        ]}
      />
    </View>
  );

  if (tab === 'members') {
    return <OrganizationMembers handle={handle} header={header} hasHeader={hasHeader} />;
  }

  return tab === 'posts' ? (
    <ProfilePosts handle={handle} header={header} hasHeader={hasHeader} />
  ) : (
    <ProfileEvents
      handle={handle}
      when={tab === 'events' ? 'upcoming' : 'past'}
      header={header}
      hasHeader={hasHeader}
    />
  );
}

type ListProps = { handle: string; header: ReactElement; hasHeader?: boolean };

function ProfilePosts({ handle, header, hasHeader }: ListProps) {
  const { t } = useTranslation();
  const posts = useProfilePosts(handle);
  return (
    <FeedList
      query={posts}
      header={header}
      hasHeader={hasHeader}
      renderItem={(post) => <PostCard post={post} />}
      keyExtractor={(post) => String(post.id)}
      emptyText={t('profile.noPosts')}
    />
  );
}

function OrganizationMembers({ handle, header, hasHeader }: ListProps) {
  const { t } = useTranslation();
  const members = useQuery(organizationsMembersListOptions({ path: { handle } }));
  return (
    <Screen hasHeader={hasHeader}>
      {header}
      {members.data?.map((member) => (
        <ProfileRow
          key={member.profile.handle}
          profile={member.profile}
          action={
            <ThemedText type="small" themeColor="textSecondary">
              {t(`organizations.roles.${member.role ?? 'editor'}`)}
            </ThemedText>
          }
        />
      ))}
    </Screen>
  );
}

function ProfileEvents({
  handle,
  when,
  header,
  hasHeader,
}: ListProps & { when: 'upcoming' | 'past' }) {
  const { t } = useTranslation();
  const events = useProfileEvents(handle, when);
  return (
    <FeedList
      query={events}
      header={header}
      hasHeader={hasHeader}
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={when === 'upcoming' ? t('profile.noEvents') : t('profile.noPastEvents')}
    />
  );
}
