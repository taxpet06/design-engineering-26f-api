// A quiet workspace: Today, Week and Tasks. Advanced tools are opened on demand.
import { h, icon } from './dom.js';
import { openCourseImport, openCourseReport } from './course.js';
import { toast, openDialog } from './dialog.js';
import { app, initApp, derived, switchMode, setDemoNow, nextMorning, undo, weekShift, goToday, generate, now, tz, saveTask, newTaskId } from './app.js';
import { createRepository, pickBackend } from '../core/storage.js';
import { buildDemoState } from '../data/demoSeed.js';
import { renderCalendar } from './calendar.js';
import { renderNow, renderTasks, renderSide, runIssueAction } from './panels.js';
import { openTaskForm, openCommitmentForm, openCommitmentsList, openPlaces, openPreferences, openBlock, openOccurrence } from './forms.js';
import { openData, openHelp, openStartGuide, openRecovery } from './flows.js';
import { fmtDateTime, fmtDate, fmtTimeRange, fmtDuration, fmtMonthDay, addDays, MINUTE, HOUR, msToDate, zonedToMs, parseClockInput, toClockInput, fmtYear, startOfWeek, weekdayOf } from '../core/time.js';
import { fingerprint, taskRemaining, deadlineMs } from '../core/model.js';
import { expandCommitments } from '../core/recurrence.js';

const root = document.getElementById('app');
let view = 'week';
let calendarView = 'week';
let miniMonth = null;
let toolsDialog = null;
let settingsDialog = null;
let hadProposal = false;
let dismissedWarnings = false;
let nowDetailsOpen = false;
function navigate(next) { view = next; app.render(); window.scrollTo({ top: 0 }); }
function planWeek() { view = 'week'; generate('plan'); }
function demoClock(d) {
  const input = h('input', { type: 'datetime-local', step: 300, 'aria-label': 'Set demo time', value: `${msToDate(d.now, tz())}T${toClockInput(Math.round((d.now - zonedToMs(msToDate(d.now, tz()), 0, tz())) / MINUTE))}` });
  const set = () => {
    const [date, time] = input.value.split('T');
    const m = parseClockInput(time || '');
    if (!date || m == null) { toast('Choose a date and time.', { tone: 'warn' }); return; }
    setDemoNow(zonedToMs(date, m, tz()));
  };
  return h('div', { class: 'clock clock-demo', role: 'group', 'aria-label': 'Demo clock' },
    h('span', { class: 'clock-badge' }, 'Demo time'),
    h('span', { class: 'clock-time' }, fmtDateTime(d.now, tz())),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => setDemoNow(d.now + 30 * MINUTE), dataset: { fk: 'clock-30' } }, '+30 min'),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => setDemoNow(d.now + 2 * HOUR), dataset: { fk: 'clock-2h' } }, '+2 hr'),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => nextMorning(), dataset: { fk: 'clock-morning' } }, 'Next morning'),
    h('details', { class: 'menu' }, h('summary', { class: 'btn btn-quiet btn-sm' }, 'Set'), h('div', { class: 'menu-list menu-pad' }, input, h('button', { type: 'button', class: 'btn btn-sm', onclick: set }, 'Set demo time'))));
}

