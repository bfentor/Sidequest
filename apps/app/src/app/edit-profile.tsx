import {
  mePartialUpdate,
  meRetrieveQueryKey,
  profilesRetrieveQueryKey,
  type Image,
  type PatchedProfileRequestWritable,
  type Profile,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { RemoteImage } from '@/components/remote-image';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useImageUpload } from '@/hooks/use-image-upload';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { goBack } from '@/lib/navigation';

type FieldErrors = Partial<Record<keyof PatchedProfileRequestWritable, string[]>>;

export default function EditProfileScreen() {
  const me = useMe();
  return me ? <EditProfileForm me={me} /> : <ActivityIndicator style={styles.loading} />;
}

function EditProfileForm({ me }: { me: Profile }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { categories } = useCategories();
  const theme = useTheme();
  const upload = useImageUpload();

  const [avatar, setAvatar] = useState<Image | null | undefined>(me.avatar);
  const [cover, setCover] = useState<Image | null | undefined>(me.cover);
  const [form, setForm] = useState({
    display_name: me.display_name,
    handle: me.handle,
    bio: me.bio ?? '',
    pronouns: me.pronouns ?? '',
    university: me.university ?? '',
    faculty: me.faculty ?? '',
    study_year: me.study_year ? String(me.study_year) : '',
    website: me.website ?? '',
    instagram: me.instagram ?? '',
  });
  const [interests, setInterests] = useState<string[]>(me.interests ?? []);
  const [privacy, setPrivacy] = useState({
    is_private: me.is_private ?? false,
    hide_followers: me.hide_followers ?? false,
    hide_attendance: me.hide_attendance ?? false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
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
        ...privacy,
      };
      const { data, error } = await mePartialUpdate({ body });
      if (error) {
        setErrors(error as FieldErrors);
        throw new Error('invalid');
      }
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(meRetrieveQueryKey(), profile);
      queryClient.invalidateQueries({
        queryKey: profilesRetrieveQueryKey({ path: { handle: me.handle } }),
      });
      goBack('/profile');
    },
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
    <Screen hasHeader keyboardShouldPersistTaps="handled">
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

      <Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: Spacing.six,
  },
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
