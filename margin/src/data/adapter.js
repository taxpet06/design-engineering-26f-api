// Data-access layer. The rest of the app only sees normalized entities, so swapping
// the mock adapter for a real API adapter means implementing the same methods and
// the same normalize* mappings. Source ids and provenance are preserved on every record.

import { MOCK_RECORDS } from './mockRecords.js';
import { fetchCourseData, buildCourseImport } from './courseApi.js';
import { parseClockInput, zonedToMs, DEFAULT_TZ } from '../core/time.js';

const DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// Interface every adapter implements. All methods resolve to arrays of source records.
export const ADAPTER_METHODS = ['listLocations', 'listRoutes', 'listSections', 'listJobs', 'listClubs', 'listEvents', 'listAssignments', 'listCompletedWork', 'listRevisionTopics'];

export function createMockAdapter(records = MOCK_RECORDS) {
  const copy = (x) => structuredClone(x || []);
  return {
    kind: 'mock',
    description: 'Synthetic records bundled with the app. Makes no network requests.',
    term: records.term,
    listLocations: () => copy(records.locations),
    listRoutes: () => copy(records.routes),
    listSections: () => copy(records.sections),
    listJobs: () => copy(records.jobs),
    listClubs: () => copy(records.clubs),
    listEvents: () => copy(records.events),
    listAssignments: () => copy(records.assignments),
    listCompletedWork: () => copy(records.completed),
    listRevisionTopics: () => copy(records.revision_topics),
  };
}

// The course API uses different shapes from mock records. Normalize through the
// verified mapper rather than feeding it into the invented mock schema.
export function createApiAdapter() {
  return { kind: 'course-api', fetch: fetchCourseData, normalize: buildCourseImport };
}

const src = (table, id) => ({ system: 'mock', table, id });
const clock = (s) => parseClockInput(s);

function weekly(id, title, type, meet, locationId, term, extra = {}) {
  return {
    id, title, type, startDate: term.start, start: clock(meet.start), end: clock(meet.end),
    recurrence: { freq: 'weekly', days: meet.days.map((d) => DAY_CODES[d]).sort(), until: term.end },
    locationId: locationId || null, optional: false, notes: '', exceptions: [], ...extra,
  };
}

export function normalizeLocationRecord(r) {
  return { id: r.id, name: r.name, kind: r.kind, studyOk: !!r.study_ok, equipment: r.equipment || [], source: src('locations', r.id) };
}

export function normalizeRoute(r) {
  return { a: r.from < r.to ? r.from : r.to, b: r.from < r.to ? r.to : r.from, minutes: r.minutes };
}

export function normalizeSection(r, term) {
  return r.meets.map((m, i) => weekly(`c_${r.id}_${i}`, r.title, 'class', m, r.location_id, term, {
    notes: `${r.course}`,
    exceptions: (r.canceled_dates || []).map((date) => ({ date, action: 'skip' })),
    source: src('sections', r.id),
  }));
}

export function normalizeJob(r, term) {
  return r.shifts.map((m, i) => weekly(`c_${r.id}_${i}`, r.title, 'work', m, r.location_id, term, { source: src('jobs', r.id) }));
}

export function normalizeClub(r, term) {
  return r.meets.map((m, i) => weekly(`c_${r.id}_${i}`, r.title, 'club', m, r.location_id, term, {
    optional: !!r.optional,
    exceptions: (r.changes || []).map((c) => ({ date: c.date, action: 'modify', start: clock(c.start), end: clock(c.end) })),
    source: src('clubs', r.id),
  }));
}

export function normalizeEvent(r) {
  return {
    id: `c_${r.id}`, title: r.title, type: r.kind === 'appointment' ? 'appointment' : 'personal', startDate: r.date,
    start: clock(r.start), end: clock(r.end), recurrence: { freq: 'none' }, locationId: r.location_id || null,
    optional: false, notes: r.kind === 'workshop' ? 'Workshop or event' : '', exceptions: [], source: src('events', r.id),
  };
}

function parseDue(due) {
  if (due.length === 10) return { date: due, time: null };
  return { date: due.slice(0, 10), time: clock(due.slice(11, 16)) };
}

export function normalizeAssignment(r) {
  const steps = (r.steps || []).map(([title, min, done], i) => ({ id: `s${i + 1}`, title, estimateMin: min, remainingMin: done ? 0 : min, done: !!done }));
  const est = steps.length ? steps.reduce((s, x) => s + x.estimateMin, 0) : r.estimate_min;
  return {
    id: `t_${r.id}`, title: r.title, category: r.course, kind: r.type, priority: r.priority || 'medium',
    deadline: parseDue(r.due), estimateMin: est, remainingMin: steps.length ? 0 : r.estimate_min,
    confidence: r.confidence || 'medium', focus: r.focus || 'normal',
    location: r.required_locations ? { mode: 'required', ids: r.required_locations } : r.preferred_locations ? { mode: 'preferred', ids: r.preferred_locations } : { mode: 'any', ids: [] },
    equipment: r.equipment || [], status: 'todo', notes: '', doneWhen: r.done_when || '',
    splittable: r.splittable !== false, minSessionMin: r.min_session_min ?? null, steps,
    dependsOn: (r.depends_on || []).map((id) => `t_${id}`), lateTarget: null, revisionTopicId: null,
    calibratedFrom: null, createdAt: null, completedAt: null, source: src('assignments', r.id),
  };
}

export function normalizeCompleted(r, tz = DEFAULT_TZ) {
  const task = normalizeAssignment(r);
  task.status = 'done';
  task.remainingMin = 0;
  const lastDate = r.sessions[r.sessions.length - 1][0];
  task.completedAt = zonedToMs(lastDate, 21 * 60, tz);
  let left = r.estimate_min;
  const log = r.sessions.map(([date, minutes, outcome], i) => {
    const before = left;
    const last = i === r.sessions.length - 1;
    left = last ? 0 : Math.max(0, left - minutes);
    return {
      id: `log_${r.id}_${i}`, at: zonedToMs(date, 20 * 60, tz), date, blockId: null, taskId: task.id, stepId: null,
      outcome: outcome || 'completed', actualMin: minutes, unitRemainingBefore: before, unitRemainingAfter: left,
      taskRemainingBefore: before, taskRemainingAfter: left, focus: null, difficulty: null, note: '', finished: last ? 'task' : null,
    };
  });
  return { task, log };
}

export function normalizeTopic(r) {
  return {
    id: r.id, title: r.title, category: r.course, reviewMin: r.review_min, confidence: r.confidence, intervalDays: r.interval_days,
    lastReviewed: r.last_reviewed, nextDue: r.next_due, history: [{ date: r.last_reviewed, confidence: r.confidence, intervalDays: r.interval_days }],
  };
}

export function loadFromAdapter(adapter) {
  const term = adapter.term;
  const completed = adapter.listCompletedWork().map((r) => normalizeCompleted(r));
  return {
    locations: adapter.listLocations().map(normalizeLocationRecord),
    travel: adapter.listRoutes().map(normalizeRoute),
    commitments: [
      ...adapter.listSections().flatMap((r) => normalizeSection(r, term)),
      ...adapter.listJobs().flatMap((r) => normalizeJob(r, term)),
      ...adapter.listClubs().flatMap((r) => normalizeClub(r, term)),
      ...adapter.listEvents().map(normalizeEvent),
    ],
    tasks: [...completed.map((c) => c.task), ...adapter.listAssignments().map(normalizeAssignment)],
    log: completed.flatMap((c) => c.log),
    topics: adapter.listRevisionTopics().map(normalizeTopic),
  };
}
