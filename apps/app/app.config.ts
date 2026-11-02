import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Variants of the app, chosen with APP_VARIANT (set per build profile in
 * eas.json). Each has its own name and app ID, so they can be installed side
 * by side on one phone.
 */
const VARIANTS = {
  development: { name: 'Sidequest Dev', id: 'hu.fentorweb.sidequest.dev' },
  staging: { name: 'Sidequest Staging', id: 'hu.fentorweb.sidequest.staging' },
  production: { name: 'Sidequest', id: 'hu.fentorweb.sidequest' },
} as const;

type Variant = keyof typeof VARIANTS;

function currentVariant(): Variant {
  const variant = process.env.APP_VARIANT ?? 'development';
  if (!(variant in VARIANTS)) {
    throw new Error(
      `Unknown APP_VARIANT "${variant}"; use one of ${Object.keys(VARIANTS).join(', ')}.`,
    );
  }
  return variant as Variant;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[currentVariant()];
  // Written by `eas init`; over-the-air updates need it.
  const projectId: string | undefined = config.extra?.eas?.projectId;

  return {
    ...config,
    name: variant.name,
    slug: config.slug ?? 'sidequest',
    ios: { ...config.ios, bundleIdentifier: variant.id },
    android: {
      ...config.android,
      package: variant.id,
      // Google Maps (the nearby map) needs a key restricted to these Android app IDs.
      config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } },
    },
    // Updates only reach builds with the same native code, whatever the version number says.
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId ? { url: `https://u.expo.dev/${projectId}` } : config.updates,
  };
};
