// Normalized entities, validation, and migration.
// Every record the UI or an import hands to the engine passes through these functions.

import { isDateString, zonedToMs, DEFAULT_TZ } from './time.js';
import { hashString, stableStringify } from './ids.js';

export const APP_ID = 'margin-planner';
export const SCHEMA_VERSION = 2;

export const COMMITMENT_TYPES = {
  class: 'Class', work: 'Work shift', club: 'Club', appointment: 'Appointment',
  meal: 'Meal', personal: 'Personal', protected: 'Protected time',
};
export const TASK_KINDS = {
  assignment: 'Assignment', exam: 'Exam prep', reading: 'Reading', project: 'Project', task: 'Everyday task', review: 'Review',
};
export const PRIORITIES = { high: 'High', medium: 'Medium', low: 'Low' };
export const FOCUS = { deep: 'Deep focus', normal: 'Normal', light: 'Light, fits short gaps' };
export const CONFIDENCE = { low: 'Rough guess', medium: 'Fairly sure', high: 'Confident' };
export const LOCATION_KINDS = { home: 'Home', study: 'Study space', class: 'Academic building', dining: 'Dining', other: 'Other', virtual: 'Online or virtual' };
export const EQUIPMENT = { quiet: 'Quiet space', monitor: 'External monitor', whiteboard: 'Whiteboard', printer: 'Printer', workshop: 'Workshop tools' };
export const STATUSES = { todo: 'Not started', in_progress: 'In progress', done: 'Done' };

const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
function clampInt(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function defaultPreferences() {
  const weekday = () => [{ start: 8 * 60, end: 23 * 60 }];
  const weekend = () => [{ start: 10 * 60, end: 22 * 60 }];
  return {
    availability: [weekend(), weekday(), weekday(), weekday(), weekday(), weekday(), weekend()],
    sleep: { start: 23 * 60 + 30, end: 7 * 60 + 30 },
    maxDailyStudyMin: 300,
    preferredSessionMin: 75,
    minSessionMin: 25,
    breakMin: 10,
    maxContinuousMin: 110,
    focusHours: [{ start: 9 * 60, end: 12 * 60 }],
    reserveFlexMin: 30,
    eveningCutoff: 18 * 60,
  };
}

export function defaultSettings() {
  return {
    timezone: DEFAULT_TZ,
    dateOnlyCutoff: 23 * 60 + 59,
    planningHorizonDays: 14,
    unknownTravelFallbackMin: 15,
    travelBufferMin: 5,
    homeLocationId: null,
    calibrationEnabled: true,
  };
}

export function emptyState(mode = 'personal') {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    mode,
    meta: { createdAt: null, demoNow: null, scenario: null },
    settings: defaultSettings(),
    preferences: defaultPreferences(),
    locations: [],
    travel: [],
    commitments: [],
    tasks: [],
    plan: { version: 0, approvedAt: null, strategy: null, blocks: [] },
    log: [],
    proposal: null,
    calibration: { clearedAt: null, dismissed: {} },
    revision: { topics: [] },
    checkins: {},
  };
}

// ---------- Task helpers ----------

export function taskUnits(task) {
  const steps = arr(task.steps);
  if (task.status === 'done') return [];
  if (steps.length === 0) {
    return [{ unitId: task.id, taskId: task.id, stepId: null, title: task.title, stepTitle: null, remaining: task.remainingMin, index: 0, count: 1 }];
  }
  const open = steps.filter((s) => !s.done);
  return open.map((s, i) => ({
    unitId: `${task.id}:${s.id}`, taskId: task.id, stepId: s.id, title: `${task.title}: ${s.title}`,
    stepTitle: s.title, remaining: s.remainingMin, index: i, count: open.length,
  }));
}

export function unitKey(taskId, stepId) { return stepId ? `${taskId}:${stepId}` : taskId; }

// When a task has steps, its effort is the sum of its steps. The task-level fields are not added.
export function taskRemaining(task) {
  if (task.status === 'done') return 0;
  const steps = arr(task.steps);
  if (steps.length) return steps.reduce((s, x) => s + (x.done ? 0 : x.remainingMin), 0);
  return task.remainingMin;
}

export function taskEstimate(task) {
  const steps = arr(task.steps);
  if (steps.length) return steps.reduce((s, x) => s + x.estimateMin, 0);
  return task.estimateMin;
}

