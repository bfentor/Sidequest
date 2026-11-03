import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/lib/config';
import { useFormat } from '@/lib/format';

import { ThemedText } from './themed-text';

type Health = { version: string; commit?: string };

/** "0.1.0 (abc1234)": the version, and the commit it was built from when known. */
function versionLabel(version: string, commit?: string) {
  return commit ? `${version} (${commit.slice(0, 7)})` : version;
}

/**
 * Which build is running, for development and bug reports: the app's version
 * and commit, the API's (and which server it is), and on phones the
 * over-the-air update in use. Selectable, so it can be copied.
 */
export function BuildInfo() {
  const { t } = useTranslation();
  const format = useFormat();
  const api = useQuery({
    queryKey: ['healthz', API_URL],
    queryFn: async (): Promise<Health> => (await fetch(`${API_URL}/healthz`)).json(),
    staleTime: 60 * 1000,
  });
  const app = versionLabel(
    Constants.expoConfig?.version ?? '?',
    Constants.expoConfig?.extra?.commit as string | undefined,
  );
  const host = API_URL.replace(/^https?:\/\//, '');
  const lines = [
    t('settings.buildApp', { version: app }),
    t('settings.buildApi', {
      version: api.data ? versionLabel(api.data.version, api.data.commit) : '…',
      host,
    }),
    // Phones running an over-the-air update rather than the code they were built with.
    Updates.updateId && !Updates.isEmbeddedLaunch
      ? t('settings.buildUpdate', {
          id: Updates.updateId.slice(0, 8),
          date: Updates.createdAt ? format.dateTime(Updates.createdAt) : '?',
        })
      : null,
  ].filter((line) => line !== null);

  return (
    <View style={styles.info}>
      {lines.map((line) => (
        <ThemedText key={line} type="small" themeColor="textSecondary" selectable>
          {line}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  info: {
    gap: 2,
  },
});
