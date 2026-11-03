import {
  profilesCalendarsCreate,
  profilesCalendarsDestroy,
  profilesCalendarsListOptions,
  profilesCalendarsListQueryKey,
  type CalendarSource,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';

/** The messages in a DRF error response ({"field": ["…"]} or ["…"]). */
function messagesOf(error: unknown): string[] {
  if (Array.isArray(error)) return error.map(String);
  if (error && typeof error === 'object') return Object.values(error).flatMap(messagesOf);
  return [];
}

/** Calendars (iCal feeds) whose events a profile imports and keeps in sync. */
export default function CalendarsScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const queryKey = profilesCalendarsListQueryKey({ path: { handle } });
  const sources = useQuery(profilesCalendarsListOptions({ path: { handle } }));
  const refresh = () => queryClient.invalidateQueries();

  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await profilesCalendarsCreate({ path: { handle }, body: { url } });
      if (!data) throw error;
      return data;
    },
    onSuccess: (source) => {
      queryClient.setQueryData<CalendarSource[]>(queryKey, (current = []) => [...current, source]);
      setUrl('');
      setErrors([]);
      refresh();
    },
    onError: (error) => {
      const messages = messagesOf(error);
      setErrors(messages.length ? messages : [t('errors.unexpected')]);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) =>
      profilesCalendarsDestroy({ path: { handle, id }, throwOnError: true }),
    onSuccess: refresh,
  });

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText themeColor="textSecondary">{t('calendarSync.intro')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('calendarSync.help')}
      </ThemedText>
      {sources.isPending ? <ActivityIndicator /> : null}
      {sources.data?.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          removing={remove.isPending && remove.variables === source.id}
          onRemove={() => remove.mutate(source.id)}
        />
      ))}
      <TextField
        label={t('calendarSync.address')}
        value={url}
        onChangeText={setUrl}
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {errors.map((message) => (
        <ThemedText key={message} type="small" themeColor="danger">
          {message}
        </ThemedText>
      ))}
      <Button
        title={t('calendarSync.add')}
        disabled={!url.trim()}
        loading={add.isPending}
        onPress={() => add.mutate()}
      />
    </Screen>
  );
}

function SourceCard({
  source,
  removing,
  onRemove,
}: {
  source: CalendarSource;
  removing: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const status =
    source.error === 'fetch'
      ? t('calendarSync.errorFetch')
      : source.error === 'parse'
        ? t('calendarSync.errorParse')
        : source.synced_at
          ? t('calendarSync.synced', {
              when: format.dateTime(source.synced_at),
              count: source.event_count,
            })
          : t('calendarSync.pending');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" numberOfLines={1}>
        {source.url}
      </ThemedText>
      <ThemedText type="small" themeColor={source.error ? 'danger' : 'textSecondary'}>
        {status}
      </ThemedText>
      <Button
        title={t('calendarSync.remove')}
        variant="secondary"
        loading={removing}
        onPress={onRemove}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
