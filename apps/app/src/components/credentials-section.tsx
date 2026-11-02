import {
  changeEmail,
  changePassword,
  meSettingsRetrieveOptions,
  meSettingsRetrieveQueryKey,
  verifyEmail,
} from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { authErrorMessage } from '@/lib/errors';

import { Button } from './button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';

/** Change the sign-in email (confirmed with a code sent to the new one) and password. */
export function CredentialsSection() {
  return (
    <>
      <EmailChange />
      <PasswordChange />
    </>
  );
}

function EmailChange() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(meSettingsRetrieveOptions());
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    const errors = await changeEmail(email);
    setCodeSent(!errors);
    setMessage(errors ? authErrorMessage(errors, t) : null);
  }

  async function confirm() {
    const result = await verifyEmail(code);
    if (result.status === 'error') {
      setMessage(authErrorMessage(result.errors, t));
      return;
    }
    setCodeSent(false);
    setEmail('');
    setCode('');
    setMessage(t('credentials.emailChanged'));
    queryClient.invalidateQueries({ queryKey: meSettingsRetrieveQueryKey() });
  }

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('credentials.email')}</ThemedText>
      {settings.data?.email ? (
        <ThemedText themeColor="textSecondary">{settings.data.email}</ThemedText>
      ) : null}
      {codeSent ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('credentials.codeSent', { email })}
          </ThemedText>
          <TextField
            label={t('verifyEmail.code')}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />
          <Button title={t('verifyEmail.verify')} disabled={!code} onPress={confirm} />
        </>
      ) : (
        <>
          <TextField
            label={t('credentials.newEmail')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title={t('credentials.changeEmail')}
            variant="secondary"
            disabled={!email}
            onPress={send}
          />
        </>
      )}
      {message ? <ThemedText type="small">{message}</ThemedText> : null}
    </View>
  );
}

function PasswordChange() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    const errors = await changePassword(current, next);
    setMessage(errors ? authErrorMessage(errors, t) : t('credentials.passwordChanged'));
    if (!errors) {
      setCurrent('');
      setNext('');
    }
  }

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('credentials.password')}</ThemedText>
      <TextField
        label={t('credentials.currentPassword')}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
      />
      <TextField
        label={t('forgotPassword.newPassword')}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
      />
      {message ? <ThemedText type="small">{message}</ThemedText> : null}
      <Button
        title={t('credentials.changePassword')}
        variant="secondary"
        disabled={!current || !next}
        onPress={save}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
