import type { AuthResult } from '@sidequest/api';
import { router } from 'expo-router';
import { useState } from 'react';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

type Mode = 'sign-in' | 'sign-up';

function messageFor(result: AuthResult) {
  switch (result.status) {
    case 'error':
      return result.errors.map((error) => error.message).join('\n');
    case 'pending':
      return result.flows.includes('verify_email')
        ? 'Check your inbox to verify your email address, then sign in.'
        : 'Additional steps are required to finish signing in.';
    default:
      return null;
  }
}

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
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
      setMessage(messageFor(result));
    }
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">
        {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
      </ThemedText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        onSubmitEditing={submit}
      />
      {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
      <Button
        title={mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        onPress={submit}
        loading={submitting}
        disabled={!email || !password}
      />
      <Button
        variant="secondary"
        title={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        onPress={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setMessage(null);
        }}
      />
    </Screen>
  );
}
