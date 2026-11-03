import { meSettingsRetrieveOptions } from '@sidequest/api';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/auth/auth-provider';

// Screens that belong to signing in or that onboarding links to (the gate waits until they're
// left), and the widget other websites embed.
const PASSTHROUGH = ['/onboarding', '/sign-in', '/verify-email', '/two-factor', '/legal', '/embed'];

/** Opens the first-run steps for accounts that haven't been through them yet. */
export function OnboardingGate() {
  const { status } = useAuth();
  const pathname = usePathname();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const settings = useQuery({ ...meSettingsRetrieveOptions(), enabled: status === 'signed-in' });

  const due =
    status === 'signed-in' &&
    settings.data?.onboarded === false &&
    // The terms gate goes first.
    settings.data.terms_version === settings.data.current_terms_version;

  useEffect(() => {
    if (due && navigationReady && !PASSTHROUGH.some((path) => pathname.startsWith(path))) {
      router.push('/onboarding');
    }
  }, [due, navigationReady, pathname]);

  return null;
}
