// Interaction state and every action that changes data. Views call these functions;
// they never mutate state directly. Each change is persisted and can be undone.

import { msToDate, startOfWeek, zonedToMs, addDays, DAY } from '../core/time.js';
import { makeAlternatives, selectedAlternative, approveProposal, cancelProposal, proposalStaleness, setBlockLock, removeBlock } from '../core/proposal.js';
import { recordProgress, setTaskDone } from '../core/progress.js';
import { applySuggestion, dismissSuggestion, clearCalibration } from '../core/calibration.js';
import { addTopic, logReview, removeTopic, syncReviewTasks } from '../core/revision.js';
import { withException } from '../core/recurrence.js';
import { analyze } from '../core/analysis.js';
import { recommendNow } from '../core/recommend.js';
import { stressTest } from '../core/fragility.js';
import { fingerprint, emptyState } from '../core/model.js';
import { buildDemoState } from '../data/demoSeed.js';
import { newId } from '../core/ids.js';
import { toast } from './dialog.js';
import { plural } from './dom.js';

export const app = {
  repo: null,
  mode: 'demo',
  state: null,
  ui: { weekStart: null, selectedDate: null, sideTab: 'issues', locationId: null, session: null, taskFilter: 'open', openReason: null },
  undoStack: [],
  saveError: null,
  loadWarnings: [],
  stressCache: null,
  whatIf: null,
  saving: Promise.resolve(),
  render: () => {},
};

export function tz() { return app.state.settings.timezone; }
export function now() { return app.mode === 'demo' ? app.state.meta.demoNow : Date.now(); }
export function today() { return msToDate(now(), tz()); }

function persist() {
  const mode = app.mode;
  const snapshot = app.state;
  app.saving = app.saving.then(async () => {
    const r = await app.repo.saveMode(mode, snapshot);
    if (mode !== app.mode) return;
    const prev = app.saveError;
    app.saveError = r.ok ? null : r.error;
    if (prev !== app.saveError) app.render();
  });
  return app.saving;
}

export function commit(next, { label = 'Change', undoable = true, message = null, undoToast = false, tone = 'neutral' } = {}) {
  if (undoable) {
    app.undoStack.push({ label, state: app.state });
    if (app.undoStack.length > 30) app.undoStack.shift();
  }
  app.state = next;
  persist();
  app.render();
  if (message) toast(message, undoable && undoToast ? { actionLabel: 'Undo', onAction: undo, tone } : { tone });
}

export function update(fn, opts) {
  const draft = structuredClone(app.state);
  const r = fn(draft);
  commit(r || draft, opts);
}

export function undo() {
  const e = app.undoStack.pop();
  if (!e) return;
  app.state = e.state;
  app.stressCache = null;
  persist();
  app.render();
  toast(`Undid: ${e.label}.`);
}

export function setUi(patch) {
  Object.assign(app.ui, patch);
  app.render();
}

function resetUi() {
  const t = today();
  Object.assign(app.ui, { weekStart: startOfWeek(t), selectedDate: t, sideTab: app.state.proposal ? 'review' : 'issues', locationId: null, session: null, openReason: null });
  app.stressCache = null;
  app.whatIf = null;
}

export async function initApp(repo) {
  app.repo = repo;
  app.mode = await repo.getActiveMode();
  const r = await repo.loadMode(app.mode);
  app.state = r.state;
  app.loadWarnings = r.warnings;
  if (r.status === 'new' || r.status === 'recovered') await persist();
  resetUi();
}

export async function switchMode(mode) {
  if (mode === app.mode) return;
  await app.saving;
  const r = await app.repo.loadMode(mode);
  app.mode = mode;
  app.state = r.state;
  app.loadWarnings = r.warnings;
  app.undoStack = [];
  if (r.status === 'new' || r.status === 'recovered') persist();
  await app.repo.setActiveMode(mode);
  resetUi();
  app.render();
  toast(mode === 'demo' ? 'Demo mode. Your personal data was not touched.' : 'Personal mode. Demo data was not touched.');
}

