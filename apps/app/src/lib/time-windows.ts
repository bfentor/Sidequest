/** Quick time filters for the feeds, in the device's local time. */
export type TimeWindow = 'any' | 'today' | 'tonight' | 'weekend';

function at(day: Date, hours: number) {
  const date = new Date(day);
  date.setHours(hours, 0, 0, 0);
  return date;
}

function addDays(day: Date, days: number) {
  const date = new Date(day);
  date.setDate(date.getDate() + days);
  return date;
}

/** [start, end] of a window starting from `now`, or null for any time. */
export function timeWindow(window: TimeWindow, now: Date): [Date, Date] | null {
  switch (window) {
    case 'any':
      return null;
    case 'today':
      return [now, at(addDays(now, 1), 0)];
    case 'tonight': {
      // From 17:00 (or now, if later) until 04:00.
      const evening = at(now, 17);
      return [now > evening ? now : evening, at(addDays(now, 1), 4)];
    }
    case 'weekend': {
      // Saturday 00:00 (or now, during the weekend) until Monday 00:00.
      const day = now.getDay(); // 0 = Sunday, 6 = Saturday
      const untilSaturday = day === 6 || day === 0 ? 0 : 6 - day;
      const saturday = at(addDays(now, untilSaturday), 0);
      const monday = at(addDays(now, day === 0 ? 1 : untilSaturday + 2), 0);
      return [now > saturday ? now : saturday, monday];
    }
  }
}