function openTools(tab = 'issues') {
  app.ui.sideTab = tab;
  toolsDialog = openDialog({ title: 'Planning tools', size: 'lg', content: renderSide(derived()), onClose: () => { toolsDialog = null; } });
  toolsDialog.dlg.classList.add('tools-drawer');
}
function openSettings() {
  const mode = (m, label) => h('button', { type: 'button', class: 'seg-btn', role: 'radio', 'aria-checked': app.mode === m ? 'true' : 'false', onclick: async () => { settingsDialog.close(); view = 'today'; await switchMode(m); } }, label);
  const item = (title, desc, fn) => h('button', { type: 'button', class: 'settings-item', onclick: () => { settingsDialog.close(); fn(); } }, h('span', null, h('strong', null, title), h('small', null, desc)), icon('right', { size: 16 }));
  settingsDialog = openDialog({ title: 'Settings', size: 'md', onClose: () => { settingsDialog = null; }, content: h('div', { class: 'settings-content' },
    h('p', { class: 'eyebrow' }, 'WORKSPACE'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Data mode' }, mode('personal', 'Personal'), mode('demo', 'Course demo')),
    h('p', { class: 'muted small' }, app.mode === 'demo' ? 'A fictional schedule to explore. Personal data is kept separately.' : 'Your own schedule, saved in this browser.'),
    app.mode === 'demo' ? h('details', { class: 'settings-clock' }, h('summary', null, 'Adjust demo time'), demoClock(derived())) : null,
    item('Study preferences', 'Available hours, sleep, breaks and focus time', openPreferences),
    item('Places & walking', 'Locations, travel times and buffers', openPlaces),
    item('Your events', 'Classes, shifts and recurring plans', openCommitmentsList),
    item('Course data', 'Import a fictional student from the class API', openCourseImport),
    app.state.meta.course && app.mode === 'demo' ? item('Course import details', 'Source records and missing meeting times', openCourseReport) : null,
    item('Backups & data', 'Export, import, restore or reset', openData),
    item('Help', 'How planning works and keyboard shortcuts', openHelp)) });
}
function plannerMark() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 30 30'); svg.setAttribute('width', '30'); svg.setAttribute('height', '30'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('planner-mark');
  for (const d of ['M3 23V7h7v10h7V7h10v16', 'M3 23h7v-6h7v6h10']) {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path);
  }
  return svg;
}
function navigation() {
  const nav = (id, title, glyph) => h('button', { type: 'button', class: ['nav-item', view === id && 'is-active'], 'aria-current': view === id ? 'page' : null, onclick: () => navigate(id), dataset: { fk: `nav-${id}` } }, icon(glyph, { size: 17 }), title);
  return h('aside', { class: 'navigation' },
    h('a', { class: 'brand', href: '#', onclick: (e) => { e.preventDefault(); navigate('week'); }, 'aria-label': 'Margin home' }, h('span', { class: 'logo-orbit', 'aria-hidden': 'true' }, h('span')), h('span', { class: 'brand-name' }, 'Margin')),
    h('nav', { class: 'primary-nav', 'aria-label': 'Main navigation' }, nav('today', 'Overview', 'today'), nav('week', 'Calendar', 'week'), nav('tasks', 'Tasks', 'tasks')),
    h('p', { class: 'nav-section-label' }, 'Workspace'),
    h('div', { class: 'workspace-options' }, ['personal', 'demo'].map((m) => h('button', { type: 'button', class: ['workspace-option', app.mode === m && 'is-current'], onclick: async () => { if (m !== app.mode) await switchMode(m); } }, h('span', { class: `workspace-dot ${m}` }), m === 'personal' ? 'Personal' : 'Course demo', app.mode === m ? h('span', { class: 'current-check' }, '✓') : null))),
    h('div', { class: 'nav-utility' }, h('p', { class: 'nav-section-label' }, 'Tools'),
      h('button', { class: 'nav-item', onclick: () => openTools('load') }, icon('chart', { size: 17 }), 'Workload'),
      h('button', { class: 'nav-item', onclick: openRecovery }, icon('undo', { size: 17 }), 'Recover plan'),
      h('button', { class: 'nav-item settings-button', onclick: openSettings }, icon('settings', { size: 17 }), 'Settings'),
      h('button', { class: 'nav-item', onclick: openHelp }, icon('help', { size: 17 }), 'Help')),
    h('div', { class: 'nav-footer' }, h('span', { class: 'profile-avatar', 'aria-hidden': 'true' }, 'M'), h('div', null, h('strong', null, app.mode === 'demo' ? 'Course demo' : 'Personal'), h('small', null, 'Saved on this device'))));
}
function openSearch() {
  const output = h('div', { class: 'search-results', 'aria-live': 'polite' });
  const input = h('input', { type: 'search', placeholder: 'Search tasks and events', 'aria-label': 'Search your planner', oninput: run });
  function run() {
    const q = input.value.trim().toLowerCase();
    if (!q) { output.replaceChildren(h('p', { class: 'muted' }, 'Type a title or course name.')); return; }
    const tasks = app.state.tasks.filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(q)).map((t) => ({ title: t.title, sub: `${t.category} · Task`, open: () => openTaskForm(t) }));
    const events = app.state.commitments.filter((c) => c.title.toLowerCase().includes(q)).map((c) => ({ title: c.title, sub: 'Event', open: () => openCommitmentForm(c) }));
    const results = [...tasks, ...events].slice(0, 15);
    output.replaceChildren(...(results.length ? results.map((r) => h('button', { class: 'search-result', onclick: () => { api.close(); r.open(); } }, h('strong', null, r.title), h('small', null, r.sub))) : [h('p', { class: 'muted' }, 'No matching tasks or events.')]));
  }
  const api = openDialog({ title: 'Search', size: 'md', content: h('div', { class: 'stack command-palette' }, input, output) }); run();
}
function heading(d) {
  return h('header', { class: 'page-heading' }, h('div', null, h('h1', null, view === 'today' ? 'Overview' : view === 'week' ? 'Calendar' : 'Tasks'), h('p', { class: 'page-sub' }, view === 'week' ? 'Your classes, study time, and everything between.' : view === 'today' ? 'Your next step and the rest of today.' : 'Assignments and deadlines, all in one place.')),
    h('div', { class: 'heading-actions' }, h('button', { class: 'search-trigger', onclick: openSearch, 'aria-label': 'Search your planner' }, icon('search', { size: 15 }), h('span', null, 'Search tasks, events…'), h('kbd', null, '⌘ K')),
      view === 'today' ? h('button', { type: 'button', class: 'btn btn-primary', onclick: quickAddTask }, icon('plus', { size: 15 }), 'Add task') : null));
}
function quickAddTask() {
  const title = h('input', { name: 'title', type: 'text', placeholder: 'e.g. Finish calculus problem set', maxlength: 200, required: true });
  const date = h('input', { name: 'deadline', type: 'date', value: msToDate(now(), tz()), required: true });
  const minutes = h('input', { name: 'estimateMin', type: 'number', value: 60, min: 5, max: 6000, step: 5, required: true });
  const error = h('p', { class: 'field-error', role: 'alert' });
  const draft = () => ({ id: newTaskId(), title: title.value.trim(), category: 'Study', kind: 'assignment', priority: 'medium', deadline: { date: date.value, time: null }, estimateMin: Number(minutes.value), remainingMin: Number(minutes.value), confidence: 'medium', focus: 'normal', location: { mode: 'any', ids: [] }, equipment: [], status: 'todo', notes: '', doneWhen: '', splittable: true, minSessionMin: null, steps: [], dependsOn: [], lateTarget: null, revisionTopicId: null, calibratedFrom: null, createdAt: now(), completedAt: null, source: { system: 'user', id: null } });
  const field = (label, input) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input);
  const submit = () => { if (!title.value.trim()) { error.textContent = 'Give the task a title.'; title.focus(); return; } if (!date.value || !minutes.checkValidity()) { error.textContent = 'Choose a deadline and an estimate from 5 to 6000 minutes.'; return; } saveTask(draft()); api.close(); };
  const form = h('form', { id: 'quick-task', class: 'form', onsubmit: (e) => { e.preventDefault(); submit(); } }, field('What do you need to do?', title), h('div', { class: 'grid-2' }, field('Due date', date), field('Time needed (minutes)', minutes)), error,
    h('button', { type: 'button', class: 'text-action', onclick: () => { const t = draft(); api.close(); openTaskForm(t); } }, 'More options: course, priority, steps…'));
  const api = openDialog({ title: 'Add task', size: 'sm', content: form, actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close() }, { label: 'Add task', primary: true, onClick: submit }] });
}
function systemNotes() {
  const out = [];
  if (app.saveError || app.repo.backend.name === 'memory') out.push(h('div', { class: 'banner banner-conflict', role: 'alert' }, 'Changes are not being saved. Export a backup to keep your work.', h('button', { class: 'btn btn-sm', onclick: openData }, 'Export')));
  if (app.loadWarnings.length && !dismissedWarnings) out.push(h('div', { class: 'banner banner-warn' }, app.loadWarnings.join(' '), h('button', { class: 'btn btn-sm', onclick: () => { dismissedWarnings = true; app.render(); } }, 'Dismiss')));
  if (app.mode === 'demo') out.push(h('div', { class: 'demo-ribbon' }, h('span', null, app.state.meta.course ? `${app.state.meta.course.studentName} · Fictional course data` : 'Sample schedule · October 2026'), h('button', { class: 'text-action', onclick: openSettings }, 'Use my own schedule')));
  if (app.mode === 'demo' && app.state.meta.course?.pending.length) out.push(h('div', { class: 'source-note' }, `${app.state.meta.course.pending.length} commitments need meeting times before they can block your calendar. `, h('button', { class: 'text-action', onclick: openCourseReport }, 'Review details')));
  return out;
}
function quietNow(d) {
  const node = renderNow(d);
  const more = h('details', { class: 'now-extra', open: nowDetailsOpen, ontoggle: (e) => { if (e.target.isConnected) nowDetailsOpen = e.target.open; } }, h('summary', null, 'Details & preferences'));
  for (const item of [...node.querySelectorAll('.bullets, .now-context, .now-alts')]) more.append(item);
  if (!app.ui.session && !['in-session', 'upcoming'].includes(d.rec.status)) { const kicker = node.querySelector('.now-kicker'); if (kicker) more.prepend(kicker); }
  node.append(more);
  const title = node.querySelector('.panel-head h2'); if (title) title.textContent = app.ui.session ? 'Session in progress' : 'Suggested next task';
  return node;
}
function agenda(d) {
  const occurrences = expandCommitments(app.state.commitments, d.today, d.today, tz()).filter((o) => !o.skipped);
  const blocks = app.state.plan.blocks.filter((b) => msToDate(b.start, tz()) === d.today && b.status !== 'missed');
  const items = [...occurrences.map((o) => ({ start: o.startMs, end: o.endMs, title: o.title, kind: o.type, open: () => openOccurrence(o) })), ...blocks.map((b) => ({ start: b.start, end: b.end, title: app.state.tasks.find((t) => t.id === b.taskId)?.title || 'Study session', kind: 'study', open: () => openBlock(b) }))].sort((a, b) => a.start - b.start);
  const future = view === 'week' ? items : items.filter((i) => i.end > d.now);
  const list = view === 'week' ? future : future.slice(0, 6);
  return h('section', { class: 'agenda-section' }, h('div', { class: 'section-title' }, h('h2', null, view === 'week' ? fmtDate(d.today) : 'Schedule'), view !== 'week' ? h('button', { class: 'text-action', onclick: () => navigate('week') }, 'Open week') : null),
    list.length ? h('ol', { class: 'agenda-list' }, list.map((i) => h('li', null, h('button', { type: 'button', class: ['agenda-row', `agenda-${i.kind}`], onclick: i.open }, h('span', { class: 'agenda-time' }, fmtTimeRange(i.start, i.end, tz())), h('span', { class: 'agenda-line' }), h('span', { class: 'agenda-info' }, h('strong', null, i.title), h('small', null, i.kind === 'study' ? 'Study session' : i.kind === 'class' ? 'Class' : 'Event')), icon('right', { size: 16 }))))) : h('div', { class: 'empty-agenda' }, h('p', null, 'No more events today.'), h('span', null, 'Add a class, shift or appointment to this schedule.'), h('button', { class: 'btn btn-quiet', onclick: () => openCommitmentForm(null, d.today) }, '+ Add a commitment')),
    view !== 'week' && future.length > 6 ? h('button', { class: 'text-action', onclick: () => navigate('week') }, `${future.length - 6} more in your calendar`) : null);
}
function dueSoon(d) {
  const list = app.state.tasks.filter((t) => t.status !== 'done' && taskRemaining(t) > 0).sort((a, b) => deadlineMs(a, app.state.settings) - deadlineMs(b, app.state.settings)).slice(0, 3);
  return h('section', { class: 'due-soon' }, h('div', { class: 'section-title' }, h('h2', null, 'On your radar'), h('button', { class: 'text-action', onclick: () => navigate('tasks') }, 'All tasks ↗')),
    list.length ? list.map((t) => h('button', { type: 'button', class: 'radar-row', onclick: () => openTaskForm(t) }, h('span', { class: 'radar-dot' }), h('span', null, h('small', null, t.category), h('strong', null, t.title)), h('span', { class: 'radar-meta' }, `${t.deadline.date < d.today ? 'Overdue · ' : ''}${fmtMonthDay(t.deadline.date)}`, h('small', null, `${fmtDuration(taskRemaining(t))} left`)))) : h('p', { class: 'muted' }, 'Nothing waiting on you. Add a task when you need to.'));
}
function todayView(d) {
  const empty = app.mode === 'personal' && !app.state.tasks.length && !app.state.commitments.length;
  return h('div', { class: 'today-content' }, empty ? openStartGuide() : null,
    h('div', { class: 'today-grid' }, quietNow(d), agenda(d)),
    h('div', { class: 'today-utilities' },
      h('button', { class: 'btn btn-quiet recovery-link', onclick: openRecovery }, icon('undo', { size: 15 }), 'Missed a study session?'),
      (d.analysis.counts.conflict + d.analysis.counts.warning) > 0 ? h('button', { class: 'text-action', onclick: () => openTools('issues') }, `Review ${d.analysis.counts.conflict + d.analysis.counts.warning} scheduling issues`) : null),
    h('details', { class: 'deadline-disclosure' }, h('summary', null, 'Upcoming deadlines'), dueSoon(d)));
}
function shiftPeriod(delta) {
 if (calendarView === 'week') { weekShift(delta * 7); return; }
 app.ui.selectedDate = addDays(app.ui.selectedDate || msToDate(now(), tz()), delta);
 app.ui.weekStart = startOfWeek(app.ui.selectedDate); app.render();
}
function weekView(d) {
  const ws = app.ui.weekStart;
  const selected = app.ui.selectedDate || d.today;
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: tz() }).format(zonedToMs(ws, 12 * 60, tz()));
  return h('section', { class: ['week-workspace', `calendar-${calendarView}`], id: 'calendar', tabindex: '-1' },
    h('div', { class: 'toolbar' }, h('div', { class: 'calendar-view-tabs', role: 'group', 'aria-label': 'Calendar view' }, ['week', 'day', 'agenda'].map((m) => h('button', { class: ['view-tab', calendarView === m && 'is-active'], 'aria-pressed': calendarView === m ? 'true' : 'false', onclick: () => { calendarView = m; app.render(); } }, m[0].toUpperCase() + m.slice(1)))),
      h('div', { class: 'toolbar-actions' }, h('button', { class: 'btn', onclick: () => openTools('issues') }, `${d.analysis.counts.conflict + d.analysis.counts.warning} issues`), h('button', { class: 'btn-icon', 'aria-label': 'Search your planner', onclick: openSearch }, icon('search')), h('button', { class: 'btn btn-quiet', onclick: goToday }, 'Today'), h('button', { class: 'btn', onclick: () => openCommitmentForm(null, selected) }, icon('plus', { size: 14 }), 'Add event'), h('button', { class: 'btn btn-primary', onclick: planWeek }, app.state.proposal ? 'Replan' : 'Plan my week'))),
    h('div', { class: ['week-grid', app.state.proposal && 'has-review'] },
      h('div', { class: 'calendar-frame' }, h('div', { class: 'calendar-month-bar' }, h('button', { class: 'btn-icon', 'aria-label': 'Previous period', onclick: () => shiftPeriod(-1) }, icon('left', { size: 16 })), h('div', null, h('h2', { class: 'week-label' }, calendarView === 'week' ? label : fmtDate(selected)), h('small', null, calendarView === 'week' ? `${fmtMonthDay(ws)} to ${fmtMonthDay(addDays(ws, 6))}, ${fmtYear(ws)}` : 'Your full day')), h('button', { class: 'btn-icon', 'aria-label': 'Next period', onclick: () => shiftPeriod(1) }, icon('right', { size: 16 }))), calendarView === 'agenda' ? agenda({ ...d, today: selected, now: selected === d.today ? d.now : zonedToMs(selected, 0, tz()) }) : renderCalendar(d)),
      app.state.proposal ? h('details', { class: 'proposal-drawer', open: true }, h('summary', null, 'Review your proposed plan'), renderSide(d, { onlyReview: true })) : null),
    h('div', { class: 'week-bottom' }, h('span', null, 'Walking and breaks are included in study planning.'), h('button', { class: 'text-action', onclick: () => openTools('issues') }, 'Review planning details')));
}
function monthShift(delta) {
  const m = miniMonth || (app.ui.selectedDate || msToDate(now(), tz())).slice(0, 7);
  const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + delta, 1)); miniMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; app.render();
}
function tasksView(d) {
  return h('div', { class: 'tasks-workspace' }, renderTasks(d, { onAdd: quickAddTask }), h('div', { class: 'tasks-foot' }, h('p', null, 'Set a deadline and time estimate for each task.'), h('button', { class: 'text-action', onclick: () => openTools('learn') }, 'Revision & estimate suggestions ↗')));
}
function render() {
  const d = derived();
  if (app.state.proposal && !hadProposal) { view = 'week'; toolsDialog?.close(); }
  hadProposal = !!app.state.proposal;
  d.stressKey = `${JSON.stringify(fingerprint(app.state))}|${now()}`;
  app.derivedIssues = d.analysis.issues; app.derivedCoverage = d.analysis.coverage; app.derivedRec = d.rec;
  app.derivedOccurrences = expandCommitments(app.state.commitments, addDays(d.today, -1), addDays(d.today, app.state.settings.planningHorizonDays), tz());
  const fk = document.activeElement?.dataset?.fk;
  const scrolls = {}; for (const e of root.querySelectorAll('[data-scroll]')) scrolls[e.dataset.scroll] = e.scrollTop;
  root.replaceChildren(h('div', { class: 'shell new-shell' }, h('a', { class: 'skip', href: '#workspace' }, 'Skip to content'), navigation(),
    h('main', { class: 'workspace', id: 'workspace', tabindex: '-1' }, view === 'week' ? null : heading(d), systemNotes(), view === 'today' ? todayView(d) : view === 'week' ? weekView(d) : tasksView(d), h('footer', { class: 'workspace-footer' }, h('span', { class: 'version-stamp' }, 'Saved on this device'), h('button', { class: 'text-action', onclick: () => openTools('load') }, 'Planning tools')))));
  const toolbar = root.querySelector('.toolbar'); const monthbar = root.querySelector('.calendar-month-bar'); if (toolbar && monthbar) toolbar.prepend(monthbar);
  for (const e of root.querySelectorAll('[data-scroll]')) e.scrollTop = scrolls[e.dataset.scroll] ?? Number(e.dataset.initial || 0);
  if (fk) root.querySelector(`[data-fk="${CSS.escape(fk)}"]`)?.focus({ preventScroll: true });
  if (toolsDialog?.dlg.open) { const scroll = toolsDialog.body.querySelector('.side-body')?.scrollTop || 0; toolsDialog.body.replaceChildren(renderSide(d)); const panel = toolsDialog.body.querySelector('.side-body'); if (panel) panel.scrollTop = scroll; }
}
function onKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!document.querySelector('dialog[open]')) openSearch(); return; }
  if (document.querySelector('dialog[open]') || ['input', 'textarea', 'select'].includes(e.target.tagName?.toLowerCase()) || e.target.isContentEditable) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const map = { t: () => navigate('today'), '[': () => { view = 'week'; weekShift(-7); }, ']': () => { view = 'week'; weekShift(7); }, n: quickAddTask, c: () => openCommitmentForm(null, app.ui.selectedDate), p: planWeek, '?': openHelp };
  if (map[e.key]) { e.preventDefault(); map[e.key](); }
}
async function boot() {
  document.documentElement.dataset.theme = 'dark';
  const repo = createRepository(pickBackend(window), { seedDemo: () => buildDemoState('midweek') });
  await initApp(repo); app.render = render; render(); document.addEventListener('keydown', onKey);
  setInterval(() => { if (app.mode === 'personal' && !document.querySelector('dialog[open]')) render(); }, 60000);
}
boot().catch((e) => { root.replaceChildren(h('div', { class: 'fatal', role: 'alert' }, h('h1', null, 'Margin could not start'), h('p', null, e.message))); console.error(e); });
