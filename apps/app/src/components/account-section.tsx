import {
  meAccountDeleteCreate,
  meExportRetrieve,
  meSettingsPartialUpdate,
  meSettingsRetrieveOptions,
  meSettingsRetrieveQueryKey,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';
import { toIsoDate } from '@/lib/dates';
import { useFormat } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { saveTextFile } from '@/lib/save-file';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { Button } from './button';
import { DateTimeField } from './date-time-field';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Download my data and Delete account (GDPR, and Apple's in-app deletion rule). */
export function AccountSection() {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const download = useMutation({
    mutationFn: async () => {
      const { data } = await meExportRetrieve({ throwOnError: true });
      const date = new Date().toISOString().slice(0, 10);
      await saveTextFile(
        `sidequest-data-${date}.json`,
        JSON.stringify(data, null, 2),
        'application/json',
      );
    },
  });

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('account.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.exportHint')}
      </ThemedText>
      <BirthDate />
      <Button
        title={t('account.export')}
        variant="secondary"
        loading={download.isPending}
        onPress={() => download.mutate()}
      />
      <Button title={t('account.delete')} variant="danger" onPress={() => setDeleting(true)} />
      <DeleteAccountDialog visible={deleting} onClose={() => setDeleting(false)} />
    </View>
  );
}

/** Shows the birth date; accounts made before it was asked can add it once. */
function BirthDate() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const settings = useQuery(meSettingsRetrieveOptions());
  const [value, setValue] = useState(() => new Date(2005, 0, 1));
  const save = useMutation({
    mutationFn: () =>
      meSettingsPartialUpdate({ body: { birth_date: toIsoDate(value) }, throwOnError: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meSettingsRetrieveQueryKey() }),
  });

  if (!settings.data) {
    return null;
  }
  if (settings.data.birth_date) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.birthDate', { date: format.date(settings.data.birth_date) })}
      </ThemedText>
    );
  }
  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.addBirthDateHint')}
      </ThemedText>
      <DateTimeField label={t('auth.birthDate')} mode="date" value={value} onChange={setValue} />
      <Button
        title={t('account.addBirthDate')}
        variant="secondary"
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </>
  );
}

function DeleteAccountDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const { forgetSession } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: async () => {
      const { error: problem } = await meAccountDeleteCreate({ body: { password } });
      if (problem) {
        setError(t('account.wrongPassword'));
        throw new Error('invalid');
      }
    },
    onSuccess: async () => {
      onClose();
      // The account is gone, so there is no session left to end on the server.
      await forgetSession();
      goBack('/');
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.dialog} role="alertdialog">
          <ThemedText type="heading">{t('account.deleteConfirmTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('account.deleteConfirmMessage')}</ThemedText>
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
          <Button
            title={t('account.deleteForever')}
            variant="danger"
            disabled={!password}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
          <Button title={t('common.cancel')} variant="secondary" onPress={onClose} />
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
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
});
