import { eventsDestroyMutation, eventsRetrieveOptions, type Event } from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import type { MenuAction } from '@/components/action-menu';
import { CategoryChips } from '@/components/category-chips';
import { ContentMenu } from '@/components/content-menu';
import { RemoteImage } from '@/components/remote-image';
import { RsvpBar } from '@/components/rsvp-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';
import { goBack } from '@/lib/navigation';

/** What an event's organizer (or its organization's members) can do from the "…" menu. */
function organizerActions(event: Event, t: TFunction, onDelete: () => void): MenuAction[] {
  return [
    {
      label: t('eventForm.edit'),
      onPress: () => router.push({ pathname: '/events/[id]/edit', params: { id: event.id } }),
    },
    {
      label: t('eventForm.duplicate'),
      onPress: () => router.push({ pathname: '/events/new', params: { from: event.id } }),
    },
    {
      label: t('eventForm.delete'),
      destructive: true,
      onPress: onDelete,
      confirm: {
        title: t('eventForm.deleteConfirmTitle'),
        message: t('eventForm.deleteConfirmMessage'),
        confirmLabel: t('common.delete'),
      },
    },
  ];
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const {
    data: event,
    isPending,
    isError,
  } = useQuery(eventsRetrieveOptions({ path: { id: Number(id) } }));
  const destroy = useMutation({
    ...eventsDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      goBack('/');
    },
  });

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{
          title: event?.title ?? t('event.title'),
          headerRight: event
            ? () => (
                <ContentMenu
                  target={{ type: 'event', id: String(event.id) }}
                  owner={event.organizer}
                  ownActions={organizerActions(event, t, () =>
                    destroy.mutate({ path: { id: event.id } }),
                  )}
                />
              )
            : undefined,
        }}
      />
      {isPending ? (
        <ActivityIndicator />
      ) : isError ? (
        <ThemedText themeColor="textSecondary">{t('event.loadFailed')}</ThemedText>
      ) : (
        <>
          {event.cover ? (
            <RemoteImage image={event.cover} style={styles.cover} contentFit="cover" />
          ) : null}
          <ThemedText type="smallBold" themeColor="tint">
            {format.eventTime(event.starts_at, event.ends_at)}
          </ThemedText>
          <ThemedText type="subtitle">{event.title}</ThemedText>
          <Link
            href={{ pathname: '/profiles/[handle]', params: { handle: event.organizer.handle } }}>
            <ThemedText themeColor="textSecondary">
              {t('event.byOrganizerWithHandle', {
                name: event.organizer.display_name,
                handle: event.organizer.handle,
              })}
            </ThemedText>
          </Link>
          <RsvpBar event={event} />
          {event.venue_name || event.address ? (
            <ThemedText>{[event.venue_name, event.address].filter(Boolean).join(', ')}</ThemedText>
          ) : null}
          {event.online_url ? (
            <Pressable role="link" onPress={() => Linking.openURL(event.online_url ?? '')}>
              <ThemedText themeColor="tint">{t('event.joinOnline')}</ThemedText>
            </Pressable>
          ) : null}
          <View style={styles.price}>
            <ThemedText>{event.price ? format.price(event.price) : t('event.free')}</ThemedText>
            {event.ticket_url ? (
              <Pressable role="link" onPress={() => Linking.openURL(event.ticket_url ?? '')}>
                <ThemedText themeColor="tint">{t('event.tickets')}</ThemedText>
              </Pressable>
            ) : null}
          </View>
          {event.description ? <ThemedText>{event.description}</ThemedText> : null}
          <CategoryChips slugs={event.categories ?? []} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
  },
  price: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
