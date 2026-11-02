import { useUpcomingFeed } from '@sidequest/api';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { ThemedText } from '@/components/themed-text';

export default function UpcomingScreen() {
  const feed = useUpcomingFeed();
  const { t } = useTranslation();

  return (
    <FeedList
      query={feed}
      header={<ThemedText type="subtitle">{t('tabs.upcoming')}</ThemedText>}
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={t('upcoming.empty')}
    />
  );
}
