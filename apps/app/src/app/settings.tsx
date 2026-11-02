import {
  meBlockedListOptions,
  meMutedListOptions,
  meSettingsPartialUpdate,
  meSettingsRetrieveOptions,
  meSettingsRetrieveQueryKey,
  type AccountSettings,
  profilesBlockDestroyMutation,
  profilesMuteDestroyMutation,
  type ProfileSummary,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chooseLanguage, LANGUAGES, storedLanguage, type Language } from '@/i18n';

export default function SettingsScreen() {
  const { status } = useAuth();

  return (
    <Screen hasHeader>
      <LanguagePicker />
      {status === 'signed-in' ? (
        <>
          <PushSettings />
          <BlockedAndMuted />
        </>
      ) : null}
    </Screen>
  );
}

const PUSH_KINDS = [
  'new_follower',
  'new_event',
  'event_changed',
  'event_cancelled',
  'event_reminder',
  'waitlist_promoted',
  'announcement',
  'mention',
  'comment',
  'reaction',
] as const;

function PushSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery(meSettingsRetrieveOptions());
  const update = useMutation({
    mutationFn: async (push: Record<string, boolean>) =>
      (await meSettingsPartialUpdate({ body: { push }, throwOnError: true })).data,
    onSuccess: (settings) =>
      queryClient.setQueryData<AccountSettings>(meSettingsRetrieveQueryKey(), settings),
  });

  if (!data?.push) {
    return null;
  }

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('settings.pushTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('settings.pushHint')}
      </ThemedText>
      {PUSH_KINDS.map((kind) => (
        <View key={kind} style={styles.switchRow}>
          <ThemedText style={styles.switchLabel}>{t(`settings.pushKinds.${kind}`)}</ThemedText>
          <Switch
            value={data.push?.[kind] ?? true}
            onValueChange={(enabled) => update.mutate({ [kind]: enabled })}
            accessibilityLabel={t(`settings.pushKinds.${kind}`)}
          />
        </View>
      ))}
    </View>
  );
}

function BlockedAndMuted() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const blocked = useQuery(meBlockedListOptions());
  const muted = useQuery(meMutedListOptions());
  const onSuccess = () => queryClient.invalidateQueries();
  const unblock = useMutation({ ...profilesBlockDestroyMutation(), onSuccess });
  const unmute = useMutation({ ...profilesMuteDestroyMutation(), onSuccess });

  return (
    <>
      <ProfileSection
        title={t('moderation.blockedAccounts')}
        emptyText={t('moderation.noneBlocked')}
        profiles={blocked.data}
        actionLabel={t('moderation.unblock')}
        onAction={(handle) => unblock.mutate({ path: { handle } })}
      />
      <ProfileSection
        title={t('moderation.mutedAccounts')}
        emptyText={t('moderation.noneMuted')}
        profiles={muted.data}
        actionLabel={t('moderation.unmute')}
        onAction={(handle) => unmute.mutate({ path: { handle } })}
      />
    </>
  );
}

type ProfileSectionProps = {
  title: string;
  emptyText: string;
  profiles: ProfileSummary[] | undefined;
  actionLabel: string;
  onAction: (handle: string) => void;
};

function ProfileSection({
  title,
  emptyText,
  profiles,
  actionLabel,
  onAction,
}: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText type="heading">{title}</ThemedText>
      {profiles?.length === 0 ? (
        <ThemedText themeColor="textSecondary">{emptyText}</ThemedText>
      ) : null}
      {profiles?.map((profile) => (
        <View key={profile.handle} style={styles.profileRow}>
          <Avatar name={profile.display_name} image={profile.avatar} size={36} />
          <View style={styles.profileName}>
            <ThemedText type="smallBold">{profile.display_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              @{profile.handle}
            </ThemedText>
          </View>
          <Button
            title={actionLabel}
            variant="secondary"
            onPress={() => onAction(profile.handle)}
          />
        </View>
      ))}
    </View>
  );
}

function LanguagePicker() {
  const { t } = useTranslation();
  const theme = useTheme();
  // undefined while loading, null when following the device
  const [choice, setChoice] = useState<Language | null | undefined>(undefined);

  useEffect(() => {
    storedLanguage().then(setChoice);
  }, []);

  const options: { code: Language | null; name: string }[] = [
    { code: null, name: t('settings.languageAutomatic') },
    ...LANGUAGES,
  ];

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('settings.language')}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.group}>
        {options.map((option) => {
          const selected = choice !== undefined && option.code === choice;
          return (
            <Pressable
              key={option.code ?? 'automatic'}
              role="radio"
              aria-checked={selected}
              onPress={() => {
                setChoice(option.code);
                chooseLanguage(option.code);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <ThemedText style={selected && { color: theme.tint }}>{option.name}</ThemedText>
              {selected ? <ThemedText style={{ color: theme.tint }}>✓</ThemedText> : null}
            </Pressable>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  group: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  profileName: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchLabel: {
    flex: 1,
  },
});
