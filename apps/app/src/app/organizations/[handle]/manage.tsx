import {
  meProfilesListQueryKey,
  organizationsInvitationsListOptions,
  organizationsInvitationsListQueryKey,
  organizationsMembersCreate,
  organizationsMembersDestroy,
  organizationsMembersListOptions,
  organizationsMembersListQueryKey,
  organizationsMembersPartialUpdate,
  organizationsPartialUpdate,
  organizationsVerificationCreate,
  profilesRetrieveOptions,
  profilesRetrieveQueryKey,
  type MembershipRoleEnum,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ProfileForm, type ProfileFieldErrors } from '@/components/profile-form';
import { ProfileRow } from '@/components/profile-row';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';

export default function ManageOrganizationScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const organization = useQuery(profilesRetrieveOptions({ path: { handle } }));
  const [saved, setSaved] = useState(false);

  if (!organization.data) {
    return <ActivityIndicator style={styles.loading} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: organization.data.display_name }} />
      <ThemedText type="heading">{t('organizations.profile')}</ThemedText>
      <ProfileForm
        profile={organization.data}
        onSave={async (body) => {
          const { error } = await organizationsPartialUpdate({ path: { handle }, body });
          return error ? (error as ProfileFieldErrors) : null;
        }}
        onSaved={() => {
          setSaved(true);
          queryClient.invalidateQueries({
            queryKey: profilesRetrieveQueryKey({ path: { handle } }),
          });
          queryClient.invalidateQueries({ queryKey: meProfilesListQueryKey() });
        }}
      />
      {saved ? (
        <ThemedText themeColor="textSecondary">{t('organizations.saved')}</ThemedText>
      ) : null}
      <Members handle={handle} />
      <Invite handle={handle} />
      {organization.data.verified ? null : <Verification handle={handle} />}
    </Screen>
  );
}

function Members({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const members = useQuery(organizationsMembersListOptions({ path: { handle } }));
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: organizationsMembersListQueryKey({ path: { handle } }),
    });

  const setRole = useMutation({
    mutationFn: async ({ member, role }: { member: string; role: MembershipRoleEnum }) => {
      const { error: problem } = await organizationsMembersPartialUpdate({
        path: { handle, member },
        body: { role },
      });
      setError(problem ? t('errors.unexpected') : null);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (member: string) => {
      const { error: problem } = await organizationsMembersDestroy({ path: { handle, member } });
      setError(problem ? t('organizations.needsAdmin') : null);
    },
    onSuccess: refresh,
  });

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('organizations.members')}</ThemedText>
      {members.data?.map((member) => (
        <View key={member.profile.handle} style={styles.member}>
          <ProfileRow
            profile={member.profile}
            action={
              member.profile.handle === me?.handle ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`organizations.roles.${member.role ?? 'editor'}`)}
                </ThemedText>
              ) : (
                <Button
                  title={t('organizations.remove')}
                  variant="secondary"
                  onPress={() => remove.mutate(member.profile.handle)}
                />
              )
            }
          />
          {member.profile.handle === me?.handle ? null : (
            <SegmentedControl
              value={member.role ?? 'editor'}
              onChange={(role) => setRole.mutate({ member: member.profile.handle, role })}
              options={[
                { value: 'admin', label: t('organizations.roles.admin') },
                { value: 'editor', label: t('organizations.roles.editor') },
              ]}
            />
          )}
        </View>
      ))}
      {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('organizations.rolesHint')}
      </ThemedText>
    </View>
  );
}

function Invite({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pending = useQuery(organizationsInvitationsListOptions({ path: { handle } }));
  const [invitee, setInvitee] = useState('');
  const [role, setRole] = useState<MembershipRoleEnum>('editor');
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: async () => {
      const { error: problem } = await organizationsMembersCreate({
        path: { handle },
        body: { handle: invitee.replace(/^@/, '').trim(), role },
      });
      if (problem) {
        const messages = (problem as { handle?: string[] }).handle;
        setError(messages?.join(' ') ?? t('errors.unexpected'));
        throw new Error('invalid');
      }
    },
    onSuccess: () => {
      setInvitee('');
      setError(null);
      queryClient.invalidateQueries({
        queryKey: organizationsInvitationsListQueryKey({ path: { handle } }),
      });
    },
  });

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('organizations.invite')}</ThemedText>
      <TextField
        label={t('editProfile.handle')}
        value={invitee}
        onChangeText={setInvitee}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <SegmentedControl
        value={role}
        onChange={setRole}
        options={[
          { value: 'editor', label: t('organizations.roles.editor') },
          { value: 'admin', label: t('organizations.roles.admin') },
        ]}
      />
      {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
      <Button
        title={t('organizations.sendInvite')}
        disabled={!invitee.trim()}
        loading={invite.isPending}
        onPress={() => invite.mutate()}
      />
      {pending.data?.length ? (
        <>
          <ThemedText type="smallBold">{t('organizations.pending')}</ThemedText>
          {pending.data.map((invitation) => (
            <ProfileRow key={invitation.id} profile={invitation.invitee} />
          ))}
        </>
      ) : null}
    </View>
  );
}

function Verification({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const request = useMutation({
    mutationFn: async () =>
      organizationsVerificationCreate({ path: { handle }, body: { message }, throwOnError: true }),
  });

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('organizations.verification')}</ThemedText>
      {request.isSuccess ? (
        <ThemedText themeColor="textSecondary">{t('organizations.verificationSent')}</ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('organizations.verificationHint')}
          </ThemedText>
          <TextField
            label={t('organizations.verificationMessage')}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
          />
          <Button
            title={t('organizations.requestVerification')}
            variant="secondary"
            disabled={!message.trim()}
            loading={request.isPending}
            onPress={() => request.mutate()}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: Spacing.six,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  member: {
    gap: Spacing.two,
  },
});
