import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

/** Email → code → new password. Signs in at the end. */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { requestPasswordReset, resetPassword, pendingFlow } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const codeSent = pendingFlow?.kind === 'password_reset';

  async function send() {
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    setMessage(result.status === 'error' ? authErrorMessage(result.errors, t) : null);
  }

  async function reset() {
    setSubmitting(true);
    const result = await resetPassword(code, password);
    setSubmitting(false);
    if (result.status === 'authenticated') {
      goBack('/');
    } else {
      setMessage(result.status === 'error' ? authErrorMessage(result.errors, t) : null);
    }
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      {codeSent ? (
        <>
          <ThemedText themeColor="textSecondary">{t('forgotPassword.codeSent')}</ThemedText>
          <TextField
            label={t('verifyEmail.code')}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoComplete="one-time-code"
          />
          <TextField
            label={t('forgotPassword.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
          <Button
            title={t('forgotPassword.reset')}
            disabled={!code || !password}
            loading={submitting}
            onPress={reset}
          />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">{t('forgotPassword.hint')}</ThemedText>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
          <Button
            title={t('forgotPassword.send')}
            disabled={!email}
            loading={submitting}
            onPress={send}
          />
        </>
      )}
    </Screen>
  );
}
