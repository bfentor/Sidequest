import {
  mePartialUpdate,
  meRetrieveQueryKey,
  meSettingsPartialUpdate,
  meSettingsRetrieveQueryKey,
  meSuggestionsListQueryKey,
  type AccountSettings,
  type Profile,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Checkbox } from '@/components/checkbox';
import { CategoryPicker } from '@/components/category-chips';
import { FollowSuggestions } from '@/components/follow-suggestions';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentPosition } from '@/hooks/use-current-position';
import { useMe } from '@/hooks/use-me';
import { goBack } from '@/lib/navigation';

const STEPS = ['interests', 'follow', 'location'] as const;

/** First-run steps after signing up: interests, organizations to follow, and location. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const me = useMe();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[] | null>(null);
  const [emailDigest, setEmailDigest] = useState(false);

  const saveInterests = useMutation({
    mutationFn: (slugs: string[]) =>
      mePartialUpdate({ body: { interests: slugs }, throwOnError: true }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<Profile>(meRetrieveQueryKey(), data);
      // Suggestions take interests into account.
      queryClient.invalidateQueries({ queryKey: meSuggestionsListQueryKey() });
      setStep(1);
    },
  });
  const finish = useMutation({
    mutationFn: () =>
      meSettingsPartialUpdate({
        body: { onboarded: true, ...(emailDigest ? { email_digest: true } : {}) },
        throwOnError: true,
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<AccountSettings>(meSettingsRetrieveQueryKey(), data);
      goBack('/');
    },
  });

  if (!me) {
    return <ActivityIndicator style={styles.loading} />;
  }

  const last = step === STEPS.length - 1;
  const next = () => (last ? finish.mutate() : setStep(step + 1));

  return (
    <Screen hasHeader>
      <ThemedText type="small" themeColor="textSecondary">
        {t('onboarding.step', { current: step + 1, total: STEPS.length })}
      </ThemedText>

      {STEPS[step] === 'interests' ? (
        <>
          <ThemedText type="subtitle">{t('onboarding.interestsTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('onboarding.interestsHint')}</ThemedText>
          <CategoryPicker value={interests ?? me.interests ?? []} onChange={setInterests} />
        </>
      ) : STEPS[step] === 'follow' ? (
        <>
          <ThemedText type="subtitle">{t('onboarding.followTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('onboarding.followHint')}</ThemedText>
          <FollowSuggestions
            kind="organization"
            limit={10}
            empty={
              <ThemedText themeColor="textSecondary">{t('onboarding.noSuggestions')}</ThemedText>
            }
          />
        </>
      ) : (
        <>
          <ThemedText type="subtitle">{t('onboarding.locationTitle')}</ThemedText>
          <LocationStep />
          <Checkbox
            checked={emailDigest}
            onChange={setEmailDigest}
            label={t('settings.emailDigest')}
          />
        </>
      )}

      <View style={styles.actions}>
        {STEPS[step] === 'interests' ? (
          <Button
            title={t('onboarding.next')}
            loading={saveInterests.isPending}
            onPress={() => (interests === null ? setStep(1) : saveInterests.mutate(interests))}
          />
        ) : (
          <Button
            title={last ? t('onboarding.finish') : t('onboarding.next')}
            loading={finish.isPending}
            onPress={next}
          />
        )}
        {step > 0 ? (
          <Button
            title={t('onboarding.back')}
            variant="secondary"
            onPress={() => setStep(step - 1)}
          />
        ) : null}
        {saveInterests.isError || finish.isError ? (
          <ThemedText themeColor="danger">{t('errors.unexpected')}</ThemedText>
        ) : null}
      </View>
    </Screen>
  );
}

/** Asks for location access; the Nearby feed works without it, so this is optional. */
function LocationStep() {
  const { t } = useTranslation();
  const { permission, requestPermission } = useCurrentPosition();

  if (!permission) {
    return <ActivityIndicator />;
  }
  if (permission.granted) {
    return <ThemedText themeColor="textSecondary">{t('onboarding.locationOn')}</ThemedText>;
  }
  if (!permission.canAskAgain) {
    return <ThemedText themeColor="textSecondary">{t('nearby.permissionDenied')}</ThemedText>;
  }
  return (
    <>
      <ThemedText themeColor="textSecondary">{t('nearby.askPermission')}</ThemedText>
      <Button title={t('nearby.useMyLocation')} variant="secondary" onPress={requestPermission} />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 64,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
