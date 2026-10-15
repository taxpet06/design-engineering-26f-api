// Multi-step flows: the session launch brief, recovery after a disrupted day,
// data management, help, and the what-if workspace logic.

import { h, icon, plural, download, reasonList } from './dom.js';
import { openDialog, confirmDialog, toast } from './dialog.js';
import { app, now, today, tz, commit, generate, resetDemo, importIntoPersonal, restorePersonalBackup, deletePersonalData, recordProgressAction, setUi } from './app.js';
import { openProgressForm, saveDoneWhen, openPlaces, openPreferences, openCommitmentForm, openTaskForm } from './forms.js';
import { fallbackFor } from '../core/recommend.js';
import { makeProposal } from '../core/proposal.js';
import { buildContext, freeIntervals } from '../core/scheduler.js';
import { exportPayload, parseImport, summarize } from '../core/storage.js';
import { DEMO_SCENARIOS } from '../data/demoSeed.js';
import { EQUIPMENT, taskRemaining, taskUnits } from '../core/model.js';
import { fmtDate, fmtDuration, fmtTime, fmtTimeRange, fmtDateTime, MINUTE, msToDate } from '../core/time.js';
import { locationName } from '../core/travel.js';
import { expandCommitments } from '../core/recurrence.js';
import { blockTitle, deadlineInfo } from './common.js';

// ---------- Session launch brief ----------

export function openLaunchBrief({ taskId, stepId = null, minutes, locationId = null, blockId = null, endsAt = null }) {
  const state = app.state;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const units = taskUnits(task);
  const unit = units.find((u) => u.stepId === stepId) || units[0];
  const step = unit?.stepId ? task.steps.find((s) => s.id === unit.stepId) : null;
  const nextUnit = units[units.indexOf(unit) + 1] || null;
  const n = now();
  const end = endsAt || n + minutes * MINUTE;
  const dl = deadlineInfo(task, state.settings, n);
  const doneInput = h('input', { type: 'text', maxlength: 300, value: task.doneWhen, 'aria-label': 'Definition of done', placeholder: 'For example: all tests pass and the write-up is drafted' });
  const fallbackOut = h('div', { class: 'fallback-out', 'aria-live': 'polite' });
  const fallbackMin = h('input', { type: 'number', min: 5, max: 240, value: Math.max(5, Math.min(30, minutes)), 'aria-label': 'Minutes you actually have' });

  function findFallback() {
    const m = Math.round(Number(fallbackMin.value));
    if (!Number.isFinite(m) || m < 5) { fallbackOut.replaceChildren(h('p', { class: 'field-error' }, 'Enter at least 5 minutes.')); return; }
    const r = fallbackFor(app.state, now(), m, { locationId });
    const same = r.options.find((o) => o.taskId === task.id && o.fits);
    const pick = same || r.pick;
    if (!pick) { fallbackOut.replaceChildren(h('p', null, `Nothing useful fits in ${fmtDuration(m)}. Take the break, and keep the plan as it is.`)); return; }
    fallbackOut.replaceChildren(
      h('p', null, h('strong', null, pick.title), ` for ${fmtDuration(pick.minutes)}${pick.taskId === task.id ? ', a smaller piece of the same task' : ''}.`),
      h('ul', { class: 'bullets' }, pick.reasons.slice(0, 3).map((x) => h('li', null, x))),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { api.close(); openLaunchBrief({ taskId: pick.taskId, stepId: pick.stepId, minutes: pick.minutes, locationId: pick.locationId }); } }, 'Switch to this'));
  }

  const body = h('div', { class: 'brief' },
    h('p', { class: 'brief-objective' }, step ? step.title : task.title),
    step ? h('p', { class: 'muted' }, `Part of ${task.title}`) : null,
    h('dl', { class: 'facts' },
      h('dt', null, 'Time'), h('dd', null, `${fmtDuration(minutes)}, until ${fmtTime(end, tz())}`),
      h('dt', null, 'Place'), h('dd', null, locationName(state, locationId)),
      task.equipment.length ? [h('dt', null, 'Bring or use'), h('dd', null, task.equipment.map((e) => EQUIPMENT[e]).join(', '))] : null,
      h('dt', null, 'Left on this'), h('dd', null, `${fmtDuration(unit ? unit.remaining : taskRemaining(task))}${step ? ' for this step' : ''}`),
      h('dt', null, 'Deadline'), h('dd', null, `${dl.text} (${dl.rel})`),
      nextUnit ? [h('dt', null, 'After this'), h('dd', null, nextUnit.stepTitle)] : null),
    task.steps.length ? h('ol', { class: 'step-check' }, task.steps.map((s) => h('li', { class: s.done ? 'is-done' : s.id === step?.id ? 'is-current' : '' }, s.done ? icon('check', { size: 12, label: 'Done' }) : null, ` ${s.title}`))) : null,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Done when'), h('div', { class: 'row gap' }, doneInput, h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => saveDoneWhen(task.id, doneInput.value.trim()) }, 'Save')),
      task.doneWhen ? null : h('p', { class: 'field-hint' }, 'Not set yet. A concrete finish line makes it easier to stop and to resume.')),
    h('details', { class: 'fallback' }, h('summary', null, 'Less time than planned?'),
      h('div', { class: 'row gap' }, fallbackMin, h('span', null, 'minutes'), h('button', { type: 'button', class: 'btn btn-sm', onclick: findFallback }, 'Find what fits')),
      fallbackOut));
  const api = openDialog({
    title: 'Session brief', size: 'md', content: body,
    actions: [
      { label: 'Close', quiet: true, onClick: () => api.close() },
      { label: 'Start session', primary: true, onClick: () => {
        setUi({ session: { taskId: task.id, stepId: unit?.stepId || null, blockId, startedAt: now(), plannedMin: minutes, locationId } });
        api.close();
        toast(`Started ${step ? step.title : task.title}. Record progress when you stop.`);
      } },
    ],
  });
}

