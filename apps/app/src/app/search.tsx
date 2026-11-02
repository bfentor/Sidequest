import { searchRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EventCard } from '@/components/event-card';
import { ProfileRow } from '@/components/profile-row';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function SearchScreen() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    ...searchRetrieveOptions({ query: { q: query } }),
    enabled: query.length >= 2,
    placeholderData: (previous) => previous,
  });
  const profiles = results.data?.profiles ?? [];
  const events = results.data?.events ?? [];

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <TextField
        label={t('search.label')}
        value={text}
        onChangeText={setText}
        placeholder={t('search.placeholder')}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />
      {results.isFetching && !results.data ? <ActivityIndicator /> : null}
      {query.length >= 2 && results.data && profiles.length + events.length === 0 ? (
        <ThemedText themeColor="textSecondary">{t('search.nothing', { query })}</ThemedText>
      ) : null}
      {profiles.length ? (
        <View style={styles.section}>
          <ThemedText type="heading">{t('search.people')}</ThemedText>
          {profiles.map((profile) => (
            <ProfileRow key={profile.handle} profile={profile} />
          ))}
        </View>
      ) : null}
      {events.length ? (
        <View style={styles.section}>
          <ThemedText type="heading">{t('search.events')}</ThemedText>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
});
