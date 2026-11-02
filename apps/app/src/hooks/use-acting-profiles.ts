import { meProfilesListOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/auth-provider';

/** Profiles the signed-in user can publish as: their own, then their organizations (with role). */
export function useActingProfiles() {
  const { status } = useAuth();
  const { data = [] } = useQuery({ ...meProfilesListOptions(), enabled: status === 'signed-in' });
  return status === 'signed-in' ? data : [];
}
