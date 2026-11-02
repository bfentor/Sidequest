import {
  activateTotp,
  deactivateTotp,
  endSessions,
  getRecoveryCodes,
  getTotp,
  listSessions,
  reauthenticate,
  regenerateRecoveryCodes,
} from '@sidequest/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage } from '@/lib/errors';
import { useFormat } from '@/lib/format';

import { Button } from './button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Two-factor sign-in and the list of signed-in sessions. */
export function SecuritySection() {
  return (
    <>
      <TwoFactor />
      <Sessions />
    </>
  );
}

type Step = 'idle' | 'password' | 'setup' | 'codes';

function TwoFactor() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const totp = useQuery({ queryKey: ['totp'], queryFn: getTotp });
  const [step, setStep] = useState<Step>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  // What the password confirms: turning on, turning off, or new recovery codes.
  const [intent, setIntent] = useState<'enable' | 'disable' | 'codes'>('enable');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['totp'] });

  async function confirmPassword() {
    const errors = await reauthenticate(password);
    setPassword('');
    if (errors) {
      setMessage(authErrorMessage(errors, t));
      return;
    }
    setMessage(null);
    if (intent === 'enable') {
      setStep('setup');
    } else if (intent === 'disable') {
      const problem = await deactivateTotp();
      setMessage(problem ? authErrorMessage(problem, t) : t('twoFactor.disabled'));
      setStep('idle');
      refresh();
    } else {
      await regenerateRecoveryCodes();
      setCodes(await getRecoveryCodes());
      setStep('codes');
    }
  }

  async function activate() {
    const errors = await activateTotp(code);
    setCode('');
    if (errors) {
      setMessage(authErrorMessage(errors, t));
      return;
    }
    setMessage(null);
    setCodes(await getRecoveryCodes());
    setStep('codes');
    refresh();
  }

  const start = (next: typeof intent) => {
    setIntent(next);
    setMessage(null);
    setStep('password');
  };

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('twoFactor.title')}</ThemedText>
      {step === 'password' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('twoFactor.confirmPassword')}
          </ThemedText>
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <Button title={t('twoFactor.continue')} disabled={!password} onPress={confirmPassword} />
          <Button title={t('common.cancel')} variant="secondary" onPress={() => setStep('idle')} />
        </>
      ) : step === 'setup' && totp.data && !totp.data.active ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('twoFactor.scan')}
          </ThemedText>
          <View style={styles.qr}>
            <QRCode value={totp.data.url} size={180} backgroundColor="#ffffff" color="#000000" />
          </View>
          <Pressable
            role="link"
            onPress={() => totp.data && !totp.data.active && Linking.openURL(totp.data.url)}>
            <ThemedText type="small" themeColor="tint">
              {t('twoFactor.openApp')}
            </ThemedText>
          </Pressable>
          <ThemedText type="code" selectable>
            {totp.data.secret}
          </ThemedText>
          <TextField
            label={t('twoFactor.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button title={t('twoFactor.turnOn')} disabled={code.length < 6} onPress={activate} />
        </>
      ) : step === 'codes' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('twoFactor.recoveryHint')}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.codes}>
            <ThemedText type="code" selectable>
              {codes.join('\n')}
            </ThemedText>
          </ThemedView>
          <Button title={t('common.done')} onPress={() => setStep('idle')} />
        </>
      ) : totp.data?.active ? (
        <>
          <ThemedText>{t('twoFactor.on')}</ThemedText>
          <Button
            title={t('twoFactor.newCodes')}
            variant="secondary"
            onPress={() => start('codes')}
          />
          <Button
            title={t('twoFactor.turnOff')}
            variant="secondary"
            onPress={() => start('disable')}
          />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('twoFactor.offHint')}
          </ThemedText>
          <Button
            title={t('twoFactor.turnOn')}
            variant="secondary"
            onPress={() => start('enable')}
          />
        </>
      )}
      {message ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Sessions() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: listSessions });
  const others = (sessions.data ?? []).filter((session) => !session.is_current);

  async function signOut(ids: number[]) {
    await endSessions(ids);
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('sessions.title')}</ThemedText>
      {sessions.data?.map((session) => (
        <View key={session.id} style={styles.session}>
          <View style={styles.sessionText}>
            <ThemedText type="smallBold">
              {session.is_current
                ? t('sessions.thisDevice')
                : session.user_agent || t('sessions.unknownDevice')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('sessions.lastSeen', {
                when: format.dateTime(
                  new Date((session.last_seen_at ?? session.created_at) * 1000),
                ),
              })}
            </ThemedText>
          </View>
          {session.is_current ? null : (
            <Button
              title={t('common.signOut')}
              variant="secondary"
              onPress={() => signOut([session.id])}
            />
          )}
        </View>
      ))}
      {others.length > 1 ? (
        <Button
          title={t('sessions.signOutOthers')}
          variant="secondary"
          onPress={() => signOut(others.map((session) => session.id))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  qr: {
    alignSelf: 'flex-start',
    padding: Spacing.two,
    backgroundColor: '#ffffff',
    borderRadius: Spacing.two,
  },
  codes: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sessionText: {
    flex: 1,
  },
});
