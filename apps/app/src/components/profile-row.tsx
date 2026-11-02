import type { ProfileSummary } from '@sidequest/api';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';

/** A profile in a list, linking to it, with an optional action on the right. */
export function ProfileRow({ profile, action }: { profile: ProfileSummary; action?: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/profiles/[handle]', params: { handle: profile.handle } }} asChild>
        <Pressable style={styles.link}>
          <Avatar name={profile.display_name} image={profile.avatar} size={40} />
          <View style={styles.name}>
            <View style={styles.nameLine}>
              <ThemedText type="smallBold">{profile.display_name}</ThemedText>
              {profile.verified ? (
                <SymbolView
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                  size={14}
                  tintColor={theme.tint}
                />
              ) : null}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              @{profile.handle}
            </ThemedText>
          </View>
        </Pressable>
      </Link>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
