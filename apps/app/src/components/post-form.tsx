import type { Image, Post, PostRequestWritable } from '@sidequest/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useImageUpload } from '@/hooks/use-image-upload';

import { ActingAsPicker } from './acting-as-picker';
import { Button } from './button';
import { EventCard } from './event-card';
import { IconButton } from './icon-button';
import { RemoteImage } from './remote-image';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';

export const MAX_POST_IMAGES = 4;

export type PostFieldErrors = Partial<
  Record<keyof PostRequestWritable | 'non_field_errors', string[]>
>;

type PostFormProps = {
  mode: 'create' | 'edit';
  initial?: Pick<Post, 'body' | 'images' | 'event'>;
  submitLabel: string;
  /** Resolves to the server's field errors, or null once saved. */
  onSubmit: (body: PostRequestWritable) => Promise<PostFieldErrors | null>;
};

/** Text, up to four pictures and an optional shared event; posting as yourself or an organization. */
export function PostForm({ mode, initial, submitLabel, onSubmit }: PostFormProps) {
  const { t } = useTranslation();
  const upload = useImageUpload();
  const [body, setBody] = useState(initial?.body ?? '');
  const [images, setImages] = useState<Image[]>(initial?.images ?? []);
  const [author, setAuthor] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [errors, setErrors] = useState<PostFieldErrors>({});
  const event = initial?.event ?? null;

  const submit = useMutation({
    mutationFn: async () => {
      const fieldErrors = await onSubmit({
        body,
        image_ids: images.map((image) => image.id),
        ...(mode === 'create' ? { event_id: event?.id ?? null } : {}),
        ...(mode === 'create' && author ? { author_handle: author } : {}),
      });
      if (fieldErrors) {
        setErrors(fieldErrors);
        throw new Error('invalid');
      }
    },
  });

  async function addImage() {
    setUploadError(undefined);
    const result = await upload.pickAndUpload();
    if (result?.status === 'ok') {
      setImages((current) => [...current, result.image]);
    } else if (result) {
      setUploadError(result.message ?? t('errors.unexpected'));
    }
  }

  const messages = Object.values(errors).flat();
  const empty = !body.trim() && !images.length && !event;

  return (
    <>
      {mode === 'create' ? (
        <ActingAsPicker label={t('posts.postAs')} value={author} onChange={setAuthor} />
      ) : null}
      <TextField
        label={t('posts.body')}
        value={body}
        onChangeText={setBody}
        placeholder={event ? t('posts.aboutEventPlaceholder') : t('posts.placeholder')}
        multiline
        maxLength={2000}
        style={styles.body}
      />
      {images.length ? (
        <View style={styles.images}>
          {images.map((image) => (
            <View key={image.id} style={styles.thumbnail}>
              <RemoteImage image={image} style={styles.thumbnailImage} contentFit="cover" />
              <View style={styles.remove}>
                <IconButton
                  icon={{ ios: 'xmark.circle.fill', material: 'cancel' }}
                  label={t('posts.removeImage')}
                  size={22}
                  onPress={() =>
                    setImages((current) => current.filter((other) => other.id !== image.id))
                  }
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {images.length < MAX_POST_IMAGES ? (
        <Pressable role="button" onPress={addImage} disabled={upload.uploading}>
          <ThemedText type="small" themeColor="tint">
            {upload.uploading ? t('eventForm.uploading') : t('posts.addImage')}
          </ThemedText>
        </Pressable>
      ) : null}
      {uploadError ? (
        <ThemedText type="small" themeColor="danger">
          {uploadError}
        </ThemedText>
      ) : null}
      {event ? <EventCard event={event} /> : null}
      {messages.map((message) => (
        <ThemedText key={message} type="small" themeColor="danger">
          {message}
        </ThemedText>
      ))}
      <Button
        title={submitLabel}
        disabled={empty || upload.uploading}
        loading={submit.isPending}
        onPress={() => submit.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    minHeight: 120,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  thumbnail: {
    width: 96,
    height: 96,
  },
  thumbnailImage: {
    width: 96,
    height: 96,
    borderRadius: Spacing.two,
  },
  remove: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
  },
});