export function deadlineMs(task, settings) {
  const time = task.deadline.time ?? settings.dateOnlyCutoff;
  return zonedToMs(task.deadline.date, time, settings.timezone);
}

export function findDependencyCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const color = new Map();
  const stack = [];
  let found = null;
  const visit = (id) => {
    if (found) return;
    color.set(id, 1);
    stack.push(id);
    for (const d of arr(byId.get(id)?.dependsOn)) {
      if (!byId.has(d)) continue;
      if (color.get(d) === 1) { found = stack.slice(stack.indexOf(d)); return; }
      if (!color.get(d)) visit(d);
      if (found) return;
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const t of tasks) if (!color.get(t.id)) visit(t.id);
  return found;
}

// ---------- Validation (returns { field: message }) ----------

export function validatePreferences(p) {
  const e = {};
  if (!Array.isArray(p.availability) || p.availability.length !== 7) e.availability = 'Availability needs one entry per weekday.';
  else p.availability.forEach((ws, i) => {
    for (const w of arr(ws)) {
      if (!intIn(w.start, 0, 1440) || !intIn(w.end, 0, 1440) || w.end <= w.start) e[`availability${i}`] = 'Study hours must end after they start.';
    }
  });
  if (!intIn(p.sleep?.start, 0, 1439) || !intIn(p.sleep?.end, 0, 1439) || p.sleep.start === p.sleep.end) e.sleep = 'Sleep needs a start and an end that differ.';
  if (!intIn(p.maxDailyStudyMin, 0, 960)) e.maxDailyStudyMin = 'Daily study limit must be 0 to 960 minutes.';
  if (!intIn(p.preferredSessionMin, 10, 240)) e.preferredSessionMin = 'Preferred session must be 10 to 240 minutes.';
  if (!intIn(p.minSessionMin, 5, 240)) e.minSessionMin = 'Minimum session must be 5 to 240 minutes.';
  else if (p.minSessionMin > p.preferredSessionMin) e.minSessionMin = 'Minimum session cannot be longer than the preferred session.';
  if (!intIn(p.breakMin, 0, 120)) e.breakMin = 'Break must be 0 to 120 minutes.';
  if (!intIn(p.maxContinuousMin, 15, 480)) e.maxContinuousMin = 'Continuous work limit must be 15 to 480 minutes.';
  else if (p.maxContinuousMin < p.minSessionMin) e.maxContinuousMin = 'Continuous work limit must be at least the minimum session.';
  for (const w of arr(p.focusHours)) if (!intIn(w.start, 0, 1440) || !intIn(w.end, 0, 1440) || w.end <= w.start) e.focusHours = 'Focus hours must end after they start.';
  if (!intIn(p.reserveFlexMin, 0, 600)) e.reserveFlexMin = 'Reserved flexibility must be 0 to 600 minutes.';
  if (!intIn(p.eveningCutoff, 0, 1439)) e.eveningCutoff = 'Choose when evenings start.';
  return e;
}

export function validateCommitment(c) {
  const e = {};
  if (!str(c.title)) e.title = 'Give the commitment a title.';
  if (!has(COMMITMENT_TYPES, c.type)) e.type = 'Choose a type.';
  if (!isDateString(c.startDate)) e.startDate = 'Choose a valid date.';
  if (!intIn(c.start, 0, 1439)) e.start = 'Choose a start time.';
  if (!intIn(c.end, 0, 1440)) e.end = 'Choose an end time.';
  if (intIn(c.start, 0, 1439) && intIn(c.end, 0, 1440) && c.start === c.end) e.end = 'Start and end cannot be the same time. Zero-length events are not allowed.';
  if (c.recurrence?.freq === 'weekly') {
    if (!arr(c.recurrence.days).length) e.days = 'Pick at least one weekday.';
    if (!isDateString(c.recurrence.until)) e.until = 'Choose the date the series ends.';
    else if (isDateString(c.startDate) && c.recurrence.until < c.startDate) e.until = 'The series cannot end before it starts.';
  }
  return e;
}

