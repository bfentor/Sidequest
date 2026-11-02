import {
  meStudentCreate,
  meStudentDestroy,
  meStudentRetrieveOptions,
  meStudentRetrieveQueryKey,
  meStudentVerifyCreate,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';

import { Button } from './button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';

/** First message of a DRF field error, e.g. {"code": ["The code is wrong."]}. */
function firstError(error: unknown, field: string) {
  return (error as Record<string, string[] | undefined> | undefined)?.[field]?.[0] ?? null;
}

/** Show you study at a university: a code is sent to your university email address. */
export function StudentSection() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const queryKey = meStudentRetrieveQueryKey();
  const status = useQuery(meStudentRetrieveOptions());
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await meStudentCreate({ body: { email } });
      setMessage(error ? firstError(error, 'email') : null);
      setCodeSent(!error);
    },
  });
  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await meStudentVerifyCreate({ body: { code } });
      setMessage(error ? firstError(error, 'code') : null);
      if (!error) {
        setCodeSent(false);
        setCode('');
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  const remove = useMutation({
    mutationFn: () => meStudentDestroy({ throwOnError: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const current = status.data?.is_current ? status.data : null;

  return (
    <View style={styles.section}>
      <ThemedText type="heading">{t('student.title')}</ThemedText>
      {current ? (
        <>
          <ThemedText>
            {t('student.verified', {
              university: current.university.name,
              date: format.date(current.verified_at),
            })}
          </ThemedText>
          <Button title={t('student.remove')} variant="secondary" onPress={() => remove.mutate()} />
        </>
      ) : codeSent ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('student.codeSent', { email })}
          </ThemedText>
          <TextField
            label={t('verifyEmail.code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            title={t('verifyEmail.verify')}
            disabled={code.length < 6}
            loading={verify.isPending}
            onPress={() => verify.mutate()}
          />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('student.hint')}
          </ThemedText>
          <TextField
            label={t('student.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title={t('student.sendCode')}
            variant="secondary"
            disabled={!email}
            loading={send.isPending}
            onPress={() => send.mutate()}
          />
        </>
      )}
      {message ? <ThemedText themeColor="danger">{message}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
