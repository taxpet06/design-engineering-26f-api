import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan } from '../src/core/scheduler.js';
import { makeProposal, approveProposal } from '../src/core/proposal.js';
import { analyze } from '../src/core/analysis.js';
import { MINUTE, addDays, msToMinuteOfDay } from '../src/core/time.js';
import { baseState, task, commitment, at, MON, TZ, assertFeasible, minutesFor } from './helpers.mjs';

const NOW = at(MON, 8);

function busyDay() {
  const s = baseState();
  s.settings.planningHorizonDays = 5;
  s.commitments = [
    commitment('c1', { start: 9 * 60, end: 10 * 60, recurrence: { freq: 'weekly', days: [1, 2, 3, 4, 5], until: '2026-12-01' } }),
    commitment('c2', { start: 11 * 60 + 30, end: 12 * 60 + 30, recurrence: { freq: 'weekly', days: [1, 3, 5], until: '2026-12-01' } }),
    commitment('c3', { title: 'Call', start: 14 * 60, end: 14 * 60 + 30, locationId: 'web', recurrence: { freq: 'weekly', days: [1, 2], until: '2026-12-01' } }),
  ];
  s.tasks = [
    task('a', { remainingMin: 240, estimateMin: 240, deadline: { date: addDays(MON, 2), time: 23 * 60 }, focus: 'deep' }),
    task('b', { remainingMin: 90, estimateMin: 90, deadline: { date: addDays(MON, 1), time: 12 * 60 }, focus: 'light' }),
    task('c', { remainingMin: 180, estimateMin: 180, deadline: { date: addDays(MON, 4), time: 17 * 60 }, location: { mode: 'required', ids: ['lib'] } }),
  ];
  return s;
}

test('generated plan satisfies every hard constraint', () => {
  const s = busyDay();
  const r = generatePlan(s, NOW, { strategy: 'balanced' });
  assert.ok(r.blocks.length > 0);
  assertFeasible(s, r.blocks, NOW, { horizonDays: 5 });
  for (const b of r.blocks) {
    const mod = msToMinuteOfDay(b.start, TZ);
    assert.ok(mod >= 8 * 60, 'starts inside study hours');
    assert.ok(msToMinuteOfDay(b.end, TZ) <= 23 * 60 || msToMinuteOfDay(b.end, TZ) === 0, 'ends inside study hours');
  }
  for (const strategy of ['early', 'evenings']) assertFeasible(s, generatePlan(s, NOW, { strategy }).blocks, NOW, { horizonDays: 5 });
});

test('travel is respected before and after sessions', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 1;
  s.preferences.availability = Array.from({ length: 7 }, () => [{ start: 10 * 60, end: 12 * 60 + 30 }]);
  s.commitments = [
    commitment('x', { start: 9 * 60, end: 10 * 60, locationId: 'hall' }),
    commitment('y', { start: 12 * 60, end: 13 * 60, locationId: 'hall' }),
  ];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60, location: { mode: 'required', ids: ['lib'] }, deadline: { date: MON, time: 20 * 60 } })];
  const r = generatePlan(s, NOW);
  assert.equal(r.blocks.length, 1);
  const b = r.blocks[0];
  assert.ok(b.start >= at(MON, 10, 12), 'leaves 7 min travel plus 5 min buffer after the class');
  assert.ok(b.end <= at(MON, 11, 48), 'leaves time to walk back before the next class');
  assert.ok(b.reasons.some((x) => /7 min to get here from Hall/.test(x.text)));
});

test('a session does not fit just because clock time fits between classes', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 1;
  s.preferences.availability = Array.from({ length: 7 }, () => [{ start: 10 * 60, end: 11 * 60 }]);
  s.commitments = [commitment('x', { start: 9 * 60, end: 10 * 60 }), commitment('y', { start: 11 * 60, end: 12 * 60 })];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60, splittable: false, location: { mode: 'required', ids: ['lib'] }, deadline: { date: MON, time: 20 * 60 } })];
  const r = generatePlan(s, NOW);
  assert.equal(r.blocks.length, 0);
  assert.equal(r.unplaced[0].minutes, 60);
  assert.match(r.unplaced[0].text, /No single free window|free within your study hours/);
});

test('no travel between identical places or to virtual activities', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 1;
  s.locations[0].studyOk = true;
  s.preferences.availability = Array.from({ length: 7 }, () => [{ start: 10 * 60, end: 11 * 60 }]);
  s.commitments = [commitment('x', { start: 9 * 60, end: 10 * 60, locationId: 'hall' }), commitment('v', { start: 11 * 60, end: 12 * 60, locationId: 'web' })];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60, splittable: false, location: { mode: 'required', ids: ['hall'] }, deadline: { date: MON, time: 20 * 60 } })];
  const r = generatePlan(s, NOW);
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0].start, at(MON, 10));
  assert.equal(r.blocks[0].end, at(MON, 11));
});

