import type { Event } from '@sidequest/api';

/** 2026-11-02T18:30:00.000Z → 20261102T183000Z */
function icsTime(iso: string | Date) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeText(text: string) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function utf8Length(char: string) {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

/** Splits a line into 75-byte pieces, continued with a leading space (RFC 5545 §3.1). */
function fold(line: string) {
  const pieces: string[] = [];
  let piece = '';
  let bytes = 0;
  for (const char of line) {
    // Continuation lines start with a space, which counts towards their 75 bytes.
    const limit = pieces.length ? 74 : 75;
    if (bytes + utf8Length(char) > limit) {
      pieces.push(piece);
      piece = '';
      bytes = 0;
    }
    piece += char;
    bytes += utf8Length(char);
  }
  pieces.push(piece);
  return pieces.join('\r\n ');
}

function place(event: Event) {
  return [event.venue_name, event.address].filter(Boolean).join(', ') || event.online_url || '';
}

function details(event: Event, url: string) {
  return [event.description, url].filter(Boolean).join('\n\n');
}

/** An iCalendar file with the event, for Apple Calendar, Outlook and others. */
export function eventIcs(event: Event, url: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sidequest//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable, so adding the event again updates it instead of duplicating it.
    `UID:event-${event.id}@sidequest`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(event.starts_at)}`,
    `DTEND:${icsTime(event.ends_at)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(details(event, url))}`,
    ...(place(event) ? [`LOCATION:${escapeText(place(event))}`] : []),
    ...(event.location ? [`GEO:${event.location.lat};${event.location.lng}`] : []),
    `URL:${url}`,
    ...(event.status === 'cancelled' ? ['STATUS:CANCELLED'] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Opens Google Calendar's "new event" page filled in with the event. */
export function googleCalendarUrl(event: Event, url: string) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${icsTime(event.starts_at)}/${icsTime(event.ends_at)}`,
    details: details(event, url),
    location: place(event),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
