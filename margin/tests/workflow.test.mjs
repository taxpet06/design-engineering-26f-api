import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProposal, makeAlternatives, approveProposal, cancelProposal, proposalStaleness } from '../src/core/proposal.js';
import { recordProgress, taskAccounting, setTaskDone } from '../src/core/progress.js';
import { calibrationSuggestions, applySuggestion, dismissSuggestion, clearCalibration, calibrationGroups } from '../src/core/calibration.js';
import { nextInterval, syncReviewTasks, logReview, addTopic } from '../src/core/revision.js';
import { recommendNow } from '../src/core/recommend.js';
import { stressTest } from '../src/core/fragility.js';
import { generatePlan } from '../src/core/scheduler.js';
import { createRepository, memoryBackend, parseImport, exportPayload, KEYS } from '../src/core/storage.js';
import { emptyState, normalizeState, taskRemaining, SCHEMA_VERSION } from '../src/core/model.js';
import { buildDemoState, DEMO_NOW, DEMO_SCENARIOS } from '../src/data/demoSeed.js';
import { analyze } from '../src/core/analysis.js';
import { MINUTE, addDays } from '../src/core/time.js';
import { baseState, task, commitment, at, MON, assertFeasible } from './helpers.mjs';

const NOW = at(MON, 8);
function planned() {
  const s = baseState();
  s.settings.planningHorizonDays = 4;
  s.commitments = [commitment('c', { recurrence: { freq: 'weekly', days: [1, 2, 3, 4, 5], until: '2026-12-01' } })];
  s.tasks = [task('a', { remainingMin: 150, estimateMin: 150 }), task('b', { remainingMin: 60, estimateMin: 60, deadline: { date: addDays(MON, 1), time: 12 * 60 } })];
  return approveProposal(s, makeProposal(s, NOW), NOW).state;
}

// ---------- Proposals ----------

test('cancelling a proposal leaves the active plan unchanged', () => {
  const s = planned();
  const withProp = { ...s, proposal: makeAlternatives(s, NOW + 60 * MINUTE) };
  const after = cancelProposal(withProp);
  assert.equal(after.proposal, null);
  assert.deepEqual(after.plan, s.plan);
});

test('approval does not reduce remaining effort', () => {
  const s = planned();
  for (const t of s.tasks) assert.equal(t.remainingMin, t.estimateMin);
});

test('stale proposals are refused with reasons', () => {
  const s = planned();
  const alt = makeProposal(s, NOW, { strategy: 'early' });
  const edited = structuredClone(s);
  edited.tasks[0].remainingMin = 200;
  const r = approveProposal(edited, alt, NOW);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes('Tasks changed'));
  const later = proposalStaleness(s, alt, NOW + 24 * 60 * MINUTE);
  assert.ok(later.reasons.some((x) => /past/.test(x)));
  assert.equal(approveProposal(s, alt, NOW).ok, true);
});

test('relaxed option appears only when capacity is short, and is labeled', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 2;
  s.preferences.maxDailyStudyMin = 60;
  s.tasks = [task('big', { remainingMin: 200, estimateMin: 200, deadline: { date: addDays(MON, 1), time: 20 * 60 } })];
  const p = makeAlternatives(s, NOW);
  const relaxed = p.alternatives.find((a) => a.relaxed);
  assert.ok(relaxed);
  assert.ok(relaxed.decisions.some((d) => d.type === 'relaxed'));
  assert.ok(relaxed.metrics.placedMin > p.alternatives[0].metrics.placedMin);
  const fine = baseState();
  fine.tasks = [task('small', { remainingMin: 30, estimateMin: 30 })];
  assert.ok(!makeAlternatives(fine, NOW).alternatives.some((a) => a.relaxed));
});

test('fact changes from a what-if apply only on approval', () => {
  const s = baseState();
  s.commitments = [commitment('club', { type: 'club', optional: true, start: 19 * 60, end: 21 * 60 })];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60 })];
  const alt = makeProposal(s, NOW, { skipOccurrenceIds: [`club@${MON}`], factChanges: [{ type: 'skipOccurrence', commitmentId: 'club', date: MON }, { type: 'taskRemaining', taskId: 't', from: 60, to: 90 }] });
  assert.equal(s.commitments[0].exceptions.length, 0);
  const r = approveProposal(s, alt, NOW);
  assert.equal(r.state.commitments[0].exceptions[0].action, 'skip');
  assert.equal(r.state.tasks[0].remainingMin, 90);
});

