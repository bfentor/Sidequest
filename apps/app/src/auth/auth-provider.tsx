import * as api from '@sidequest/api';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { disablePush, forgetPushToken } from '@/notifications/push';

import { session } from './session';

type Credentials = { email: string; password: string };

/** A multi-step flow waiting for an emailed code, with its temporary session token. */
type PendingFlow = { kind: 'verify_email' | 'password_reset' | 'two_factor'; token: string };

type AuthContextValue = {
  status: 'loading' | 'signed-in' | 'signed-out';
  /** Set while signing up or in waits for the email code, or a password reset is under way. */
  pendingFlow: PendingFlow | null;
  verifyEmail: (code: string) => Promise<api.AuthResult>;
  resendEmailCode: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<api.AuthResult>;
  resetPassword: (code: string, password: string) => Promise<api.AuthResult>;
  /** Completes a sign-in that asked for a two-factor code. */
  authenticateTwoFactor: (code: string) => Promise<api.AuthResult>;
  signIn: (credentials: Credentials) => Promise<api.AuthResult>;
  signUp: (details: api.SignUpDetails) => Promise<api.AuthResult>;
  signOut: () => Promise<void>;
  /** Drops the local session without asking the server, e.g. after deleting the account. */
  forgetSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [pendingFlow, setPendingFlow] = useState<PendingFlow | null>(null);

  useEffect(() => {
    async function restore() {
      if ((await session.restore()) && (await api.checkSession()) === 'invalid') {
        await session.clear();
        // Saved from the expired session; not for whoever signs in next.
        queryClient.clear();
      }
      setStatus(session.token() ? 'signed-in' : 'signed-out');
    }
    restore();
  }, [queryClient]);

  async function authenticate(request: Promise<api.AuthResult>) {
    const result = await request;
    if (result.status === 'pending' && result.sessionToken) {
      const kind = result.flows.includes('verify_email')
        ? 'verify_email'
        : result.flows.includes('mfa_authenticate')
          ? 'two_factor'
          : 'password_reset';
      setPendingFlow({ kind, token: result.sessionToken });
    }
    if (result.status === 'authenticated') {
      setPendingFlow(null);
      await session.save(result.sessionToken);
      // Cached data was fetched anonymously; refetch it as the signed-in user.
      queryClient.clear();
      setStatus('signed-in');
    }
    return result;
  }

  async function forgetSession() {
    await forgetPushToken();
    await session.clear();
    queryClient.clear();
    setStatus('signed-out');
  }

  const value: AuthContextValue = {
    status,
    pendingFlow,
    verifyEmail: (code) => authenticate(api.verifyEmail(code, pendingFlow?.token)),
    resendEmailCode: async () => {
      await api.resendEmailCode(pendingFlow?.token);
    },
    requestPasswordReset: (email) => authenticate(api.requestPasswordReset(email)),
    resetPassword: (code, password) =>
      authenticate(api.resetPassword(code, password, pendingFlow?.token ?? '')),
    authenticateTwoFactor: (code) =>
      authenticate(api.authenticateTwoFactor(code, pendingFlow?.token ?? '')),
    signIn: (credentials) => authenticate(api.signIn(credentials)),
    signUp: (details) => authenticate(api.signUp(details)),
    signOut: async () => {
      // While the session is still valid, so the API can forget this phone.
      await disablePush();
      await api.signOut();
      await forgetSession();
    },
    forgetSession,
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
