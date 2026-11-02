import { StyleSheet, View, Pressable } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useActingProfiles } from '@/hooks/use-acting-profiles';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';

type ActingAsPickerProps = {
  label: string;
  /** A handle; undefined means the first profile (your own). */
  value: string | undefined;
  onChange: (handle: string) => void;
};

/** Choose to publish as yourself or an organization you belong to. Hidden if there's no choice. */
export function ActingAsPicker({ label, value, onChange }: ActingAsPickerProps) {
  const theme = useTheme();
  const acting = useActingProfiles();
  if (acting.length < 2) {
    return null;
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>
        {acting.map((profile) => {
          const selected = (value ?? acting[0]?.handle) === profile.handle;
          return (
            <Pressable
              key={profile.handle}
              role="radio"
              aria-checked={selected}
              onPress={() => onChange(profile.handle)}
              style={[
                styles.profile,
                { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement },
              ]}>
              <Avatar name={profile.display_name} image={profile.avatar} size={24} />
              <ThemedText type="small">{profile.display_name}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
});
