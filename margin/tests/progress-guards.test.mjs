import test from 'node:test';
import assert from 'node:assert/strict';
import { baseState, task, at, MON } from './helpers.mjs';
import { recordProgress } from '../src/core/progress.js';

test('a missed session cannot erase remaining work by also marking finished', () => {
  const s = baseState(); s.tasks = [task('t', { remainingMin: 90 })];
  const r = recordProgress(s, { taskId: 't', outcome: 'missed', actualMin: 0, remainingAfter: 90, finish: 'task' }, at(MON, 12));
  assert.equal(r.ok, false); assert.ok(r.errors.finish); assert.equal(s.tasks[0].remainingMin, 90);
});

test('progress cannot be credited twice to a recorded block or to a different task', () => {
  const s = baseState(); s.tasks = [task('t'), task('other')];
  s.plan.blocks = [{ id: 'b', taskId: 't', stepId: null, start: at(MON, 9), end: at(MON, 10), status: 'completed' }];
  const input = { blockId: 'b', taskId: 't', outcome: 'completed', actualMin: 60, remainingAfter: 30 };
  assert.equal(recordProgress(s, input, at(MON, 12)).ok, false);
  s.plan.blocks[0].status = 'planned';
  assert.equal(recordProgress(s, { ...input, taskId: 'other' }, at(MON, 12)).ok, false);
});
