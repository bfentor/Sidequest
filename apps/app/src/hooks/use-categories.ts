import { categoriesListOptions, type Category } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/** All categories (named in the UI language), plus a lookup by slug. */
export function useCategories() {
  const { data = [] } = useQuery({ ...categoriesListOptions(), staleTime: 60 * 60 * 1000 });
  const bySlug = useMemo(
    () => new Map<string, Category>(data.map((category) => [category.slug, category])),
    [data],
  );
  return { categories: data, bySlug };
}
