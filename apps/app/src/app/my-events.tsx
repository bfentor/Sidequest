import { useManagedEvents } from '@sidequest/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EventCard } from '@/components/event-card';
import { FeedList } from '@/components/feed-list';
import { SegmentedControl } from '@/components/segmented-control';

/** Events you (or your organizations) host, drafts and scheduled ones included. */
export default function MyEventsScreen() {
  const { t } = useTranslation();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const events = useManagedEvents(when);

  return (
    <FeedList
      query={events}
      hasHeader
      header={
        <SegmentedControl
          value={when}
          onChange={setWhen}
          options={[
            { value: 'upcoming', label: t('myEvents.upcoming') },
            { value: 'past', label: t('myEvents.past') },
          ]}
        />
      }
      renderItem={(event) => <EventCard event={event} />}
      keyExtractor={(event) => String(event.id)}
      emptyText={t('myEvents.empty')}
    />
  );
}
