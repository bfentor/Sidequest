import { configureApi } from '@sidequest/api';

import { API_URL } from '@/lib/config';

import { tokenStorage } from './token-storage';

let currentToken: string | undefined;

/** The session token, kept in memory so every API request can read it synchronously. */
export const session = {
  token: () => currentToken,

  async restore() {
    currentToken = (await tokenStorage.get()) ?? undefined;
    return currentToken;
  },

  async save(token: string) {
    currentToken = token;
    await tokenStorage.set(token);
  },

  async clear() {
    currentToken = undefined;
    await tokenStorage.remove();
  },
};

configureApi({ baseUrl: API_URL, getSessionToken: session.token });