export function validateTask(t, allTasks = []) {
  const e = {};
  if (!str(t.title)) e.title = 'Give the task a title.';
  if (!isDateString(t.deadline?.date)) e.deadline = 'Choose a valid deadline date.';
  if (t.deadline?.time != null && !intIn(t.deadline.time, 0, 1439)) e.deadlineTime = 'Choose a valid deadline time.';
  const steps = arr(t.steps);
  if (!steps.length) {
    if (!intIn(t.estimateMin, 0, 6000)) e.estimateMin = 'Estimate must be a whole number from 0 to 6000 minutes.';
    if (!intIn(t.remainingMin, 0, 6000)) e.remainingMin = 'Remaining effort must be a whole number from 0 to 6000 minutes.';
  }
  steps.forEach((s, i) => {
    if (!str(s.title)) e[`step${i}`] = `Step ${i + 1} needs a title.`;
    else if (!intIn(s.estimateMin, 0, 6000) || !intIn(s.remainingMin, 0, 6000)) e[`step${i}`] = `Step ${i + 1} needs whole-minute estimates from 0 to 6000.`;
  });
  if (t.minSessionMin != null && !intIn(t.minSessionMin, 5, 240)) e.minSessionMin = 'Minimum useful session must be 5 to 240 minutes.';
  if (t.location?.mode && t.location.mode !== 'any' && !arr(t.location.ids).length) e.location = 'Pick at least one location, or choose Anywhere.';
  if (t.lateTarget != null && t.lateTarget !== '' && !isDateString(t.lateTarget)) e.lateTarget = 'Choose a valid date.';
  const deps = arr(t.dependsOn);
  if (deps.includes(t.id)) e.dependsOn = 'A task cannot depend on itself.';
  else if (deps.length) {
    const others = allTasks.filter((x) => x.id !== t.id);
    if (findDependencyCycle([...others, t])) e.dependsOn = 'These dependencies would form a loop.';
  }
  return e;
}

export function validateLocation(l) {
  const e = {};
  if (!str(l.name)) e.name = 'Give the place a name.';
  if (!has(LOCATION_KINDS, l.kind)) e.kind = 'Choose a kind.';
  return e;
}

// ---------- Normalization ----------

function normalizeWindows(v, fallback) {
  const out = arr(v).filter((w) => isObj(w) && intIn(w.start, 0, 1440) && intIn(w.end, 0, 1440) && w.end > w.start).map((w) => ({ start: w.start, end: w.end }));
  return out.length || Array.isArray(v) ? out : fallback;
}

export function normalizePreferences(raw, warnings = []) {
  const d = defaultPreferences();
  if (!isObj(raw)) return d;
  const p = {
    availability: Array.isArray(raw.availability) && raw.availability.length === 7 ? raw.availability.map((ws, i) => normalizeWindows(ws, d.availability[i])) : d.availability,
    sleep: isObj(raw.sleep) && intIn(raw.sleep.start, 0, 1439) && intIn(raw.sleep.end, 0, 1439) && raw.sleep.start !== raw.sleep.end ? { start: raw.sleep.start, end: raw.sleep.end } : d.sleep,
    maxDailyStudyMin: clampInt(raw.maxDailyStudyMin, 0, 960, d.maxDailyStudyMin),
    preferredSessionMin: clampInt(raw.preferredSessionMin, 10, 240, d.preferredSessionMin),
    minSessionMin: clampInt(raw.minSessionMin, 5, 240, d.minSessionMin),
    breakMin: clampInt(raw.breakMin, 0, 120, d.breakMin),
    maxContinuousMin: clampInt(raw.maxContinuousMin, 15, 480, d.maxContinuousMin),
    focusHours: normalizeWindows(raw.focusHours, d.focusHours),
    reserveFlexMin: clampInt(raw.reserveFlexMin, 0, 600, d.reserveFlexMin),
    eveningCutoff: clampInt(raw.eveningCutoff, 0, 1439, d.eveningCutoff),
  };
  if (p.minSessionMin > p.preferredSessionMin) { p.minSessionMin = p.preferredSessionMin; warnings.push('Minimum session was longer than the preferred session and was shortened.'); }
  if (p.maxContinuousMin < p.minSessionMin) p.maxContinuousMin = p.minSessionMin;
  return p;
}

function normalizeSource(v) {
  if (!isObj(v)) return { system: 'user', id: null };
  const out = { system: str(v.system, 40) || 'user', id: v.id == null ? null : String(v.id).slice(0, 120) };
  if (v.table) out.table = str(v.table, 60);
  return out;
}

