import {
  mePartialUpdate,
  meRetrieveQueryKey,
  profilesRetrieveQueryKey,
  type Profile,
} from '@sidequest/api';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator } from 'react-native';

import { ProfileForm, type ProfileFieldErrors } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { useMe } from '@/hooks/use-me';
import { goBack } from '@/lib/navigation';

export default function EditProfileScreen() {
  const me = useMe();
  const queryClient = useQueryClient();

  if (!me) {
    return <ActivityIndicator style={{ marginTop: 64 }} />;
  }

  return (
    <Screen hasHeader keyboardShouldPersistTaps="handled">
      <ProfileForm
        profile={me}
        showPrivacy
        onSave={async (body) => {
          const { data, error } = await mePartialUpdate({ body });
          if (error) {
            return error as ProfileFieldErrors;
          }
          queryClient.setQueryData<Profile>(meRetrieveQueryKey(), data);
          return null;
        }}
        onSaved={() => {
          queryClient.invalidateQueries({
            queryKey: profilesRetrieveQueryKey({ path: { handle: me.handle } }),
          });
          goBack('/profile');
        }}
      />
    </Screen>
  );
}
