import { useLayoutEffect } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Shows the page once it's drawn in the scheme it should have. The script in
 * app/+html.tsx hides it when that's dark, since the server-rendered page is
 * light, so dark-mode visitors don't see a light flash while it loads.
 */
export function ThemeReady() {
  const scheme = useColorScheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute('data-theme-pending') && scheme === root.dataset.scheme) {
      root.removeAttribute('data-theme-pending');
      root.style.backgroundColor = '';
    }
  }, [scheme]);

  return null;
}
