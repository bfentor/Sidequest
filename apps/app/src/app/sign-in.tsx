import type { AuthResult } from '@sidequest/api';
import { Link, router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { toIsoDate } from '@/lib/dates';
import { authErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';

type Mode = 'sign-in' | 'sign-up';

// Nobody this young can sign up anyway; the API checks the real minimum age.
const LATEST_BIRTH_DATE = new Date(2020, 0, 1);

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
  // A plausible starting point for the birth date picker; people adjust it.
  const [birthDate, setBirthDate] = useState(() => new Date(2005, 0, 1));
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    const result =
      mode === 'sign-in'
        ? await signIn({ email, password })
        : await signUp({
            email,
            password,
            birth_date: toIsoDate(birthDate),
            accept_terms: acceptTerms,
          });
    setSubmitting(false);
    if (result.status === 'authenticated') {
      goBack();
    } else if (result.status === 'pending' && result.flows.includes('verify_email')) {
      router.replace('/verify-email');
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
      {mode === 'sign-up' ? (
        <>
          <DateTimeField
            label={t('auth.birthDate')}
            mode="date"
            value={birthDate}
            onChange={setBirthDate}
            maximumDate={LATEST_BIRTH_DATE}
          />
          <Checkbox
            checked={acceptTerms}
            onChange={setAcceptTerms}
            accessibilityLabel={t('auth.acceptTermsShort')}
            label={
              <ThemedText type="small">
                {t('auth.acceptTermsStart')}
                <Link href={{ pathname: '/legal/[document]', params: { document: 'terms' } }}>
                  <ThemedText type="small" themeColor="tint">
                    {t('auth.termsLink')}
                  </ThemedText>
                </Link>
                {t('auth.acceptTermsAnd')}
                <Link href={{ pathname: '/legal/[document]', params: { document: 'privacy' } }}>
                  <ThemedText type="small" themeColor="tint">
                    {t('auth.privacyLink')}
                  </ThemedText>
                </Link>
                .
              </ThemedText>
            }
          />
        </>
      ) : null}
      {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
      <Button
        title={mode === 'sign-in' ? t('common.signIn') : t('auth.signUp')}
        onPress={submit}
        loading={submitting}
        disabled={!email || !password || (mode === 'sign-up' && !acceptTerms)}
      />
      {mode === 'sign-in' ? (
        <Link href="/forgot-password">
          <ThemedText type="small" themeColor="tint">
            {t('auth.forgotPassword')}
          </ThemedText>
        </Link>
      ) : null}
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
