// Form-based editing for every entity. Drag-and-drop is not required anywhere.

import { h, icon, uid, reasonList, plural } from './dom.js';
import { openDialog, confirmDialog, toast } from './dialog.js';
import { app, now, today, tz, saveTask, deleteTask, setDone, saveCommitment, deleteCommitment, setOccurrence, savePlaces, savePreferences, recordProgressAction, addTopicAction, logReviewAction, newTaskId, newCommitmentId, lockBlock, removeBlockAction, update } from './app.js';
import { TASK_KINDS, PRIORITIES, FOCUS, CONFIDENCE, EQUIPMENT, LOCATION_KINDS, COMMITMENT_TYPES, validateTask, validateCommitment, validatePreferences, validateLocation, taskRemaining, taskUnits } from '../core/model.js';
import { OUTCOMES, taskAccounting } from '../core/progress.js';
import { selectedAlternative } from '../core/proposal.js';
import { CONFIDENCE_LABELS } from '../core/revision.js';
import { fmtDate, fmtDuration, fmtTime, fmtTimeRange, fmtClock, fmtClockRange, toClockInput, parseClockInput, addDays, WEEKDAY_SHORT, WEEKDAY_LONG, MINUTE, msToDate } from '../core/time.js';
import { locationName } from '../core/travel.js';
import { newId } from '../core/ids.js';
import { deadlineInfo, blockTitle, blockStatus, typeLabel, minutesRow } from './common.js';

// ---------- Field helpers ----------

function field(label, control, { hint = null, name = null, wide = false } = {}) {
  const id = control.id || uid('f');
  control.id = id;
  const errId = `${id}-err`;
  const hintId = hint ? `${id}-hint` : null;
  control.setAttribute('aria-describedby', [hintId, errId].filter(Boolean).join(' '));
  return h('div', { class: ['field', wide && 'field-wide'], dataset: { field: name || control.name || '' } },
    h('label', { for: id, class: 'field-label' }, label), control,
    hint ? h('p', { id: hintId, class: 'field-hint' }, hint) : null,
    h('p', { id: errId, class: 'field-error', hidden: true }));
}

function group(legend, children, { hint = null, name = null } = {}) {
  return h('fieldset', { class: 'fieldset', dataset: { field: name || '' } }, h('legend', null, legend), hint ? h('p', { class: 'field-hint' }, hint) : null,
    h('div', { class: 'fieldset-body' }, children), h('p', { class: 'field-error', hidden: true }));
}

const input = (name, value, attrs = {}) => h('input', { name, value: value ?? '', ...attrs });
const num = (name, value, min, max, attrs = {}) => h('input', { name, type: 'number', inputmode: 'numeric', min, max, step: 1, value: value ?? '', ...attrs });
const time = (name, minutes, attrs = {}) => h('input', { name, type: 'time', step: 300, value: minutes == null ? '' : toClockInput(minutes), ...attrs });
const date = (name, value, attrs = {}) => h('input', { name, type: 'date', value: value || '', ...attrs });
function select(name, options, value, attrs = {}) {
  const entries = Array.isArray(options) ? options : Object.entries(options);
  const el = h('select', { name, ...attrs }, entries.map(([v, l]) => h('option', { value: v }, l)));
  el.value = value == null ? '' : String(value);
  return el;
}
const check = (name, checked, label, attrs = {}) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name, checked: !!checked, ...attrs }), h('span', null, label));

