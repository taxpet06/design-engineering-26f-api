// Expands commitments into dated occurrences. Weekly series keep their local
// wall-clock time across daylight-saving changes because each occurrence is
// converted from its own local date and time.

import { addDays, weekdayOf, zonedToMs, DEFAULT_TZ } from './time.js';

export function occurrenceDates(c, fromDate, toDate) {
  const r = c.recurrence || { freq: 'none' };
  if (r.freq !== 'weekly') return c.startDate >= fromDate && c.startDate <= toDate ? [c.startDate] : [];
  const days = new Set(r.days || []);
  const first = c.startDate > fromDate ? c.startDate : fromDate;
  const last = r.until && r.until < toDate ? r.until : toDate;
  const out = [];
  for (let d = first; d <= last; d = addDays(d, 1)) if (days.has(weekdayOf(d))) out.push(d);
  return out;
}

export function expandCommitment(c, fromDate, toDate, tz = DEFAULT_TZ) {
  const exceptions = new Map((c.exceptions || []).map((e) => [e.date, e]));
  return occurrenceDates(c, fromDate, toDate).map((date) => {
    const ex = exceptions.get(date);
    const mod = ex && ex.action === 'modify' ? ex : null;
    const start = mod && mod.start != null ? mod.start : c.start;
    const end = mod && mod.end != null ? mod.end : c.end;
    const locationId = mod && mod.locationId !== undefined ? mod.locationId : c.locationId;
    const endDate = end <= start ? addDays(date, 1) : date;
    return {
      id: `${c.id}@${date}`,
      commitmentId: c.id,
      date,
      title: c.title,
      type: c.type,
      start,
      end,
      startMs: zonedToMs(date, start, tz),
      endMs: zonedToMs(endDate, end, tz),
      locationId: locationId ?? null,
      recurring: c.recurrence?.freq === 'weekly',
      skipped: !!(ex && ex.action === 'skip'),
      modified: !!mod,
      optional: !!c.optional,
      source: c.source,
    };
  });
}

export function expandCommitments(list, fromDate, toDate, tz = DEFAULT_TZ) {
  return list
    .flatMap((c) => expandCommitment(c, fromDate, toDate, tz))
    .sort((a, b) => a.startMs - b.startMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Returns a new commitment with an exception set for one date (or removed when action is null).
export function withException(c, date, exception) {
  const rest = (c.exceptions || []).filter((e) => e.date !== date);
  return { ...c, exceptions: exception ? [...rest, { date, ...exception }].sort((a, b) => (a.date < b.date ? -1 : 1)) : rest };
}