export function endSession(outcome = 'completed') {
  const s = app.ui.session;
  if (!s) return;
  const elapsed = Math.round((now() - s.startedAt) / MINUTE);
  const actual = Math.max(0, Math.min(720, elapsed)); // Ask for actual time; never substitute planned minutes.
  openProgressForm({ blockId: s.blockId && app.state.plan.blocks.some((b) => b.id === s.blockId && b.start <= now()) ? s.blockId : null, taskId: s.taskId, stepId: s.stepId, outcome, actualMin: actual });
}

// ---------- Recovery ----------

export function openRecovery() {
  const state = app.state;
  const n = now();
  const zone = tz();
  const pending = state.plan.blocks.filter((b) => b.status === 'planned' && b.end <= n && b.end > n - 7 * 86400000).sort((a, b) => a.start - b.start);
  const missed = state.plan.blocks.filter((b) => b.status === 'missed' && b.end > n - 3 * 86400000);
  const quick = (b, outcome) => {
    const task = app.state.tasks.find((t) => t.id === b.taskId);
    const step = b.stepId ? task.steps.find((s) => s.id === b.stepId) : null;
    const rem = step ? step.remainingMin : task.remainingMin;
    const dur = Math.round((b.end - b.start) / MINUTE);
    const r = recordProgressAction({ blockId: b.id, taskId: b.taskId, stepId: b.stepId, outcome, actualMin: outcome === 'missed' ? 0 : dur, remainingAfter: outcome === 'missed' ? rem : Math.max(0, rem - dur) });
    if (r.ok) { api.close(); openRecovery(); }
  };
  const ctx = buildContext(state, n, { horizonDays: 1, keepExistingFuture: true });
  const todayFree = ctx.days[0] ? freeIntervals(ctx, ctx.days[0]).filter(([s, e]) => e - s >= 25 * MINUTE) : [];
  const freeMin = todayFree.reduce((s, [a, b]) => s + (b - a) / MINUTE, 0);
  const rec = app.derivedRec;
  const gaps = [...(app.derivedCoverage || new Map()).entries()].filter(([, c]) => c.gap > 0 && !c.overdue && c.inHorizon).map(([id, c]) => ({ task: state.tasks.find((t) => t.id === id), ...c }));
  const body = h('div', { class: 'stack' },
    h('p', { class: 'lead' }, 'A disrupted day does not mean the plan failed. Record what happened, see what still fits, then compare the smallest fixes.'),
    h('section', { class: 'rec-step' }, h('h3', null, '1. Record what happened'),
      pending.length ? h('ul', { class: 'plain-list' }, pending.map((b) => h('li', { class: 'list-row' },
        h('div', null, h('div', { class: 'list-title' }, blockTitle(state, b)), h('div', { class: 'muted' }, `${fmtDate(msToDate(b.start, zone))}, ${fmtTimeRange(b.start, b.end, zone)}`)),
        h('div', { class: 'row gap-sm wrap' },
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => quick(b, 'completed') }, 'Done as planned'),
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => quick(b, 'missed') }, 'Missed'),
          h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { api.close(); openProgressForm({ blockId: b.id, outcome: 'partial' }); } }, 'Partly, with details'))))) : h('p', { class: 'muted' }, 'Every past session is recorded.'),
      missed.length ? h('p', { class: 'muted' }, `${plural(missed.length, 'recent session')} marked missed. That work is still in your remaining effort.`) : null),
    h('section', { class: 'rec-step' }, h('h3', null, '2. What still fits today'),
      todayFree.length ? h('ul', { class: 'bullets' }, todayFree.map(([s, e]) => h('li', null, `${fmtTimeRange(s, e, zone)} (${fmtDuration((e - s) / MINUTE)})`))) : h('p', null, 'No study window of 25 minutes or more is left today.'),
      todayFree.length ? h('p', { class: 'muted' }, `${fmtDuration(freeMin)} free in total today, before travel.`) : null,
      rec?.pick ? h('p', null, 'Best next action: ', h('strong', null, rec.pick.title), ` for ${fmtDuration(rec.pick.minutes)}.`) : null),
    h('section', { class: 'rec-step' }, h('h3', null, '3. Review remaining work'),
      gaps.length ? h('ul', { class: 'bullets' }, gaps.map((g) => h('li', null, `${g.task.title}: ${fmtDuration(g.gap)} without a session before ${fmtDateTime(g.deadline, zone)}`))) : h('p', { class: 'muted' }, 'Every task due in the planning window is covered by approved sessions.'),
      h('p', { class: 'muted' }, 'Options start with the smallest change, which keeps every approved session and only places missing work. Nothing changes until you approve one.')));
  const api = openDialog({ title: 'Recover the plan', size: 'md', content: body,
    actions: [{ label: 'Close', quiet: true, onClick: () => api.close() }, { label: 'Review remaining work', primary: true, onClick: () => { api.close(); generate('recovery'); } }] });
}

