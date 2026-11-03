import { profilesStatsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { WEB_URL } from '@/lib/config';
import { useFormat } from '@/lib/format';

/** How a profile you act for is doing: views, RSVPs and followers over 30 days, and per event. */
export default function DashboardScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const { data, isPending, isError } = useQuery(profilesStatsRetrieveOptions({ path: { handle } }));

  if (isPending) {
    return <ActivityIndicator style={styles.loading} />;
  }
  if (isError) {
    return (
      <Screen hasHeader>
        <ThemedText themeColor="textSecondary">{t('errors.unexpected')}</ThemedText>
      </Screen>
    );
  }

  const total = (values: number[]) => values.reduce((sum, n) => sum + n, 0);
  const newFollowers = total(data.new_followers);

  return (
    <Screen hasHeader>
      <ThemedText themeColor="textSecondary">@{handle}</ThemedText>
      <View style={styles.tiles}>
        <StatTile
          title={t('dashboard.views')}
          value={total(data.views)}
          caption={t('dashboard.last30')}
          daily={data.views}
          days={data.days}
        />
        <StatTile
          title={t('dashboard.rsvps')}
          value={total(data.rsvps)}
          caption={t('dashboard.last30')}
          daily={data.rsvps}
          days={data.days}
        />
        <StatTile
          title={t('dashboard.followers')}
          value={data.followers}
          caption={t('dashboard.newFollowers', { count: newFollowers })}
          daily={data.new_followers}
          days={data.days}
        />
      </View>

      <ThemedText type="heading">{t('dashboard.events')}</ThemedText>
      {data.events.length ? (
        <View role="table">
          <View role="row" style={styles.row}>
            <ThemedText type="smallBold" style={styles.name} role="columnheader">
              {t('dashboard.event')}
            </ThemedText>
            {[t('dashboard.views'), t('rsvp.going'), t('rsvp.interested')].map((label) => (
              <ThemedText
                key={label}
                type="smallBold"
                style={styles.number}
                numberOfLines={1}
                role="columnheader">
                {label}
              </ThemedText>
            ))}
          </View>
          {data.events.map((event) => (
            <View key={event.id} role="row" style={styles.row}>
              <View style={styles.name} role="cell">
                <Link href={{ pathname: '/events/[id]', params: { id: event.id } }}>
                  <ThemedText type="small" themeColor="tint" numberOfLines={2}>
                    {event.title}
                  </ThemedText>
                </Link>
                <ThemedText type="small" themeColor="textSecondary">
                  {format.dateTime(event.starts_at)}
                </ThemedText>
              </View>
              {[event.views, event.going, event.interested].map((value, index) => (
                <ThemedText key={index} type="small" style={styles.number} role="cell">
                  {value}
                </ThemedText>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <ThemedText themeColor="textSecondary">{t('dashboard.noEvents')}</ThemedText>
      )}
      <ThemedText type="heading">{t('embed.dashboardTitle')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('embed.dashboardHint')}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.snippet}>
        <ThemedText type="code" selectable>
          {`<iframe src="${WEB_URL}/embed/${handle}" title="Sidequest" width="100%" height="480" style="border:0"></iframe>`}
        </ThemedText>
      </ThemedView>
      <Button
        title={t('calendarSync.open')}
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/profiles/[handle]/calendars', params: { handle } })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 64,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  name: {
    flex: 1,
  },
  snippet: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  number: {
    width: 76,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
