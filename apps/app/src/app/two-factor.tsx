import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

/** The second sign-in step for accounts with two-factor sign-in on. */
export default function TwoFactorScreen() {
  const { t } = useTranslation();
  const { authenticateTwoFactor } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const result = await authenticateTwoFactor(code);
    setSubmitting(false);
    if (result.status === 'authenticated') {
      goBack('/');
    } else {
      setMessage(
        result.status === 'error' ? authErrorMessage(result.errors, t) : t('twoFactor.expired'),
      );
    }
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText themeColor="textSecondary">{t('twoFactor.hint')}</ThemedText>
      <TextField
        label={t('twoFactor.code')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
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
    </Screen>
  );
}
