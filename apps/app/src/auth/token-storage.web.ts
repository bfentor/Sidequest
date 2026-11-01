const KEY = 'sidequest.session-token';

/** Persists the session token in the browser's localStorage. */
export const tokenStorage = {
  get: async () => localStorage.getItem(KEY),
  set: async (token: string) => localStorage.setItem(KEY, token),
  remove: async () => localStorage.removeItem(KEY),
};
