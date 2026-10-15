// Verified against the Design Engineering course API. All imported people and
// records are synthetic. Never send the Dartmouth Chat credential to this API.
import { COURSE_SNAPSHOT } from './courseSnapshot.js';
import { emptyState, normalizeState } from '../core/model.js';
import { isDateString, parseClockInput, zonedToMs, DEFAULT_TZ } from '../core/time.js';

export const COURSE_BASE_URL = 'https://api-backend-zeta-five.vercel.app';
export const COURSE_ENDPOINTS = ['students', 'terms', 'courses', 'sections', 'enrollments', 'assignments', 'submissions', 'clubs', 'club-memberships', 'study-groups', 'study-group-members', 'campus-jobs', 'job-assignments', 'events', 'event-rsvps', 'workshops', 'workshop-registrations'];
export const COURSE_SNAPSHOT_DATE = COURSE_SNAPSHOT.fetchedAt;
export function bundledCourseData() { return structuredClone(COURSE_SNAPSHOT); }

// No silent fallback: the UI offers the bundled snapshot separately after failure.
export async function fetchCourseData(fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const records = {};
    // Limit concurrent requests and reject incomplete datasets atomically.
    for (let i = 0; i < COURSE_ENDPOINTS.length; i += 6) {
      await Promise.all(COURSE_ENDPOINTS.slice(i, i + 6).map(async (name) => {
        const response = await fetcher(`${COURSE_BASE_URL}/${name}`, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error(`${name}: expected an array. The API schema may have changed.`);
        records[name] = rows;
      }));
    }
    return { baseUrl: COURSE_BASE_URL, fetchedAt: new Date().toISOString(), records };
  } finally { clearTimeout(timer); controller.abort(); }
}

const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const source = (table, id) => ({ system: 'course-api', table, id: String(id) });
const same = (a, b) => String(a) === String(b);
const locId = (name) => `api_loc_${encodeURIComponent(name).replace(/%/g, '_')}`;
function slot(value) {
  const parts = typeof value === 'string' ? value.split('-') : [];
  if (parts.length !== 2) return null;
  const start = parseClockInput(parts[0]);
  const end = parseClockInput(parts[1]);
  return start != null && end != null && end > start ? { start, end } : null;
}
export function enrollmentCount(data, studentId, termCode) {
  const ids = new Set(data.records.sections.filter((s) => s.term === termCode).map((s) => String(s.id)));
  return data.records.enrollments.filter((e) => same(e.student_id, studentId) && e.status === 'enrolled' && ids.has(String(e.section_id))).length;
}

