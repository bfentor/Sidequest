import { meSettingsPartialUpdate } from '@sidequest/api';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { applyPreferredLanguage, type Language } from '@/i18n';
import { TermsGate } from '@/components/terms-gate';
import { NotificationHandler } from '@/notifications/notification-handler';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [queryClient] = useState(() => new QueryClient());

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: Colors[scheme].tint,
      background: Colors[scheme].background,
      card: Colors[scheme].background,
      text: Colors[scheme].text,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageSync />
        <NotificationHandler />
        <ThemeProvider value={navigationTheme}>
          <RootStack />
          <TermsGate />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="events/[id]/index" options={{ title: t('event.title') }} />
      <Stack.Screen name="events/[id]/edit" options={{ title: t('eventForm.edit') }} />
      <Stack.Screen name="events/[id]/attendees" options={{ title: t('attendees.title') }} />
      <Stack.Screen name="events/new" options={{ title: t('eventForm.newEvent') }} />
      <Stack.Screen name="posts/new" options={{ title: t('posts.new') }} />
      <Stack.Screen name="posts/[id]/index" options={{ title: t('posts.title') }} />
      <Stack.Screen name="posts/[id]/edit" options={{ title: t('posts.edit') }} />
      <Stack.Screen name="my-events" options={{ title: t('myEvents.title') }} />
      <Stack.Screen name="legal/[document]" options={{ title: '' }} />
      <Stack.Screen name="verify-email" options={{ title: t('verifyEmail.title') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('forgotPassword.title') }} />
      <Stack.Screen name="two-factor" options={{ title: t('twoFactor.title') }} />
      <Stack.Screen name="search" options={{ title: t('search.title') }} />
      <Stack.Screen name="sign-in" options={{ title: t('common.signIn'), presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: t('common.settings') }} />
      <Stack.Screen name="edit-profile" options={{ title: t('profile.edit') }} />
      <Stack.Screen name="follow-requests" options={{ title: t('followRequests.title') }} />
      <Stack.Screen name="suggestions" options={{ title: t('suggestions.title') }} />
      <Stack.Screen name="organizations/index" options={{ title: t('organizations.title') }} />
      <Stack.Screen name="organizations/new" options={{ title: t('organizations.create') }} />
      <Stack.Screen
        name="report"
        options={{ title: t('moderation.report'), presentation: 'modal' }}
      />
    </Stack>
  );
}

/**
 * Applies the preferred language once mounted, refetches data when it changes,
 * and tells the API, which writes push notifications in it.
 */
function LanguageSync() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'signed-in') {
      meSettingsPartialUpdate({ body: { language: i18n.language as Language } });
    }
  }, [i18n.language, status]);

  useEffect(() => {
    applyPreferredLanguage();
  }, []);

  useEffect(() => {
    // Responses can contain server-translated text (e.g. error messages).
    queryClient.invalidateQueries();
  }, [i18n.language, queryClient]);

  return null;
}
