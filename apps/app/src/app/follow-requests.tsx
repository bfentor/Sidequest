import {
  meFollowRequestsCreate,
  meFollowRequestsDestroy,
  meFollowRequestsListInfiniteQueryKey,
  meRetrieveQueryKey,
  useFollowRequests,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FeedList } from '@/components/feed-list';
import { ProfileRow } from '@/components/profile-row';
import { Spacing } from '@/constants/theme';

export default function FollowRequestsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = meFollowRequestsListInfiniteQueryKey();
  const requests = useFollowRequests();
  const respond = useMutation({
    mutationFn: async ({ handle, accept }: { handle: string; accept: boolean }) => {
      const options = { path: { handle }, throwOnError: true } as const;
      await (accept ? meFollowRequestsCreate(options) : meFollowRequestsDestroy(options));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: meRetrieveQueryKey() });
    },
  });

  return (
    <FeedList
      query={requests}
      hasHeader
      renderItem={(profile) => (
        <ProfileRow
          profile={profile}
          action={
            <View style={styles.actions}>
              <Button
                title={t('followRequests.accept')}
                onPress={() => respond.mutate({ handle: profile.handle, accept: true })}
              />
              <Button
                title={t('followRequests.decline')}
                variant="secondary"
                onPress={() => respond.mutate({ handle: profile.handle, accept: false })}
              />
            </View>
          }
        />
      )}
      keyExtractor={(profile) => profile.handle}
      emptyText={t('followRequests.empty')}
    />
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