// ---------- What-if ----------

const round5 = (n) => Math.max(0, Math.round(n / 5) * 5);

export function optionalOccurrences(days = 7) {
  const s = app.state;
  const t = today();
  const end = msToDate(now() + days * 86400000, tz());
  return expandCommitments(s.commitments.filter((c) => c.optional), t, end, tz()).filter((o) => !o.skipped && o.startMs > now());
}

export function runWhatIf(params) {
  const s = app.state;
  const n = now();
  const opts = { strategy: 'balanced', variant: 'whatif' };
  const factChanges = [];
  if (params.protectEvenings) opts.protectEveningsAfter = params.eveningCutoff;
  if (params.maxDaily != null && params.maxDaily !== s.preferences.maxDailyStudyMin) opts.prefOverrides = { maxDailyStudyMin: params.maxDaily };
  if (params.taskId && params.factor !== 1) {
    const t = s.tasks.find((x) => x.id === params.taskId);
    if (t) {
      opts.estimateScale = { [t.id]: params.factor };
      const from = taskRemaining(t);
      factChanges.push({ type: 'taskRemaining', taskId: t.id, from, to: round5(from * params.factor), label: `Change "${t.title}" remaining from ${fmtDuration(from)} to ${fmtDuration(round5(from * params.factor))}` });
    }
  }
  if (params.skip.length) {
    opts.skipOccurrenceIds = params.skip;
    for (const id of params.skip) {
      const [cid, date] = id.split('@');
      const c = s.commitments.find((x) => x.id === cid);
      factChanges.push({ type: 'skipOccurrence', commitmentId: cid, date, label: `Skip ${c?.title || 'commitment'} on ${fmtDate(date)}` });
    }
  }
  opts.factChanges = factChanges;
  const alt = makeProposal(s, n, opts);
  alt.label = 'Try a change';
  alt.summary = 'Your what-if settings applied to a balanced plan.';
  const baseline = makeProposal(s, n, { strategy: 'balanced' });
  return { params, opts, alt, baseline, notes: opts.prefOverrides ? [`Uses a daily limit of ${fmtDuration(params.maxDaily)} for this plan only. Your saved limit stays ${fmtDuration(s.preferences.maxDailyStudyMin)}, so days above it will be flagged.`] : [] };
}

