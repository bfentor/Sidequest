import { client } from './generated/client.gen';

export type ApiConfig = {
  /** Origin of the Django backend, e.g. `http://localhost:8000`. */
  baseUrl: string;
  /** Returns the current session token, or undefined when signed out. */
  getSessionToken: () => string | undefined | Promise<string | undefined>;
  /** Returns the UI language (e.g. `fi`), sent as Accept-Language so errors come back translated. */
  getLanguage?: () => string;
};

let languageInterceptor: number | undefined;

/** Call once at app start-up, before any request is made. */
export function configureApi({ baseUrl, getSessionToken, getLanguage }: ApiConfig) {
  client.setConfig({ baseUrl, auth: getSessionToken });

  if (languageInterceptor !== undefined) {
    client.interceptors.request.eject(languageInterceptor);
    languageInterceptor = undefined;
  }
  if (getLanguage) {
    languageInterceptor = client.interceptors.request.use((request) => {
      request.headers.set('Accept-Language', getLanguage());
      return request;
    });
  }
}
