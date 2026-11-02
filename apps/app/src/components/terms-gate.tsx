import {
  meAcceptTermsCreate,
  meSettingsRetrieveOptions,
  meSettingsRetrieveQueryKey,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';

import { Button } from './button';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Asks signed-in people to accept the terms again after they change. */
export function TermsGate() {
  const { t } = useTranslation();
  const { status, signOut } = useAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({ ...meSettingsRetrieveOptions(), enabled: status === 'signed-in' });
  const accept = useMutation({
    mutationFn: () => meAcceptTermsCreate({ throwOnError: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meSettingsRetrieveQueryKey() }),
  });

  const outdated =
    status === 'signed-in' &&
    settings.data !== undefined &&
    settings.data.terms_version !== settings.data.current_terms_version;

  return (
    <Modal visible={outdated} transparent animationType="fade">
      <View style={styles.backdrop}>
        <ThemedView style={styles.dialog} role="alertdialog">
          <ThemedText type="heading">{t('legal.updatedTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('legal.updatedMessage')}</ThemedText>
          <View style={styles.links}>
            <Link href={{ pathname: '/legal/[document]', params: { document: 'terms' } }}>
              <ThemedText themeColor="tint">{t('legal.terms')}</ThemedText>
            </Link>
            <Link href={{ pathname: '/legal/[document]', params: { document: 'privacy' } }}>
              <ThemedText themeColor="tint">{t('legal.privacy')}</ThemedText>
            </Link>
          </View>
          <Button
            title={t('legal.accept')}
            loading={accept.isPending}
            onPress={() => accept.mutate()}
          />
          <Button title={t('common.signOut')} variant="secondary" onPress={signOut} />
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  links: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
});