export function whatIfToProposal(result) {
  const next = structuredClone(app.state);
  next.proposal = { origin: 'whatif', createdAt: now(), alternatives: [result.alt], selectedId: result.alt.id, base: result.opts };
  app.ui.sideTab = 'review';
  commit(next, { label: 'Preview what-if' });
}

// ---------- Data ----------

export function openData() {
  const n = now();
  const backend = app.repo.backend;
  const where = backend.name === 'browser' ? 'Saved in this browser\'s local storage on this device.'
    : backend.name === 'host' ? 'Saved in this preview\'s storage.'
      : 'Not saved: browser storage is unavailable here. Changes last until this tab closes. Export to keep them.';
  const backupSlot = h('div', null, h('p', { class: 'muted' }, 'Checking for a backup...'));
  const unreadableSlot = h('div');
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', onchange: async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('That file is larger than 5 MB.', { tone: 'warn' }); return; }
    const text = await file.text();
    api.close();
    openImportPreview(text, file.name);
  } });
  const scenario = h('select', { 'aria-label': 'Demo scenario' }, Object.entries(DEMO_SCENARIOS).map(([k, v]) => h('option', { value: k }, v.label)));
  scenario.value = app.state.meta.scenario || 'midweek';
  const body = h('div', { class: 'stack' },
    h('section', null, h('h3', { class: 'h-sm' }, 'Where your data lives'),
      h('p', null, where),
      h('p', { class: 'muted' }, 'Your tasks and progress stay on this device. An optional Course data refresh reads public synthetic API records; personal information is not uploaded. There is no cloud backup or sync; clearing site data deletes saved work. Demo and personal data are separate.'),
      app.saveError ? h('p', { class: 'callout callout-conflict' }, app.saveError) : null),
    h('section', null, h('h3', { class: 'h-sm' }, 'Export'),
      h('p', { class: 'muted' }, `Downloads the ${app.mode} data as a JSON file you can import later.`),
      h('button', { type: 'button', class: 'btn', onclick: () => { const ok = download(`margin-${app.mode}-${msToDate(n, tz())}.json`, exportPayload(app.state, Date.now())); toast(ok ? 'Export downloaded.' : 'This browser blocked the download.', { tone: ok ? 'neutral' : 'warn' }); } }, `Export ${app.mode} data`)),
    h('section', null, h('h3', { class: 'h-sm' }, 'Import into personal data'),
      h('p', { class: 'muted' }, 'You will see a preview first. Your current personal data is backed up before anything is replaced.'),
      h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, 'Choose a JSON file'), fileInput,
      backupSlot),
    unreadableSlot,
    app.mode === 'demo' ? h('section', null, h('h3', { class: 'h-sm' }, 'Reset the demo'),
      h('p', { class: 'muted' }, 'Rebuilds the synthetic demo. Personal data is not touched.'),
      h('div', { class: 'row gap' }, scenario, h('button', { type: 'button', class: 'btn', onclick: async () => {
        if (await confirmDialog({ title: 'Reset the demo?', message: `Demo data will be replaced with "${DEMO_SCENARIOS[scenario.value].label}". Your personal data is separate and stays as it is.`, confirmLabel: 'Reset demo' })) { resetDemo(scenario.value); api.close(); }
      } }, 'Reset demo')),
      h('p', { class: 'muted' }, DEMO_SCENARIOS[scenario.value].description)) : null,
    app.mode === 'personal' ? h('section', null, h('h3', { class: 'h-sm' }, 'Delete personal data'),
      h('p', { class: 'muted' }, 'Removes all personal data and its backup from this browser. Export first if you might want it back.'),
      h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
        if (await confirmDialog({ title: 'Delete all personal data?', message: 'Tasks, commitments, places, plans, progress, and the backup will be deleted from this browser. This cannot be undone.', confirmLabel: 'Delete everything', danger: true, requireText: 'DELETE' })) { await deletePersonalData(); api.close(); }
      } }, 'Delete all personal data')) : null);
  scenario.addEventListener('change', () => { const p = scenario.closest('section').querySelector('p.muted:last-child'); if (p) p.textContent = DEMO_SCENARIOS[scenario.value].description; });
  const api = openDialog({ title: 'Data', size: 'md', content: body, actions: [{ label: 'Close', quiet: true, onClick: () => api.close() }] });
  app.repo.getBackup('personal').then((b) => {
    backupSlot.replaceChildren(b ? h('div', { class: 'row gap wrap' }, h('p', { class: 'muted' }, `Backup from ${fmtDateTime(b.savedAt, tz())}: ${plural(summarize(b.state).tasks, 'task')}, ${plural(summarize(b.state).commitments, 'commitment')}.`),
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: async () => { if (await confirmDialog({ title: 'Restore the backup?', message: 'Your current personal data will be backed up, then replaced with the backup.', confirmLabel: 'Restore backup' })) { await restorePersonalBackup(); api.close(); } } }, 'Restore backup'))
      : h('p', { class: 'muted' }, 'No personal backup yet. One is made automatically before each import.'));
  });
  app.repo.getUnreadable(app.mode).then((raw) => {
    if (!raw) return;
    unreadableSlot.replaceChildren(h('section', null, h('h3', { class: 'h-sm' }, 'Recovery'), h('p', { class: 'muted' }, 'Earlier saved data could not be read and was set aside instead of deleted.'),
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => download(`margin-${app.mode}-unreadable.json`, raw) }, 'Download the unreadable copy')));
  });
}