export function buildCourseImport(data, { studentId, termCode = '26F', asOf = '2026-09-27', estimateMin = 90, markSubmitted = false } = {}) {
  for (const name of COURSE_ENDPOINTS) if (!Array.isArray(data?.records?.[name])) throw new Error(`Missing course resource: ${name}`);
  if (!isDateString(asOf)) throw new Error('Choose a valid demo date.');
  if (!Number.isInteger(estimateMin) || estimateMin < 5 || estimateMin > 6000) throw new Error('Default effort must be 5 to 6000 whole minutes.');
  const r = data.records;
  const student = r.students.find((x) => same(x.id, studentId));
  const term = r.terms.find((x) => x.code === termCode);
  if (!student || !term || !isDateString(term.start_date) || !isDateString(term.end_date)) throw new Error('Select a valid student and academic term.');
  if (asOf < term.start_date || asOf > term.end_date) throw new Error('Demo date must be inside the selected term.');
  const state = emptyState('demo');
  const pending = [];
  const warnings = [];
  const addPending = (title, detail, location = null, date = null, table = null, id = null) => pending.push({ title, detail, location, date, table, id: id == null ? null : String(id) });
  state.meta = { createdAt: Date.now(), demoNow: zonedToMs(asOf, 8 * 60, DEFAULT_TZ), scenario: 'course-api' };
  const locations = new Map();
  function location(name) {
    if (!name || typeof name !== 'string') return null;
    if (!locations.has(name)) locations.set(name, { id: locId(name), name, kind: 'class', studyOk: false, equipment: [], source: source('locations-derived', name) });
    return locations.get(name).id;
  }
  // Provide one clearly labeled user-editable study-space assumption, not a route measurement.
  state.locations.push({ id: 'api_study', name: 'My study space (choose a real place)', kind: 'study', studyOk: true, equipment: [], source: { system: 'user', id: 'study-space' } });
  const enrolled = r.enrollments.filter((e) => same(e.student_id, studentId) && e.status === 'enrolled');
  const sectionIds = new Set(enrolled.map((e) => String(e.section_id)));
  const sections = r.sections.filter((s) => sectionIds.has(String(s.id)) && s.term === termCode);
  const selectedIds = new Set(sections.map((s) => String(s.id)));
  for (const s of sections) {
    const c = r.courses.find((x) => same(x.id, s.course_id));
    const title = `${c?.code || 'Course'}: ${c?.title || `Section ${s.id}`}`;
    const time = slot(s.time);
    const days = [...new Set((s.days || []).map((d) => DAYS[d]).filter((d) => d != null))].sort();
    if (!time || !days.length) { addPending(title, 'Class meeting time or weekday is missing or invalid.', s.room, null, 'sections', s.id); continue; }
    state.commitments.push({ id: `api_section_${s.id}`, title, type: 'class', startDate: term.start_date, ...time, recurrence: { freq: 'weekly', days, until: term.end_date }, locationId: location(s.room), optional: false, exceptions: [], notes: `Synthetic course API. ${term.label}, section ${s.section_number}. Room-level locations are retained; enter walking estimates in Setup > Places and travel.`, source: source('sections', s.id) });
  }
  const waitlisted = r.enrollments.filter((e) => same(e.student_id, studentId) && e.status === 'waitlisted' && r.sections.some((s) => same(s.id, e.section_id) && s.term === termCode));
  if (waitlisted.length) warnings.push(`${waitlisted.length} waitlisted section(s) excluded from fixed classes.`);
  for (const a of r.assignments.filter((a) => selectedIds.has(String(a.section_id)))) {
    const s = sections.find((s) => same(s.id, a.section_id));
    const c = r.courses.find((c) => same(c.id, s.course_id));
    if (!isDateString(a.due_date)) { addPending(a.title, 'Deadline is missing or invalid.', null, null, 'assignments', a.id); continue; }
    const submission = r.submissions.find((x) => same(x.student_id, studentId) && same(x.assignment_id, a.id) && isDateString(x.submitted_at) && x.submitted_at <= asOf);
    const done = !!(markSubmitted && submission);
    const notes = [`Synthetic course API. ${a.points_possible} possible points; points do not set priority.`, `Effort: user-selected import default of ${estimateMin} minutes, not provided by the API. Edit for this assignment.`, 'Deadline has no time; your configurable date-only cutoff applies.', submission ? `Submission recorded ${submission.submitted_at}, score ${submission.score}. ${done ? 'Marked done by your import choice; no study time or mastery inferred.' : 'Left open for your review.'}` : 'No submission recorded by the selected demo date.'].join('\n');
    state.tasks.push({ id: `api_assignment_${a.id}`, title: a.title, category: c?.code || 'Course', kind: a.type === 'exam' ? 'exam' : a.type === 'project' ? 'project' : 'assignment', priority: 'medium', deadline: { date: a.due_date, time: null }, estimateMin, remainingMin: done ? 0 : estimateMin, confidence: 'low', focus: 'normal', location: { mode: 'any', ids: [] }, equipment: [], status: done ? 'done' : 'todo', notes, doneWhen: '', splittable: true, minSessionMin: null, steps: [], dependsOn: [], lateTarget: null, revisionTopicId: null, calibratedFrom: null, createdAt: state.meta.demoNow, completedAt: done ? zonedToMs(submission.submitted_at, 0, DEFAULT_TZ) : null, source: source('assignments', a.id) });
  }
  const memberships = r['club-memberships'].filter((m) => same(m.student_id, studentId));
  for (const m of memberships) {
    const c = r.clubs.find((c) => same(c.id, m.club_id));
    if (!c) continue;
    const time = slot(c.meeting_time);
    const day = DAYS[c.meeting_day];
    // Historical memberships after the chosen as-of date are not presumed active.
    if (isDateString(m.joined_at) && m.joined_at > asOf) continue;
    if (!time || day == null) { addPending(c.name, 'Missing meeting day or time.', null, null, 'clubs', c.id); continue; }
    state.commitments.push({ id: `api_club_${c.id}`, title: c.name, type: 'club', startDate: term.start_date, ...time, recurrence: { freq: 'weekly', days: [day], until: term.end_date }, locationId: null, optional: true, exceptions: [], notes: 'Synthetic club membership. Location unknown; travel uses your fallback estimate. Membership term boundaries are not supplied; this import uses the selected term.', source: source('clubs', c.id) });
  }
  for (const j of r['job-assignments'].filter((x) => same(x.student_id, studentId) && x.term === termCode)) {
    const job = r['campus-jobs'].find((x) => same(x.id, j.campus_job_id));
    addPending(job?.title || 'Campus job', `${j.hours_per_week} hours/week. Exact shift days, times, and location are not supplied. Add real shifts before relying on free-time estimates.`, null, null, 'job-assignments', j.id);
  }
  for (const m of r['study-group-members'].filter((x) => same(x.student_id, studentId))) {
    const g = r['study-groups'].find((g) => same(g.id, m.study_group_id) && selectedIds.has(String(g.section_id)));
    if (g) addPending(g.name, `Meeting slot ${g.meeting_time}; weekday is not supplied.`, g.meeting_location, null, 'study-groups', g.id);
  }
  for (const m of r['event-rsvps'].filter((x) => same(x.student_id, studentId) && ['going', 'maybe'].includes(x.status))) {
    const e = r.events.find((e) => same(e.id, m.event_id));
    if (e && e.date >= term.start_date && e.date <= term.end_date) addPending(e.title, `RSVP: ${m.status}. Start time and duration are missing.`, e.location, e.date, 'events', e.id);
  }
  for (const m of r['workshop-registrations'].filter((x) => same(x.student_id, studentId) && x.status === 'registered')) {
    const w = r.workshops.find((w) => same(w.id, m.workshop_id));
    if (w && w.date >= term.start_date && w.date <= term.end_date) addPending(w.title, 'Registered workshop; start time and duration are missing.', w.location, w.date, 'workshops', w.id);
  }
  state.locations.push(...locations.values());
  warnings.push('All records describe fictional students. This is not your Dartmouth schedule.', 'Walking routes and durations are not provided. The planner uses labeled fallback estimates until you enter routes.', 'Assignment effort is a user-selected estimate. Deadline times use your date-only cutoff.', 'Unscheduled commitments below are NOT included in capacity calculations until you add their missing times.');
  if (!sections.length) warnings.push('No enrolled classes in this term for this student. Choose another student or term.');
  state.meta.course = { studentId: String(student.id), studentName: `${student.first_name} ${student.last_name}`, termCode, termLabel: term.label, fetchedAt: data.fetchedAt, asOf, estimateMin, pending, warnings };
  const result = normalizeState(state, 'demo');
  if (!result.ok) throw new Error(result.errors.join(' '));
  return { state: result.state, student, term, warnings: [...warnings, ...result.warnings], pending };
}
