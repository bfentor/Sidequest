import type { Profile } from '@sidequest/api';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { RemoteImage } from './remote-image';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type ProfileHeaderProps = {
  profile: Profile;
  /** Buttons under the name: follow, edit, … */
  actions?: ReactNode;
};

export function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const details = [
    profile.pronouns,
    profile.university,
    profile.faculty,
    profile.study_year ? t('profile.studyYear', { year: profile.study_year }) : null,
  ].filter(Boolean);

  return (
    <View style={styles.header}>
      {profile.cover ? (
        <RemoteImage image={profile.cover} style={styles.cover} contentFit="cover" />
      ) : (
        <ThemedView type="backgroundElement" style={[styles.cover, styles.coverEmpty]} />
      )}
      <View style={styles.avatar}>
        <Avatar name={profile.display_name} image={profile.avatar} size={88} />
      </View>
      <View>
        <View style={styles.nameRow}>
          <ThemedText type="heading">{profile.display_name}</ThemedText>
          {profile.verified ? (
            <SymbolView
              name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
              size={20}
              tintColor={theme.tint}
              accessibilityLabel={t('profile.verified')}
            />
          ) : null}
        </View>
        <ThemedText themeColor="textSecondary">@{profile.handle}</ThemedText>
      </View>
      {details.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {details.join(' · ')}
        </ThemedText>
      ) : null}
      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
      <Links profile={profile} />
      <View style={styles.stats}>
        <Link
          href={{ pathname: '/profiles/[handle]/followers', params: { handle: profile.handle } }}>
          <ThemedText type="small">
            {t('profile.followers', { count: profile.follower_count })}
          </ThemedText>
        </Link>
        <Link
          href={{ pathname: '/profiles/[handle]/following', params: { handle: profile.handle } }}>
          <ThemedText type="small">
            {t('profile.following', { count: profile.following_count })}
          </ThemedText>
        </Link>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

function Links({ profile }: { profile: Profile }) {
  const links = [
    profile.website
      ? { label: profile.website.replace(/^https?:\/\//, ''), url: profile.website }
      : null,
    profile.instagram
      ? {
          label: `Instagram: @${profile.instagram}`,
          url: `https://instagram.com/${profile.instagram}`,
        }
      : null,
  ].filter((link) => link !== null);

  if (links.length === 0) {
    return null;
  }
  return (
    <View style={styles.links}>
      {links.map((link) => (
        <Pressable key={link.url} role="link" onPress={() => Linking.openURL(link.url)}>
          <ThemedText type="small" themeColor="tint">
            {link.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  cover: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: Spacing.three,
  },
  coverEmpty: {
    aspectRatio: 4,
  },
  avatar: {
    marginTop: -44 - Spacing.two,
    marginLeft: Spacing.three,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
