import type { AttendanceSummary } from '@sidequest/api';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';

const AVATAR = 20;

/** "Sam and 2 others you follow are going", with their avatars. Nothing if no one is. */
export function FriendsGoing({ attendance }: { attendance: AttendanceSummary }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [first, second] = attendance.friends_going;
  const count = attendance.friends_going_count;
  if (!first) {
    return null;
  }
  const text =
    count === 1
      ? t('friendsGoing.one', { name: first.display_name })
      : count === 2 && second
        ? t('friendsGoing.two', { name: first.display_name, other: second.display_name })
        : t('friendsGoing.more', { name: first.display_name, count: count - 1 });

  return (
    <View style={styles.row}>
      <View style={styles.avatars}>
        {attendance.friends_going.map((profile, index) => (
          <View
            key={profile.handle}
            style={[
              styles.avatar,
              { marginLeft: index ? -AVATAR / 3 : 0, borderColor: theme.backgroundElement },
            ]}>
            <Avatar name={profile.display_name} image={profile.avatar} size={AVATAR} />
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    borderWidth: 1.5,
    borderRadius: 999,
  },
  text: {
    flex: 1,
  },
});