export function openImportPreview(text, name) {
  const res = parseImport(text, 'personal');
  if (!res.ok) {
    const api = openDialog({ title: 'This file cannot be imported', size: 'sm', content: h('div', { class: 'stack' }, h('p', null, name), h('ul', { class: 'bullets' }, res.errors.map((e) => h('li', null, e))), h('p', { class: 'muted' }, 'Nothing was changed.')),
      actions: [{ label: 'Close', primary: true, onClick: () => api.close() }] });
    return;
  }
  const slot = h('tbody');
  const rows = [['Tasks', 'tasks'], ['Open tasks', 'openTasks'], ['Commitments', 'commitments'], ['Places', 'places'], ['Plan sessions', 'sessions'], ['Progress records', 'progress'], ['Revision topics', 'topics']];
  const fill = (cur) => slot.replaceChildren(...rows.map(([label, k]) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, String(res.summary[k])), h('td', null, cur ? String(cur[k]) : '...'))));
  fill(null);
  (app.mode === 'personal' ? Promise.resolve({ state: app.state }) : app.repo.loadMode('personal')).then((r) => fill(summarize(r.state)));
  const body = h('div', { class: 'stack' },
    h('p', null, `${name}${res.exportedAt ? `, exported ${res.exportedAt.slice(0, 10)}` : ''}`),
    h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', { scope: 'col' }, 'In the file'), h('th', { scope: 'col' }, 'Current personal'))), slot),
    res.warnings.length ? h('div', { class: 'callout callout-warn' }, h('strong', null, 'Notes'), h('ul', null, res.warnings.map((w) => h('li', null, w)))) : null,
    h('p', { class: 'muted' }, 'Importing replaces your personal data. The current personal data is backed up first and can be restored from Data.'));
  const api = openDialog({ title: 'Preview import', size: 'md', content: body,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close() }, { label: 'Replace personal data', primary: true, onClick: async () => { api.close(); await importIntoPersonal(res.state); } }] });
}

