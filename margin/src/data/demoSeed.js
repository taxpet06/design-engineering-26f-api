// Builds demo-mode state. Course, job, club, and event records come through the mock
// adapter; meals and personal routines are entered here the way a student would.
// The demo clock is fixed and labeled; it never reads the real time.

import { emptyState } from '../core/model.js';
import { zonedToMs, DEFAULT_TZ } from '../core/time.js';
import { createMockAdapter, loadFromAdapter } from './adapter.js';
import { makeProposal, approveProposal } from '../core/proposal.js';
import { recordProgress } from '../core/progress.js';
import { syncReviewTasks, logReview } from '../core/revision.js';

export const DEMO_NOW = zonedToMs('2026-10-27', 13 * 60, DEFAULT_TZ);
const SEED_PLAN_AT = zonedToMs('2026-10-25', 16 * 60, DEFAULT_TZ);

export const DEMO_SCENARIOS = {
  midweek: { label: 'Midweek, plan drifting', description: 'A plan approved on Sunday, some sessions done, one missed, one not yet recorded.' },
  crunch: { label: 'Crunch week', description: 'New work arrived and the daily limit is lower. Not everything fits.' },
  fresh: { label: 'Fresh week, no plan', description: 'Tasks and commitments entered, nothing planned yet.' },
};

function personalCommitments() {
  const term = { start: '2026-09-14', end: '2026-11-24' };
  const weekly = (id, title, type, days, start, end, locationId, extra = {}) => ({
    id, title, type, startDate: term.start, start, end, recurrence: { freq: 'weekly', days, until: term.end },
    locationId, optional: false, notes: '', exceptions: [], source: { system: 'demo', id }, ...extra,
  });
  return [
    weekly('c_lunch_mwf', 'Lunch', 'meal', [1, 3, 5], 12 * 60 + 50, 13 * 60 + 30, 'loc_foco'),
    weekly('c_lunch_tth', 'Lunch', 'meal', [2, 4], 12 * 60 + 15, 12 * 60 + 55, 'loc_foco'),
    weekly('c_dinner', 'Dinner', 'meal', [0, 1, 2, 3, 4, 5, 6], 18 * 60 + 20, 18 * 60 + 55, 'loc_foco'),
    weekly('c_brunch', 'Brunch', 'meal', [6], 11 * 60, 11 * 60 + 45, 'loc_foco'),
    weekly('c_call_home', 'Call home', 'personal', [0], 12 * 60, 12 * 60 + 45, 'loc_online'),
    weekly('c_wind_down', 'Wind down, no screens', 'protected', [0, 1, 2, 3, 4], 22 * 60 + 45, 23 * 60 + 30, null),
  ];
}

function baseState(scenario) {
  const state = emptyState('demo');
  const data = loadFromAdapter(createMockAdapter());
  state.meta = { createdAt: SEED_PLAN_AT, demoNow: DEMO_NOW, scenario };
  state.locations = data.locations;
  state.travel = data.travel;
  state.commitments = [...data.commitments, ...personalCommitments()];
  state.tasks = [
    ...data.tasks,
    {
      id: 't_laundry', title: 'Laundry', category: 'Personal', kind: 'task', priority: 'low', deadline: { date: '2026-11-01', time: null },
      estimateMin: 45, remainingMin: 45, confidence: 'high', focus: 'light', location: { mode: 'required', ids: ['loc_dorm'] }, equipment: [],
      status: 'todo', notes: '', doneWhen: 'Washed, dried, put away.', splittable: false, minSessionMin: null, steps: [], dependsOn: [],
      lateTarget: null, revisionTopicId: null, calibratedFrom: null, createdAt: null, completedAt: null, source: { system: 'demo', id: 'laundry' },
    },
    {
      id: 't_essay', title: 'Scholarship essay draft', category: 'Personal', kind: 'assignment', priority: 'medium', deadline: { date: '2026-11-07', time: null },
      estimateMin: 180, remainingMin: 180, confidence: 'low', focus: 'deep', location: { mode: 'any', ids: [] }, equipment: [],
      status: 'todo', notes: 'Synthetic example of personal work.', doneWhen: 'A complete first draft, even if rough.', splittable: true, minSessionMin: 45, steps: [], dependsOn: [],
      lateTarget: null, revisionTopicId: null, calibratedFrom: null, createdAt: null, completedAt: null, source: { system: 'demo', id: 'essay' },
    },
  ];
  state.log = data.log;
  state.revision = { topics: data.topics };
  state.settings.homeLocationId = 'loc_dorm';
  return state;
}