export function normalizeLocation(raw) {
  if (!isObj(raw) || !str(raw.id, 80) || !str(raw.name)) return null;
  return {
    id: str(raw.id, 80),
    name: str(raw.name, 80),
    kind: has(LOCATION_KINDS, raw.kind) ? raw.kind : 'other',
    studyOk: raw.studyOk !== false && raw.kind !== 'virtual',
    equipment: arr(raw.equipment).filter((x) => has(EQUIPMENT, x)),
    source: normalizeSource(raw.source),
  };
}

export function normalizeCommitment(raw, locationIds) {
  if (!isObj(raw) || !str(raw.id, 80)) return null;
  const rec = isObj(raw.recurrence) && raw.recurrence.freq === 'weekly'
    ? { freq: 'weekly', days: [...new Set(arr(raw.recurrence.days).filter((d) => intIn(d, 0, 6)))].sort(), until: raw.recurrence.until }
    : { freq: 'none' };
  const c = {
    id: str(raw.id, 80),
    title: str(raw.title, 120),
    type: has(COMMITMENT_TYPES, raw.type) ? raw.type : 'personal',
    startDate: raw.startDate,
    start: raw.start,
    end: raw.end,
    recurrence: rec,
    locationId: raw.locationId && locationIds.has(raw.locationId) ? raw.locationId : null,
    optional: !!raw.optional,
    notes: str(raw.notes, 1000),
    exceptions: arr(raw.exceptions).filter((e) => isObj(e) && isDateString(e.date) && (e.action === 'skip' || e.action === 'modify')).map((e) => ({
      date: e.date,
      action: e.action,
      start: intIn(e.start, 0, 1439) ? e.start : undefined,
      end: intIn(e.end, 0, 1440) ? e.end : undefined,
      locationId: e.locationId === null || (e.locationId && locationIds.has(e.locationId)) ? e.locationId : undefined,
    })),
    source: normalizeSource(raw.source),
  };
  return Object.keys(validateCommitment(c)).length ? null : c;
}

export function normalizeTask(raw, locationIds) {
  if (!isObj(raw) || !str(raw.id, 80)) return null;
  const dl = isObj(raw.deadline) ? raw.deadline : {};
  const loc = isObj(raw.location) ? raw.location : {};
  const steps = arr(raw.steps).filter(isObj).map((s, i) => ({
    id: str(s.id, 80) || `s${i + 1}`,
    title: str(s.title, 120),
    estimateMin: clampInt(s.estimateMin, 0, 6000, 0),
    remainingMin: clampInt(s.remainingMin ?? s.estimateMin, 0, 6000, 0),
    done: !!s.done,
  }));
  const t = {
    id: str(raw.id, 80),
    title: str(raw.title, 120),
    category: str(raw.category, 60) || 'General',
    kind: has(TASK_KINDS, raw.kind) ? raw.kind : 'task',
    priority: has(PRIORITIES, raw.priority) ? raw.priority : 'medium',
    deadline: { date: dl.date, time: intIn(dl.time, 0, 1439) ? dl.time : null },
    estimateMin: clampInt(raw.estimateMin, 0, 6000, 0),
    remainingMin: clampInt(raw.remainingMin ?? raw.estimateMin, 0, 6000, 0),
    confidence: has(CONFIDENCE, raw.confidence) ? raw.confidence : 'medium',
    focus: has(FOCUS, raw.focus) ? raw.focus : 'normal',
    location: {
      mode: ['any', 'preferred', 'required'].includes(loc.mode) ? loc.mode : 'any',
      ids: arr(loc.ids).filter((id) => locationIds.has(id)),
    },
    equipment: arr(raw.equipment).filter((x) => has(EQUIPMENT, x)),
    status: has(STATUSES, raw.status) ? raw.status : 'todo',
    notes: str(raw.notes, 2000),
    doneWhen: str(raw.doneWhen, 300),
    splittable: raw.splittable !== false,
    minSessionMin: raw.minSessionMin == null ? null : clampInt(raw.minSessionMin, 5, 240, null),
    steps,
    dependsOn: [...new Set(arr(raw.dependsOn).filter((x) => typeof x === 'string'))],
    lateTarget: isDateString(raw.lateTarget) ? raw.lateTarget : null,
    revisionTopicId: raw.revisionTopicId ? str(raw.revisionTopicId, 80) : null,
    calibratedFrom: isObj(raw.calibratedFrom) ? raw.calibratedFrom : null,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : null,
    completedAt: Number.isFinite(raw.completedAt) ? raw.completedAt : null,
    source: normalizeSource(raw.source),
  };
  if (t.location.mode !== 'any' && !t.location.ids.length) t.location.mode = 'any';
  if (t.status === 'done') { t.remainingMin = 0; }
  return Object.keys(validateTask({ ...t, dependsOn: [] })).length ? null : t;
}

