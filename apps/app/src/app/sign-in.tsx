import type { AuthResult } from '@sidequest/api';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage } from '@/lib/errors';

type Mode = 'sign-in' | 'sign-up';

function messageFor(result: AuthResult, t: TFunction) {
  switch (result.status) {
    case 'error':
      return authErrorMessage(result.errors, t);
    case 'pending':
      return result.flows.includes('verify_email') ? t('auth.verifyEmail') : t('auth.moreSteps');
    default:
      return null;
  }
}

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    const result = await (mode === 'sign-in' ? signIn : signUp)({ email, password });
    setSubmitting(false);
    if (result.status === 'authenticated') {
      router.back();
    } else {
      setMessage(messageFor(result, t));
    }
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">
        {mode === 'sign-in' ? t('auth.signInTitle') : t('auth.signUpTitle')}
      </ThemedText>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        onSubmitEditing={submit}
      />
      {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
      <Button
        title={mode === 'sign-in' ? t('common.signIn') : t('auth.signUp')}
        onPress={submit}
        loading={submitting}
        disabled={!email || !password}
      />
      <Button
        variant="secondary"
        title={mode === 'sign-in' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
        onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setMessage(null);
        }}
      />
    </Screen>
  );
}
