import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

/** Enter the code emailed at signup (or when signing in before verifying). */
export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const { verifyEmail, resendEmailCode, pendingFlow } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!pendingFlow) {
    return (
      <Screen hasHeader>
        <ThemedText themeColor="textSecondary">{t('verifyEmail.nothingPending')}</ThemedText>
        <Button title={t('common.signIn')} onPress={() => goBack('/sign-in')} />
      </Screen>
    );
  }

  async function submit() {
    setSubmitting(true);
    const result = await verifyEmail(code);
    setSubmitting(false);
    if (result.status === 'authenticated') {
      goBack('/');
    } else {
      setMessage(result.status === 'error' ? authErrorMessage(result.errors, t) : null);
    }
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">{t('verifyEmail.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('verifyEmail.hint')}</ThemedText>
      <TextField
        label={t('verifyEmail.code')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={submit}
      />
      {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
      <Button
        title={t('verifyEmail.verify')}
        disabled={!code}
        loading={submitting}
        onPress={submit}
      />
      <Button
        title={t('verifyEmail.resend')}
        variant="secondary"
        onPress={async () => {
          await resendEmailCode();
          setMessage(t('verifyEmail.resent'));
        }}
      />
    </Screen>
  );
}
