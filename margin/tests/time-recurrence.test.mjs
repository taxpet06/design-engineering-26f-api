import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToMs, msToDate, msToMinuteOfDay, tzOffsetMinutes, fmtClock, fmtTimeRange, addDays, weekdayOf, startOfWeek, HOUR, isDateString } from '../src/core/time.js';
import { expandCommitments, withException } from '../src/core/recurrence.js';
import { validateCommitment } from '../src/core/model.js';
import { commitment, TZ } from './helpers.mjs';

test('offsets on both sides of the November 2026 fall-back', () => {
  assert.equal(tzOffsetMinutes(zonedToMs('2026-10-30', 600, TZ), TZ), -240);
  assert.equal(tzOffsetMinutes(zonedToMs('2026-11-02', 600, TZ), TZ), -300);
});

test('ambiguous fall-back time resolves to the first occurrence', () => {
  assert.equal(zonedToMs('2026-11-01', 90, TZ), Date.UTC(2026, 10, 1, 5, 30));
});

test('nonexistent spring-forward time moves forward by the gap', () => {
  const ms = zonedToMs('2027-03-14', 150, TZ);
  assert.equal(ms, Date.UTC(2027, 2, 14, 7, 30));
  assert.equal(msToMinuteOfDay(ms, TZ), 210);
});

test('day lengths across DST transitions', () => {
  assert.equal((zonedToMs('2026-11-02', 0, TZ) - zonedToMs('2026-11-01', 0, TZ)) / HOUR, 25);
  assert.equal((zonedToMs('2027-03-15', 0, TZ) - zonedToMs('2027-03-14', 0, TZ)) / HOUR, 23);
});

test('date helpers round-trip and validate', () => {
  assert.equal(msToDate(zonedToMs('2026-10-31', 1439, TZ), TZ), '2026-10-31');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-10-26'), 1);
  assert.equal(startOfWeek('2026-11-01'), '2026-10-26');
  assert.equal(isDateString('2026-02-30'), false);
  assert.equal(isDateString('2026-02-28'), true);
});

test('12-hour formatting', () => {
  assert.equal(fmtClock(0), '12:00 AM');
  assert.equal(fmtClock(750), '12:30 PM');
  assert.equal(fmtClock(1439), '11:59 PM');
  assert.equal(fmtTimeRange(zonedToMs('2026-10-26', 600, TZ), zonedToMs('2026-10-26', 675, TZ), TZ), '10:00 to 11:15 AM');
  assert.equal(fmtTimeRange(zonedToMs('2026-10-26', 690, TZ), zonedToMs('2026-10-26', 755, TZ), TZ), '11:30 AM to 12:35 PM');
});

test('weekly class keeps its local time across the DST change', () => {
  const c = commitment('cls', { start: 610, end: 675, recurrence: { freq: 'weekly', days: [1, 3, 5], until: '2026-11-30' } });
  const occ = expandCommitments([c], '2026-10-26', '2026-11-06', TZ);
  assert.equal(occ.length, 6);
  for (const o of occ) assert.equal(msToMinuteOfDay(o.startMs, TZ), 610);
  const fri = occ.find((o) => o.date === '2026-10-30');
  const mon = occ.find((o) => o.date === '2026-11-02');
  assert.equal(new Date(fri.startMs).getUTCHours(), 14);
  assert.equal(new Date(mon.startMs).getUTCHours(), 15);
});

test('recurrence exceptions affect one date only', () => {
  let c = commitment('cls', { recurrence: { freq: 'weekly', days: [1, 3], until: '2026-11-30' } });
  c = withException(c, '2026-10-28', { action: 'skip' });
  c = withException(c, '2026-11-02', { action: 'modify', start: 13 * 60, end: 14 * 60, locationId: 'lib' });
  const occ = expandCommitments([c], '2026-10-26', '2026-11-04', TZ);
  const by = Object.fromEntries(occ.map((o) => [o.date, o]));
  assert.equal(by['2026-10-28'].skipped, true);
  assert.equal(by['2026-11-02'].start, 780);
  assert.equal(by['2026-11-02'].locationId, 'lib');
  assert.equal(by['2026-10-26'].start, 600);
  assert.equal(by['2026-11-04'].locationId, 'hall');
  c = withException(c, '2026-10-28', null);
  assert.equal(expandCommitments([c], '2026-10-28', '2026-10-28', TZ)[0].skipped, false);
});

test('series respects start date and until date', () => {
  const c = commitment('cls', { startDate: '2026-10-28', recurrence: { freq: 'weekly', days: [1, 3], until: '2026-11-02' } });
  assert.deepEqual(expandCommitments([c], '2026-10-20', '2026-11-30', TZ).map((o) => o.date), ['2026-10-28', '2026-11-02']);
});

test('overnight commitments end the next day; zero-length is rejected', () => {
  const c = commitment('night', { start: 22 * 60, end: 2 * 60 });
  const [o] = expandCommitments([c], '2026-10-26', '2026-10-26', TZ);
  assert.equal(msToDate(o.endMs, TZ), '2026-10-27');
  assert.equal((o.endMs - o.startMs) / HOUR, 4);
  assert.deepEqual(validateCommitment(c), {});
  assert.ok(validateCommitment({ ...c, end: c.start }).end);
  assert.ok(validateCommitment({ ...c, recurrence: { freq: 'weekly', days: [], until: '2026-10-01' } }).days);
});

test('overnight event across the fall-back night lasts one extra hour', () => {
  const c = commitment('n', { startDate: '2026-10-31', start: 23 * 60, end: 7 * 60 });
  const [o] = expandCommitments([c], '2026-10-31', '2026-10-31', TZ);
  assert.equal((o.endMs - o.startMs) / HOUR, 9);
});