// ---------- Derived data for one render ----------

export function derived() {
  const s = app.state;
  const n = now();
  const alt = selectedAlternative(s.proposal);
  return {
    now: n,
    today: msToDate(n, s.settings.timezone),
    analysis: analyze(s, n),
    alt,
    staleness: alt ? proposalStaleness(s, alt, n) : null,
    rec: recommendNow(s, n, { locationId: app.ui.locationId }),
  };
}

export function stress() {
  const fp = JSON.stringify(fingerprint(app.state));
  const key = `${fp}|${now()}`;
  if (!app.stressCache || app.stressCache.key !== key) app.stressCache = { key, result: stressTest(app.state, now()) };
  return app.stressCache.result;
}

// ---------- Demo clock ----------

export function setDemoNow(ms) {
  if (app.mode !== 'demo') return;
  update((s) => { s.meta.demoNow = ms; }, { label: 'Demo time change' });
  const t = today();
  if (t < app.ui.weekStart || t > addDays(app.ui.weekStart, 6)) app.ui.weekStart = startOfWeek(t);
  app.ui.selectedDate = t;
  app.render();
}

export function nextMorning() {
  const t = today();
  setDemoNow(zonedToMs(addDays(t, 1), 8 * 60, tz()));
}

export function resetDemo(scenario) {
  if (app.mode !== 'demo') return;
  commit(buildDemoState(scenario), { label: 'Demo reset', message: 'Demo reset. Personal data was not touched.', undoToast: true });
  resetUi();
  app.render();
}

// ---------- Planning ----------

export function generate(origin = 'plan', base = {}) {
  let s = app.state;
  const sync = syncReviewTasks(s, today(), s.settings.planningHorizonDays);
  s = sync.state;
  const proposal = makeAlternatives(s, now(), base, { origin });
  const next = structuredClone(s);
  next.proposal = proposal;
  app.ui.sideTab = 'review';
  commit(next, { label: 'Generate proposal' });
  if (sync.created.length) toast(`Added ${plural(sync.created.length, 'review task')} from your revision topics.`);
}

export function regenerate(extra = {}) {
  const p = app.state.proposal;
  generate(p?.origin || 'plan', { ...(p?.base || {}), ...extra });
}

export function selectAlternative(id) {
  update((s) => { s.proposal.selectedId = id; }, { undoable: false });
}

export function approveSelected() {
  const alt = selectedAlternative(app.state.proposal);
  if (!alt) return false;
  const r = approveProposal(app.state, alt, now());
  if (!r.ok) {
    toast(`Not approved: ${r.reasons.join('. ')}. Regenerate to get an up-to-date proposal.`, { tone: 'warn', timeout: 10000 });
    app.render();
    return false;
  }
  app.ui.sideTab = 'issues';
  app.stressCache = null;
  const changed = alt.diff.added.length + alt.diff.moved.length + alt.diff.removed.length;
  commit(r.state, { label: 'Approve plan', message: `Plan approved with ${plural(changed, 'change')}.`, undoToast: true });
  return true;
}

export function cancelProposalAction() {
  app.ui.sideTab = 'issues';
  commit(cancelProposal(app.state), { label: 'Cancel proposal', message: 'Proposal cancelled. Your approved plan is unchanged.' });
}

export function lockBlock(id, locked) {
  commit(setBlockLock(app.state, id, locked), { label: locked ? 'Lock session' : 'Unlock session', message: locked ? 'Session locked. Replanning will not move it.' : 'Session unlocked.' });
}

export function removeBlockAction(id) {
  commit(removeBlock(app.state, id), { label: 'Remove session', message: 'Session removed from the plan.', undoToast: true });
}

// ---------- Tasks ----------

export function saveTask(task) {
  update((s) => {
    const i = s.tasks.findIndex((t) => t.id === task.id);
    if (i >= 0) s.tasks[i] = task; else s.tasks.push({ ...task, createdAt: now() });
  }, { label: 'Save task', message: `Saved "${task.title}".` });
}

