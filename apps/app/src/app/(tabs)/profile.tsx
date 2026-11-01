import { meRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const { status } = useAuth();

  return (
    <Screen>
      <ThemedText type="subtitle">Profile</ThemedText>
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : status === 'signed-in' ? (
        <MyProfile />
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Sign in to follow people and organizations, and to publish your own events.
          </ThemedText>
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        </>
      )}
    </Screen>
  );
}

function MyProfile() {
  const { signOut } = useAuth();
  const { data: me, isPending } = useQuery(meRetrieveOptions());

  if (isPending || !me) {
    return <ActivityIndicator />;
  }

  return (
    <>
      <View>
        <ThemedText type="heading">{me.display_name}</ThemedText>
        <ThemedText themeColor="textSecondary">@{me.handle}</ThemedText>
      </View>
      {me.bio ? <ThemedText>{me.bio}</ThemedText> : null}
      <View style={styles.stats}>
        <ThemedText type="small">
          <ThemedText type="smallBold">{me.follower_count}</ThemedText> followers
        </ThemedText>
        <ThemedText type="small">
          <ThemedText type="smallBold">{me.following_count}</ThemedText> following
        </ThemedText>
      </View>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
});
