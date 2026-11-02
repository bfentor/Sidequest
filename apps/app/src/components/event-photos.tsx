import { eventsPhotosListOptions, type Event } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Spacing } from '@/constants/theme';

import { Button } from './button';
import { RemoteImage } from './remote-image';
import { ThemedText } from './themed-text';

// The newest photos shown on the event page.
const SHOWN = 12;

/**
 * Photos people posted about an event, once it has started. Each opens the
 * post it came from; adding one writes a post that shares the event.
 */
export function EventPhotos({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const started = new Date(event.starts_at) <= new Date();
  const photos = useQuery({
    ...eventsPhotosListOptions({ path: { id: event.id }, query: { limit: SHOWN } }),
    enabled: started,
  });

  if (!started || event.status === 'cancelled') {
    return null;
  }

  const results = photos.data?.results ?? [];
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{t('eventPhotos.title')}</ThemedText>
      {results.length ? (
        <View style={styles.grid}>
          {results.map(({ image, post_id, author }) => (
            <Link
              key={`${post_id}-${image.id}`}
              href={{ pathname: '/posts/[id]', params: { id: post_id } }}
              asChild>
              <Pressable
                style={styles.cell}
                accessibilityLabel={t('eventPhotos.by', { name: author.display_name })}>
                <RemoteImage image={image} style={styles.photo} contentFit="cover" />
              </Pressable>
            </Link>
          ))}
        </View>
      ) : photos.isSuccess ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('eventPhotos.empty')}
        </ThemedText>
      ) : null}
      {status === 'signed-in' ? (
        <Button
          title={t('eventPhotos.add')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/posts/new', params: { event: event.id } })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  cell: {
    // Three to a row, with the gaps between them.
    width: '32.5%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    aspectRatio: undefined,
  },
});