test('breaks, session length, and daily limit', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 2;
  s.preferences.maxDailyStudyMin = 180;
  s.preferences.maxContinuousMin = 60;
  s.preferences.preferredSessionMin = 60;
  s.preferences.breakMin = 15;
  s.tasks = [task('t', { remainingMin: 600, estimateMin: 600, deadline: { date: addDays(MON, 1), time: 22 * 60 } })];
  const r = generatePlan(s, NOW, { strategy: 'early' });
  const perDay = {};
  for (const b of r.blocks) {
    assert.ok((b.end - b.start) / MINUTE <= 60);
    const d = b.start < at(addDays(MON, 1), 0) ? 'mon' : 'tue';
    perDay[d] = (perDay[d] || 0) + (b.end - b.start) / MINUTE;
  }
  assert.ok(perDay.mon <= 180 && perDay.tue <= 180);
  const sorted = r.blocks.slice().sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].start - sorted[i - 1].end >= 15 * MINUTE, 'break between sessions');
  assert.equal(r.unplaced[0].code, 'capacity');
  assert.equal(r.unplaced[0].minutes + minutesFor(r.blocks, 't'), 600);
});

test('splitting conserves minutes and never leaves a fragment below the minimum', () => {
  const s = busyDay();
  const r = generatePlan(s, NOW);
  for (const u of r.units) assert.equal(u.placed + u.unplaced + u.deferred, u.need, `${u.unitId} minutes accounted`);
  for (const b of r.blocks) {
    const t = s.tasks.find((x) => x.id === b.taskId);
    const min = t.minSessionMin ?? s.preferences.minSessionMin;
    const total = r.units.find((u) => u.taskId === t.id).need;
    assert.ok((b.end - b.start) / MINUTE >= Math.min(min, total), `${b.id} is at least the minimum useful session`);
  }
  assert.equal(new Set(r.blocks.map((b) => b.id)).size, r.blocks.length);
});

test('deadline within the same day is respected', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 3;
  s.tasks = [task('t', { remainingMin: 120, estimateMin: 120, deadline: { date: MON, time: 13 * 60 } })];
  const r = generatePlan(s, NOW);
  assert.ok(r.blocks.length > 0);
  for (const b of r.blocks) assert.ok(b.end <= at(MON, 13));
  assert.equal(minutesFor(r.blocks, 't'), 120);
});

test('overdue work is reported, not silently scheduled; a late target allows it', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 3;
  s.tasks = [task('late', { remainingMin: 40, estimateMin: 40, deadline: { date: addDays(MON, -1), time: 23 * 60 + 59 } })];
  let r = generatePlan(s, NOW);
  assert.equal(r.blocks.length, 0);
  assert.equal(r.unplaced[0].code, 'overdue');
  assert.equal(r.metrics.overdueMin, 40);
  assert.equal(r.metrics.unplacedMin, 0);
  s.tasks[0].lateTarget = addDays(MON, 1);
  r = generatePlan(s, NOW);
  assert.equal(minutesFor(r.blocks, 'late'), 40);
  assert.ok(r.blocks[0].reasons[0].text.includes('finish-late-by'));
});

test('dependencies and ordered steps', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 4;
  s.tasks = [
    task('a', { remainingMin: 90, estimateMin: 90, deadline: { date: addDays(MON, 3), time: 17 * 60 } }),
    task('b', { remainingMin: 120, estimateMin: 120, dependsOn: ['a'], deadline: { date: addDays(MON, 3), time: 17 * 60 } }),
    task('st', { estimateMin: 0, remainingMin: 0, deadline: { date: addDays(MON, 3), time: 17 * 60 }, steps: [
      { id: 's1', title: 'One', estimateMin: 60, remainingMin: 60, done: false },
      { id: 's2', title: 'Two', estimateMin: 60, remainingMin: 60, done: false },
      { id: 's3', title: 'Done already', estimateMin: 30, remainingMin: 0, done: true },
    ] }),
  ];
  const r = generatePlan(s, NOW);
  const endA = Math.max(...r.blocks.filter((x) => x.taskId === 'a').map((x) => x.end));
  for (const x of r.blocks.filter((x) => x.taskId === 'b')) assert.ok(x.start >= endA);
  const end1 = Math.max(...r.blocks.filter((x) => x.stepId === 's1').map((x) => x.end));
  for (const x of r.blocks.filter((x) => x.stepId === 's2')) assert.ok(x.start >= end1);
  assert.equal(minutesFor(r.blocks, 'st'), 120, 'parent and step effort are not double-counted');
  assert.ok(!r.blocks.some((x) => x.stepId === 's3'));
});

test('a blocked dependency reports its reason', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 2;
  s.tasks = [
    task('a', { remainingMin: 40, estimateMin: 40, deadline: { date: addDays(MON, -1), time: 12 * 60 } }),
    task('b', { remainingMin: 60, estimateMin: 60, dependsOn: ['a'] }),
  ];
  const r = generatePlan(s, NOW);
  assert.equal(r.unplaced.find((u) => u.taskId === 'b').code, 'dependency');
});