// ---------- Progress ----------

test('recording progress updates only what the user reports', () => {
  const s = planned();
  const b = s.plan.blocks.find((x) => x.taskId === 'a');
  const r = recordProgress(s, { blockId: b.id, taskId: 'a', outcome: 'completed', actualMin: 75, remainingAfter: 100 }, b.end);
  assert.ok(r.ok);
  const t = r.state.tasks.find((x) => x.id === 'a');
  assert.equal(t.remainingMin, 100);
  assert.equal(t.status, 'in_progress', 'completing a session does not finish the task');
  assert.equal(r.state.plan.blocks.find((x) => x.id === b.id).status, 'completed');
  const acc = taskAccounting(r.state, t, b.end);
  assert.equal(acc.actualMin, 75);
  assert.equal(acc.completedEffort, 50, 'credited effort can differ from time spent');
});

test('missed sessions keep remaining effort and record zero minutes', () => {
  const s = planned();
  const b = s.plan.blocks[0];
  const r = recordProgress(s, { blockId: b.id, taskId: b.taskId, outcome: 'missed', actualMin: 999, remainingAfter: 0 }, b.end);
  assert.ok(r.ok);
  assert.equal(r.state.tasks.find((x) => x.id === b.taskId).remainingMin, s.tasks.find((x) => x.id === b.taskId).remainingMin);
  assert.equal(r.state.log.at(-1).actualMin, 0);
});

test('finishing a task is explicit; invalid input is rejected', () => {
  const s = planned();
  const done = recordProgress(s, { taskId: 'b', outcome: 'logged', actualMin: 60, remainingAfter: 0, finish: 'task' }, NOW);
  assert.equal(done.state.tasks.find((x) => x.id === 'b').status, 'done');
  assert.equal(recordProgress(s, { taskId: 'b', outcome: 'partial', actualMin: -5, remainingAfter: 10 }, NOW).ok, false);
  assert.equal(recordProgress(s, { taskId: 'nope', outcome: 'partial', actualMin: 5, remainingAfter: 10 }, NOW).ok, false);
  const reopened = setTaskDone(done.state, 'b', false, NOW);
  assert.equal(reopened.tasks.find((x) => x.id === 'b').status, 'in_progress');
});

test('replanning after progress places only what remains', () => {
  const s = planned();
  const first = s.plan.blocks.filter((x) => x.taskId === 'a').sort((x, y) => x.start - y.start)[0];
  const r = recordProgress(s, { blockId: first.id, taskId: 'a', outcome: 'partial', actualMin: 60, remainingAfter: 120 }, first.end);
  const later = first.end + 5 * MINUTE;
  const p = generatePlan(r.state, later);
  const placed = p.blocks.filter((x) => x.taskId === 'a').reduce((m, x) => m + (x.end - x.start) / MINUTE, 0);
  const kept = p.kept.filter((x) => x.taskId === 'a' && x.status === 'planned').reduce((m, x) => m + (x.end - Math.max(x.start, p.startMs)) / MINUTE, 0);
  assert.equal(placed + kept + (p.unplaced.find((u) => u.taskId === 'a')?.minutes || 0), 120);
});

// ---------- Calibration ----------

function withHistory(ratios, { interrupted = [] } = {}) {
  const s = baseState();
  ratios.forEach((r, i) => {
    const id = `h${i}`;
    s.tasks.push(task(id, { status: 'done', estimateMin: 100, remainingMin: 0, completedAt: NOW - (10 - i) * 86400000 }));
    s.log.push({ id: `l${i}`, at: NOW - (10 - i) * 86400000, date: MON, blockId: null, taskId: id, stepId: null, outcome: interrupted.includes(i) ? 'interrupted' : 'completed', actualMin: Math.round(100 * r), unitRemainingBefore: 100, unitRemainingAfter: 0, taskRemainingBefore: 100, taskRemainingAfter: 0, focus: null, difficulty: null, note: '', finished: 'task' });
  });
  s.tasks.push(task('open', { remainingMin: 100, estimateMin: 100 }));
  return s;
}

