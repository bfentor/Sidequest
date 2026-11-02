import { useLocalSearchParams } from 'expo-router';

import { FollowListScreen } from '@/components/follow-list';

export default function FollowersScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <FollowListScreen handle={handle} direction="followers" />;
}
