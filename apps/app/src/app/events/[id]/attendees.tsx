import { useAttendees } from '@sidequest/api';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeedList } from '@/components/feed-list';
import { ProfileRow } from '@/components/profile-row';
import { SegmentedControl } from '@/components/segmented-control';

type Status = 'going' | 'interested';

export default function AttendeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('going');
  const attendees = useAttendees(Number(id), status);

  return (
    <FeedList
      query={attendees}
      hasHeader
      header={
        <SegmentedControl
          options={[
            { value: 'going', label: t('rsvp.going') },
            { value: 'interested', label: t('rsvp.interested') },
          ]}
          value={status}
          onChange={setStatus}
        />
      }
      renderItem={(profile) => <ProfileRow profile={profile} />}
      keyExtractor={(profile) => profile.handle}
      emptyText={t('attendees.empty')}
    />
  );
}