test('calibration needs three usable observations', () => {
  assert.equal(calibrationSuggestions(withHistory([1.5, 1.5])).length, 0);
  const s = withHistory([1.3, 1.5, 1.4]);
  const [sug] = calibrationSuggestions(s);
  assert.equal(sug.to, 140);
  assert.equal(sug.n, 3);
});

test('interrupted work is excluded from the ratio', () => {
  const s = withHistory([1.3, 1.5, 3.0, 1.4], { interrupted: [2] });
  const g = calibrationGroups(s).find((x) => x.key.startsWith('ck:'));
  assert.equal(g.n, 3);
  assert.equal(g.excluded, 1);
  assert.equal(g.ratio, 1.4);
});

test('suggestions are never applied automatically and can be dismissed, disabled, or cleared', () => {
  const s = withHistory([1.3, 1.5, 1.4]);
  assert.equal(s.tasks.find((t) => t.id === 'open').remainingMin, 100);
  const [sug] = calibrationSuggestions(s);
  const applied = applySuggestion(s, sug, NOW);
  const t = applied.tasks.find((x) => x.id === 'open');
  assert.equal(t.remainingMin, 140);
  assert.equal(t.estimateMin, 100, 'original estimate kept for future calibration');
  assert.equal(calibrationSuggestions(applied).length, 0);
  assert.equal(calibrationSuggestions(dismissSuggestion(s, sug)).length, 0);
  assert.equal(calibrationSuggestions(clearCalibration(s, NOW)).length, 0);
  const off = structuredClone(s);
  off.settings.calibrationEnabled = false;
  assert.equal(calibrationSuggestions(off).length, 0);
});

// ---------- Revision ----------

test('interval rule and review logging', () => {
  assert.equal(nextInterval(null, 3), 2);
  assert.equal(nextInterval(4, 5), 12);
  assert.equal(nextInterval(10, 1), 1);
  assert.equal(nextInterval(50, 5), 60);
  let s = baseState();
  s = addTopic(s, { id: 'tp', title: 'Topic', category: 'TEST 1', confidence: 2 }, MON);
  assert.equal(s.revision.topics[0].nextDue, addDays(MON, 1));
  s = logReview(s, 'tp', 4, addDays(MON, 1), NOW);
  assert.equal(s.revision.topics[0].intervalDays, 3);
});

test('review tasks are created once and scheduled normally', () => {
  let s = baseState();
  s.settings.planningHorizonDays = 3;
  s = addTopic(s, { id: 'tp', title: 'Topic', confidence: 1 }, MON);
  const a = syncReviewTasks(s, MON, 3);
  assert.equal(a.created.length, 1);
  const b = syncReviewTasks(a.state, MON, 3);
  assert.equal(b.created.length, 0);
  assert.equal(b.state.tasks.filter((t) => t.revisionTopicId === 'tp').length, 1);
  const r = generatePlan(b.state, NOW);
  assert.ok(r.blocks.some((x) => x.taskId === a.created[0].id));
  assertFeasible(b.state, r.blocks, NOW, { horizonDays: 3 });
});

// ---------- Recommendation ----------

test('no realistic window means a break, not manufactured urgency', () => {
  const s = baseState();
  s.commitments = [commitment('c', { start: 8 * 60 + 15, end: 9 * 60 })];
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60 })];
  const r = recommendNow(s, at(MON, 8, 5));
  assert.equal(r.status, 'no-window');
  assert.equal(r.pick, null);
  assert.ok(r.next && r.next.start >= at(MON, 9));
});

test('busy, resting, and in-session states', () => {
  const s = planned();
  assert.equal(recommendNow(s, at(MON, 10, 30)).status, 'busy');
  assert.equal(recommendNow(s, at(MON, 3)).status, 'resting');
  const b = s.plan.blocks[0];
  assert.equal(recommendNow(s, b.start + 5 * MINUTE).status, 'in-session');
});

test('recommendation accounts for travel to a required place', () => {
  const s = baseState();
  s.locations[0].studyOk = true;
  s.commitments = [commitment('c', { start: 9 * 60, end: 10 * 60, locationId: 'hall' }), commitment('d', { start: 10 * 60 + 45, end: 11 * 60 + 30, locationId: 'hall' })];
  s.tasks = [task('lib', { remainingMin: 60, estimateMin: 60, minSessionMin: 30, location: { mode: 'required', ids: ['lib'] } }), task('any', { remainingMin: 30, estimateMin: 30, focus: 'light' })];
  const r = recommendNow(s, at(MON, 10));
  const lib = r.options.find((o) => o.taskId === 'lib');
  assert.equal(lib.fits, false);
  assert.match(lib.whyNot, /Library/);
  assert.equal(r.pick.taskId, 'any');
});