export function deleteTask(id) {
  const t = app.state.tasks.find((x) => x.id === id);
  update((s) => {
    s.tasks = s.tasks.filter((x) => x.id !== id);
    for (const x of s.tasks) x.dependsOn = x.dependsOn.filter((d) => d !== id);
    s.plan.blocks = s.plan.blocks.filter((b) => b.taskId !== id);
    s.log = s.log.filter((l) => l.taskId !== id);
    s.plan.version += 1;
  }, { label: 'Delete task', message: `Deleted "${t?.title}" and its sessions.`, undoToast: true });
}

export function setDone(id, done) {
  commit(setTaskDone(app.state, id, done, now()), { label: done ? 'Mark done' : 'Reopen task', message: done ? 'Marked done.' : 'Reopened.', undoToast: true });
}

export function recordProgressAction(input) {
  const r = recordProgress(app.state, input, now());
  if (!r.ok) return r;
  app.stressCache = null;
  commit(r.state, { label: 'Record progress', message: 'Progress recorded. Remaining effort updated.', undoToast: true });
  return r;
}

// ---------- Commitments ----------

export function saveCommitment(c) {
  update((s) => {
    const i = s.commitments.findIndex((x) => x.id === c.id);
    if (i >= 0) s.commitments[i] = c; else s.commitments.push(c);
  }, { label: 'Save commitment', message: `Saved "${c.title}".` });
}

export function deleteCommitment(id) {
  const c = app.state.commitments.find((x) => x.id === id);
  update((s) => { s.commitments = s.commitments.filter((x) => x.id !== id); }, { label: 'Delete commitment', message: `Deleted "${c?.title}".`, undoToast: true });
}

export function setOccurrence(commitmentId, date, exception, message) {
  update((s) => {
    const i = s.commitments.findIndex((x) => x.id === commitmentId);
    if (i >= 0) s.commitments[i] = withException(s.commitments[i], date, exception);
  }, { label: 'Change one occurrence', message, undoToast: true });
}

// ---------- Places, preferences, settings ----------

export function savePlaces({ locations, travel, settings }) {
  update((s) => {
    const ids = new Set(locations.map((l) => l.id));
    s.locations = locations;
    s.travel = travel.filter((t) => ids.has(t.a) && ids.has(t.b));
    Object.assign(s.settings, settings);
    if (s.settings.homeLocationId && !ids.has(s.settings.homeLocationId)) s.settings.homeLocationId = null;
    for (const c of s.commitments) {
      if (c.locationId && !ids.has(c.locationId)) c.locationId = null;
      for (const e of c.exceptions) if (e.locationId && !ids.has(e.locationId)) e.locationId = null;
    }
    for (const t of s.tasks) {
      t.location.ids = t.location.ids.filter((id) => ids.has(id));
      if (!t.location.ids.length) t.location.mode = 'any';
    }
  }, { label: 'Save places', message: 'Places and travel times saved.' });
}

export function savePreferences(prefs, settingsPatch) {
  update((s) => { s.preferences = prefs; Object.assign(s.settings, settingsPatch); }, { label: 'Save preferences', message: 'Preferences saved. Generate a new proposal to apply them.' });
}

export function checkIn(level) {
  const t = today();
  update((s) => { if (s.checkins[t] === level) delete s.checkins[t]; else s.checkins[t] = level; }, { label: 'Energy check-in', undoable: false });
}

// ---------- Learning ----------

export function applyCalibration(sug) {
  commit(applySuggestion(app.state, sug, now()), { label: 'Apply estimate suggestion', message: `Updated "${sug.title}" to ${sug.to} min remaining.`, undoToast: true });
}
export function dismissCalibration(sug) { commit(dismissSuggestion(app.state, sug), { label: 'Dismiss suggestion' }); }
export function clearCalibrationAction() { commit(clearCalibration(app.state, now()), { label: 'Clear learned history', message: 'Learned history cleared. Earlier work is no longer used for suggestions.', undoToast: true }); }
export function toggleCalibration(on) { update((s) => { s.settings.calibrationEnabled = on; }, { label: on ? 'Enable suggestions' : 'Disable suggestions' }); }

