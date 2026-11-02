import { useLocalSearchParams } from 'expo-router';

import { FollowListScreen } from '@/components/follow-list';

export default function FollowingScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return <FollowListScreen handle={handle} direction="following" />;
}