// ---------- Robustness ----------

test('stress test flags a session whose loss breaks a deadline', () => {
  const s = baseState();
  s.settings.planningHorizonDays = 1;
  s.preferences.availability = Array.from({ length: 7 }, () => [{ start: 9 * 60, end: 11 * 60 }]);
  s.preferences.maxContinuousMin = 60;
  s.preferences.preferredSessionMin = 60;
  s.preferences.breakMin = 0;
  s.tasks = [task('t', { remainingMin: 120, estimateMin: 120, deadline: { date: MON, time: 12 * 60 }, location: { mode: 'required', ids: ['home'] } })];
  const st = approveProposal(s, makeProposal(s, NOW), NOW).state;
  const res = stressTest(st, NOW);
  assert.ok(res.sessions.some((x) => x.critical));
  assert.equal(res.tasks[0].status, 'fragile');
  assert.ok(res.assumptions.some((a) => /not predictions/.test(a)));
});

// ---------- Storage ----------

function repo(backend = memoryBackend()) {
  return createRepository(backend, { seedDemo: () => buildDemoState('fresh') });
}

test('demo and personal data never mix; demo reset leaves personal intact', async () => {
  const be = memoryBackend();
  const r = repo(be);
  const personal = emptyState('personal');
  personal.tasks.push(task('mine'));
  assert.equal((await r.saveMode('personal', personal)).ok, true);
  const demo = (await r.loadMode('demo')).state;
  assert.ok(!demo.tasks.some((t) => t.id === 'mine'));
  assert.equal((await r.saveMode('demo', personal)).ok, false, 'refuses to write personal data into demo storage');
  await r.saveMode('demo', demo);
  await r.removeMode('demo');
  const p2 = (await r.loadMode('personal')).state;
  assert.ok(p2.tasks.some((t) => t.id === 'mine'));
  assert.equal((await r.loadMode('demo')).status, 'new');
});

test('refresh round-trip preserves state', async () => {
  const r = repo();
  const s = planned();
  await r.saveMode('personal', s);
  const back = (await r.loadMode('personal')).state;
  assert.deepEqual(back.plan, s.plan);
  assert.deepEqual(back.tasks, s.tasks);
});

test('unreadable stored data is kept aside, not deleted', async () => {
  const be = memoryBackend({ [KEYS.data('personal')]: '{not json' });
  const r = repo(be);
  const res = await r.loadMode('personal');
  assert.equal(res.status, 'recovered');
  assert.equal(await r.getUnreadable('personal'), '{not json');
});

test('storage failure is reported, not thrown', async () => {
  const be = memoryBackend();
  be.set = async () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  const res = await repo(be).saveMode('personal', emptyState('personal'));
  assert.equal(res.ok, false);
  assert.match(res.error, /full/);
});

test('backup and restore', async () => {
  const r = repo();
  const s = planned();
  await r.backup('personal', s, NOW);
  const b = await r.getBackup('personal');
  assert.deepEqual(b.state.tasks, s.tasks);
});

test('imports are validated before anything is replaced', () => {
  assert.equal(parseImport('{oops').ok, false);
  assert.equal(parseImport('[]').ok, false);
  assert.equal(parseImport(JSON.stringify({ app: 'other-app' })).ok, false);
  assert.equal(parseImport(JSON.stringify({ app: 'margin-planner', schemaVersion: SCHEMA_VERSION + 1 })).ok, false);
  const s = planned();
  const ok = parseImport(exportPayload(s, NOW));
  assert.equal(ok.ok, true);
  assert.equal(ok.summary.tasks, 2);
  assert.equal(ok.state.proposal, null);
});