function normalizeBlock(raw, taskIds) {
  if (!isObj(raw) || !str(raw.id, 160) || !taskIds.has(raw.taskId)) return null;
  if (!Number.isFinite(raw.start) || !Number.isFinite(raw.end) || raw.end <= raw.start) return null;
  return {
    id: str(raw.id, 160), taskId: raw.taskId, stepId: raw.stepId ? String(raw.stepId) : null,
    start: raw.start, end: raw.end, locationId: raw.locationId ?? null,
    status: ['planned', 'completed', 'partial', 'interrupted', 'missed'].includes(raw.status) ? raw.status : 'planned',
    locked: !!raw.locked, origin: raw.origin === 'manual' ? 'manual' : 'generated',
    approvedAt: Number.isFinite(raw.approvedAt) ? raw.approvedAt : null,
    actualMin: Number.isFinite(raw.actualMin) ? raw.actualMin : null,
    recordedAt: Number.isFinite(raw.recordedAt) ? raw.recordedAt : null,
    reasons: arr(raw.reasons).filter((r) => isObj(r) && typeof r.text === 'string').slice(0, 20),
  };
}

function normalizeLog(raw, taskIds) {
  if (!isObj(raw) || !taskIds.has(raw.taskId) || !Number.isFinite(raw.at)) return null;
  return {
    id: str(raw.id, 120) || `log_${raw.at}`,
    at: raw.at, date: isDateString(raw.date) ? raw.date : null,
    blockId: raw.blockId ?? null, taskId: raw.taskId, stepId: raw.stepId ?? null,
    outcome: ['completed', 'partial', 'interrupted', 'missed', 'logged'].includes(raw.outcome) ? raw.outcome : 'logged',
    actualMin: clampInt(raw.actualMin, 0, 1440, 0),
    unitRemainingBefore: clampInt(raw.unitRemainingBefore, 0, 6000, 0),
    unitRemainingAfter: clampInt(raw.unitRemainingAfter, 0, 6000, 0),
    taskRemainingBefore: clampInt(raw.taskRemainingBefore, 0, 6000, 0),
    taskRemainingAfter: clampInt(raw.taskRemainingAfter, 0, 6000, 0),
    focus: intIn(raw.focus, 1, 5) ? raw.focus : null,
    difficulty: intIn(raw.difficulty, 1, 5) ? raw.difficulty : null,
    note: str(raw.note, 500),
    finished: raw.finished === 'step' || raw.finished === 'task' ? raw.finished : null,
  };
}

function normalizeTopic(raw) {
  if (!isObj(raw) || !str(raw.id, 80) || !str(raw.title)) return null;
  return {
    id: str(raw.id, 80), title: str(raw.title, 120), category: str(raw.category, 60) || 'General',
    reviewMin: clampInt(raw.reviewMin, 5, 120, 20),
    confidence: clampInt(raw.confidence, 1, 5, 3),
    intervalDays: raw.intervalDays == null ? null : clampInt(raw.intervalDays, 1, 120, 1),
    lastReviewed: isDateString(raw.lastReviewed) ? raw.lastReviewed : null,
    nextDue: isDateString(raw.nextDue) ? raw.nextDue : null,
    history: arr(raw.history).filter((h) => isObj(h) && isDateString(h.date)).map((h) => ({ date: h.date, confidence: clampInt(h.confidence, 1, 5, 3), intervalDays: clampInt(h.intervalDays, 1, 120, 1) })),
  };
}

