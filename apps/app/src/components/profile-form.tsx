import type { Image, PatchedProfileRequestWritable, Profile } from '@sidequest/api';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useTheme } from '@/hooks/use-theme';

import { Avatar } from './avatar';
import { Button } from './button';
import { RemoteImage } from './remote-image';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { TextField } from './text-field';

export type ProfileFieldErrors = Partial<Record<keyof PatchedProfileRequestWritable, string[]>>;

type ProfileFormProps = {
  profile: Profile;
  /** Private-account and visibility switches; people only. */
  showPrivacy?: boolean;
  /** Saves the changes; resolves to field errors if the API rejected them. */
  onSave: (body: PatchedProfileRequestWritable) => Promise<ProfileFieldErrors | null>;
  onSaved: () => void;
};

/** Pictures, details, interests and privacy of a profile (a person's or an organization's). */
export function ProfileForm({ profile, showPrivacy, onSave, onSaved }: ProfileFormProps) {
  const { t } = useTranslation();
  const { categories } = useCategories();
  const theme = useTheme();
  const upload = useImageUpload();

  const [avatar, setAvatar] = useState<Image | null | undefined>(profile.avatar);
  const [cover, setCover] = useState<Image | null | undefined>(profile.cover);
  const [form, setForm] = useState({
    display_name: profile.display_name,
    handle: profile.handle,
    bio: profile.bio ?? '',
    pronouns: profile.pronouns ?? '',
    university: profile.university ?? '',
    faculty: profile.faculty ?? '',
    study_year: profile.study_year ? String(profile.study_year) : '',
    website: profile.website ?? '',
    instagram: profile.instagram ?? '',
  });
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
  const [privacy, setPrivacy] = useState({
    is_private: profile.is_private ?? false,
    hide_followers: profile.hide_followers ?? false,
    hide_attendance: profile.hide_attendance ?? false,
  });
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const body: PatchedProfileRequestWritable = {
        ...form,
        study_year: form.study_year ? Number(form.study_year) : null,
        avatar_id: avatar?.id ?? null,
        cover_id: cover?.id ?? null,
        interests,
        ...(showPrivacy ? privacy : {}),
      };
      const fieldErrors = await onSave(body);
      if (fieldErrors) {
        setErrors(fieldErrors);
        throw new Error('invalid');
      }
    },
    onSuccess: onSaved,
  });

  async function pick(kind: 'avatar' | 'cover') {
    setUploadError(null);
    const result = await upload.pickAndUpload({ aspect: kind === 'avatar' ? [1, 1] : [3, 1] });
    if (result?.status === 'ok') {
      (kind === 'avatar' ? setAvatar : setCover)(result.image);
    } else if (result?.status === 'error') {
      setUploadError(result.message ?? t('errors.unexpected'));
    }
  }

  const field = (name: keyof typeof form, label: string, extra?: object) => (
    <View>
      <TextField label={label} value={form[name]} onChangeText={set(name)} {...extra} />
      {errors[name]?.map((message) => (
        <ThemedText key={message} type="small" themeColor="danger">
          {message}
        </ThemedText>
      ))}
    </View>
  );

  return (
    <>
      <Pressable onPress={() => pick('cover')} accessibilityLabel={t('editProfile.changeCover')}>
        {cover ? (
          <RemoteImage image={cover} style={styles.cover} contentFit="cover" />
        ) : (
          <ThemedView type="backgroundElement" style={[styles.cover, styles.coverEmpty]}>
            <ThemedText themeColor="textSecondary">{t('editProfile.changeCover')}</ThemedText>
          </ThemedView>
        )}
      </Pressable>
      <View style={styles.avatarRow}>
        <Avatar name={form.display_name} image={avatar} size={72} />
        <View style={styles.avatarButtons}>
          <Button
            title={t('editProfile.changeAvatar')}
            variant="secondary"
            loading={upload.uploading}
            onPress={() => pick('avatar')}
          />
          {avatar ? (
            <Button
              title={t('editProfile.removeAvatar')}
              variant="secondary"
              onPress={() => setAvatar(null)}
            />
          ) : null}
        </View>
      </View>
      {uploadError ? <ThemedText themeColor="danger">{uploadError}</ThemedText> : null}

      {field('display_name', t('editProfile.displayName'))}
      {field('handle', t('editProfile.handle'), { autoCapitalize: 'none', autoCorrect: false })}
      {field('bio', t('editProfile.bio'), { multiline: true, maxLength: 500, style: styles.bio })}
      {field('pronouns', t('editProfile.pronouns'))}
      {field('university', t('editProfile.university'))}
      {field('faculty', t('editProfile.faculty'))}
      {field('study_year', t('editProfile.studyYear'), {
        keyboardType: 'number-pad',
        maxLength: 2,
      })}
      {field('website', t('editProfile.website'), { autoCapitalize: 'none', keyboardType: 'url' })}
      {field('instagram', t('editProfile.instagram'), {
        autoCapitalize: 'none',
        autoCorrect: false,
      })}

      <View style={styles.interests}>
        <ThemedText type="smallBold">{t('editProfile.interests')}</ThemedText>
        <View style={styles.chips}>
          {categories.map((category) => {
            const selected = interests.includes(category.slug);
            return (
              <Pressable
                key={category.slug}
                role="checkbox"
                aria-checked={selected}
                onPress={() =>
                  setInterests((current) =>
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

      {showPrivacy ? (
        <View style={styles.privacy}>
          <ThemedText type="smallBold">{t('editProfile.privacy')}</ThemedText>
          {(
            [
              ['is_private', t('editProfile.isPrivate'), t('editProfile.isPrivateHint')],
              ['hide_followers', t('editProfile.hideFollowers'), null],
              ['hide_attendance', t('editProfile.hideAttendance'), null],
            ] as const
          ).map(([key, label, hint]) => (
            <View key={key} style={styles.switchRow}>
              <View style={styles.switchText}>
                <ThemedText>{label}</ThemedText>
                {hint ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {hint}
                  </ThemedText>
                ) : null}
              </View>
              <Switch
                value={privacy[key]}
                accessibilityLabel={label}
                onValueChange={(value) => setPrivacy((current) => ({ ...current, [key]: value }))}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} />
    </>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: Spacing.three,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarButtons: {
    flex: 1,
    gap: Spacing.two,
  },
  bio: {
    minHeight: 80,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  interests: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  privacy: {
    gap: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
});
