import { reportsCreateMutation, type ReasonEnum } from '@sidequest/api';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import type { ReportTarget } from '@/components/content-menu';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goBack } from '@/lib/navigation';

const REASONS: ReasonEnum[] = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'false_information',
  'other',
];

export default function ReportScreen() {
  const { type, id } = useLocalSearchParams<ReportTarget>();
  const { t } = useTranslation();
  const theme = useTheme();
  const [reason, setReason] = useState<ReasonEnum | null>(null);
  const [details, setDetails] = useState('');
  const report = useMutation(reportsCreateMutation());

  if (report.isSuccess) {
    return (
      <Screen hasHeader>
        <ThemedText type="heading">{t('moderation.thanksTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('moderation.thanksMessage')}</ThemedText>
        <Button title={t('common.done')} onPress={() => goBack()} />
      </Screen>
    );
  }

  return (
    <Screen hasHeader>
      <ThemedText type="heading">{t('moderation.reportQuestion')}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.group} role="radiogroup">
        {REASONS.map((option) => {
          const selected = option === reason;
          return (
            <Pressable
              key={option}
              role="radio"
              aria-checked={selected}
              onPress={() => setReason(option)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <ThemedText style={selected && { color: theme.tint }}>
                {t(`moderation.reasons.${option}`)}
              </ThemedText>
              {selected ? <ThemedText style={{ color: theme.tint }}>✓</ThemedText> : null}
            </Pressable>
          );
        })}
      </ThemedView>
      <TextField
        label={t('moderation.details')}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        style={styles.details}
      />
      {report.isError ? (
        <ThemedText themeColor="danger">{t('errors.unexpected')}</ThemedText>
      ) : null}
      <Button
        title={t('moderation.send')}
        disabled={!reason}
        loading={report.isPending}
        onPress={() =>
          reason && report.mutate({ body: { target_type: type, target_id: id, reason, details } })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  details: {
    minHeight: 96,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
});
