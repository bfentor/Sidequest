import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';

import { preferences } from '@/lib/preferences';

import en from './locales/en.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';

// `satisfies` makes TypeScript report a key missing from a translation.
export const resources = {
  en: { translation: en },
  fi: { translation: fi satisfies typeof en },
  sv: { translation: sv satisfies typeof en },
} as const;

export type Language = keyof typeof resources;
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'fi', name: 'Suomi' },
  { code: 'sv', name: 'Svenska' },
];

/** Locale for dates and numbers: 24-hour clocks, and Finland's conventions for Swedish. */
export const INTL_LOCALES: Record<Language, string> = {
  en: 'en-GB',
  fi: 'fi-FI',
  sv: 'sv-FI',
};

function isLanguage(code: string | null | undefined): code is Language {
  return !!code && code in resources;
}

export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: Platform.OS === 'web' ? 'en' : deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const PREFERENCE_KEY = 'language';

/** The language the user picked, or null to follow the device. */
export async function storedLanguage(): Promise<Language | null> {
  const code = await preferences.get(PREFERENCE_KEY);
  return isLanguage(code) ? code : null;
}

export async function chooseLanguage(code: Language | null) {
  if (code) {
    await preferences.set(PREFERENCE_KEY, code);
  } else {
    await preferences.remove(PREFERENCE_KEY);
  }
  await i18n.changeLanguage(code ?? deviceLanguage());
}

/** Switches to the stored or device language; the web renders English until it hydrates. */
export async function applyPreferredLanguage() {
  const language = (await storedLanguage()) ?? deviceLanguage();
  if (language !== i18n.language) {
    await i18n.changeLanguage(language);
  }
}

export default i18n;