function intVal(form, name) {
  const el = form.elements[name];
  if (!el || el.value === '') return null;
  const n = Number(el.value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

// Shows field errors next to their controls plus a summary at the top of the form.
function showErrors(form, errors, map = {}) {
  for (const p of form.querySelectorAll('.field-error')) { p.hidden = true; p.textContent = ''; }
  for (const c of form.querySelectorAll('[aria-invalid]')) c.removeAttribute('aria-invalid');
  const summary = form.querySelector('.form-errors');
  const entries = Object.entries(errors);
  if (!entries.length) { if (summary) summary.hidden = true; return true; }
  let first = null;
  for (const [key, msg] of entries) {
    const target = form.querySelector(`[data-field="${map[key] || key}"]`);
    if (target) {
      const p = target.querySelector('.field-error');
      p.hidden = false;
      p.textContent = msg;
      const ctl = target.querySelector('input, select, textarea');
      if (ctl) { ctl.setAttribute('aria-invalid', 'true'); if (!first) first = ctl; }
    }
  }
  if (summary) {
    summary.hidden = false;
    summary.replaceChildren(h('p', null, `Fix ${plural(entries.length, 'problem')} to save:`), h('ul', null, entries.map(([, m]) => h('li', null, m))));
  }
  (first || summary)?.focus?.();
  return false;
}

const errorSummary = () => h('div', { class: 'form-errors', role: 'alert', tabindex: '-1', hidden: true });

// ---------- Tasks ----------

const TEMPLATES = {
  problemset: { label: 'Problem set', steps: [['Read the problems and notes', 0.15], ['Work the problems', 0.6], ['Check and write up', 0.25]] },
  essay: { label: 'Essay or paper', steps: [['Outline', 0.15], ['Draft', 0.5], ['Revise', 0.25], ['Proofread', 0.1]] },
  exam: { label: 'Exam prep', steps: [['Review notes', 0.3], ['Practice problems', 0.5], ['Self-test', 0.2]] },
  project: { label: 'Project', steps: [['Plan', 0.15], ['Build', 0.55], ['Test', 0.2], ['Document', 0.1]] },
  reading: { label: 'Reading', steps: [['Read', 0.8], ['Notes', 0.2]] },
};

function blankTask() {
  return {
    id: newTaskId(), title: '', category: '', kind: 'assignment', priority: 'medium', deadline: { date: addDays(today(), 2), time: null },
    estimateMin: 60, remainingMin: 60, confidence: 'medium', focus: 'normal', location: { mode: 'any', ids: [] }, equipment: [],
    status: 'todo', notes: '', doneWhen: '', splittable: true, minSessionMin: null, steps: [], dependsOn: [], lateTarget: null,
    revisionTopicId: null, calibratedFrom: null, createdAt: null, completedAt: null, source: { system: 'user', id: null },
  };
}

export function openTaskForm(existing = null) {
  const state = app.state;
  const isNew = !existing;
  const t = structuredClone(existing || blankTask());
  let steps = t.steps.map((s) => ({ ...s }));
  const formId = uid('task-form');
  const categories = [...new Set(state.tasks.map((x) => x.category).filter(Boolean))].sort();
  const listId = uid('cats');
  let remainingTouched = !isNew;

  const stepsBox = h('div', { class: 'steps' });
  const effortBox = h('div', { class: 'grid-2' });
  const est = num('estimateMin', t.estimateMin, 0, 6000, { oninput: () => { if (!remainingTouched) form.elements.remainingMin.value = form.elements.estimateMin.value; } });
  const rem = num('remainingMin', t.remainingMin, 0, 6000, { oninput: () => { remainingTouched = true; } });

  function readSteps() {
    steps = steps.map((s, i) => ({
      ...s,
      title: form.elements[`step-title-${i}`]?.value.trim() ?? s.title,
      estimateMin: intVal(form, `step-est-${i}`) ?? 0,
      remainingMin: intVal(form, `step-rem-${i}`) ?? 0,
      done: !!form.elements[`step-done-${i}`]?.checked,
    }));
  }
  function renderSteps() {
    const rows = steps.map((s, i) => h('div', { class: 'step-row', dataset: { field: `step${i}` } },
      h('span', { class: 'step-n', 'aria-hidden': 'true' }, String(i + 1)),
      h('label', { class: 'sr-only', for: `${formId}-st-${i}` }, `Step ${i + 1} title`),
      h('input', { id: `${formId}-st-${i}`, name: `step-title-${i}`, value: s.title, placeholder: 'Step title' }),
      h('label', { class: 'step-num' }, h('span', null, 'Estimate'), num(`step-est-${i}`, s.estimateMin, 0, 6000)),
      h('label', { class: 'step-num' }, h('span', null, 'Left'), num(`step-rem-${i}`, s.remainingMin, 0, 6000)),
      check(`step-done-${i}`, s.done, 'Done'),
      h('div', { class: 'step-actions' },
        h('button', { type: 'button', class: 'btn-icon', 'aria-label': `Move step ${i + 1} up`, disabled: i === 0, onclick: () => { readSteps(); [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; renderSteps(); } }, icon('left', { size: 14 })),
        h('button', { type: 'button', class: 'btn-icon', 'aria-label': `Move step ${i + 1} down`, disabled: i === steps.length - 1, onclick: () => { readSteps(); [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; renderSteps(); } }, icon('right', { size: 14 })),
        h('button', { type: 'button', class: 'btn-icon', 'aria-label': `Remove step ${i + 1}`, onclick: () => { readSteps(); steps.splice(i, 1); renderSteps(); } }, icon('x', { size: 14 }))),
      h('p', { class: 'field-error', hidden: true })));
    const templateSel = select('template', [['', 'Suggest steps from a template'], ...Object.entries(TEMPLATES).map(([k, v]) => [k, v.label])], '');
    stepsBox.replaceChildren(
      ...rows,
      h('div', { class: 'row gap' },
        h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { readSteps(); steps.push({ id: newId('s'), title: '', estimateMin: 30, remainingMin: 30, done: false }); renderSteps(); stepsBox.querySelector(`[name=step-title-${steps.length - 1}]`)?.focus(); } }, icon('plus', { size: 14 }), 'Add step'),
        h('label', { class: 'sr-only', for: `${formId}-tpl` }, 'Template'),
        Object.assign(templateSel, { id: `${formId}-tpl` }),
        h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => {
          const key = templateSel.value;
          if (!key) return;
          readSteps();
          const total = steps.length ? steps.reduce((s, x) => s + x.estimateMin, 0) : (intVal(form, 'estimateMin') || 60);
          steps = TEMPLATES[key].steps.map(([title, share]) => { const m = Math.max(5, Math.round((total * share) / 5) * 5); return { id: newId('s'), title, estimateMin: m, remainingMin: m, done: false }; });
          renderSteps();
        } }, 'Apply')),
      h('p', { class: 'field-hint' }, 'Templates are generic and know nothing about your assignment. Edit the steps to fit. Steps are worked in order.'));
    effortBox.hidden = steps.length > 0;
    const sum = steps.reduce((s, x) => s + (x.done ? 0 : x.remainingMin), 0);
    stepsNote.textContent = steps.length ? `Effort is the sum of the steps: ${fmtDuration(sum)} left. The task-level estimate is not added on top.` : '';
  }
  const stepsNote = h('p', { class: 'field-hint' });

  const noTime = check('noTime', t.deadline.time == null, 'No specific time', { onchange: (e) => { form.elements.deadlineTime.disabled = e.target.checked; } });
  const dlTime = time('deadlineTime', t.deadline.time ?? 23 * 60 + 59, { disabled: t.deadline.time == null });
  const locIds = new Set(t.location.ids);
  const locChecks = h('div', { class: 'checks' }, state.locations.map((l) => check(`loc-${l.id}`, locIds.has(l.id), l.name)));
  const eqChecks = h('div', { class: 'checks' }, Object.entries(EQUIPMENT).map(([k, v]) => check(`eq-${k}`, t.equipment.includes(k), v)));
  const others = state.tasks.filter((x) => x.id !== t.id && (x.status !== 'done' || t.dependsOn.includes(x.id)));
  const depChecks = others.length ? h('div', { class: 'checks checks-col' }, others.map((x) => check(`dep-${x.id}`, t.dependsOn.includes(x.id), x.title))) : h('p', { class: 'muted' }, 'No other tasks yet.');

  const acct = !isNew ? (() => {
    const a = taskAccounting(state, existing, now(), selectedAlternative(state.proposal), deadlineInfo(existing, state.settings, now()).ms);
    return h('dl', { class: 'minutes' },
      minutesRow('Original estimate', a.estimate),
      minutesRow('Remaining', a.remaining),
      minutesRow('Progress credited', a.completedEffort, 'from recorded sessions'),
      minutesRow('Actual time recorded', a.actualMin, `over ${plural(a.sessionsRecorded, 'record')}`),
      minutesRow('Approved future sessions', a.approvedFutureMin),
      state.proposal ? minutesRow('New in the open proposal', a.proposedFutureMin) : null);
  })() : null;

  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    acct ? h('section', { class: 'form-section' }, h('h3', null, 'Minutes'), acct) : null,
    h('div', { class: 'grid-2' },
      field('Title', input('title', t.title, { required: true, maxlength: 120, autocomplete: 'off' }), { wide: true }),
      field('Course or category', input('category', t.category, { list: listId, maxlength: 60, placeholder: 'COSC 10, Personal' })),
      h('datalist', { id: listId }, categories.map((c) => h('option', { value: c }))),
      field('Type', select('kind', TASK_KINDS, t.kind)),
      field('Priority', select('priority', PRIORITIES, t.priority)),
      field('Deadline date', date('deadline', t.deadline.date, { required: true })),
      h('div', { class: 'field', dataset: { field: 'deadlineTime' } }, h('label', { class: 'field-label', for: (dlTime.id = uid('f')) }, 'Deadline time'), dlTime, noTime,
        h('p', { class: 'field-hint' }, `Without a time, the deadline is assumed to be ${fmtClock(state.settings.dateOnlyCutoff)}. Change the assumption in Preferences.`), h('p', { class: 'field-error', hidden: true }))),
    h('section', { class: 'form-section' }, h('h3', null, 'Effort'),
      effortBox,
      h('div', { class: 'grid-2' },
        field('How sure is the estimate?', select('confidence', CONFIDENCE, t.confidence), { hint: 'Used by the robustness check: rough guesses are tested for running 50% long.' }),
        field('Focus needed', select('focus', FOCUS, t.focus)),
        h('div', { class: 'field' }, check('splittable', t.splittable, 'Can be split into several sessions')),
        field('Minimum useful session (min)', num('minSessionMin', t.minSessionMin, 5, 240, { placeholder: `Default ${state.preferences.minSessionMin}` })))),
    h('section', { class: 'form-section' }, h('h3', null, 'Steps'), stepsNote, stepsBox),
    h('section', { class: 'form-section' }, h('h3', null, 'Where and with what'),
      h('div', { class: 'grid-2' },
        field('Location', select('locMode', [['any', 'Anywhere I can study'], ['preferred', 'Prefer these places'], ['required', 'Must be at one of these']], t.location.mode), { name: 'location' }),
        state.locations.length ? group('Places', locChecks) : h('p', { class: 'muted' }, 'Add places under Places and travel to set locations.'),
        group('Equipment needed', eqChecks, { hint: 'Only places with all of these are used.' }))),
    h('section', { class: 'form-section' }, h('h3', null, 'Order and finish'),
      group('Must finish first', depChecks, { name: 'dependsOn' }),
      h('div', { class: 'grid-2' },
        field('Definition of done', input('doneWhen', t.doneWhen, { maxlength: 300, placeholder: 'What "finished" looks like' }), { wide: true }),
        field('Finish late by', date('lateTarget', t.lateTarget), { hint: 'Only for overdue work. Lets the planner schedule it without changing the real deadline.' }),
        field('Notes', h('textarea', { name: 'notes', rows: 2, maxlength: 2000 }, t.notes), { wide: true }))));
  effortBox.append(
    field('Total estimate (min)', est, { name: 'estimateMin' }),
    field('Remaining (min)', rem, { name: 'remainingMin', hint: 'Only recorded progress or your own edit changes this.' }));
  renderSteps();

  function submit() {
    readSteps();
    const f = form.elements;
    const task = {
      ...t,
      title: f.title.value.trim(),
      category: f.category.value.trim() || 'General',
      kind: f.kind.value,
      priority: f.priority.value,
      deadline: { date: f.deadline.value, time: f.noTime.checked ? null : parseClockInput(f.deadlineTime.value) },
      confidence: f.confidence.value,
      focus: f.focus.value,
      splittable: f.splittable.checked,
      minSessionMin: intVal(form, 'minSessionMin'),
      location: { mode: f.locMode.value, ids: state.locations.filter((l) => f[`loc-${l.id}`]?.checked).map((l) => l.id) },
      equipment: Object.keys(EQUIPMENT).filter((k) => f[`eq-${k}`].checked),
      dependsOn: others.filter((x) => f[`dep-${x.id}`]?.checked).map((x) => x.id),
      doneWhen: f.doneWhen.value.trim(),
      lateTarget: f.lateTarget.value || null,
      notes: f.notes.value,
      steps,
    };
    if (steps.length) { task.estimateMin = steps.reduce((s, x) => s + x.estimateMin, 0); task.remainingMin = 0; }
    else { task.estimateMin = intVal(form, 'estimateMin'); task.remainingMin = intVal(form, 'remainingMin'); }
    if (f.deadlineTime.value === '' && !f.noTime.checked) task.deadline.time = NaN;
    const errs = validateTask(task, state.tasks);
    if (!showErrors(form, errs, { deadline: 'deadline', lateTarget: 'lateTarget' })) return;
    if (task.status === 'done' && taskRemaining({ ...task, status: 'todo' }) > 0 && existing?.status === 'done') task.status = 'in_progress';
    saveTask(task);
    api.close(true);
  }

  const api = openDialog({
    title: isNew ? 'New task' : 'Edit task', size: 'lg', content: form,
    actions: [
      !isNew ? { label: 'Delete', danger: true, onClick: async () => { if (await confirmDialog({ title: 'Delete this task?', message: `"${existing.title}" and its sessions and progress records will be removed. You can undo right after.`, confirmLabel: 'Delete task', danger: true })) { deleteTask(existing.id); api.close(true); } } } : null,
      !isNew ? { label: existing.status === 'done' ? 'Reopen' : 'Mark done', quiet: true, onClick: () => { setDone(existing.id, existing.status !== 'done'); api.close(true); } } : null,
      !isNew && existing.status !== 'done' ? { label: 'Log time', quiet: true, onClick: () => { api.close(true); openProgressForm({ taskId: existing.id }); } } : null,
      { label: 'Cancel', quiet: true, onClick: () => api.close(false) },
      { label: isNew ? 'Add task' : 'Save task', primary: true, submit: true, form: formId },
    ],
  });
  return api;
}

