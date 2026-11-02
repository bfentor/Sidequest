import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider } from '@/auth/auth-provider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { applyPreferredLanguage } from '@/i18n';

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
      <LanguageSync />
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <RootStack />
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
      <Stack.Screen name="events/[id]" options={{ title: t('event.title') }} />
      <Stack.Screen
        name="sign-in"
        options={{ title: t('common.signIn'), presentation: 'modal' }}
      />
      <Stack.Screen name="settings" options={{ title: t('common.settings') }} />
    </Stack>
  );
}

/** Applies the preferred language once mounted, and refetches data when it changes. */
function LanguageSync() {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    applyPreferredLanguage();
  }, []);

  useEffect(() => {
    // Responses can contain server-translated text (e.g. error messages).
    queryClient.invalidateQueries();
  }, [i18n.language, queryClient]);

  return null;
}