// ---------- Help ----------

export function openHelp() {
  const keys = [['t', 'Go to today'], ['[ and ]', 'Previous and next week'], ['n', 'New task'], ['c', 'New event'], ['p', 'Plan: generate a proposal'], ['Ctrl+Z or Cmd+Z', 'Undo the last change'], ['?', 'This help']];
  const body = h('div', { class: 'stack' },
    h('section', null, h('h3', { class: 'h-sm' }, 'How planning works'),
      h('ol', { class: 'bullets' },
        h('li', null, 'Enter commitments, study hours, places, and tasks.'),
        h('li', null, 'Plan creates proposals. Nothing on your calendar changes until you approve one.'),
        h('li', null, 'Record what actually happened. Only recorded progress changes remaining effort.'),
        h('li', null, 'When the day goes sideways, Recover compares the smallest fixes first.'))),
    h('section', null, h('h3', { class: 'h-sm' }, 'Rules, preferences, estimates, heuristics'),
      reasonList([
        { type: 'hard', text: 'Never broken: sleep, study hours, commitments, travel, breaks, daily limit, deadlines, locked sessions.' },
        { type: 'soft', text: 'Shapes placement: focus hours, preferred places, session length, free time kept each day.' },
        { type: 'estimate', text: 'Uncertain inputs, such as travel times nobody entered.' },
        { type: 'heuristic', text: 'Choices the planner made that a different method might make differently.' },
      ])),
    h('section', null, h('h3', { class: 'h-sm' }, 'Keyboard'), h('table', { class: 'table' }, h('tbody', null, keys.map(([k, v]) => h('tr', null, h('th', { scope: 'row' }, h('kbd', null, k)), h('td', null, v)))))),
    h('section', null, h('h3', { class: 'h-sm' }, 'Limits'), h('p', { class: 'muted' }, 'The planner is a deterministic heuristic, not an optimizer: when it cannot place work, a different schedule might still exist. Robustness checks are scenarios, not probabilities. Only America/New_York is supported.')));
  const api = openDialog({ title: 'Help', size: 'md', content: body, actions: [{ label: 'Close', primary: true, onClick: () => api.close() }] });
}

export function openStartGuide() {
  const s = app.state;
  const steps = [
    ['Add the places you study and travel between', s.locations.length > 0, () => openPlaces()],
    ['Add classes, shifts, meals, and protected time', s.commitments.length > 0, () => openCommitmentForm()],
    ['Set your study hours, sleep, and limits', false, () => openPreferences()],
    ['Add tasks with deadlines and estimates', s.tasks.length > 0, () => openTaskForm()],
    ['Generate a proposal and approve it', s.plan.blocks.length > 0, () => generate('plan')],
  ];
  return h('section', { class: 'starter', 'aria-label': 'Getting started' },
    h('h2', null, 'Set up your own planner'),
    h('p', { class: 'muted' }, 'Personal data stays in this browser. The demo is separate and unaffected.'),
    h('ol', { class: 'starter-list' }, steps.map(([label, done, fn]) => h('li', { class: done ? 'is-done' : '' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: fn }, done ? icon('check', { size: 14, label: 'Done' }) : null, label)))));
}
