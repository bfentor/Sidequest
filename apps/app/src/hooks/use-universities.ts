import { universitiesListOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';

/** Universities students can verify with; changes rarely, so cached for a day. */
export function useUniversities() {
  const { data = [] } = useQuery({ ...universitiesListOptions(), staleTime: 24 * 60 * 60 * 1000 });
  return data;
}