// Migrations from older schema versions. v1 is the prototype format
// (prefs instead of preferences, effortMin/doneMin on tasks, string deadlines).
const MIGRATIONS = {
  1(d) {
    const o = { ...d };
    if (o.prefs && !o.preferences) { o.preferences = o.prefs; delete o.prefs; }
    o.tasks = arr(o.tasks).map((t) => {
      if (!isObj(t)) return t;
      const n = { ...t };
      if (n.effortMin != null && n.estimateMin == null) {
        n.estimateMin = n.effortMin;
        n.remainingMin = Math.max(0, Number(n.effortMin) - Number(n.doneMin || 0));
      }
      delete n.effortMin;
      delete n.doneMin;
      if (typeof n.deadline === 'string') n.deadline = { date: n.deadline.slice(0, 10), time: null };
      return n;
    });
    o.schemaVersion = 2;
    return o;
  },
};

export function migrate(data, fromVersion) {
  let d = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    if (!MIGRATIONS[v]) throw new Error(`No migration from schema ${v}.`);
    d = MIGRATIONS[v](d);
  }
  return d;
}

// Validates and repairs an untrusted state object. Never throws.
export function normalizeState(raw, mode) {
  const warnings = [];
  if (!isObj(raw)) return { ok: false, errors: ['This is not a planner data object.'] };
  if (raw.app && raw.app !== APP_ID) return { ok: false, errors: [`This file belongs to a different app (${String(raw.app).slice(0, 40)}).`] };
  const version = Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : 1;
  if (version > SCHEMA_VERSION) return { ok: false, errors: [`This data uses schema ${version}, which is newer than this app supports (${SCHEMA_VERSION}).`] };
  let data = raw;
  if (version < SCHEMA_VERSION) {
    try { data = migrate(raw, version); warnings.push(`Upgraded data from schema ${version} to ${SCHEMA_VERSION}.`); } catch (err) { return { ok: false, errors: [err.message] }; }
  }
  const out = emptyState(mode);
  const drop = (label, before, after) => { if (after < before) warnings.push(`Skipped ${before - after} invalid ${label}.`); };

  if (isObj(data.meta)) {
    out.meta = {
      createdAt: Number.isFinite(data.meta.createdAt) ? data.meta.createdAt : null,
      demoNow: Number.isFinite(data.meta.demoNow) ? data.meta.demoNow : null,
      scenario: typeof data.meta.scenario === 'string' ? data.meta.scenario.slice(0, 40) : null,
      course: isObj(data.meta.course) ? {
        studentId: str(data.meta.course.studentId, 120), studentName: str(data.meta.course.studentName),
        termCode: str(data.meta.course.termCode, 30), termLabel: str(data.meta.course.termLabel),
        fetchedAt: str(data.meta.course.fetchedAt, 100), asOf: str(data.meta.course.asOf, 10),
        estimateMin: clampInt(data.meta.course.estimateMin, 5, 6000, 90),
        pending: arr(data.meta.course.pending).slice(0, 200).filter(isObj).map((p) => ({
          title: str(p.title), detail: str(p.detail, 1000), location: str(p.location) || null,
          date: isDateString(p.date) ? p.date : null, table: str(p.table, 60), id: str(p.id, 120),
        })),
        warnings: arr(data.meta.course.warnings).filter((w) => typeof w === 'string').slice(0, 50).map((w) => str(w, 1000)),
      } : null,
    };
  }
  const s = isObj(data.settings) ? data.settings : {};
  const ds = defaultSettings();
  out.settings = {
    timezone: DEFAULT_TZ,
    dateOnlyCutoff: clampInt(s.dateOnlyCutoff, 0, 1439, ds.dateOnlyCutoff),
    planningHorizonDays: clampInt(s.planningHorizonDays, 3, 28, ds.planningHorizonDays),
    unknownTravelFallbackMin: clampInt(s.unknownTravelFallbackMin, 0, 120, ds.unknownTravelFallbackMin),
    travelBufferMin: clampInt(s.travelBufferMin, 0, 60, ds.travelBufferMin),
    homeLocationId: null,
    calibrationEnabled: s.calibrationEnabled !== false,
  };
  if (s.timezone && s.timezone !== DEFAULT_TZ) warnings.push(`Timezone ${String(s.timezone).slice(0, 40)} is not supported; using ${DEFAULT_TZ}.`);
  out.preferences = normalizePreferences(data.preferences, warnings);

  const rawLocs = arr(data.locations);
  const seen = new Set();
  out.locations = rawLocs.map(normalizeLocation).filter((l) => l && !seen.has(l.id) && seen.add(l.id));
  drop('places', rawLocs.length, out.locations.length);
  const locIds = new Set(out.locations.map((l) => l.id));
  if (s.homeLocationId && locIds.has(s.homeLocationId)) out.settings.homeLocationId = s.homeLocationId;

  const rawTravel = arr(data.travel);
  const pairs = new Set();
  out.travel = rawTravel.filter((t) => isObj(t) && locIds.has(t.a) && locIds.has(t.b) && t.a !== t.b && intIn(t.minutes, 0, 240)).map((t) => ({ a: t.a < t.b ? t.a : t.b, b: t.a < t.b ? t.b : t.a, minutes: t.minutes })).filter((t) => !pairs.has(`${t.a}|${t.b}`) && pairs.add(`${t.a}|${t.b}`));
  drop('travel times', rawTravel.length, out.travel.length);

  const rawCommit = arr(data.commitments);
  out.commitments = rawCommit.map((c) => normalizeCommitment(c, locIds)).filter(Boolean);
  drop('commitments', rawCommit.length, out.commitments.length);

  const rawTasks = arr(data.tasks);
  out.tasks = rawTasks.map((t) => normalizeTask(t, locIds)).filter(Boolean);
  drop('tasks', rawTasks.length, out.tasks.length);
  const taskIds = new Set(out.tasks.map((t) => t.id));
  for (const t of out.tasks) t.dependsOn = t.dependsOn.filter((id) => taskIds.has(id) && id !== t.id);
  if (findDependencyCycle(out.tasks)) warnings.push('Some task dependencies form a loop. The planner will report the affected tasks.');

  const plan = isObj(data.plan) ? data.plan : {};
  const rawBlocks = arr(plan.blocks);
  out.plan = {
    version: clampInt(plan.version, 0, 1e9, 0),
    approvedAt: Number.isFinite(plan.approvedAt) ? plan.approvedAt : null,
    strategy: typeof plan.strategy === 'string' ? plan.strategy : null,
    blocks: rawBlocks.map((b) => normalizeBlock(b, taskIds)).filter(Boolean).sort((a, b) => a.start - b.start),
  };
  drop('plan sessions', rawBlocks.length, out.plan.blocks.length);

  const rawLog = arr(data.log);
  out.log = rawLog.map((l) => normalizeLog(l, taskIds)).filter(Boolean);
  drop('progress records', rawLog.length, out.log.length);

  // Proposals are regenerated rather than trusted, except a structurally intact one from our own storage.
  out.proposal = isObj(data.proposal) && Array.isArray(data.proposal.alternatives) ? data.proposal : null;

  const cal = isObj(data.calibration) ? data.calibration : {};
  out.calibration = { clearedAt: Number.isFinite(cal.clearedAt) ? cal.clearedAt : null, dismissed: isObj(cal.dismissed) ? cal.dismissed : {} };
  const rev = isObj(data.revision) ? data.revision : {};
  out.revision = { topics: arr(rev.topics).map(normalizeTopic).filter(Boolean) };
  out.checkins = isObj(data.checkins) ? Object.fromEntries(Object.entries(data.checkins).filter(([k, v]) => isDateString(k) && ['low', 'ok', 'high'].includes(v))) : {};
  return { ok: true, state: out, warnings };
}

// Hashes of each part of the state a proposal depends on. Used to detect stale proposals.
export function fingerprint(state) {
  const h = (v) => hashString(stableStringify(v));
  return {
    tasks: h(state.tasks),
    commitments: h(state.commitments),
    preferences: h(state.preferences),
    places: h([state.locations, state.travel]),
    settings: h(state.settings),
    plan: `${state.plan.version}:${h(state.plan.blocks.map((b) => [b.id, b.start, b.end, b.locked, b.status]))}`,
    progress: String(state.log.length),
  };
}

export const FINGERPRINT_LABELS = {
  tasks: 'Tasks changed', commitments: 'Commitments changed', preferences: 'Preferences changed',
  places: 'Places or travel times changed', settings: 'Settings changed', plan: 'The approved plan changed', progress: 'New progress was recorded',
};