test('unsplittable work gets one block or a clear reason', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 3;
  s.tasks = [
    task('one', { remainingMin: 90, estimateMin: 90, splittable: false }),
    task('long', { remainingMin: 200, estimateMin: 200, splittable: false }),
  ];
  const r = generatePlan(s, NOW);
  const one = r.blocks.filter((b) => b.taskId === 'one');
  assert.equal(one.length, 1);
  assert.equal((one[0].end - one[0].start) / MINUTE, 90);
  assert.equal(r.unplaced.find((u) => u.taskId === 'long').code, 'tooLong');
});

test('required equipment and location are hard constraints', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 2;
  s.tasks = [
    task('mon', { remainingMin: 60, estimateMin: 60, equipment: ['monitor'] }),
    task('ws', { remainingMin: 60, estimateMin: 60, equipment: ['workshop'] }),
  ];
  const r = generatePlan(s, NOW);
  assert.ok(r.blocks.filter((b) => b.taskId === 'mon').every((b) => b.locationId === 'lib'));
  assert.equal(r.unplaced.find((u) => u.taskId === 'ws').code, 'noLocation');
});

test('unknown routes use the labeled fallback estimate', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 1;
  s.travel = s.travel.filter((t) => !(t.a === 'hall' && t.b === 'lib'));
  s.settings.unknownTravelFallbackMin = 20;
  s.preferences.availability = Array.from({ length: 7 }, () => [{ start: 10 * 60, end: 13 * 60 }]);
  s.commitments = [commitment('x', { start: 9 * 60, end: 10 * 60 })];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60, location: { mode: 'required', ids: ['lib'] }, deadline: { date: MON, time: 20 * 60 } })];
  const r = generatePlan(s, NOW);
  assert.ok(r.blocks[0].start >= at(MON, 10, 25));
  assert.ok(r.blocks[0].reasons.some((x) => x.type === 'estimate' && /fallback/.test(x.text)));
  assert.ok(r.decisions.some((d) => d.type === 'estimate'));
});

test('impossible transitions between fixed commitments are flagged, not changed', () => {
  const s = baseState();
  s.commitments = [commitment('x', { start: 9 * 60, end: 10 * 60, locationId: 'hall' }), commitment('y', { start: 10 * 60 + 5, end: 11 * 60, locationId: 'lib' })];
  const a = analyze(s, NOW);
  assert.ok(a.issues.some((i) => i.kind === 'transition' && i.severity === 'conflict'));
  assert.equal(s.commitments[1].start, 605);
});

test('overlapping commitments are reported and preserved', () => {
  const s = baseState();
  s.commitments = [commitment('x', { start: 9 * 60, end: 10 * 60 }), commitment('y', { start: 9 * 60 + 30, end: 10 * 60 + 30 })];
  const before = structuredClone(s.commitments);
  const a = analyze(s, NOW);
  assert.ok(a.issues.some((i) => i.kind === 'overlap'));
  assert.deepEqual(s.commitments, before);
});

test('replanning preserves locked, in-progress, and recorded sessions', () => {
  const s = busyDay();
  const res = approveProposal(s, makeProposal(s, NOW, { strategy: 'balanced' }), NOW);
  let st = res.state;
  const future = st.plan.blocks.filter((b) => b.start > NOW).sort((a, b) => a.start - b.start);
  const locked = future[2];
  st.plan.blocks.find((b) => b.id === locked.id).locked = true;
  const later = NOW + 3 * 60 * MINUTE;
  const r = generatePlan(st, later, { strategy: 'early' });
  assert.ok(r.kept.some((b) => b.id === locked.id));
  assert.ok(!r.blocks.some((b) => b.start < locked.end && b.end > locked.start), 'nothing placed over the locked block');
  assert.ok(r.history.every((b) => b.end <= r.startMs));
});

test('repeated generation is idempotent and never double-allocates', () => {
  const s = busyDay();
  const first = approveProposal(s, makeProposal(s, NOW, { strategy: 'balanced' }), NOW).state;
  const again = makeProposal(first, NOW, { strategy: 'balanced' });
  assert.equal(again.diff.added.length, 0);
  assert.equal(again.diff.moved.length, 0);
  assert.equal(again.diff.removed.length, 0);
  const minimal = makeProposal(first, NOW, { strategy: 'minimal' });
  assert.equal(minimal.newBlocks.length, 0, 'nothing is added when the plan already covers the work');
  for (const t of s.tasks) assert.ok(minutesFor(first.plan.blocks, t.id) <= t.remainingMin);
});

test('generation is deterministic', () => {
  const s = busyDay();
  assert.deepEqual(generatePlan(s, NOW), generatePlan(structuredClone(s), NOW));
});

test('estimate scaling and protect-evenings options', () => {
  const s = busyDay();
  const r = generatePlan(s, NOW, { strategy: 'evenings' });
  for (const b of r.blocks) assert.ok(msToMinuteOfDay(b.end, TZ) <= s.preferences.eveningCutoff);
  assert.equal(r.metrics.eveningMin, 0);
  const scaled = generatePlan(s, NOW, { estimateScale: { b: 0.5 } });
  assert.equal(minutesFor(scaled.blocks, 'b'), 45);
});
