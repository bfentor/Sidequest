import type {
  Event,
  EventRequestWritable,
  EventVisibilityEnum,
  FrequencyEnum,
  Image,
} from '@sidequest/api';
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
import { SegmentedControl } from './segmented-control';
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

  // Computed once, not on every render.
  const [defaultStart] = useState(() =>
    initial ? new Date(initial.starts_at) : tomorrowEvening(),
  );
  const [openedAt] = useState(() => new Date());
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
  const [adultsOnly, setAdultsOnly] = useState(initial?.min_age === 18);
  const [visibility, setVisibility] = useState<EventVisibilityEnum>(
    initial?.visibility ?? 'public',
  );
  const isDraft = mode === 'edit' && !initial?.published_at;
  const [publishMode, setPublishMode] = useState<'now' | 'schedule' | 'draft'>(
    mode === 'edit' ? (isDraft ? 'draft' : 'now') : 'now',
  );
  const [publishAt, setPublishAt] = useState(() => new Date(openedAt.getTime() + HOUR));
  const [repeat, setRepeat] = useState<FrequencyEnum | 'none'>('none');
  const [repeatCount, setRepeatCount] = useState('4');
  const [coHosts, setCoHosts] = useState<string[]>(
    initial?.co_hosts?.map((profile) => profile.handle) ?? [],
  );
  const [coHostInput, setCoHostInput] = useState('');
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
        min_age: adultsOnly ? 18 : null,
        visibility,
        co_host_handles: coHosts,
        ...(mode === 'create' && organizer ? { organizer_handle: organizer } : {}),
        ...(mode === 'create' && repeat !== 'none'
          ? { repeat: { frequency: repeat, count: Number(repeatCount) || 2 } }
          : {}),
        // Published events keep their publishing time when edited.
        ...(mode === 'create' || isDraft
          ? {
              published_at:
                publishMode === 'draft'
                  ? null
                  : publishMode === 'schedule'
                    ? publishAt.toISOString()
                    : new Date().toISOString(),
            }
          : {}),
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

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <ThemedText>{t('eventForm.adultsOnly')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('eventForm.adultsOnlyHint')}
          </ThemedText>
        </View>
        <Switch
          value={adultsOnly}
          onValueChange={setAdultsOnly}
          accessibilityLabel={t('eventForm.adultsOnly')}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('eventForm.visibility')}</ThemedText>
        <SegmentedControl
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'public', label: t('eventForm.visibilityPublic') },
            { value: 'followers', label: t('eventForm.visibilityFollowers') },
            { value: 'unlisted', label: t('eventForm.visibilityUnlisted') },
          ]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t(`eventForm.visibilityHint.${visibility}`)}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">{t('eventForm.coHosts')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('eventForm.coHostsHint')}
        </ThemedText>
        <View style={styles.coHostInput}>
          <View style={styles.coHostField}>
            <TextField
              label={t('editProfile.handle')}
              value={coHostInput}
              onChangeText={setCoHostInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button
            title={t('eventForm.addCoHost')}
            variant="secondary"
            disabled={!coHostInput.trim()}
            onPress={() => {
              const handle = coHostInput.replace(/^@/, '').trim().toLowerCase();
              setCoHosts((current) => (current.includes(handle) ? current : [...current, handle]));
              setCoHostInput('');
            }}
          />
        </View>
        <View style={styles.chips}>
          {coHosts.map((handle) => (
            <Pressable
              key={handle}
              accessibilityLabel={t('eventForm.removeCoHost', { handle })}
              onPress={() => setCoHosts((current) => current.filter((h) => h !== handle))}
              style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">@{handle} ✕</ThemedText>
            </Pressable>
          ))}
        </View>
        {errorsFor('co_host_handles')}
      </View>

      {mode === 'create' ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">{t('eventForm.repeat')}</ThemedText>
          <SegmentedControl
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'none', label: t('eventForm.repeatNone') },
              { value: 'weekly', label: t('eventForm.repeatWeekly') },
              { value: 'biweekly', label: t('eventForm.repeatBiweekly') },
              { value: 'monthly', label: t('eventForm.repeatMonthly') },
            ]}
          />
          {repeat !== 'none' ? (
            <TextField
              label={t('eventForm.repeatCount')}
              value={repeatCount}
              onChangeText={(text) => setRepeatCount(text.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />
          ) : null}
          {errorsFor('repeat')}
        </View>
      ) : null}

      {mode === 'create' || isDraft ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">{t('eventForm.publishing')}</ThemedText>
          <SegmentedControl
            value={publishMode}
            onChange={setPublishMode}
            options={[
              { value: 'now', label: t('eventForm.publishNow') },
              { value: 'schedule', label: t('eventForm.schedule') },
              { value: 'draft', label: t('eventForm.draft') },
            ]}
          />
          {publishMode === 'schedule' ? (
            <DateTimeField
              label={t('eventForm.publishAt')}
              value={publishAt}
              onChange={setPublishAt}
              minimumDate={openedAt}
            />
          ) : null}
        </View>
      ) : null}
      {errorsFor('non_field_errors')}

      <Button
        title={
          (mode === 'create' || isDraft) && publishMode !== 'now'
            ? t(publishMode === 'draft' ? 'eventForm.saveDraft' : 'eventForm.schedule')
            : submitLabel
        }
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
  coHostInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  coHostField: {
    flex: 1,
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
