import { flagsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';

/**
 * Whether a feature flag is on for the current user (flags are managed in
 * the API's admin). Off while loading, and for flags that don't exist, so a
 * feature can ship hidden before its flag is created.
 */
export function useFlag(name: string) {
  const { data } = useQuery({ ...flagsRetrieveOptions(), staleTime: 5 * 60 * 1000 });
  return data?.[name] === true;
}