test('outdated schema is migrated and malformed records are dropped with warnings', () => {
  const legacy = { schemaVersion: 1, prefs: { maxDailyStudyMin: 200 }, tasks: [
    { id: 'old', title: 'Old task', effortMin: 90, doneMin: 30, deadline: '2026-11-01' },
    { id: 'bad', title: '', effortMin: 10, deadline: 'never' },
    { id: 'x', title: '<img src=x onerror=alert(1)>', estimateMin: 10, deadline: { date: '2026-11-01' } },
  ] };
  const res = parseImport(JSON.stringify(legacy));
  assert.equal(res.ok, true);
  const old = res.state.tasks.find((t) => t.id === 'old');
  assert.equal(old.estimateMin, 90);
  assert.equal(old.remainingMin, 60);
  assert.equal(res.state.preferences.maxDailyStudyMin, 200);
  assert.ok(!res.state.tasks.some((t) => t.id === 'bad'));
  assert.ok(res.warnings.some((w) => /Upgraded/.test(w)));
  assert.ok(res.warnings.some((w) => /Skipped 1 invalid tasks/.test(w)));
  assert.equal(res.state.tasks.find((t) => t.id === 'x').title, '<img src=x onerror=alert(1)>', 'kept as plain text');
});

test('normalization repairs dangling references', () => {
  const s = planned();
  s.tasks[0].dependsOn = ['ghost'];
  s.plan.blocks.push({ ...s.plan.blocks[0], id: 'orphan', taskId: 'ghost' });
  const res = normalizeState(JSON.parse(JSON.stringify(s)), 'personal');
  assert.deepEqual(res.state.tasks[0].dependsOn, []);
  assert.ok(!res.state.plan.blocks.some((b) => b.id === 'orphan'));
});

// ---------- Demo scenarios ----------

test('every demo scenario builds a consistent, feasible state', () => {
  for (const key of Object.keys(DEMO_SCENARIOS)) {
    const s = buildDemoState(key);
    assert.equal(s.mode, 'demo');
    assert.equal(s.meta.demoNow, DEMO_NOW);
    const p = makeAlternatives(s, DEMO_NOW);
    for (const alt of p.alternatives) {
      assertFeasible({ ...s, plan: { ...s.plan, blocks: s.plan.blocks.filter((b) => !alt.replacedIds.includes(b.id)) } }, alt.newBlocks, DEMO_NOW - 5 * MINUTE);
      for (const u of alt.units) assert.equal(u.placed + u.unplaced + u.deferred, u.need);
    }
    const a = analyze(s, DEMO_NOW);
    assert.ok(a.issues.some((i) => i.kind === 'transition'));
    assert.ok(a.issues.some((i) => i.kind === 'overdue'));
  }
  const crunch = makeAlternatives(buildDemoState('crunch'), DEMO_NOW);
  assert.ok(crunch.alternatives.some((x) => x.relaxed), 'crunch week offers an explicitly relaxed option');
  const mid = buildDemoState('midweek');
  assert.ok(analyze(mid, DEMO_NOW).unrecorded.length >= 1);
  for (const t of mid.tasks) assert.ok(taskRemaining(t) >= 0);
});

test('a planned session starting soon is surfaced instead of a generic break', async () => {
  const { recommendNow } = await import('../src/core/recommend.js');
  const { baseState, task, at, MON } = await import('./helpers.mjs');
  const s = baseState();
  s.tasks = [task('t', { remainingMin: 60, estimateMin: 60 })];
  s.plan.blocks = [{ id: 't@x', taskId: 't', stepId: null, start: at(MON, 9, 10), end: at(MON, 10, 10), locationId: 'lib', status: 'planned', locked: false, origin: 'generated', approvedAt: 1, actualMin: null, recordedAt: null, reasons: [] }];
  const r = recommendNow(s, at(MON, 9));
  assert.equal(r.status, 'upcoming');
  assert.equal(r.block.id, 't@x');
  assert.match(r.sub, /12 min away/);
});

test('review tasks are excluded from calibration', async () => {
  const { observations } = await import('../src/core/calibration.js');
  const { baseState, task } = await import('./helpers.mjs');
  const s = baseState();
  s.tasks = [task('r', { kind: 'review', status: 'done', completedAt: 5, estimateMin: 20, remainingMin: 0 })];
  s.log = [{ id: 'l', at: 4, date: '2026-10-26', blockId: null, taskId: 'r', stepId: null, outcome: 'completed', actualMin: 20, unitRemainingBefore: 20, unitRemainingAfter: 0, taskRemainingBefore: 20, taskRemainingAfter: 0, focus: null, difficulty: null, note: '', finished: 'task' }];
  assert.equal(observations(s).length, 0);
});
