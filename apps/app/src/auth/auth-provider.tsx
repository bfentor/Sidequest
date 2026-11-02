import * as api from '@sidequest/api';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { disablePush } from '@/notifications/push';

import { session } from './session';

type Credentials = { email: string; password: string };

type AuthContextValue = {
  status: 'loading' | 'signed-in' | 'signed-out';
  signIn: (credentials: Credentials) => Promise<api.AuthResult>;
  signUp: (credentials: Credentials) => Promise<api.AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  useEffect(() => {
    async function restore() {
      if ((await session.restore()) && (await api.checkSession()) === 'invalid') {
        await session.clear();
      }
      setStatus(session.token() ? 'signed-in' : 'signed-out');
    }
    restore();
  }, []);

  async function authenticate(request: Promise<api.AuthResult>) {
    const result = await request;
    if (result.status === 'authenticated') {
      await session.save(result.sessionToken);
      // Cached data was fetched anonymously; refetch it as the signed-in user.
      queryClient.clear();
      setStatus('signed-in');
    }
    return result;
  }

  const value: AuthContextValue = {
    status,
    signIn: (credentials) => authenticate(api.signIn(credentials)),
    signUp: (credentials) => authenticate(api.signUp(credentials)),
    signOut: async () => {
      // While the session is still valid, so the API can forget this phone.
      await disablePush();
      await api.signOut();
      await session.clear();
      queryClient.clear();
      setStatus('signed-out');
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
