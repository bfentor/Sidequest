import type { Event } from '@sidequest/api';
import type { Metadata } from 'expo-server';

import { API_URL, WEB_URL } from './config';

const SITE_NAME = 'Sidequest';
const SITE_DESCRIPTION = 'Find student events near you, and see what your friends are going to.';
// Where events happen; the same as the backend's TIME_ZONE.
const EVENT_TIME_ZONE = 'Europe/Helsinki';

const when = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: EVENT_TIME_ZONE,
});

/** Tags for pages without their own: what Sidequest is. */
const siteMetadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: 'website',
  },
};

function summary(event: Event) {
  const place = event.venue_name || event.address || (event.online_url ? 'Online' : '');
  return [when.format(new Date(event.starts_at)), place, `by ${event.organizer.display_name}`]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Link preview and search engine tags for an event page, rendered on the
 * server so crawlers that don't run JavaScript see them. Only public events
 * are fetched (anonymously); anything else gets the site's tags.
 */
export async function eventMetadata(id: string): Promise<Metadata> {
  let event: Event;
  try {
    const response = await fetch(`${API_URL}/api/events/${encodeURIComponent(id)}/`);
    if (!response.ok) return siteMetadata;
    event = await response.json();
  } catch {
    return siteMetadata;
  }

  const url = `${WEB_URL}/events/${event.id}`;
  const text = summary(event);
  const description = event.description ? `${text}. ${event.description.slice(0, 200)}` : text;
  const image = event.cover?.url;
  return {
    title: `${event.title} · ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    // Unlisted events are for people with the link, not search engines.
    robots: event.visibility === 'public' ? undefined : { index: false },
    openGraph: {
      siteName: SITE_NAME,
      type: 'website',
      url,
      title: event.title,
      description,
      images: image ? [{ url: image, alt: event.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}
