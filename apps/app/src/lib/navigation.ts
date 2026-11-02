import { router, type Href } from 'expo-router';

/**
 * Goes back, or to `fallback` when there is nothing to go back to (e.g. a
 * page opened directly from a link on the web).
 */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
