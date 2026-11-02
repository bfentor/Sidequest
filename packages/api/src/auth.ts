/**
 * Sign-up, sign-in and sign-out through django-allauth's headless API.
 *
 * Every frontend uses allauth's "app" client: a successful sign-in returns a
 * session token, which is then sent as `X-Session-Token` on every request.
 * See https://docs.allauth.org/en/latest/headless/openapi-specification/
 */
import { client } from './generated/client.gen';

const BASE = '/_allauth/app/v1';
const SESSION_TOKEN = [{ name: 'X-Session-Token', type: 'apiKey' } as const];

export type AuthError = { message: string; code: string; param?: string };

export type AuthResult =
  | { status: 'authenticated'; sessionToken: string }
  /** More steps are needed, e.g. `verify_email`. */
  | { status: 'pending'; flows: string[]; sessionToken?: string }
  | { status: 'error'; errors: AuthError[] };

type AllauthResponse = {
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

async function submit(url: string, body: object): Promise<AuthResult> {
  const { data, error, response } = await client.post<
    { 200: AllauthResponse },
    Record<number, AllauthResponse>
  >({
    url: `${BASE}${url}`,
    body,
    headers: { 'Content-Type': 'application/json' },
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
  const { response } = await client.get({ url: `${BASE}/auth/session`, security: SESSION_TOKEN });
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
