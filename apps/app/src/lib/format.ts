const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const timeOnly = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** "Fri 10 Jan, 18:00 – 22:00", or with both dates if the event spans days. */
export function formatEventTime(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  return `${dateTime.format(start)} – ${(sameDay ? timeOnly : dateTime).format(end)}`;
}

export function formatPostedAt(createdAt: string) {
  return dateTime.format(new Date(createdAt));
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}
