// Time utilities.
// Instants are epoch milliseconds. Calendar dates are 'YYYY-MM-DD' strings in the
// planner timezone. Times of day are minutes after local midnight (0..1440).
// All conversions go through Intl so daylight-saving changes are handled by the
// platform's timezone database rather than by fixed offsets.

export const MINUTE = 60000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const DEFAULT_TZ = 'America/New_York';

const pad2 = (n) => String(n).padStart(2, '0');
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatters = new Map();

function partsFormatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function zonedParts(ms, tz = DEFAULT_TZ) {
  const o = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  }
  return { year: o.year, month: o.month, day: o.day, hour: o.hour === 24 ? 0 : o.hour, minute: o.minute, second: o.second };
}

// Minutes to add to UTC to get local wall time (New York: -300 in winter, -240 in summer).
export function tzOffsetMinutes(ms, tz = DEFAULT_TZ) {
  const p = zonedParts(ms, tz);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = ms - (((ms % 1000) + 1000) % 1000);
  return Math.round((wall - wholeSeconds) / MINUTE);
}

function dateToUTC(d) {
  const m = DATE_RE.exec(d);
  if (!m) throw new Error(`Invalid date: ${d}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcToDate(ms) {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

export function isDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  return utcToDate(dateToUTC(s)) === s;
}

export function addDays(d, n) { return utcToDate(dateToUTC(d) + n * DAY); }
export function weekdayOf(d) { return new Date(dateToUTC(d)).getUTCDay(); }
export function daysBetween(a, b) { return Math.round((dateToUTC(b) - dateToUTC(a)) / DAY); }
export function startOfWeek(d) { return addDays(d, -((weekdayOf(d) + 6) % 7)); }

// Converts a local wall-clock time to an instant.
// Ambiguous times (the repeated hour when clocks fall back) resolve to the first occurrence.
// Nonexistent times (the skipped hour when clocks spring forward) move forward by the gap.
export function zonedToMs(date, minuteOfDay, tz = DEFAULT_TZ) {
  const wall = dateToUTC(date) + minuteOfDay * MINUTE;
  const before = tzOffsetMinutes(wall - 14 * HOUR, tz);
  const after = tzOffsetMinutes(wall + 14 * HOUR, tz);
  const valid = [];
  for (const off of new Set([before, after])) {
    const ms = wall - off * MINUTE;
    if (tzOffsetMinutes(ms, tz) === off) valid.push(ms);
  }
  if (valid.length) return Math.min(...valid);
  return wall - before * MINUTE;
}

export function msToDate(ms, tz = DEFAULT_TZ) {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function msToMinuteOfDay(ms, tz = DEFAULT_TZ) {
  const p = zonedParts(ms, tz);
  return p.hour * 60 + p.minute;
}

export function roundUpTo(ms, step) { return Math.ceil(ms / step) * step; }
export function roundDownTo(ms, step) { return Math.floor(ms / step) * step; }

const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const WEEKDAY_SHORT = WD_SHORT;
export const WEEKDAY_LONG = WD_LONG;

export function fmtClock(minuteOfDay) {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return `${h}:${pad2(m % 60)} ${ap}`;
}

export function fmtTime(ms, tz = DEFAULT_TZ) { return fmtClock(msToMinuteOfDay(ms, tz)); }

export function fmtTimeRange(a, b, tz = DEFAULT_TZ) {
  const sa = fmtTime(a, tz);
  const sb = fmtTime(b, tz);
  const crossDay = msToDate(a, tz) !== msToDate(b - 1, tz);
  const [ta, pa] = sa.split(' ');
  const pb = sb.split(' ')[1];
  if (!crossDay && pa === pb) return `${ta} to ${sb}`;
  return `${sa} to ${sb}${crossDay ? ' (next day)' : ''}`;
}

export function fmtClockRange(start, end) {
  const sa = fmtClock(start);
  const sb = fmtClock(end);
  const next = end <= start ? ' (next day)' : '';
  const [ta, pa] = sa.split(' ');
  if (!next && pa === sb.split(' ')[1]) return `${ta} to ${sb}`;
  return `${sa} to ${sb}${next}`;
}

export function fmtDate(d) {
  const t = new Date(dateToUTC(d));
  return `${WD_SHORT[t.getUTCDay()]}, ${MON_SHORT[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

export function fmtDateLong(d) {
  const t = new Date(dateToUTC(d));
  return `${WD_LONG[t.getUTCDay()]}, ${MON_LONG[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

export function fmtMonthDay(d) {
  const t = new Date(dateToUTC(d));
  return `${MON_SHORT[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

export function fmtYear(d) { return d.slice(0, 4); }

export function fmtDateTime(ms, tz = DEFAULT_TZ) { return `${fmtDate(msToDate(ms, tz))}, ${fmtTime(ms, tz)}`; }

export function fmtDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export function fmtRelative(ms, nowMs) {
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  let s;
  if (abs < HOUR) s = `${Math.max(1, Math.round(abs / MINUTE))} min`;
  else if (abs < 2 * DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs % HOUR) / MINUTE);
    s = h >= 10 || m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  } else s = `${Math.round(abs / DAY)} days`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

// Day label relative to today: "Today", "Tomorrow", "Yesterday", or the formatted date.
export function fmtDayRelative(d, today) {
  const n = daysBetween(today, d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return fmtDate(d);
}

// <input type="time"> uses "HH:MM" in 24-hour form.
export function parseClockInput(s) {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function toClockInput(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function overlapMs(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