// ---------- Commitments ----------

export function openCommitmentForm(existing = null, presetDate = null) {
  const state = app.state;
  const isNew = !existing;
  const c = structuredClone(existing || { id: newCommitmentId(), title: '', type: 'class', startDate: presetDate || today(), start: 9 * 60, end: 10 * 60, recurrence: { freq: 'none' }, locationId: null, optional: false, notes: '', exceptions: [], source: { system: 'user', id: null } });
  const weekly = c.recurrence.freq === 'weekly';
  const days = new Set(weekly ? c.recurrence.days : []);
  const formId = uid('c-form');
  const repeatBox = h('div', { class: 'repeat', hidden: !weekly },
    group('Repeats on', h('div', { class: 'checks' }, [1, 2, 3, 4, 5, 6, 0].map((d) => check(`day-${d}`, days.has(d), WEEKDAY_SHORT[d]))), { name: 'days' }),
    field('Until', date('until', weekly ? c.recurrence.until : addDays(c.startDate, 70))));
  const endHint = h('p', { class: 'field-hint', 'aria-live': 'polite' });
  const updateHint = () => {
    const s = parseClockInput(form.elements.start.value);
    const e = parseClockInput(form.elements.end.value);
    endHint.textContent = s != null && e != null && e < s ? 'Ends the next day.' : s != null && e != null && e === s ? 'Start and end are the same time.' : '';
  };
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('div', { class: 'grid-2' },
      field('Title', input('title', c.title, { maxlength: 120, autocomplete: 'off' }), { wide: true }),
      field('Type', select('type', COMMITMENT_TYPES, c.type), { hint: 'Protected time blocks study without needing a location.' }),
      field('Location', select('locationId', [['', 'No location'], ...state.locations.map((l) => [l.id, l.name])], c.locationId || '')),
      field(weekly ? 'First date' : 'Date', date('startDate', c.startDate), { name: 'startDate' }),
      h('div', { class: 'field' }, check('weekly', weekly, 'Repeats weekly', { onchange: (e) => { repeatBox.hidden = !e.target.checked; } }))),
    repeatBox,
    h('div', { class: 'grid-2' },
      field('Starts', time('start', c.start, { oninput: () => updateHint() })),
      h('div', { class: 'field', dataset: { field: 'end' } }, h('label', { class: 'field-label', for: `${formId}-end` }, 'Ends'), time('end', c.end === 1440 ? 0 : c.end, { id: `${formId}-end`, oninput: () => updateHint() }), endHint, h('p', { class: 'field-error', hidden: true })),
      h('div', { class: 'field' }, check('optional', c.optional, 'Optional: can be skipped in a what-if')),
      field('Notes', input('notes', c.notes, { maxlength: 1000 }))));

  function submit() {
    const f = form.elements;
    const start = parseClockInput(f.start.value);
    let end = parseClockInput(f.end.value);
    if (end === 0 && start != null && start > 0) end = 1440;
    const next = {
      ...c, title: f.title.value.trim(), type: f.type.value, locationId: f.locationId.value || null, startDate: f.startDate.value,
      start: start ?? NaN, end: end ?? NaN, optional: f.optional.checked, notes: f.notes.value.trim(),
      recurrence: f.weekly.checked ? { freq: 'weekly', days: [0, 1, 2, 3, 4, 5, 6].filter((d) => f[`day-${d}`].checked), until: f.until.value } : { freq: 'none' },
    };
    if (end === 1440 && start === 0) next.end = 1440;
    const errs = validateCommitment(next);
    if (!showErrors(form, errs, { days: 'days' })) return;
    saveCommitment(next);
    api.close(true);
  }
  const api = openDialog({
    title: isNew ? 'New event' : 'Edit event', subtitle: existing?.recurrence.freq === 'weekly' ? 'Changes apply to the whole series. To change one date, open that occurrence on the calendar.' : null,
    size: 'md', content: form,
    actions: [
      !isNew ? { label: 'Delete', danger: true, onClick: async () => { if (await confirmDialog({ title: 'Delete this commitment?', message: existing.recurrence.freq === 'weekly' ? `Every occurrence of "${existing.title}" will be removed.` : `"${existing.title}" will be removed.`, confirmLabel: 'Delete', danger: true })) { deleteCommitment(existing.id); api.close(true); } } } : null,
      { label: 'Cancel', quiet: true, onClick: () => api.close(false) },
      { label: isNew ? 'Add event' : 'Save commitment', primary: true, submit: true, form: formId },
    ],
  });
  updateHint();
  return api;
}

