import { meProfilesListQueryKey, organizationsCreate } from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

type Errors = Partial<Record<'handle' | 'display_name' | 'bio', string[]>>;

export default function NewOrganizationScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ display_name: '', handle: '', bio: '' });
  const [errors, setErrors] = useState<Errors>({});

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await organizationsCreate({ body: form });
      if (!data) {
        setErrors((error ?? {}) as Errors);
        throw new Error('invalid');
      }
      return data;
    },
    onSuccess: (organization) => {
      queryClient.invalidateQueries({ queryKey: meProfilesListQueryKey() });
      router.replace({ pathname: '/profiles/[handle]', params: { handle: organization.handle } });
    },
  });

  const field = (name: keyof typeof form, label: string, extra?: object) => (
    <>
      <TextField
        label={label}
        value={form[name]}
        onChangeText={(value) => setForm((current) => ({ ...current, [name]: value }))}
        {...extra}
      />
      {errors[name]?.map((message) => (
        <ThemedText key={message} type="small" themeColor="danger">
          {message}
        </ThemedText>
      ))}
    </>
  );

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ThemedText themeColor="textSecondary">{t('organizations.createHint')}</ThemedText>
      {field('display_name', t('editProfile.displayName'))}
      {field('handle', t('editProfile.handle'), { autoCapitalize: 'none', autoCorrect: false })}
      {field('bio', t('editProfile.bio'), { multiline: true, maxLength: 500 })}
      <Button
        title={t('organizations.create')}
        disabled={!form.display_name || !form.handle}
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}
