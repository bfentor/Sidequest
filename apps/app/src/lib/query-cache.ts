import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import {
  removeOldestQuery,
  type PersistQueryClientOptions,
} from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';

/** How long saved data is shown when the app opens (it refreshes in the background). */
const MAX_AGE = 24 * 60 * 60 * 1000;

// What's worth having straight away and offline: feeds, events, posts, profiles, your own
// lists and inbox. Not account settings, dashboards or anything else personal.
const SAVED =
  /^(feeds|events(Retrieve|PhotosList|CommentsList)|posts(Retrieve|CommentsList)|profiles(Retrieve|EventsList|PostsList)|categoriesList|me(Retrieve|AttendingList|SavedList|EventsList|ProfilesList)|notificationsList)/;

function isSaved(query: Query) {
  const [first] = query.queryKey;
  const id = typeof first === 'object' && first !== null && '_id' in first ? first._id : null;
  return query.state.status === 'success' && typeof id === 'string' && SAVED.test(id);
}

// Rendering a web page on the server: nothing is saved there, and each request has its own client.
const ON_SERVER = typeof window === 'undefined';

export function createQueryClient() {
  // On devices, unused data must stay in memory as long as it's saved, or it's dropped before
  // saving. On the server, the default keeps finished requests from holding on to their data.
  return new QueryClient(
    ON_SERVER ? undefined : { defaultOptions: { queries: { gcTime: MAX_AGE } } },
  );
}

/**
 * Keeps fetched content on the device (AsyncStorage; localStorage on the
 * web), so the app opens with it instantly and shows it offline. Signing in
 * or out clears the cache, and with it the saved copy.
 */
export function createPersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createAsyncStoragePersister({
      storage: AsyncStorage,
      key: 'sidequest.query-cache',
      // Android limits how much one stored value can hold; drop the oldest queries until it fits.
      retry: removeOldestQuery,
    }),
    maxAge: MAX_AGE,
    // Data saved by another version of the app may have another shape.
    buster: Constants.expoConfig?.version ?? '',
    dehydrateOptions: { shouldDehydrateQuery: isSaved },
  };
}
