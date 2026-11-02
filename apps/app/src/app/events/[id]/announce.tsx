import { eventsAnnouncementsCreateMutation } from '@sidequest/api';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** A message to everyone going, interested or waitlisted, sent as a notification. */
export default function AnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const send = useMutation(eventsAnnouncementsCreateMutation());

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText themeColor="textSecondary">{t('organizerTools.announceHint')}</ThemedText>
      <TextField
        label={t('organizerTools.message')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        style={styles.message}
      />
      {send.isSuccess ? (
        <ThemedText role="status">{t('organizerTools.sent', { count: send.data.sent })}</ThemedText>
      ) : null}
      {send.isError ? <ThemedText themeColor="danger">{t('errors.unexpected')}</ThemedText> : null}
      <Button
        title={t('organizerTools.send')}
        disabled={!message.trim() || send.isSuccess}
        loading={send.isPending}
        onPress={() => send.mutate({ path: { id: Number(id) }, body: { message } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    minHeight: 120,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
});