export function openOccurrence(occ) {
  const state = app.state;
  const c = state.commitments.find((x) => x.id === occ.commitmentId);
  if (!c) return null;
  const issues = app.derivedIssues ? app.derivedIssues.filter((i) => i.refs?.occurrences?.includes(occ.id)) : [];
  const rec = c.recurrence.freq === 'weekly' ? `Weekly on ${c.recurrence.days.map((d) => WEEKDAY_LONG[d]).join(', ')} until ${fmtDate(c.recurrence.until)}` : 'One time';
  const src = c.source?.system === 'mock' ? `From mock ${c.source.table} record ${c.source.id}` : c.source?.system === 'demo' ? 'Demo personal record' : 'Entered by you';
  const body = h('div', { class: 'stack' },
    h('dl', { class: 'facts' },
      h('dt', null, 'When'), h('dd', null, `${fmtDate(occ.date)}, ${fmtTimeRange(occ.startMs, occ.endMs, tz())}`),
      h('dt', null, 'Type'), h('dd', null, typeLabel(c.type)),
      h('dt', null, 'Place'), h('dd', null, locationName(state, occ.locationId)),
      h('dt', null, 'Repeats'), h('dd', null, rec),
      h('dt', null, 'Source'), h('dd', null, src),
      occ.modified ? [h('dt', null, 'This date'), h('dd', null, `Changed from the series (${fmtClockRange(c.start, c.end)})`)] : null,
      occ.skipped ? [h('dt', null, 'This date'), h('dd', null, 'Skipped')] : null),
    issues.length ? h('div', { class: 'callout callout-conflict' }, h('strong', null, 'Conflicts'), h('ul', null, issues.map((i) => h('li', null, i.detail)))) : null,
    c.notes ? h('p', { class: 'muted' }, c.notes) : null);
  const recurring = c.recurrence.freq === 'weekly';
  const api = openDialog({
    title: occ.title, size: 'sm', content: body,
    actions: [
      recurring && !occ.skipped ? { label: 'Skip this date', quiet: true, onClick: () => { setOccurrence(c.id, occ.date, { action: 'skip' }, `Skipped ${c.title} on ${fmtDate(occ.date)}. Other dates are unchanged.`); api.close(true); } } : null,
      recurring && (occ.skipped || occ.modified) ? { label: 'Restore this date', quiet: true, onClick: () => { setOccurrence(c.id, occ.date, null, `Restored ${c.title} on ${fmtDate(occ.date)}.`); api.close(true); } } : null,
      recurring && !occ.skipped ? { label: 'Change this date only', quiet: true, onClick: () => { api.close(true); openOccurrenceEdit(c, occ); } } : null,
      { label: recurring ? 'Edit series' : 'Edit', primary: true, onClick: () => { api.close(true); openCommitmentForm(c); } },
    ],
  });
  return api;
}

