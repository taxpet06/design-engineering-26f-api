import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledCourseData, buildCourseImport, fetchCourseData, COURSE_ENDPOINTS } from '../src/data/courseApi.js';
import { normalizeState, taskRemaining } from '../src/core/model.js';
import { makeProposal } from '../src/core/proposal.js';
import { assertFeasible } from './helpers.mjs';
import { MINUTE, zonedToMs } from '../src/core/time.js';
const data = bundledCourseData();
const opts = { studentId: 12, termCode: '26F', asOf: '2026-09-27', estimateMin: 90 };

test('course import uses enrolled sections only and preserves exact room, dates, source IDs', () => {
  const { state } = buildCourseImport(data, opts);
  const ids = new Set(data.records.enrollments.filter((e) => e.student_id === opts.studentId && e.status === 'enrolled').map((e) => e.section_id));
  const expected = data.records.sections.filter((s) => ids.has(s.id) && s.term === opts.termCode);
  const classes = state.commitments.filter((c) => c.type === 'class');
  assert.equal(classes.length, expected.length);
  for (const c of classes) {
    const s = expected.find((s) => String(s.id) === c.source.id);
    assert.ok(s); assert.equal(c.source.system, 'course-api');
    assert.equal(state.locations.find((l) => l.id === c.locationId).name, s.room);
    assert.equal(c.startDate, '2026-09-15'); assert.equal(c.recurrence.until, '2026-11-20');
    assert.equal(c.start, Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3, 5)));
  }
});

test('assignment effort and priority are user defaults; date-only deadlines are not fabricated', () => {
  const { state } = buildCourseImport(data, opts);
  assert.ok(state.tasks.length > 0);
  for (const t of state.tasks) {
    const a = data.records.assignments.find((a) => String(a.id) === t.source.id);
    assert.equal(t.deadline.date, a.due_date); assert.equal(t.deadline.time, null);
    assert.equal(taskRemaining(t), 90); assert.equal(t.priority, 'medium');
    assert.match(t.notes, /user-selected import default/); assert.equal(t.status, 'todo');
  }
  assert.equal(state.travel.length, 0);
  assert.equal(state.log.length, 0);
});

test('jobs and events missing times are reported without creating fake calendar blocks', () => {
  const { state, pending } = buildCourseImport(data, { ...opts, studentId: 1 });
  assert.ok(pending.some((p) => p.table === 'job-assignments'));
  assert.equal(state.commitments.filter((c) => c.type === 'work').length, 0);
  assert.ok(pending.every((p) => p.detail.length));
  assert.deepEqual(normalizeState(state, 'demo').state.meta.course.pending, state.meta.course.pending);
});

test('submission completion is opt-in and respects demo as-of date; no fabricated study logs', () => {
  const { state } = buildCourseImport(data, { ...opts, asOf: '2026-10-15', markSubmitted: true });
  assert.ok(state.tasks.some((t) => t.status === 'done'));
  for (const t of state.tasks.filter((t) => t.status === 'done')) {
    assert.ok(data.records.submissions.some((s) => s.student_id === opts.studentId && String(s.assignment_id) === t.source.id && s.submitted_at <= '2026-10-15'));
    assert.equal(t.remainingMin, 0);
  }
  assert.equal(state.log.length, 0);
});

test('reimport yields stable unique IDs and does not mutate the source or existing workspace', () => {
  const before = JSON.stringify(data);
  const a = buildCourseImport(data, opts).state;
  const ids = (s) => [...s.tasks, ...s.commitments].map((x) => x.id);
  const b = buildCourseImport(data, opts).state;
  assert.deepEqual(ids(a), ids(b)); assert.equal(new Set(ids(a)).size, ids(a).length);
  assert.equal(JSON.stringify(data), before);
});

test('invalid student, term, date, effort, or incomplete source is rejected', () => {
  for (const patch of [{ studentId: 'missing' }, { termCode: 'invalid' }, { asOf: '2027-01-01' }, { estimateMin: 0 }, { estimateMin: 15.5 }]) assert.throws(() => buildCourseImport(data, { ...opts, ...patch }));
  assert.throws(() => buildCourseImport({ records: {} }, opts), /Missing/);
});

test('live adapter validates status and arrays; no authentication headers are sent', async () => {
  const calls = [];
  const fresh = await fetchCourseData(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => data.records[url.split('/').at(-1)] }; });
  assert.equal(calls.length, COURSE_ENDPOINTS.length);
  assert.equal(calls[0].options.credentials, 'omit'); assert.equal(calls[0].options.headers, undefined);
  assert.equal(fresh.records.students.length, 90);
  await assert.rejects(fetchCourseData(async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(fetchCourseData(async () => ({ ok: true, json: async () => ({ rows: [] }) })), /expected an array/);
});

test('real course records can be planned with conserved effort and no class overlap', () => {
  const { state } = buildCourseImport(data, opts);
  const at = state.meta.demoNow;
  const alt = makeProposal(state, at, { strategy: 'balanced' });
  const blocks = alt.newBlocks;
  assert.ok(Array.isArray(blocks));
  assertFeasible(state, blocks, at);
  for (const t of state.tasks) {
    const total = blocks.filter((b) => b.taskId === t.id).reduce((s, b) => s + (b.end - b.start) / MINUTE, 0);
    assert.ok(total <= taskRemaining(t));
    for (const b of blocks.filter((b) => b.taskId === t.id)) assert.ok(b.end <= zonedToMs(t.deadline.date, 1439));
  }
});
