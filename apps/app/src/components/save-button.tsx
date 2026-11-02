import {
  eventsRetrieveQueryKey,
  eventsSaveDestroy,
  eventsSaveUpdate,
  meSavedListInfiniteQueryKey,
  type Event,
} from '@sidequest/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

import { IconButton } from './icon-button';

/** Bookmark toggle for an event; updates instantly and rolls back if the request fails. */
export function SaveButton({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const queryKey = eventsRetrieveQueryKey({ path: { id: event.id } });

  const show = (saved: boolean) =>
    queryClient.setQueryData<Event>(queryKey, (old) => (old ? { ...old, is_saved: saved } : old));

  const toggle = useMutation({
    mutationFn: async (save: boolean) => {
      const options = { path: { id: event.id }, throwOnError: true } as const;
      await (save ? eventsSaveUpdate(options) : eventsSaveDestroy(options));
    },
    onMutate: (save) => show(save),
    onError: (_error, save) => show(!save),
    onSettled: () => queryClient.invalidateQueries({ queryKey: meSavedListInfiniteQueryKey() }),
  });

  if (status !== 'signed-in') {
    return null;
  }
  return (
    <IconButton
      icon={
        event.is_saved
          ? { ios: 'bookmark.fill', material: 'bookmark' }
          : { ios: 'bookmark', material: 'bookmark_border' }
      }
      label={event.is_saved ? t('saved.unsave') : t('saved.save')}
      color={event.is_saved ? theme.tint : undefined}
      onPress={() => toggle.mutate(!event.is_saved)}
    />
  );
}
