import assert from 'node:assert/strict';
import { emptyState } from '../src/core/model.js';
import { zonedToMs, MINUTE, addDays } from '../src/core/time.js';
import { expandCommitments } from '../src/core/recurrence.js';
import { sleepInterval } from '../src/core/scheduler.js';
import { travelBetween, travelCost } from '../src/core/travel.js';

export const TZ = 'America/New_York';
export const at = (date, h, m = 0) => zonedToMs(date, h * 60 + m, TZ);
export const MON = '2026-10-26';

export function baseState() {
  const s = emptyState('personal');
  s.locations = [
    { id: 'hall', name: 'Hall', kind: 'class', studyOk: false, equipment: [], source: { system: 'test', id: null } },
    { id: 'home', name: 'Home', kind: 'home', studyOk: true, equipment: [], source: { system: 'test', id: null } },
    { id: 'lib', name: 'Library', kind: 'study', studyOk: true, equipment: ['quiet', 'monitor'], source: { system: 'test', id: null } },
    { id: 'web', name: 'Online', kind: 'virtual', studyOk: false, equipment: [], source: { system: 'test', id: null } },
  ];
  s.travel = [{ a: 'hall', b: 'home', minutes: 10 }, { a: 'hall', b: 'lib', minutes: 7 }, { a: 'home', b: 'lib', minutes: 12 }];
  s.settings.homeLocationId = 'home';
  s.preferences.reserveFlexMin = 0;
  return s;
}

export function task(id, over = {}) {
  return {
    id, title: over.title || id, category: 'TEST 1', kind: 'assignment', priority: 'medium',
    deadline: { date: addDays(MON, 3), time: 17 * 60 }, estimateMin: 120, remainingMin: 120, confidence: 'medium',
    focus: 'normal', location: { mode: 'any', ids: [] }, equipment: [], status: 'todo', notes: '', doneWhen: '',
    splittable: true, minSessionMin: null, steps: [], dependsOn: [], lateTarget: null, revisionTopicId: null,
    calibratedFrom: null, createdAt: null, completedAt: null, source: { system: 'test', id },
    ...over,
  };
}

export function commitment(id, over = {}) {
  return {
    id, title: over.title || id, type: 'class', startDate: MON, start: 10 * 60, end: 11 * 60,
    recurrence: { freq: 'none' }, locationId: 'hall', optional: false, notes: '', exceptions: [], source: { system: 'test', id },
    ...over,
  };
}

// Asserts every hard invariant a generated plan must satisfy.
export function assertFeasible(state, blocks, nowMs, { horizonDays = state.settings.planningHorizonDays } = {}) {
  const prefs = state.preferences;
  const startDate = addDays(MON, -2);
  const occ = expandCommitments(state.commitments, startDate, addDays(MON, horizonDays + 2), TZ).filter((o) => !o.skipped);
  const sleeps = [];
  for (let i = -3; i < horizonDays + 3; i++) sleeps.push(sleepInterval(addDays(MON, i), prefs.sleep, TZ));
  const all = [...state.plan.blocks.filter((b) => b.end > nowMs && !blocks.some((n) => n.id === b.id)), ...blocks].sort((a, b) => a.start - b.start);
  for (const b of blocks) {
    assert.ok(b.start >= nowMs - 1, `block ${b.id} starts in the past`);
    assert.ok(b.end > b.start, 'zero-length block');
    assert.ok((b.end - b.start) / MINUTE <= prefs.maxContinuousMin, 'block exceeds max continuous work');
    for (const o of occ) assert.ok(b.end <= o.startMs || b.start >= o.endMs, `block ${b.id} overlaps ${o.id}`);
    for (const [s, e] of sleeps) assert.ok(b.end <= s || b.start >= e, `block ${b.id} overlaps sleep`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    assert.ok(all[i].end <= all[j].start || all[j].end <= all[i].start, `blocks ${all[i].id} and ${all[j].id} overlap`);
  }
  // Travel and breaks around every new block, against the nearest neighbours.
  const items = [
    ...occ.map((o) => ({ start: o.startMs, end: o.endMs, loc: o.locationId, study: false })),
    ...all.map((b) => ({ start: b.start, end: b.end, loc: b.locationId, study: true, id: b.id })),
  ].sort((a, b) => a.start - b.start);
  for (const b of blocks) {
    const prev = items.filter((x) => x.end <= b.start && x.id !== b.id).sort((a, c) => c.end - a.end)[0];
    const next = items.filter((x) => x.start >= b.end && x.id !== b.id).sort((a, c) => a.start - c.start)[0];
    if (prev && prev.loc && state.locations.find((l) => l.id === prev.loc)?.kind !== 'virtual') {
      const need = travelCost(travelBetween(state, prev.loc, b.locationId), state.settings) * MINUTE;
      const gap = b.start - prev.end;
      if (gap < 6 * 60 * MINUTE) assert.ok(gap >= need, `not enough travel time before ${b.id}`);
      if (prev.study) assert.ok(gap >= prefs.breakMin * MINUTE, `missing break before ${b.id}`);
    }
    if (next && next.loc && state.locations.find((l) => l.id === next.loc)?.kind !== 'virtual') {
      const need = travelCost(travelBetween(state, b.locationId, next.loc), state.settings) * MINUTE;
      const gap = next.start - b.end;
      if (gap < 6 * 60 * MINUTE) assert.ok(gap >= need, `not enough travel time after ${b.id}`);
      if (next.study) assert.ok(gap >= prefs.breakMin * MINUTE, `missing break after ${b.id}`);
    }
  }
}

export function minutesFor(blocks, taskId) {
  return blocks.filter((b) => b.taskId === taskId).reduce((s, b) => s + (b.end - b.start) / MINUTE, 0);
}
