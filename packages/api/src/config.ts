import { client } from './generated/client.gen';

export type ApiConfig = {
  /** Origin of the Django backend, e.g. `http://localhost:8000`. */
  baseUrl: string;
  /** Returns the current session token, or undefined when signed out. */
  getSessionToken: () => string | undefined | Promise<string | undefined>;
};

/** Call once at app start-up, before any request is made. */
export function configureApi({ baseUrl, getSessionToken }: ApiConfig) {
  client.setConfig({ baseUrl, auth: getSessionToken });
}
