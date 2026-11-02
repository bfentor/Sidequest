import { Redirect } from 'expo-router';

/** Push notifications about invitations link here; they're answered on the organizations screen. */
export default function InvitationsScreen() {
  return <Redirect href="/organizations" />;
}
