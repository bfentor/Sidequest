/**
 * Sign-up, sign-in and sign-out through django-allauth's headless API.
 *
 * Every frontend uses allauth's "app" client: a successful sign-in returns a
 * session token, which is then sent as `X-Session-Token` on every request.
 * See https://docs.allauth.org/en/latest/headless/openapi-specification/
 */
import { client } from './generated/client.gen';

export const ALLAUTH_BASE = '/_allauth/app/v1';
const BASE = ALLAUTH_BASE;
export const SESSION_TOKEN = [{ name: 'X-Session-Token', type: 'apiKey' } as const];

export type AuthError = { message: string; code: string; param?: string };

export type AuthResult =
  | { status: 'authenticated'; sessionToken: string }
  /** More steps are needed, e.g. `verify_email`. */
  | { status: 'pending'; flows: string[]; sessionToken?: string }
  | { status: 'error'; errors: AuthError[] };

export type AllauthResponse = {
  status: number;
  data?: { flows?: { id: string; is_pending?: boolean }[] };
  meta?: { is_authenticated?: boolean; session_token?: string };
  errors?: AuthError[];
};

const NETWORK_ERROR: AuthError = { code: 'network', message: 'Could not reach the server.' };
const UNEXPECTED_ERROR: AuthError = { code: 'unexpected', message: 'Something went wrong.' };

function toResult(body: AllauthResponse): AuthResult {
  if (body.meta?.is_authenticated && body.meta.session_token) {
    return { status: 'authenticated', sessionToken: body.meta.session_token };
  }
  // 401 with flows means "not done yet", e.g. the email must be verified first.
  if (body.status === 401 && body.data?.flows) {
    return {
      status: 'pending',
      flows: body.data.flows.filter((flow) => flow.is_pending).map((flow) => flow.id),
      sessionToken: body.meta?.session_token,
    };
  }
  return { status: 'error', errors: body.errors?.length ? body.errors : [UNEXPECTED_ERROR] };
}

/**
 * POSTs to allauth. `flowToken` is the temporary session token of a pending
 * flow (email verification, password reset); without it, the signed-in
 * session's token is sent, if any.
 */
export async function submit(url: string, body: object, flowToken?: string): Promise<AuthResult> {
  const { data, error, response } = await client.post<
    { 200: AllauthResponse },
    Record<number, AllauthResponse>
  >({
    url: `${BASE}${url}`,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(flowToken ? { 'X-Session-Token': flowToken } : {}),
    },
    ...(flowToken ? {} : { security: SESSION_TOKEN }),
  });
  if (!response) {
    return { status: 'error', errors: [NETWORK_ERROR] };
  }
  return toResult(data ?? error);
}

export type SignUpDetails = {
  email: string;
  password: string;
  /** YYYY-MM-DD */
  birth_date: string;
  accept_terms: boolean;
};

export function signUp(details: SignUpDetails) {
  return submit('/auth/signup', details);
}

export function signIn(credentials: { email: string; password: string }) {
  return submit('/auth/login', credentials);
}

/** Ends the session on the server. The caller should forget its token either way. */
export async function signOut() {
  await client.delete({ url: `${BASE}/auth/session`, security: SESSION_TOKEN });
}

/**
 * Whether the configured session token still belongs to a signed-in session.
 * `unknown` means the server couldn't be asked (e.g. offline); keep the token.
 */
export async function checkSession(): Promise<'valid' | 'invalid' | 'unknown'> {
  let response: Response | undefined;
  try {
    ({ response } = await client.get({ url: `${BASE}/auth/session`, security: SESSION_TOKEN }));
  } catch {
    // Offline or unreachable: keep the session, and check again next time.
    return 'unknown';
  }
  switch (response?.status) {
    case 200:
      return 'valid';
    case 401:
    case 410:
      return 'invalid';
    default:
      return 'unknown';
  }
}

/** Confirms an email address with the code sent to it (at signup, or when changing it). */
export function verifyEmail(code: string, flowToken?: string) {
  return submit('/auth/email/verify', { key: code.trim().toUpperCase() }, flowToken);
}

/** Sends the email verification code again. */
export function resendEmailCode(flowToken?: string) {
  return submit('/auth/email/verify/resend', {}, flowToken);
}

/** Emails a password reset code; resolves to a pending flow carrying its token. */
export function requestPasswordReset(email: string) {
  return submit('/auth/password/request', { email });
}

/** Sets a new password with the emailed code; signs in on success. */
export function resetPassword(code: string, password: string, flowToken: string) {
  return submit('/auth/password/reset', { key: code.trim().toUpperCase(), password }, flowToken);
}

/** POSTs an account change for the signed-in user; resolves to errors, or null on success. */
export async function changeAccount(url: string, body: object): Promise<AuthError[] | null> {
  const { error, response } = await client.post<
    { 200: AllauthResponse },
    Record<number, AllauthResponse>
  >({
    url: `${BASE}${url}`,
    body,
    headers: { 'Content-Type': 'application/json' },
    security: SESSION_TOKEN,
  });
  if (!response) {
    return [NETWORK_ERROR];
  }
  if (response.ok) {
    return null;
  }
  return error?.errors?.length ? error.errors : [UNEXPECTED_ERROR];
}

export function changePassword(currentPassword: string, newPassword: string) {
  return changeAccount('/account/password/change', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/**
 * Starts changing the signed-in user's email: a code goes to the new address,
 * confirmed with verifyEmail(code).
 */
export function changeEmail(email: string) {
  return changeAccount('/account/email', { email });
}
