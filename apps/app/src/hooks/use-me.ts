import { meRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/auth-provider';

/** The signed-in user's own profile, or undefined when signed out (or still loading). */
export function useMe() {
  const { status } = useAuth();
  const { data } = useQuery({ ...meRetrieveOptions(), enabled: status === 'signed-in' });
  return status === 'signed-in' ? data : undefined;
}
