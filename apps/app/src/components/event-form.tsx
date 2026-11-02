import type { Event, EventRequestWritable, Image } from '@sidequest/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useActingProfiles } from '@/hooks/use-acting-profiles';
import { useCategories } from '@/hooks/use-categories';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { Button } from './button';
import { DateTimeField } from './date-time-field';
import { LocationSearch, type Place } from './location-search';
import { RemoteImage } from './remote-image';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type EventFieldErrors = Partial<
  Record<keyof EventRequestWritable | 'non_field_errors', string[]>
>;

type EventFormProps = {
  /** An event to edit, or to copy when duplicating. */
  initial?: Event;
  /** Editing keeps the organizer; creating (also duplicating) lets you choose it. */
  mode: 'create' | 'edit';
  submitLabel: string;
  /** Saves the event; resolves to field errors if the API rejected it. */
  onSubmit: (body: EventRequestWritable) => Promise<EventFieldErrors | null>;
};

const HOUR = 60 * 60 * 1000;

function tomorrowEvening() {
  const date = new Date(Date.now() + 24 * HOUR);
  date.setHours(18, 0, 0, 0);
  return date;
}

export function EventForm({ initial, mode, submitLabel, onSubmit }: EventFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { categories } = useCategories();
  const acting = useActingProfiles();
  const upload = useImageUpload();

  const defaultStart = initial ? new Date(initial.starts_at) : tomorrowEvening();
  const [organizer, setOrganizer] = useState(initial?.organizer.handle);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(
    initial ? new Date(initial.ends_at) : new Date(defaultStart.getTime() + 2 * HOUR),
  );
  const [venueName, setVenueName] = useState(initial?.venue_name ?? '');
  const [place, setPlace] = useState<Place>({
    address: initial?.address ?? '',
    location: initial?.location ?? null,
  });
  const [online, setOnline] = useState(Boolean(initial?.online_url));
  const [onlineUrl, setOnlineUrl] = useState(initial?.online_url ?? '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initial?.categories ?? []);
  const [cover, setCover] = useState<Image | null>(initial?.cover ?? null);
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : '');
  const [free, setFree] = useState(!initial?.price);
  const [price, setPrice] = useState(initial?.price ?? '');
  const [ticketUrl, setTicketUrl] = useState(initial?.ticket_url ?? '');
  const [errors, setErrors] = useState<EventFieldErrors>({});

  const changeStart = (date: Date) => {
    setStartsAt(date);
    // Keep the end after the start, with the same length as before.
    if (endsAt <= date) {
      setEndsAt(new Date(date.getTime() + 2 * HOUR));
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const body: EventRequestWritable = {
        title,
        description,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        venue_name: venueName,
        address: place.address,
        location: place.location,
        online_url: online ? onlineUrl : '',
        categories: selectedCategories,
        cover_id: cover?.id ?? null,
        capacity: capacity ? Number(capacity) : null,
        price: free || !price ? null : price.replace(',', '.'),
        ticket_url: ticketUrl,
        ...(mode === 'create' && organizer ? { organizer_handle: organizer } : {}),
      };
      const fieldErrors = await onSubmit(body);
      if (fieldErrors) {
        setErrors(fieldErrors);
        throw new Error('invalid');
      }
    },
  });

  const errorsFor = (field: keyof EventFieldErrors) =>
    errors[field]?.map((message) => (
      <ThemedText key={message} type="small" themeColor="danger">
        {message}
      </ThemedText>
    ));

  async function pickCover() {
    const result = await upload.pickAndUpload({ aspect: [16, 9] });
    if (result?.status === 'ok') {
      setCover(result.image);
    }
  }

  return (
    <>
      {mode === 'create' && acting.length > 1 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">{t('eventForm.publishAs')}</ThemedText>
          <View style={styles.chips}>
            {acting.map((profile) => {
              const selected = (organizer ?? acting[0]?.handle) === profile.handle;
              return (
                <Pressable
                  key={profile.handle}
                  role="radio"
                  aria-checked={selected}
                  onPress={() => setOrganizer(profile.handle)}
                  style={[
                    styles.organizer,
                    {
                      backgroundColor: selected
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                    },
                  ]}>
                  <Avatar name={profile.display_name} image={profile.avatar} size={24} />
                  <ThemedText type="small">{profile.display_name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Pressable onPress={pickCover} accessibilityLabel={t('eventForm.cover')}>
        {cover ? (
          <RemoteImage image={cover} style={styles.cover} contentFit="cover" />
        ) : (
          <ThemedView type="backgroundElement" style={[styles.cover, styles.coverEmpty]}>
            <ThemedText themeColor="textSecondary">
              {upload.uploading ? t('eventForm.uploading') : t('eventForm.cover')}
            </ThemedText>
          </ThemedView>
        )}
      </Pressable>

      <TextField
        label={t('eventForm.title')}
        value={title}
        onChangeText={setTitle}
        maxLength={200}
      />
      {errorsFor('title')}
      <TextField
        label={t('eventForm.description')}
        value={description}
        onChangeText={setDescription}
        multiline
        style={styles.multiline}
      />

      <DateTimeField label={t('eventForm.startsAt')} value={startsAt} onChange={changeStart} />
      <DateTimeField
        label={t('eventForm.endsAt')}
        value={endsAt}
        onChange={setEndsAt}
        minimumDate={startsAt}
      />
      {errorsFor('ends_at')}

      <TextField label={t('eventForm.venue')} value={venueName} onChangeText={setVenueName} />
      <LocationSearch value={place} onChange={setPlace} />

      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>{t('eventForm.online')}</ThemedText>
        <Switch
          value={online}
          onValueChange={setOnline}
          accessibilityLabel={t('eventForm.online')}
        />
      </View>
      {online ? (
        <>
          <TextField
            label={t('eventForm.onlineUrl')}
            value={onlineUrl}
            onChangeText={setOnlineUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          {errorsFor('online_url')}
        </>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('eventForm.categories')}</ThemedText>
        <View style={styles.chips}>
          {categories.map((category) => {
            const selected = selectedCategories.includes(category.slug);
            return (
              <Pressable
                key={category.slug}
                role="checkbox"
                aria-checked={selected}
                onPress={() =>
                  setSelectedCategories((current) =>
                    selected
                      ? current.filter((slug) => slug !== category.slug)
                      : [...current, category.slug],
                  )
                }
                style={[
                  styles.chip,
                  { backgroundColor: selected ? theme.tint : theme.backgroundElement },
                ]}>
                <ThemedText type="small" style={selected && { color: theme.onTint }}>
                  {category.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField
        label={t('eventForm.capacity')}
        value={capacity}
        onChangeText={(text) => setCapacity(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder={t('eventForm.capacityPlaceholder')}
      />
      {errorsFor('capacity')}

      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>{t('eventForm.free')}</ThemedText>
        <Switch value={free} onValueChange={setFree} accessibilityLabel={t('eventForm.free')} />
      </View>
      {free ? null : (
        <>
          <TextField
            label={t('eventForm.price')}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          {errorsFor('price')}
        </>
      )}
      <TextField
        label={t('eventForm.ticketUrl')}
        value={ticketUrl}
        onChangeText={setTicketUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
      {errorsFor('ticket_url')}
      {errorsFor('non_field_errors')}

      <Button
        title={submitLabel}
        disabled={!title.trim()}
        loading={submit.isPending}
        onPress={() => submit.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiline: {
    minHeight: 96,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchLabel: {
    flex: 1,
  },
});
