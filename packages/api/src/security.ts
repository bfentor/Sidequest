/**
 * Two-factor sign-in (authenticator app + recovery codes) and signed-in
 * sessions, through django-allauth's headless API.
 */
import {
  ALLAUTH_BASE,
  SESSION_TOKEN,
  changeAccount,
  submit,
  type AllauthResponse,
  type AuthError,
} from './auth';
import { client } from './generated/client.gen';

type Allauth<T> = AllauthResponse & { data?: T; meta?: { secret?: string; totp_url?: string } };

async function get<T>(url: string) {
  const { data, error, response } = await client.get<
    { 200: Allauth<T> },
    Record<number, Allauth<T>>
  >({
    url: `${ALLAUTH_BASE}${url}`,
    security: SESSION_TOKEN,
  });
  return { body: data ?? error, status: response?.status };
}

/** Confirms the password again; allauth asks for it before changing two-factor settings. */
export function reauthenticate(password: string) {
  return changeAccount('/auth/reauthenticate', { password });
}

export type TotpSetup = { active: true } | { active: false; secret: string; url: string };

/** Whether the authenticator app is on; if not, the secret to set it up with. */
export async function getTotp(): Promise<TotpSetup | null> {
  const { body, status } = await get<object>('/account/authenticators/totp');
  if (status === 200) {
    return { active: true };
  }
  if (status === 404 && body?.meta?.secret && body.meta.totp_url) {
    return { active: false, secret: body.meta.secret, url: body.meta.totp_url };
  }
  return null;
}

/** Turns on the authenticator app with a code it shows (after reauthenticate). */
export function activateTotp(code: string) {
  return changeAccount('/account/authenticators/totp', { code: code.trim() });
}

/** Turns off two-factor sign-in (after reauthenticate). */
export async function deactivateTotp(): Promise<AuthError[] | null> {
  const { error, response } = await client.delete<
    { 200: AllauthResponse },
    Record<number, AllauthResponse>
  >({
    url: `${ALLAUTH_BASE}/account/authenticators/totp`,
    security: SESSION_TOKEN,
  });
  if (response?.ok) {
    return null;
  }
  return error?.errors ?? [{ code: 'unexpected', message: 'Something went wrong.' }];
}

/** The unused one-time recovery codes, to keep somewhere safe. */
export async function getRecoveryCodes(): Promise<string[]> {
  const { body, status } = await get<{ unused_codes?: string[] }>(
    '/account/authenticators/recovery-codes',
  );
  return status === 200 ? (body?.data?.unused_codes ?? []) : [];
}

/** Replaces the recovery codes with new ones (after reauthenticate). */
export function regenerateRecoveryCodes() {
  return changeAccount('/account/authenticators/recovery-codes', {});
}

/** Completes a sign-in that asked for a two-factor code (authenticator or recovery code). */
export function authenticateTwoFactor(code: string, flowToken: string) {
  return submit('/auth/2fa/authenticate', { code: code.trim() }, flowToken);
}

export type Session = {
  id: number;
  user_agent: string;
  ip: string;
  created_at: number;
  last_seen_at?: number;
  is_current: boolean;
};

/** Where the signed-in user is signed in. */
export async function listSessions(): Promise<Session[]> {
  const { body, status } = await get<Session[]>('/auth/sessions');
  return status === 200 ? (body?.data ?? []) : [];
}

/** Signs out the given sessions (other devices). */
export async function endSessions(ids: number[]) {
  await client.delete({
    url: `${ALLAUTH_BASE}/auth/sessions`,
    body: { sessions: ids },
    headers: { 'Content-Type': 'application/json' },
    security: SESSION_TOKEN,
  });
}
