import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { INTL_LOCALES, type Language } from '@/i18n';

function createFormatters(locale: string) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const timeOnly = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  const dateOnly = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });

  return {
    /** "Fri 10 Jan, 18:00 – 22:00", or with both dates if the event spans days. */
    eventTime(startsAt: string, endsAt: string) {
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      const sameDay = start.toDateString() === end.toDateString();
      return `${dateTime.format(start)} – ${(sameDay ? timeOnly : dateTime).format(end)}`;
    },
    dateTime(value: string | Date) {
      return dateTime.format(new Date(value));
    },
    date(value: string | Date) {
      return dateOnly.format(new Date(value));
    },
    /** A decimal string from the API, e.g. "12.50" → "12,50 €". */
    price(amount: string) {
      return euros.format(Number(amount));
    },
    distance(meters: number) {
      return meters < 1000
        ? `${Math.round(meters / 10) * 10} m`
        : `${decimal.format(meters / 1000)} km`;
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;

/** Date and number formatting in the current UI language. */
export function useFormat(): Formatters {
  const { i18n } = useTranslation();
  const locale = INTL_LOCALES[i18n.language as Language] ?? INTL_LOCALES.en;
  return useMemo(() => createFormatters(locale), [locale]);
}
