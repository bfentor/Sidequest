import {
  eventsCoHostCreate,
  eventsCoHostDestroy,
  eventsCoHostListOptions,
  eventsAttendeesExportRetrieve,
  eventsDestroyMutation,
  eventsPartialUpdate,
  eventsRetrieveOptions,
  eventsViewCreate,
  type Event,
  type EventStatusEnum,
} from '@sidequest/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-server';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import type { MenuAction } from '@/components/action-menu';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { Comments } from '@/components/comments';
import { ContentMenu } from '@/components/content-menu';
import { EventActions } from '@/components/event-actions';
import { EventFeedback } from '@/components/event-feedback';
import { EventPhotos } from '@/components/event-photos';
import { FriendsGoing } from '@/components/friends-going';
import { RemoteImage } from '@/components/remote-image';
import { RsvpBar } from '@/components/rsvp-bar';
import { SaveButton } from '@/components/save-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFormat } from '@/lib/format';
import { eventMetadata } from '@/lib/metadata';
import { goBack } from '@/lib/navigation';
import { saveTextFile } from '@/lib/save-file';

/** Link previews and search engine tags, rendered on the server. */
export const generateMetadata: GenerateMetadataFunction = (_request, params) =>
  eventMetadata(String(params.id));

/** Downloads (or shares, on phones) everyone who answered as a CSV file. */
async function exportAttendees(id: number) {
  const { data } = await eventsAttendeesExportRetrieve({
    path: { id },
    parseAs: 'text',
    throwOnError: true,
  });
  // Decoding the response drops the byte order mark Excel needs to read the file as UTF-8.
  const csv = String(data);
  await saveTextFile(
    `event-${id}-attendees.csv`,
    csv.startsWith('\ufeff') ? csv : `\ufeff${csv}`,
    'text/csv',
  );
}