function openOccurrenceEdit(c, occ) {
  const formId = uid('occ');
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('div', { class: 'grid-2' },
      field('Starts', time('start', occ.start)),
      field('Ends', time('end', occ.end === 1440 ? 0 : occ.end), { name: 'end' }),
      field('Location', select('locationId', [['', 'No location'], ...app.state.locations.map((l) => [l.id, l.name])], occ.locationId || ''), { wide: true })));
  function submit() {
    const start = parseClockInput(form.elements.start.value);
    let end = parseClockInput(form.elements.end.value);
    if (end === 0 && start > 0) end = 1440;
    const errs = {};
    if (start == null) errs.start = 'Choose a start time.';
    if (end == null) errs.end = 'Choose an end time.';
    else if (end === start) errs.end = 'Start and end cannot be the same time.';
    if (!showErrors(form, errs)) return;
    setOccurrence(c.id, occ.date, { action: 'modify', start, end, locationId: form.elements.locationId.value || null }, `Changed ${c.title} on ${fmtDate(occ.date)} only.`);
    api.close(true);
  }
  const api = openDialog({ title: `${c.title}, ${fmtDate(occ.date)} only`, subtitle: 'The rest of the series stays as it is.', size: 'sm', content: form,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, { label: 'Save this date', primary: true, submit: true, form: formId }] });
}

export function openCommitmentsList() {
  const state = app.state;
  const list = state.commitments.slice().sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.start - b.start));
  const body = h('div', { class: 'stack' },
    list.length ? h('ul', { class: 'plain-list' }, list.map((c) => h('li', { class: 'list-row' },
      h('div', null,
        h('div', { class: 'list-title' }, c.title),
        h('div', { class: 'muted' }, `${typeLabel(c.type)}. ${c.recurrence.freq === 'weekly' ? `${c.recurrence.days.map((d) => WEEKDAY_SHORT[d]).join(', ')}, ` : `${fmtDate(c.startDate)}, `}${fmtClockRange(c.start, c.end)}. ${locationName(state, c.locationId)}${c.exceptions.length ? `. ${plural(c.exceptions.length, 'changed date')}` : ''}.`)),
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { api.close(true); openCommitmentForm(c); } }, 'Edit')))) : h('p', { class: 'empty' }, 'No commitments yet. Add your classes, shifts, meetings, meals, and protected time.'));
  const api = openDialog({ title: 'Commitments', size: 'md', content: body,
    actions: [{ label: 'Close', quiet: true, onClick: () => api.close() }, { label: 'Add event', primary: true, onClick: () => { api.close(); openCommitmentForm(); } }] });
}

// ---------- Places and travel ----------

