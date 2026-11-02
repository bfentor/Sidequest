import {
  meInvitationsCreate,
  meInvitationsDestroy,
  meInvitationsListOptions,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ProfileRow } from '@/components/profile-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActingProfiles } from '@/hooks/use-acting-profiles';

export default function OrganizationsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const organizations = useActingProfiles().filter((profile) => profile.role !== 'self');
  const invitations = useQuery(meInvitationsListOptions());
  const answer = useMutation({
    mutationFn: async ({ id, accept }: { id: number; accept: boolean }) => {
      const options = { path: { id }, throwOnError: true } as const;
      await (accept ? meInvitationsCreate(options) : meInvitationsDestroy(options));
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <Screen hasHeader>
      {invitations.data?.length ? (
        <View style={styles.section}>
          <ThemedText type="heading">{t('organizations.invitations')}</ThemedText>
          {invitations.data.map((invitation) => (
            <View key={invitation.id} style={styles.section}>
              <ProfileRow profile={invitation.organization} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('organizations.invitedAs', {
                  role: t(`organizations.roles.${invitation.role}`),
                })}
              </ThemedText>
              <View style={styles.buttons}>
                <View style={styles.button}>
                  <Button
                    title={t('organizations.join')}
                    onPress={() => answer.mutate({ id: invitation.id, accept: true })}
                  />
                </View>
                <View style={styles.button}>
                  <Button
                    title={t('followRequests.decline')}
                    variant="secondary"
                    onPress={() => answer.mutate({ id: invitation.id, accept: false })}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="heading">{t('organizations.yours')}</ThemedText>
        {organizations.length === 0 ? (
          <ThemedText themeColor="textSecondary">{t('organizations.none')}</ThemedText>
        ) : null}
        {organizations.map((organization) => (
          <ProfileRow
            key={organization.handle}
            profile={organization}
            action={
              <ThemedText type="small" themeColor="textSecondary">
                {organization.role === 'self'
                  ? null
                  : t(`organizations.roles.${organization.role}`)}
              </ThemedText>
            }
          />
        ))}
      </View>
      <Button title={t('organizations.create')} onPress={() => router.push('/organizations/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