function overdueTask() {
  return {
    id: 't_cosc_notes', title: 'COSC 10 lecture notes review, week 6', category: 'COSC 10', kind: 'reading', priority: 'low',
    deadline: { date: '2026-10-26', time: 23 * 60 + 59 }, estimateMin: 40, remainingMin: 40, confidence: 'high', focus: 'light',
    location: { mode: 'any', ids: [] }, equipment: [], status: 'todo', notes: 'Added late to show how overdue work is reported.', doneWhen: '',
    splittable: true, minSessionMin: 20, steps: [], dependsOn: [], lateTarget: null, revisionTopicId: null, calibratedFrom: null,
    createdAt: null, completedAt: null, source: { system: 'demo', id: 'notes' },
  };
}

function recordSeedOutcomes(state) {
  const past = state.plan.blocks.filter((b) => b.end <= DEMO_NOW).sort((a, b) => a.start - b.start);
  const cycle = ['completed', 'partial', 'completed', 'missed'];
  let s = state;
  past.forEach((b, i) => {
    if (i === past.length - 1) return; // leave the latest session unrecorded
    const task = s.tasks.find((t) => t.id === b.taskId);
    const outcome = task.kind === 'review' && cycle[i % cycle.length] === 'partial' ? 'completed' : cycle[i % cycle.length];
    const step = b.stepId ? task.steps.find((x) => x.id === b.stepId) : null;
    const remaining = step ? step.remainingMin : task.remainingMin;
    const dur = Math.round((b.end - b.start) / 60000);
    const credited = outcome === 'completed' ? dur : outcome === 'partial' ? Math.round(dur * 0.5) : 0;
    const res = recordProgress(s, {
      id: `log_seed_${i}`, blockId: b.id, taskId: b.taskId, stepId: b.stepId, outcome,
      actualMin: outcome === 'missed' ? 0 : dur, remainingAfter: Math.max(0, remaining - credited),
      finish: task.kind === 'review' && outcome === 'completed' ? 'task' : step && remaining - credited <= 0 ? 'step' : null,
    }, b.end + 10 * 60000);
    if (res.ok) s = res.state;
    if (res.ok && task.kind === 'review' && outcome === 'completed') s = logReview(s, task.revisionTopicId, 3, '2026-10-25', b.end + 10 * 60000);
  });
  return s;
}

export function buildDemoState(scenario = 'midweek') {
  const key = DEMO_SCENARIOS[scenario] ? scenario : 'midweek';
  let state = baseState(key);
  if (key === 'crunch') state.preferences.maxDailyStudyMin = 180;
  state = syncReviewTasks(state, '2026-10-25', state.settings.planningHorizonDays).state;
  if (key !== 'fresh') {
    const alt = makeProposal(state, SEED_PLAN_AT, { strategy: 'balanced' });
    const res = approveProposal(state, alt, SEED_PLAN_AT);
    state = recordSeedOutcomes(res.state);
  }
  state.tasks.push(overdueTask());
  if (key === 'crunch') {
    const extra = (id, title, category, date, time, est, focus) => ({
      id, title, category, kind: 'assignment', priority: 'high', deadline: { date, time }, estimateMin: est, remainingMin: est, confidence: 'medium',
      focus, location: { mode: 'any', ids: [] }, equipment: [], status: 'todo', notes: 'Crunch-week addition.', doneWhen: '', splittable: true,
      minSessionMin: 45, steps: [], dependsOn: [], lateTarget: null, revisionTopicId: null, calibratedFrom: null, createdAt: null, completedAt: null,
      source: { system: 'demo', id },
    });
    state.tasks.push(
      extra('t_cosc_lab', 'COSC 10 lab report', 'COSC 10', '2026-10-29', 23 * 60 + 59, 180, 'deep'),
      extra('t_math_midterm', 'MATH 13 midterm prep', 'MATH 13', '2026-11-02', 9 * 60, 420, 'deep'),
      extra('t_engs_memo', 'ENGS 12 reflection memo', 'ENGS 12', '2026-10-28', 23 * 60 + 59, 60, 'normal'),
    );
  }
  state.meta.demoNow = DEMO_NOW;
  return state;
}