export function addTopicAction(fields) {
  commit(addTopic(app.state, { ...fields, id: newId('top') }, today()), { label: 'Add revision topic', message: `Added "${fields.title}". Its first review is scheduled from your confidence.` });
}
export function logReviewAction(topicId, confidence) {
  const t = app.state.revision.topics.find((x) => x.id === topicId);
  let s = logReview(app.state, topicId, confidence, today(), now());
  s = syncReviewTasks(s, today(), s.settings.planningHorizonDays).state;
  const next = s.revision.topics.find((x) => x.id === topicId);
  commit(s, { label: 'Log review', message: `Logged review of "${t?.title}". Next review ${next ? `in ${next.intervalDays} day${next.intervalDays === 1 ? '' : 's'}` : 'scheduled'}.`, undoToast: true });
}
export function removeTopicAction(id) { commit(removeTopic(app.state, id), { label: 'Remove topic', message: 'Topic removed with its open review task.', undoToast: true }); }

// ---------- Data ----------

export async function importIntoPersonal(state) {
  await app.saving;
  const current = app.mode === 'personal' ? app.state : (await app.repo.loadMode('personal')).state;
  const b = await app.repo.backup('personal', current, Date.now());
  if (!b.ok) { toast(`Import stopped: could not back up current personal data. ${b.error}`, { tone: 'warn', timeout: 10000 }); return false; }
  const saved = await app.repo.saveMode('personal', state);
  if (!saved.ok) { toast(`Import failed: ${saved.error}`, { tone: 'warn', timeout: 10000 }); return false; }
  if (app.mode === 'personal') {
    app.state = state;
    app.undoStack = [];
    resetUi();
    app.render();
  } else {
    await switchMode('personal');
  }
  toast('Imported. Your previous personal data was backed up and can be restored from Data.');
  return true;
}

export async function restorePersonalBackup() {
  const b = await app.repo.getBackup('personal');
  if (!b) { toast('No backup found.', { tone: 'warn' }); return; }
  await importIntoPersonal(b.state);
}

export async function deletePersonalData() {
  await app.saving;
  const r1 = await app.repo.removeMode('personal');
  const r2 = await app.repo.removeBackup('personal');
  if (!r1.ok || !r2.ok) { toast(`Could not delete everything: ${(r1.error || r2.error)}`, { tone: 'warn', timeout: 10000 }); return; }
  if (app.mode === 'personal') {
    app.state = emptyState('personal');
    app.undoStack = [];
    persist();
    resetUi();
    app.render();
  }
  toast('All personal data deleted from this browser.');
}

export function weekShift(days) {
  app.ui.weekStart = addDays(app.ui.weekStart, days);
  app.ui.selectedDate = addDays(app.ui.selectedDate || app.ui.weekStart, days);
  app.render();
}

export function goToday() {
  const t = today();
  app.ui.weekStart = startOfWeek(t);
  app.ui.selectedDate = t;
  app.render();
}

export function newCommitmentId() { return newId('c'); }
export function newTaskId() { return newId('t'); }
export const DAY_MS = DAY;

// Course imports deliberately replace DEMO only, never personal records. This
// is an atomic replacement, so retries cannot duplicate source records.
export async function applyCourseImport(state) {
  if (state.mode !== 'demo' || !state.meta.course) throw new Error('Expected a verified course demo.');
  await app.saving;
  if (app.mode !== 'demo') await switchMode('demo');
  commit(state, { label: 'Course import', message: 'Course demo loaded. Personal data was not touched. Undo restores the previous demo.', undoToast: true });
  resetUi();
  app.render();
}