export function openPlaces() {
  const state = app.state;
  let places = state.locations.map((l) => ({ ...l, equipment: [...l.equipment] }));
  let routes = state.travel.map((t) => ({ ...t }));
  const formId = uid('places');
  const placesBox = h('div', { class: 'stack-sm' });
  const routesBox = h('div', { class: 'stack-sm' });
  const settingsBox = h('div', { class: 'grid-3' });

  function read() {
    const f = form.elements;
    places = places.map((p, i) => ({ ...p, name: f[`p-name-${i}`].value.trim(), kind: f[`p-kind-${i}`].value, studyOk: f[`p-study-${i}`].checked && f[`p-kind-${i}`].value !== 'virtual', equipment: Object.keys(EQUIPMENT).filter((k) => f[`p-eq-${i}-${k}`].checked) }));
    routes = routes.map((r, i) => ({ a: f[`r-a-${i}`].value, b: f[`r-b-${i}`].value, minutes: intVal(form, `r-m-${i}`) }));
  }
  function render() {
    placesBox.replaceChildren(...places.map((p, i) => h('div', { class: 'place-row', dataset: { field: `place${i}` } },
      h('div', { class: 'grid-3' },
        field('Name', input(`p-name-${i}`, p.name, { maxlength: 80 })),
        field('Kind', select(`p-kind-${i}`, LOCATION_KINDS, p.kind)),
        h('div', { class: 'field' }, check(`p-study-${i}`, p.studyOk, 'Good for studying'))),
      h('div', { class: 'checks' }, Object.entries(EQUIPMENT).map(([k, v]) => check(`p-eq-${i}-${k}`, p.equipment.includes(k), v))),
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { read(); places.splice(i, 1); render(); } }, 'Remove place'),
      h('p', { class: 'field-error', hidden: true }))),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { read(); places.push({ id: newId('loc'), name: '', kind: 'study', studyOk: true, equipment: [], source: { system: 'user', id: null } }); render(); } }, icon('plus', { size: 14 }), 'Add place'));
    const opts = places.map((p) => [p.id, p.name || 'Unnamed place']);
    routesBox.replaceChildren(...routes.map((r, i) => h('div', { class: 'route-row', dataset: { field: `route${i}` } },
      h('label', { class: 'sr-only', for: `${formId}-ra-${i}` }, 'From'), select(`r-a-${i}`, opts, r.a, { id: `${formId}-ra-${i}` }),
      h('span', { 'aria-hidden': 'true' }, 'and'),
      h('label', { class: 'sr-only', for: `${formId}-rb-${i}` }, 'To'), select(`r-b-${i}`, opts, r.b, { id: `${formId}-rb-${i}` }),
      h('label', { class: 'route-min' }, num(`r-m-${i}`, r.minutes, 0, 240), h('span', null, 'min')),
      h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Remove route', onclick: () => { read(); routes.splice(i, 1); render(); } }, icon('x', { size: 14 })),
      h('p', { class: 'field-error', hidden: true }))),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', disabled: places.length < 2, onclick: () => { read(); routes.push({ a: places[0].id, b: places[1].id, minutes: 10 }); render(); } }, icon('plus', { size: 14 }), 'Add travel time'));
    const homeVal = form.elements?.home ? form.elements.home.value : state.settings.homeLocationId || '';
    settingsBox.replaceChildren(
      field('Home place', select('home', [['', 'Not set'], ...opts], homeVal), { hint: 'Each day starts and ends here.' }),
      field('Unknown route estimate (min)', num('fallback', form.elements?.fallback?.value ?? state.settings.unknownTravelFallbackMin, 0, 120), { hint: 'Used, and labeled as an estimate, when no time is entered.' }),
      field('Travel buffer (min)', num('buffer', form.elements?.buffer?.value ?? state.settings.travelBufferMin, 0, 60), { hint: 'Added to every trip.' }));
  }
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('section', { class: 'form-section' }, h('h3', null, 'Places'), placesBox),
    h('section', { class: 'form-section' }, h('h3', null, 'Travel times'), h('p', { class: 'field-hint' }, 'Enter times you know. They apply in both directions. Margin has no map connection and does not measure routes.'), routesBox),
    h('section', { class: 'form-section' }, h('h3', null, 'Travel settings'), settingsBox));
  render();
  function submit() {
    read();
    const errs = {};
    places.forEach((p, i) => { const e = validateLocation(p); if (Object.keys(e).length) errs[`place${i}`] = `Place ${i + 1}: ${Object.values(e)[0]}`; });
    const seen = new Set();
    routes.forEach((r, i) => {
      if (r.a === r.b) errs[`route${i}`] = `Travel time ${i + 1}: choose two different places.`;
      else if (!Number.isInteger(r.minutes) || r.minutes < 0 || r.minutes > 240) errs[`route${i}`] = `Travel time ${i + 1}: minutes must be 0 to 240.`;
      const k = r.a < r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`;
      if (seen.has(k)) errs[`route${i}`] = `Travel time ${i + 1}: this pair is already listed.`;
      seen.add(k);
    });
    const fb = intVal(form, 'fallback');
    const buf = intVal(form, 'buffer');
    if (!Number.isInteger(fb) || fb < 0 || fb > 120) errs.fallback = 'Unknown route estimate must be 0 to 120 minutes.';
    if (!Number.isInteger(buf) || buf < 0 || buf > 60) errs.buffer = 'Buffer must be 0 to 60 minutes.';
    if (!showErrors(form, errs)) return;
    savePlaces({
      locations: places,
      travel: routes.map((r) => ({ a: r.a < r.b ? r.a : r.b, b: r.a < r.b ? r.b : r.a, minutes: r.minutes })),
      settings: { homeLocationId: form.elements.home.value || null, unknownTravelFallbackMin: fb, travelBufferMin: buf },
    });
    api.close(true);
  }
  const api = openDialog({ title: 'Places and travel', size: 'lg', content: form,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, { label: 'Save places', primary: true, submit: true, form: formId }] });
}

// ---------- Preferences ----------

export function openPreferences() {
  const state = app.state;
  const p = state.preferences;
  const formId = uid('prefs');
  const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const w = p.availability[d][0];
    return h('div', { class: 'avail-row', dataset: { field: `availability${d}` } },
      check(`av-on-${d}`, !!w, WEEKDAY_LONG[d]),
      h('label', { class: 'sr-only', for: `${formId}-af-${d}` }, `${WEEKDAY_LONG[d]} from`), time(`av-from-${d}`, w ? w.start : 9 * 60, { id: `${formId}-af-${d}` }),
      h('span', { 'aria-hidden': 'true' }, 'to'),
      h('label', { class: 'sr-only', for: `${formId}-at-${d}` }, `${WEEKDAY_LONG[d]} until`), time(`av-to-${d}`, w ? (w.end === 1440 ? 0 : w.end) : 22 * 60, { id: `${formId}-at-${d}` }),
      p.availability[d].length > 1 ? h('span', { class: 'muted' }, `Has ${p.availability[d].length} windows; saving keeps the first.`) : null,
      h('p', { class: 'field-error', hidden: true }));
  });
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('section', { class: 'form-section' }, h('h3', null, 'Study hours'), h('p', { class: 'field-hint' }, 'Study is only planned inside these hours. This is a hard limit.'), h('div', { class: 'stack-sm' }, rows)),
    h('section', { class: 'form-section' }, h('h3', null, 'Limits'), h('div', { class: 'grid-3' },
      h('div', { class: 'field', dataset: { field: 'sleep' } }, h('span', { class: 'field-label' }, 'Protected sleep'),
        h('div', { class: 'row gap' }, h('label', { class: 'sr-only', for: `${formId}-ss` }, 'Sleep starts'), time('sleepStart', p.sleep.start, { id: `${formId}-ss` }), h('span', null, 'to'), h('label', { class: 'sr-only', for: `${formId}-se` }, 'Sleep ends'), time('sleepEnd', p.sleep.end, { id: `${formId}-se` })),
        h('p', { class: 'field-error', hidden: true })),
      field('Daily study limit (min)', num('maxDailyStudyMin', p.maxDailyStudyMin, 0, 960)),
      field('Longest single session (min)', num('maxContinuousMin', p.maxContinuousMin, 15, 480)),
      field('Break between sessions (min)', num('breakMin', p.breakMin, 0, 120)),
      field('Minimum useful session (min)', num('minSessionMin', p.minSessionMin, 5, 240)))),
    h('section', { class: 'form-section' }, h('h3', null, 'Preferences'), h('p', { class: 'field-hint' }, 'These shape where work goes but are never treated as rules.'), h('div', { class: 'grid-3' },
      field('Preferred session (min)', num('preferredSessionMin', p.preferredSessionMin, 10, 240)),
      h('div', { class: 'field', dataset: { field: 'focusHours' } }, h('span', { class: 'field-label' }, 'Focus hours'),
        h('div', { class: 'row gap' }, h('label', { class: 'sr-only', for: `${formId}-ff` }, 'Focus from'), time('focusStart', p.focusHours[0]?.start ?? 9 * 60, { id: `${formId}-ff` }), h('span', null, 'to'), h('label', { class: 'sr-only', for: `${formId}-ft` }, 'Focus until'), time('focusEnd', p.focusHours[0]?.end ?? 12 * 60, { id: `${formId}-ft` })),
        h('p', { class: 'field-hint' }, 'Deep-focus work is steered here.'), h('p', { class: 'field-error', hidden: true })),
      field('Keep free each day (min)', num('reserveFlexMin', p.reserveFlexMin, 0, 600), { hint: 'Flexibility time the planner leaves open.' }),
      field('Evenings start at', time('eveningCutoff', p.eveningCutoff), { hint: 'Used by the protect-evenings option.' }))),
    h('section', { class: 'form-section' }, h('h3', null, 'Assumptions'), h('div', { class: 'grid-3' },
      field('Deadlines without a time are due at', time('dateOnlyCutoff', state.settings.dateOnlyCutoff)),
      field('Planning window (days)', num('planningHorizonDays', state.settings.planningHorizonDays, 3, 28), { hint: 'How far ahead each proposal plans.' }),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Timezone'), h('p', null, 'America/New_York'), h('p', { class: 'field-hint' }, 'The only timezone this version supports. Daylight-saving changes are handled.')))));
  function submit() {
    const f = form.elements;
    const clockOr = (name) => { const v = parseClockInput(f[name].value); return v == null ? NaN : v; };
    const availability = Array.from({ length: 7 }, (_, d) => {
      if (!f[`av-on-${d}`].checked) return [];
      let end = clockOr(`av-to-${d}`);
      if (end === 0) end = 1440;
      return [{ start: clockOr(`av-from-${d}`), end }];
    });
    let fe = clockOr('focusEnd');
    if (fe === 0) fe = 1440;
    const prefs = {
      ...p, availability,
      sleep: { start: clockOr('sleepStart'), end: clockOr('sleepEnd') },
      maxDailyStudyMin: intVal(form, 'maxDailyStudyMin'), maxContinuousMin: intVal(form, 'maxContinuousMin'), breakMin: intVal(form, 'breakMin'),
      minSessionMin: intVal(form, 'minSessionMin'), preferredSessionMin: intVal(form, 'preferredSessionMin'),
      focusHours: [{ start: clockOr('focusStart'), end: fe }], reserveFlexMin: intVal(form, 'reserveFlexMin'), eveningCutoff: clockOr('eveningCutoff'),
    };
    const errs = validatePreferences(prefs);
    const cutoff = clockOr('dateOnlyCutoff');
    const horizon = intVal(form, 'planningHorizonDays');
    if (!Number.isInteger(cutoff)) errs.dateOnlyCutoff = 'Choose a time for date-only deadlines.';
    if (!Number.isInteger(horizon) || horizon < 3 || horizon > 28) errs.planningHorizonDays = 'Planning window must be 3 to 28 days.';
    if (!showErrors(form, errs)) return;
    savePreferences(prefs, { dateOnlyCutoff: cutoff, planningHorizonDays: horizon });
    api.close(true);
  }
  const api = openDialog({ title: 'Preferences', size: 'lg', content: form,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, { label: 'Save preferences', primary: true, submit: true, form: formId }] });
}

// ---------- Progress ----------

export function openProgressForm({ blockId = null, taskId = null, stepId = null, outcome = null, actualMin = null } = {}) {
  const state = app.state;
  const block = blockId ? state.plan.blocks.find((b) => b.id === blockId) : null;
  const tid = block ? block.taskId : taskId;
  const task = state.tasks.find((t) => t.id === tid);
  if (!task) { toast('That task no longer exists.', { tone: 'warn' }); return null; }
  const units = taskUnits(task);
  let sid = block ? block.stepId : stepId;
  if (task.steps.length && (!sid || !task.steps.some((s) => s.id === sid && !s.done))) sid = units[0]?.stepId ?? sid;
  const step = sid ? task.steps.find((s) => s.id === sid) : null;
  const unitRemaining = step ? step.remainingMin : task.remainingMin;
  const planned = block ? Math.round((block.end - block.start) / MINUTE) : 30;
  const formId = uid('prog');
  let remTouched = false;
  const outcomes = block ? OUTCOMES : { completed: 'Worked on it as intended', partial: 'Got less done than hoped', interrupted: 'Interrupted' };
  const out0 = outcome || 'completed';
  const actual = num('actualMin', actualMin ?? planned, 0, 720);
  const remaining = num('remainingAfter', Math.max(0, unitRemaining - (actualMin ?? planned)), 0, 6000, { oninput: () => { remTouched = true; } });
  const sync = () => {
    const o = form.elements.outcome.value;
    const missed = o === 'missed';
    actual.disabled = missed;
    for (const choice of form.querySelectorAll('input[name=finish]')) {
      choice.disabled = missed && choice.value !== 'open';
      if (missed) choice.checked = choice.value === 'open';
    }
    remaining.disabled = missed || form.elements.finish.value !== 'open';
    if (!remTouched) remaining.value = missed ? unitRemaining : Math.max(0, unitRemaining - (intVal(form, 'actualMin') || 0));
  };
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('p', { class: 'lead' }, step ? `${task.title}: ${step.title}` : task.title),
    block ? h('p', { class: 'muted' }, `Planned ${fmtDate(msToDate(block.start, tz()))}, ${fmtTimeRange(block.start, block.end, tz())} at ${locationName(state, block.locationId)}.`) : null,
    group('What happened?', h('div', { class: 'radios' }, Object.entries(outcomes).map(([k, v]) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'outcome', value: k, checked: k === out0, onchange: sync }), h('span', null, v)))), { name: 'outcome' }),
    h('div', { class: 'grid-2' },
      field('Time actually spent (min)', actual, { hint: 'Minutes you worked, not the planned length.' }),
      field(`Remaining for this ${step ? 'step' : 'task'} afterwards (min)`, remaining, { hint: `Before this: ${fmtDuration(unitRemaining)}. Adjust if the work turned out bigger or smaller.` })),
    group('Finished?', h('div', { class: 'radios' },
      h('label', { class: 'check' }, h('input', { type: 'radio', name: 'finish', value: 'open', checked: true, onchange: sync }), h('span', null, 'Not finished yet')),
      step ? h('label', { class: 'check' }, h('input', { type: 'radio', name: 'finish', value: 'step', onchange: sync }), h('span', null, 'This step is finished')) : null,
      h('label', { class: 'check' }, h('input', { type: 'radio', name: 'finish', value: 'task', onchange: sync }), h('span', null, 'The whole task is finished'))),
    { hint: 'A recorded session never marks the task done by itself.' }),
    h('div', { class: 'grid-3' },
      field('Focus (optional)', select('focus', [['', 'Skip'], ['1', '1, scattered'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5, locked in']], '')),
      field('Difficulty (optional)', select('difficulty', [['', 'Skip'], ['1', '1, easy'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5, very hard']], '')),
      field('Note', input('note', '', { maxlength: 500 }))));
  sync();
  function submit() {
    const f = form.elements;
    const o = f.outcome.value;
    const input2 = {
      blockId: block ? block.id : null, taskId: task.id, stepId: step ? step.id : null, outcome: block ? o : (o === 'completed' ? 'logged' : o),
      actualMin: o === 'missed' ? 0 : intVal(form, 'actualMin'), remainingAfter: intVal(form, 'remainingAfter'),
      finish: f.finish.value === 'open' ? null : f.finish.value, focus: f.focus.value ? Number(f.focus.value) : null,
      difficulty: f.difficulty.value ? Number(f.difficulty.value) : null, note: f.note.value.trim(),
    };
    if (o === 'missed') input2.remainingAfter = unitRemaining;
    const r = recordProgressAction(input2);
    if (!r.ok) { showErrors(form, r.errors); return; }
    app.ui.session = null;
    api.close(true);
    const t2 = app.state.tasks.find((x) => x.id === task.id);
    if (t2 && t2.kind === 'review' && t2.status === 'done' && t2.revisionTopicId) askConfidence(t2.revisionTopicId);
    else if (t2 && t2.status !== 'done' && t2.steps.length && t2.steps.every((s) => s.done)) toast('Every step is done. Mark the task finished?', { actionLabel: 'Mark done', onAction: () => setDone(t2.id, true), timeout: 12000 });
  }
  const api = openDialog({ title: block ? 'Record this session' : 'Log time', size: 'md', content: form,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, { label: 'Record', primary: true, submit: true, form: formId }] });
  return api;
}

export function askConfidence(topicId) {
  const topic = app.state.revision.topics.find((t) => t.id === topicId);
  if (!topic) return;
  const api = openDialog({ title: `How well did you recall ${topic.title}?`, subtitle: 'Sets when the next review is due.', size: 'sm',
    content: h('div', { class: 'conf-row' }, [1, 2, 3, 4, 5].map((c) => h('button', { type: 'button', class: 'btn', onclick: () => { logReviewAction(topicId, c); api.close(true); } }, `${c}. ${CONFIDENCE_LABELS[c]}`))),
    actions: [{ label: 'Not now', quiet: true, onClick: () => api.close(false) }] });
}

export function openTopicForm() {
  const formId = uid('topic');
  const cats = [...new Set(app.state.tasks.map((t) => t.category))].sort();
  const form = h('form', { id: formId, class: 'form', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
    errorSummary(),
    h('div', { class: 'grid-2' },
      field('Topic', input('title', '', { maxlength: 120 }), { wide: true }),
      field('Course or category', select('category', [...cats.map((c) => [c, c]), ['General', 'General']], cats[0] || 'General')),
      field('Review length (min)', num('reviewMin', 20, 5, 120)),
      field('How well do you know it now?', select('confidence', Object.entries(CONFIDENCE_LABELS).map(([k, v]) => [k, `${k}. ${v}`]), '3'), { wide: true })));
  function submit() {
    const title = form.elements.title.value.trim();
    const reviewMin = intVal(form, 'reviewMin');
    const errs = {};
    if (!title) errs.title = 'Name the topic.';
    if (!Number.isInteger(reviewMin) || reviewMin < 5 || reviewMin > 120) errs.reviewMin = 'Review length must be 5 to 120 minutes.';
    if (!showErrors(form, errs)) return;
    addTopicAction({ title, category: form.elements.category.value, reviewMin, confidence: Number(form.elements.confidence.value) });
    api.close(true);
  }
  const api = openDialog({ title: 'Add revision topic', size: 'sm', content: form,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, { label: 'Add topic', primary: true, submit: true, form: formId }] });
}

// ---------- Session details ----------

export function openBlock(b, { proposed = false, removed = false, fragile = null } = {}) {
  const state = app.state;
  const n = now();
  const st = blockStatus(b, n);
  const task = state.tasks.find((t) => t.id === b.taskId);
  const body = h('div', { class: 'stack' },
    h('dl', { class: 'facts' },
      h('dt', null, 'When'), h('dd', null, `${fmtDate(msToDate(b.start, tz()))}, ${fmtTimeRange(b.start, b.end, tz())} (${fmtDuration((b.end - b.start) / MINUTE)})`),
      h('dt', null, 'Place'), h('dd', null, locationName(state, b.locationId)),
      h('dt', null, 'Status'), h('dd', null, proposed ? 'Proposed, not approved' : removed ? 'Would be removed or moved by the proposal' : `${st.label}${b.locked ? ', locked' : ''}`),
      b.actualMin != null ? [h('dt', null, 'Recorded'), h('dd', null, fmtDuration(b.actualMin))] : null,
      task?.doneWhen ? [h('dt', null, 'Done when'), h('dd', null, task.doneWhen)] : null),
    fragile ? h('div', { class: 'callout callout-warn' }, h('strong', null, 'Fragile session'), h('p', null, fragile)) : null,
    b.reasons?.length ? h('section', null, h('h3', { class: 'h-sm' }, 'Why it is here'), reasonList(b.reasons)) : h('p', { class: 'muted' }, 'No placement notes for this session.'));
  const actions = [];
  if (!proposed && !removed) {
    if (b.status === 'planned' && b.start <= n) actions.push({ label: 'Record outcome', primary: true, onClick: () => { api.close(true); openProgressForm({ blockId: b.id }); } });
    if (b.status === 'planned' && b.end > n) actions.push({ label: b.locked ? 'Unlock' : 'Lock in place', quiet: true, onClick: () => { lockBlock(b.id, !b.locked); api.close(true); } });
    if (b.status === 'planned' && b.start > n) actions.push({ label: 'Remove session', danger: true, onClick: () => { removeBlockAction(b.id); api.close(true); } });
  }
  if (task) actions.push({ label: 'Open task', quiet: true, onClick: () => { api.close(true); openTaskForm(task); } });
  const api = openDialog({ title: blockTitle(state, b), size: 'md', content: body, actions });
  return api;
}

// Lightweight daily check-in for setting a task's definition of done inline.
export function saveDoneWhen(taskId, text) {
  update((s) => { const t = s.tasks.find((x) => x.id === taskId); if (t) t.doneWhen = text.slice(0, 300); }, { label: 'Set definition of done', message: 'Definition of done saved.' });
}

