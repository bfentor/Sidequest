import type en from './locales/en.json';

// Type-checks translation keys passed to t().
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}