/** What an event's organizer (or its organization's members) can do from the "…" menu. */
function organizerActions(
  event: Event,
  t: TFunction,
  onDelete: () => void,
  setStatus: (status: EventStatusEnum) => void,
): MenuAction[] {
  const statusActions: MenuAction[] =
    event.status === 'active'
      ? [
          {
            label: t('eventStatus.postpone'),
            onPress: () => setStatus('postponed'),
            confirm: {
              title: t('eventStatus.postponeConfirm'),
              message: t('eventStatus.notifyAttendees'),
              confirmLabel: t('eventStatus.postpone'),
            },
          },
          {
            label: t('eventStatus.cancel'),
            destructive: true,
            onPress: () => setStatus('cancelled'),
            confirm: {
              title: t('eventStatus.cancelConfirm'),
              message: t('eventStatus.notifyAttendees'),
              confirmLabel: t('eventStatus.cancel'),
            },
          },
        ]
      : [{ label: t('eventStatus.reactivate'), onPress: () => setStatus('active') }];
  return [
    ...statusActions,
    {
      label: t('organizerTools.announce'),
      onPress: () => router.push({ pathname: '/events/[id]/announce', params: { id: event.id } }),
    },
    {
      label: t('organizerTools.export'),
      onPress: () => exportAttendees(event.id),
    },
    {
      label: t('feedback.results'),
      onPress: () => router.push({ pathname: '/events/[id]/feedback', params: { id: event.id } }),
    },
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
  useEffect(() => {
    // Counted for the hosts' dashboard; the API ignores the hosts' own views.
    eventsViewCreate({ path: { id: Number(id) } });
  }, [id]);
  const destroy = useMutation({
    ...eventsDestroyMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      goBack('/');
    },
  });
  const setStatus = useMutation({
    mutationFn: async (status: EventStatusEnum) =>
      eventsPartialUpdate({ path: { id: Number(id) }, body: { status }, throwOnError: true }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <Screen hasHeader>
      <Stack.Screen
        options={{
          title: event?.title ?? t('event.title'),
          headerRight: event
            ? () => (
                <View style={styles.headerActions}>
                  <SaveButton event={event} />
                  <ContentMenu
                    target={{ type: 'event', id: String(event.id) }}
                    owner={event.organizer}
                    ownActions={organizerActions(
                      event,
                      t,
                      () => destroy.mutate({ path: { id: event.id } }),
                      (status) => setStatus.mutate(status),
                    )}
                  />
                </View>
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
          <EventBanners event={event} />
          <CoHostInvitation eventId={event.id} />
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
          {event.co_hosts?.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('event.withCoHosts', {
                names: event.co_hosts.map((profile) => profile.display_name).join(', '),
              })}
            </ThemedText>
          ) : null}
          {event.status === 'cancelled' ? null : <RsvpBar event={event} />}
          <FriendsGoing attendance={event.attendance} />
          {event.attendance.going + event.attendance.interested > 0 ? (
            <Link href={{ pathname: '/events/[id]/attendees', params: { id: event.id } }}>
              <ThemedText type="small" themeColor="tint">
                {t('attendees.seeAll')}
              </ThemedText>
            </Link>
          ) : null}
          <EventActions event={event} />
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
            {event.students_of ? (
              <ThemedText type="smallBold">
                {t('eventForm.studentsOf', { university: event.students_of.short_name })}
              </ThemedText>
            ) : null}
            {event.min_age ? (
              <ThemedText type="smallBold">{t('event.minAge', { age: event.min_age })}</ThemedText>
            ) : null}
            {event.ticket_url ? (
              <Pressable role="link" onPress={() => Linking.openURL(event.ticket_url ?? '')}>
                <ThemedText themeColor="tint">{t('event.tickets')}</ThemedText>
              </Pressable>
            ) : null}
          </View>
          {event.description ? <ThemedText>{event.description}</ThemedText> : null}
          <CategoryChips slugs={event.categories ?? []} />
          <EventFeedback event={event} />
          <EventPhotos event={event} />
          <Comments
            parent={{ type: 'event', id: event.id }}
            title={t('comments.questionsTitle')}
            placeholder={t('comments.askPlaceholder')}
          />
        </>
      )}
    </Screen>
  );
}

/** Cancelled, postponed, draft, scheduled and recurring notes at the top of an event. */
function EventBanners({ event }: { event: Event }) {
  const { t } = useTranslation();
  const format = useFormat();
  const notes = [
    event.status === 'cancelled' ? t('eventStatus.cancelled') : null,
    event.status === 'postponed' ? t('eventStatus.postponed') : null,
    !event.published_at ? t('eventStatus.draft') : null,
    event.published_at && new Date(event.published_at) > new Date()
      ? t('eventStatus.scheduled', { when: format.dateTime(event.published_at) })
      : null,
    event.series_id ? t('eventStatus.series') : null,
  ].filter((note) => note !== null);

  return notes.map((note) => (
    <ThemedView key={note} type="backgroundElement" style={styles.banner}>
      <ThemedText type="smallBold">{note}</ThemedText>
    </ThemedView>
  ));
}

/** Lets an invited co-host (a profile you manage) accept or decline. */
function CoHostInvitation({ eventId }: { eventId: number }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const pending = useQuery({
    ...eventsCoHostListOptions({ path: { id: eventId } }),
    enabled: status === 'signed-in',
  });
  const answer = useMutation({
    mutationFn: async ({ handle, accept }: { handle: string; accept: boolean }) => {
      const options = { path: { id: eventId, handle }, throwOnError: true } as const;
      await (accept ? eventsCoHostCreate(options) : eventsCoHostDestroy(options));
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (pending.data ?? []).map((profile) => (
    <ThemedView key={profile.handle} type="backgroundElement" style={styles.banner}>
      <ThemedText>{t('event.coHostInvite', { name: profile.display_name })}</ThemedText>
      <View style={styles.price}>
        <Button
          title={t('organizations.join')}
          onPress={() => answer.mutate({ handle: profile.handle, accept: true })}
        />
        <Button
          title={t('followRequests.decline')}
          variant="secondary"
          onPress={() => answer.mutate({ handle: profile.handle, accept: false })}
        />
      </View>
    </ThemedView>
  ));
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  banner: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
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
