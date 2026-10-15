// Side and left panels. Each renders from the current state and derived analysis.

import { h, icon, plural, reasonList } from './dom.js';
import { confirmDialog } from './dialog.js';
import { app, now, today, tz, setDone, setUi, generate, regenerate, selectAlternative, approveSelected, cancelProposalAction, checkIn, applyCalibration, dismissCalibration, clearCalibrationAction, toggleCalibration, removeTopicAction, stress } from './app.js';
import { openTaskForm, openOccurrence, openBlock, openProgressForm, openPreferences, openPlaces, openTopicForm, askConfidence, openCommitmentForm } from './forms.js';
import { openLaunchBrief, endSession, openRecovery, runWhatIf, whatIfToProposal, optionalOccurrences } from './flows.js';
import { fmtDate, fmtDuration, fmtTime, fmtTimeRange, fmtDateTime, fmtClock, addDays, msToDate, MINUTE, toClockInput, parseClockInput, fmtDayRelative } from '../core/time.js';
import { locationName } from '../core/travel.js';
import { taskRemaining, TASK_KINDS } from '../core/model.js';
import { workloadForDates, deadlineClusters } from '../core/analysis.js';
import { calibrationGroups, calibrationSuggestions, MIN_SAMPLES } from '../core/calibration.js';
import { CONFIDENCE_LABELS, FIRST_INTERVAL, FACTOR } from '../core/revision.js';
import { selectedAlternative } from '../core/proposal.js';
import { blockTitle, deadlineInfo, SEVERITY_LABEL, whenLabel } from './common.js';

// ---------- Now ----------

export function renderNow(d) {
  const state = app.state;
  const rec = d.rec;
  const zone = tz();
  const session = app.ui.session;
  const studyPlaces = [['', 'Where I last was'], ...state.locations.filter((l) => l.kind !== 'virtual').map((l) => [l.id, l.name])];
  const locSel = h('select', { id: 'now-loc', 'aria-label': 'Where you are', onchange: (e) => setUi({ locationId: e.target.value || null }) }, studyPlaces.map(([v, l]) => h('option', { value: v }, l)));
  locSel.value = app.ui.locationId || '';
  const energy = state.checkins[d.today] || null;
  const energyBtns = h('div', { class: 'seg', role: 'group', 'aria-label': 'Energy check-in' }, [['low', 'Low'], ['ok', 'Okay'], ['high', 'High']].map(([k, l]) => h('button', { type: 'button', class: 'seg-btn', 'aria-pressed': energy === k ? 'true' : 'false', onclick: () => checkIn(k), dataset: { fk: `energy-${k}` } }, l)));

  let main;
  if (session) {
    const t = state.tasks.find((x) => x.id === session.taskId);
    const step = session.stepId ? t?.steps.find((s) => s.id === session.stepId) : null;
    main = h('div', { class: 'now-main' },
      h('p', { class: 'now-kicker' }, `In session since ${fmtTime(session.startedAt, zone)}`),
      h('p', { class: 'now-title' }, step ? step.title : t?.title || 'Session'),
      h('p', { class: 'muted' }, `Planned ${fmtDuration(session.plannedMin)} at ${locationName(state, session.locationId)}.`),
      h('div', { class: 'row gap-sm wrap' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => endSession('completed'), dataset: { fk: 'sess-record' } }, 'Record progress'),
        h('button', { type: 'button', class: 'btn', onclick: () => endSession('interrupted') }, 'I was interrupted'),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => openLaunchBrief({ taskId: session.taskId, stepId: session.stepId, minutes: session.plannedMin, locationId: session.locationId, blockId: session.blockId, endsAt: session.startedAt + session.plannedMin * MINUTE }) }, 'Brief'),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => setUi({ session: null }) }, 'Stop without recording')));
  } else if (rec.status === 'in-session' || rec.status === 'upcoming') {
    const b = rec.block;
    main = h('div', { class: 'now-main' },
      h('p', { class: 'now-kicker' }, rec.status === 'upcoming' ? rec.headline : 'Planned right now'),
      h('p', { class: 'now-title' }, blockTitle(state, b)),
      h('p', { class: 'muted' }, rec.status === 'upcoming' ? rec.sub : `${fmtTimeRange(b.start, b.end, zone)} at ${locationName(state, b.locationId)}`),
      h('div', { class: 'row gap-sm wrap' },
        h('button', { type: 'button', class: 'btn btn-primary', dataset: { fk: 'now-start' }, onclick: () => openLaunchBrief({ taskId: b.taskId, stepId: b.stepId, minutes: Math.round((b.end - Math.max(b.start, d.now)) / MINUTE), locationId: b.locationId, blockId: b.id, endsAt: b.end }) }, icon('play', { size: 14 }), 'Open session brief'),
        rec.status === 'in-session' ? h('button', { type: 'button', class: 'btn', onclick: () => openProgressForm({ blockId: b.id }) }, 'Record outcome') : null));
  } else if (rec.pick) {
    const p = rec.pick;
    const alts = rec.options.filter((o) => o.unitId !== p.unitId);
    main = h('div', { class: 'now-main' },
      h('p', { class: 'now-kicker' }, rec.headline),
      h('p', { class: 'now-title' }, p.title),
      h('p', { class: 'now-sub' }, `${fmtDuration(p.minutes)} at ${locationName(state, p.locationId)}`),
      h('ul', { class: 'bullets' }, p.reasons.slice(0, 4).map((r) => h('li', null, r))),
      h('div', { class: 'row gap-sm wrap' },
        h('button', { type: 'button', class: 'btn btn-primary', dataset: { fk: 'now-start' }, onclick: () => openLaunchBrief({ taskId: p.taskId, stepId: p.stepId, minutes: p.minutes, locationId: p.locationId }) }, icon('play', { size: 14 }), 'Start this')),
      alts.length ? h('details', { class: 'now-alts' }, h('summary', null, `Other options (${alts.length})`),
        h('ul', { class: 'plain-list' }, alts.map((o) => h('li', { class: ['alt-row', !o.fits && 'is-nofit'] },
          h('div', null, h('div', { class: 'list-title' }, o.title), h('div', { class: 'muted' }, o.fits ? `Fits: ${fmtDuration(o.minutes)} at ${locationName(state, o.locationId)}. ${o.reasons[0] || ''}` : `Does not fit: ${o.whyNot}`)),
          o.fits ? h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => openLaunchBrief({ taskId: o.taskId, stepId: o.stepId, minutes: o.minutes, locationId: o.locationId }) }, 'Start') : null)))) : null);
  } else {
    main = h('div', { class: 'now-main' },
      h('p', { class: 'now-kicker' }, rec.headline),
      h('p', { class: 'now-title' }, rec.status === 'no-window' ? 'Take a break' : rec.sub),
      rec.status === 'no-window' ? h('p', { class: 'muted' }, rec.sub) : null,
      rec.next ? h('p', null, 'Next realistic window: ', h('strong', null, whenLabel(rec.next.start, rec.next.end, zone, d.today)), '.') : h('p', { class: 'muted' }, 'No free study window in the next two days.'),
      rec.nextSession ? h('p', { class: 'muted' }, `Next planned session: ${blockTitle(state, rec.nextSession)}, ${whenLabel(rec.nextSession.start, rec.nextSession.end, zone, d.today)}.`) : null,
      rec.status === 'no-window' && rec.options?.length ? h('details', { class: 'now-alts' }, h('summary', null, 'Why nothing fits'),
        h('ul', { class: 'plain-list' }, rec.options.slice(0, 6).map((o) => h('li', { class: 'alt-row is-nofit' }, h('div', null, h('div', { class: 'list-title' }, o.title), h('div', { class: 'muted' }, o.whyNot || 'Fits, but the window is too short to be useful.')))))) : null);
  }
  return h('section', { class: 'panel now', 'aria-labelledby': 'now-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'now-h' }, 'What now'), h('span', { class: 'muted' }, `${app.mode === 'demo' ? 'Demo time ' : ''}${fmtTime(d.now, zone)}`)),
    main,
    h('div', { class: 'now-context' },
      h('label', { class: 'field-label', for: 'now-loc' }, 'I am at'), locSel,
      h('span', { class: 'field-label' }, 'Energy'), energyBtns),
    energy === 'low' ? h('p', { class: 'muted small' }, 'Low energy steers suggestions to lighter work. It never changes your plan by itself. A lighter-day option appears when you plan.') : null);
}

// ---------- Tasks ----------

export function renderTasks(d, { onAdd = openTaskForm } = {}) {
  const state = app.state;
  const filter = app.ui.taskFilter || 'open';
  const coverage = d.analysis.coverage;
  const suggestions = new Set(calibrationSuggestions(state).map((s) => s.taskId));
  const robust = app.stressCache && app.stressCache.key === d.stressKey ? new Map(app.stressCache.result.tasks.map((t) => [t.taskId, t.status])) : new Map();
  const open = state.tasks.filter((t) => t.status !== 'done').map((t) => ({ t, dl: deadlineInfo(t, state.settings, d.now) })).sort((a, b) => a.dl.ms - b.dl.ms);
  const done = state.tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const soon = d.now + 48 * 3600000;
  const groups = filter === 'done' ? [['Done', done.map((t) => ({ t, dl: deadlineInfo(t, state.settings, d.now) }))]] : [
    ['Overdue', open.filter((x) => x.dl.overdue)],
    ['Due in the next 48 hours', open.filter((x) => !x.dl.overdue && x.dl.ms <= soon)],
    ['Later', open.filter((x) => x.dl.ms > soon)],
  ];
  const row = ({ t, dl }) => {
    const c = coverage.get(t.id);
    const rem = taskRemaining(t);
    const pct = c && c.remaining ? Math.min(100, (c.planned / c.remaining) * 100) : 100;
    const rs = robust.get(t.id);
    const rsLabel = { fragile: 'Fragile', tight: 'Tight', uncovered: 'Not covered' }[rs];
    return h('li', { class: 'task-with-check' }, h('input', { type: 'checkbox', checked: t.status === 'done', 'aria-label': `Mark ${t.title} ${t.status === 'done' ? 'incomplete' : 'done'}`, onchange: e => setDone(t.id, e.target.checked) }), h('button', { type: 'button', class: ['task', dl.overdue && t.status !== 'done' && 'is-overdue', t.status === 'done' && 'is-done'], onclick: () => openTaskForm(t), dataset: { fk: `task-${t.id}` } },
      h('span', { class: 'task-top' }, h('span', { class: 'task-cat' }, t.category), h('span', { class: 'task-kind' }, TASK_KINDS[t.kind]), t.priority === 'high' ? h('span', { class: 'tag tag-high' }, 'High priority') : null, rsLabel ? h('span', { class: `tag tag-${rs}` }, rsLabel) : null, suggestions.has(t.id) ? h('span', { class: 'tag tag-learn' }, 'Estimate tip') : null),
      h('span', { class: 'task-title' }, t.title),
      t.status === 'done' ? h('span', { class: 'task-meta' }, `Done${t.completedAt ? ` ${fmtDate(msToDate(t.completedAt, tz()))}` : ''}`) : [
        h('span', { class: 'task-meta' }, `${dl.overdue ? 'Overdue: ' : 'Due '}${dl.text}`, h('span', { class: 'muted' }, `, ${dl.rel.replace(/^overdue, due |^due /, '')}`)),
        h('span', { class: 'task-cover' },
          h('span', { class: 'cover-bar', 'aria-hidden': 'true' }, h('span', { class: ['cover-fill', pct < 100 && 'is-short'], style: { width: `${pct}%` } })),
          h('span', null, rem ? `${fmtDuration(c?.planned || 0)} planned of ${fmtDuration(rem)} left` : 'No effort left. Mark it done when finished.')),
      ]));
  };
  const filterSel = h('select', { 'aria-label': 'Show tasks', onchange: (e) => setUi({ taskFilter: e.target.value }) }, [['open', 'Open'], ['done', 'Done']].map(([v, l]) => h('option', { value: v }, l)));
  filterSel.value = filter;
  const any = groups.some(([, list]) => list.length);
  return h('section', { class: 'panel tasks', 'aria-labelledby': 'tasks-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'tasks-h' }, 'Tasks and deadlines'), filterSel,
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => onAdd(), dataset: { fk: 'add-task' } }, icon('plus', { size: 14 }), 'Add task')),
    any ? groups.filter(([, list]) => list.length).map(([label, list]) => h('div', { class: 'task-group' }, h('h3', { class: 'h-sm' }, `${label} (${list.length})`), h('ul', { class: 'task-list' }, list.map(row))))
      : h('p', { class: 'empty' }, filter === 'done' ? 'Nothing finished yet.' : 'No open tasks. Add assignments, exams, readings, or everyday tasks with a deadline and an estimate.'));
}

// ---------- Side panel ----------

const TABS = [['review', 'Review'], ['issues', 'Issues'], ['load', 'Week load'], ['robust', 'Stress test'], ['learn', 'Learning'], ['whatif', 'Try a change']];

export function renderSide(d, { onlyReview = false } = {}) {
  const hasProposal = !!app.state.proposal;
  let tab = onlyReview ? 'review' : app.ui.sideTab;
  if (tab === 'review' && !hasProposal) tab = 'issues';
  const tabs = TABS.filter(([k]) => onlyReview ? k === 'review' : k !== 'review' || hasProposal);
  const count = d.analysis.counts.conflict + d.analysis.counts.warning;
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Planning panels', onkeydown: (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const i = tabs.findIndex(([k]) => k === tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0];
    setUi({ sideTab: next });
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  } }, tabs.map(([k, l]) => h('button', { type: 'button', role: 'tab', id: `tab-${k}`, 'aria-selected': k === tab ? 'true' : 'false', 'aria-controls': 'side-panel', tabindex: k === tab ? '0' : '-1', class: 'tab', onclick: () => setUi({ sideTab: k }) },
    l, k === 'issues' && count ? h('span', { class: 'tab-count' }, String(count)) : null)));
  const body = { review: renderReview, issues: renderIssues, load: renderLoad, robust: renderRobust, learn: renderLearn, whatif: renderWhatIf }[tab](d);
  return h('aside', { class: 'panel side' }, tablist, h('div', { id: 'side-panel', role: 'tabpanel', 'aria-labelledby': `tab-${tab}`, class: 'side-body', dataset: { scroll: 'side' } }, body));
}


function renderReview(d) {
  const state = app.state;
  const p = state.proposal;
  const alt = d.alt;
  const zone = tz();
  const stale = d.staleness;
  const byId = new Map([...state.plan.blocks, ...alt.newBlocks].map((b) => [b.id, b]));
  const item = (b, prefix = '') => h('li', null, h('button', { type: 'button', class: 'linklike', onclick: () => openBlock(b, { proposed: alt.newBlocks.includes(b) }) }, `${prefix}${whenLabel(b.start, b.end, zone, d.today)}: ${blockTitle(state, b)}, ${locationName(state, b.locationId)}`));
  const origin = { plan: 'New proposal', recovery: 'Recovery options', whatif: 'What-if preview' }[p.origin] || 'Proposal';
  const lowEnergy = state.checkins[d.today] === 'low';
  const lightCap = Math.round(state.preferences.maxDailyStudyMin * 0.5 / 5) * 5;
  const lighten = !!p.base?.dayCaps?.[d.today];
  return h('div', { class: 'review' },
    h('div', { class: 'review-head' },
      h('h2', null, origin),
      h('p', { class: 'muted' }, `Generated ${fmtDateTime(p.createdAt, zone)}. Your approved plan is unchanged until you approve.`)),
    stale.stale ? h('div', { class: 'callout callout-conflict', role: 'alert' }, h('strong', null, 'This proposal is out of date'), h('ul', null, stale.reasons.map((r) => h('li', null, r))),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => regenerate() }, 'Regenerate')) : null,
    lowEnergy && p.origin !== 'whatif' ? h('label', { class: 'check callout' }, h('input', { type: 'checkbox', checked: lighten, onchange: (e) => regenerate({ dayCaps: e.target.checked ? { [d.today]: lightCap } : null }) }),
      h('span', null, `Lighten today: at most ${fmtDuration(lightCap)} of study (you checked in with low energy)`)) : null,
    h('div', { class: 'review-actions' },
      h('button', { type: 'button', class: 'btn btn-primary', disabled: stale.stale, onclick: () => approveSelected(), dataset: { fk: 'approve' } }, alt.relaxed ? 'Approve relaxed plan' : 'Approve plan'),
      h('button', { type: 'button', class: 'btn', onclick: () => cancelProposalAction(), dataset: { fk: 'cancel-proposal' } }, 'Cancel proposal')),
    p.alternatives.length > 1 ? h('details', { class: 'plan-alternatives' }, h('summary', null, `Selected: ${alt.label}. Compare other plans`),
      h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Proposal options' }, p.alternatives.map((a) => {
        const m = a.metrics;
        const changes = a.diff.added.length + a.diff.moved.length + a.diff.removed.length;
        const stat = (label, value, warn = false) => h('div', { class: ['opt-stat', warn && 'is-warn'] }, h('dt', null, label), h('dd', null, value));
        return h('label', { class: ['opt', a.id === alt.id && 'is-selected', a.relaxed && 'is-relaxed'] },
          h('span', { class: 'opt-head' }, h('input', { type: 'radio', name: 'alt', checked: a.id === alt.id, onchange: () => selectAlternative(a.id), dataset: { fk: `alt-${a.id}` } }),
            h('span', { class: 'opt-name' }, a.label), a.relaxed ? h('span', { class: 'tag tag-relaxed' }, 'Relaxes your limits') : null,
            h('span', { class: 'opt-changes' }, `${changes} change${changes === 1 ? '' : 's'}`)),
          h('span', { class: 'opt-sum' }, a.summary),
          h('dl', { class: 'opt-stats' },
            stat('Planned', fmtDuration(m.plannedTotalMin)),
            stat('Not placed', m.unplacedMin ? fmtDuration(m.unplacedMin) : 'None', m.unplacedMin > 0),
            stat('Evenings', fmtDuration(m.eveningMin)),
            stat('Busiest day', m.busiest ? `${fmtDate(m.busiest.date).split(', ')[0]}, ${fmtDuration(m.busiest.min)}` : 'None'),
            stat('Least buffer', m.tightest ? fmtDuration(m.tightest.minutes) : 'None')));
      })),
      h('p', { class: 'muted small' }, 'Planned counts all future study sessions under that option. Least buffer is the shortest gap between a task\'s last session and its deadline.')) : null,
    alt.relaxed ? h('div', { class: 'callout callout-warn' }, h('strong', null, 'Relaxes limits you set'), h('p', null, 'This option uses up to 1 hour more study per day and the free time you normally keep. Approve only if that is acceptable this week.')) : null,
    alt.factChanges?.length ? h('div', { class: 'callout callout-warn' }, h('strong', null, 'Approving also changes these facts'), h('ul', null, alt.factChanges.map((f) => h('li', null, f.label)))) : null,
    h('section', null, h('h3', { class: 'h-sm' }, 'What changes'),
      h('p', null, `${plural(alt.diff.added.length, 'session')} added, ${alt.diff.moved.length} moved, ${alt.diff.removed.length} removed, ${alt.diff.unchanged} unchanged.`),
      alt.diff.added.length ? h('details', null, h('summary', null, `Added (${alt.diff.added.length})`), h('ul', { class: 'changes' }, alt.diff.added.map((id) => item(byId.get(id))))) : null,
      alt.diff.moved.length ? h('details', null, h('summary', null, `Moved (${alt.diff.moved.length})`), h('ul', { class: 'changes' }, alt.diff.moved.map((m) => {
        const from = byId.get(m.from);
        const to = byId.get(m.to);
        return h('li', null, h('button', { type: 'button', class: 'linklike', onclick: () => openBlock(to, { proposed: true }) }, `${blockTitle(state, to)}: from ${whenLabel(from.start, from.end, zone, d.today)} to ${whenLabel(to.start, to.end, zone, d.today)}`));
      }))) : null,
      alt.diff.removed.length ? h('details', null, h('summary', null, `Removed (${alt.diff.removed.length})`), h('ul', { class: 'changes' }, alt.diff.removed.map((id) => item(byId.get(id))))) : null),
    h('section', null, h('h3', { class: 'h-sm' }, 'Not placed by this planning attempt'),
      alt.unplaced.length ? h('ul', { class: 'issues' }, alt.unplaced.map((u) => h('li', { class: `issue issue-${u.code === 'overdue' ? 'conflict' : 'warning'}` },
        h('div', { class: 'issue-title' }, `${u.title}: ${fmtDuration(u.minutes)}`), h('p', null, u.text),
        h('div', { class: 'row gap-sm' }, h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => openTaskForm(state.tasks.find((t) => t.id === u.taskId)) }, 'Open task'),
          ['capacity', 'contention'].includes(u.code) ? h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => openPreferences() }, 'Review limits') : null))))
        : h('p', null, 'Everything due inside the planning window fits.'),
      alt.unplaced.length ? h('p', { class: 'muted small' }, 'Another arrangement might still fit this work. To make room: lower the scope of a task, revisit priorities, start earlier, or try a relaxed option. Nothing here changes a deadline.') : null,
      alt.deferred.length ? h('p', { class: 'muted small' }, `${fmtDuration(alt.metrics.deferredMin)} is due after the planning window and will be planned later.`) : null),
    h('details', { class: 'decisions' }, h('summary', null, 'Decisions and assumptions'), reasonList(alt.decisions))); 
}

const ACTION_LABEL = { recover: 'Record and recover', adjust: 'Adjust plan', openTask: 'Open task', openCommitment: 'Open', preferences: 'Preferences', places: 'Places and travel', openBlock: 'Open session' };

export function runIssueAction(i) {
  const s = app.state;
  if (i.action === 'recover') openRecovery();
  else if (i.action === 'adjust') generate('recovery');
  else if (i.action === 'openTask') { const t = s.tasks.find((x) => x.id === i.refs.tasks?.[0]); if (t) openTaskForm(t); }
  else if (i.action === 'openBlock') { const b = s.plan.blocks.find((x) => x.id === i.refs.blocks?.[0]); if (b) openBlock(b); }
  else if (i.action === 'preferences') openPreferences();
  else if (i.action === 'places') openPlaces();
  else if (i.action === 'openCommitment') {
    const occId = i.refs.occurrences?.[0];
    const occ = occId ? app.derivedOccurrences?.find((o) => o.id === occId) : null;
    if (occ) openOccurrence(occ);
    else { const c = s.commitments.find((x) => x.id === i.refs.commitments?.[0]); if (c) openCommitmentForm(c); }
  }
}

function renderIssues(d) {
  const a = d.analysis;
  const state = app.state;
  const drift = a.issues.some((i) => i.kind === 'unrecorded' || i.kind === 'missed');
  const noPlan = !state.plan.blocks.some((b) => b.end > d.now) && state.tasks.some((t) => t.status !== 'done');
  const clusters = deadlineClusters(state, d.now);
  return h('div', { class: 'stack' },
    drift ? h('div', { class: 'callout callout-recover' }, h('strong', null, 'The plan has drifted'), h('p', null, 'Some sessions were missed or are not recorded yet. Recovery starts with the smallest fix.'),
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => openRecovery(), dataset: { fk: 'recover' } }, 'Recover')) : null,
    noPlan ? h('div', { class: 'callout' }, h('strong', null, 'No approved plan yet'), h('p', null, 'Generate a proposal to see how your work fits around your commitments.'),
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => generate('plan') }, 'Plan my week')) : null,
    clusters.length ? h('div', { class: 'callout' }, h('strong', null, 'Deadline cluster'), h('p', null, `${clusters[0].titles.length} deadlines within 48 hours from ${fmtDateTime(clusters[0].start, tz())}: ${clusters[0].titles.join(', ')}.`)) : null,
    a.issues.length ? h('ul', { class: 'issues' }, a.issues.map((i) => h('li', { class: `issue issue-${i.severity}` },
      h('div', { class: 'issue-sev' }, i.severity === 'conflict' ? icon('alert', { size: 13 }) : i.severity === 'warning' ? icon('clock', { size: 13 }) : icon('info', { size: 13 }), SEVERITY_LABEL[i.severity]),
      h('div', { class: 'issue-title' }, i.title), h('p', null, i.detail),
      ACTION_LABEL[i.action] ? h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => runIssueAction(i) }, ACTION_LABEL[i.action]) : null)))
      : h('p', { class: 'empty' }, `No conflicts or gaps in the next ${state.settings.planningHorizonDays} days.`));
}

function renderLoad(d) {
  const state = app.state;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(app.ui.weekStart, i));
  const rows = workloadForDates(state, d.now, dates, d.alt);
  const max = Math.max(state.preferences.maxDailyStudyMin, ...rows.map((r) => Math.max(r.studyApproved, r.studyProposedTotal, r.commitMin)), 1);
  return h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, `Computed from your calendar${d.alt ? ' with the open proposal applied' : ''}. These are scheduling indicators, not a measure of stress or wellbeing.`),
    h('ul', { class: 'load' }, rows.map((r) => {
      const study = d.alt ? r.studyProposedTotal : r.studyApproved;
      return h('li', { class: 'load-day' },
        h('div', { class: 'load-head' }, h('strong', null, fmtDayRelative(r.date, d.today)), h('span', { class: 'muted' }, r.deadlines.length ? plural(r.deadlines.length, 'deadline') : '')),
        h('div', { class: 'load-bars', 'aria-hidden': 'true' },
          h('div', { class: 'lb lb-commit', style: { width: `${(r.commitMin / max) * 100}%` } }),
          h('div', { class: ['lb', 'lb-study', d.alt && 'is-proposed'], style: { width: `${(study / max) * 100}%` } }),
          h('div', { class: 'lb-limit', style: { left: `${(r.limit / max) * 100}%` } })),
        h('p', { class: 'small' }, `Commitments ${fmtDuration(r.commitMin)}. Study ${fmtDuration(study)} of ${fmtDuration(r.limit)}. Longest stretch ${fmtDuration(r.longestStretchMin)}.`),
        r.flags.length ? h('ul', { class: 'flags' }, r.flags.map((f) => h('li', null, icon('alert', { size: 12 }), f.text))) : null);
    })));
}

function renderRobust(d) {
  const state = app.state;
  const hasPlan = state.plan.blocks.some((b) => b.status === 'planned' && b.end > d.now);
  if (!hasPlan) return h('p', { class: 'empty' }, 'Approve a plan first. The robustness check tests the approved plan, not proposals.');
  const cached = app.stressCache && app.stressCache.key === d.stressKey;
  if (!cached) {
    return h('div', { class: 'stack' },
      h('p', null, 'Test how the approved plan holds up if estimates run long, or if you lose one of your next sessions.'),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { stress(); app.render(); }, dataset: { fk: 'run-stress' } }, 'Run robustness check'));
  }
  const r = app.stressCache.result;
  const label = { uncovered: 'Not covered', fragile: 'Fragile', tight: 'Tight', holds: 'Holds' };
  const crit = r.sessions.filter((s) => s.critical);
  return h('div', { class: 'stack' },
    h('details', null, h('summary', null, 'Scenarios tested'), h('ul', { class: 'bullets' }, r.assumptions.map((a) => h('li', null, a)))),
    crit.length ? h('section', null, h('h3', { class: 'h-sm' }, `Critical sessions (${crit.length})`),
      h('ul', { class: 'issues' }, crit.map((s) => h('li', { class: 'issue issue-warning' }, h('p', null, s.text),
        h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { const b = state.plan.blocks.find((x) => x.id === s.blockId); if (b) openBlock(b, { fragile: s.text }); } }, 'Open session'))))) : h('p', null, 'No single lost session breaks a deadline among those tested.'),
    h('section', null, h('h3', { class: 'h-sm' }, 'By task'),
      h('ul', { class: 'robust' }, r.tasks.map((t) => h('li', { class: `robust-${t.status}` }, h('div', { class: 'row gap-sm' }, h('span', { class: `tag tag-${t.status}` }, label[t.status]), h('strong', null, t.title)),
        h('ul', { class: 'bullets small' }, t.notes.map((n2) => h('li', null, n2))))))),
    h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { app.stressCache = null; stress(); app.render(); } }, 'Run again'));
}

function renderLearn(d) {
  const state = app.state;
  const groups = calibrationGroups(state);
  const sugg = calibrationSuggestions(state);
  const pctText = (ratio) => {
    const pct = Math.round((ratio - 1) * 100);
    return pct === 0 ? 'matched your estimates' : pct > 0 ? `took ${pct}% longer than estimated` : `took ${-pct}% less time than estimated`;
  };
  const topics = state.revision.topics.slice().sort((a, b) => (a.nextDue || '') < (b.nextDue || '') ? -1 : 1);
  return h('div', { class: 'stack' },
    h('section', null, h('div', { class: 'row space' }, h('h3', { class: 'h-sm' }, 'Estimates'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.settings.calibrationEnabled, onchange: (e) => toggleCalibration(e.target.checked) }), h('span', null, 'Suggest adjustments'))),
      h('p', { class: 'muted small' }, `Compares the original estimate of each finished task with the time you recorded. A group needs ${MIN_SAMPLES} finished tasks before it suggests anything. Work with an interruption is shown but left out, and missed sessions never count as speed.`),
      groups.length ? h('ul', { class: 'cal-groups' }, groups.map((g) => h('li', null,
        h('strong', null, g.label), ': ',
        g.n ? `${g.n} usable, ${g.ratio.toFixed(2)}× your estimate (median; range ${g.min.toFixed(2)}× to ${g.max.toFixed(2)}×)` : 'no usable observations',
        g.excluded ? `, ${g.excluded} left out for interruptions` : '',
        g.enough ? '.' : `. Not enough data yet (${g.n} of ${MIN_SAMPLES}).`))) : h('p', { class: 'empty' }, 'No finished tasks with recorded time yet.'),
      state.settings.calibrationEnabled && sugg.length ? h('ul', { class: 'issues' }, sugg.map((s) => h('li', { class: 'issue issue-info' },
        h('div', { class: 'issue-title' }, s.title), h('p', null, `${s.groupLabel} work ${pctText(s.ratio)} (median of ${s.n}). Suggested remaining: ${fmtDuration(s.to)} instead of ${fmtDuration(s.from)}.`),
        h('div', { class: 'row gap-sm' }, h('button', { type: 'button', class: 'btn btn-sm', onclick: () => applyCalibration(s) }, 'Use suggestion'), h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => dismissCalibration(s) }, 'Keep my estimate'))))) : null,
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: async () => { if (await confirmDialog({ title: 'Clear learned history?', message: 'Finished work recorded so far will no longer be used for suggestions. Your tasks and progress records are not deleted.', confirmLabel: 'Clear history' })) clearCalibrationAction(); } }, 'Clear learned history')),
    h('section', null, h('div', { class: 'row space' }, h('h3', { class: 'h-sm' }, 'Revision'), h('button', { type: 'button', class: 'btn btn-sm', onclick: () => openTopicForm() }, icon('plus', { size: 14 }), 'Add topic')),
      h('p', { class: 'muted small' }, `A simple interval rule, not an optimized algorithm: recall 1 resets to 1 day; otherwise the gap grows by ${Object.entries(FACTOR).map(([k, v]) => `${v}x at ${k}`).join(', ')}. First reviews: ${Object.values(FIRST_INTERVAL).join(', ')} days. Each due review becomes one ordinary task.`),
      topics.length ? h('ul', { class: 'plain-list' }, topics.map((t) => h('li', { class: 'list-row' },
        h('div', null, h('div', { class: 'list-title' }, t.title), h('div', { class: 'muted small' }, `${t.category}. Last recall ${t.confidence}, ${CONFIDENCE_LABELS[t.confidence]}. Next review ${t.nextDue ? fmtDayRelative(t.nextDue, d.today) : 'not set'}${t.intervalDays ? ` (every ${plural(t.intervalDays, 'day')})` : ''}.`)),
        h('div', { class: 'row gap-sm' }, h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => askConfidence(t.id) }, 'Log review'),
          h('button', { type: 'button', class: 'btn-icon', 'aria-label': `Remove ${t.title}`, onclick: async () => { if (await confirmDialog({ title: 'Remove this topic?', message: `"${t.title}" and its open review task will be removed.`, confirmLabel: 'Remove' })) removeTopicAction(t.id); } }, icon('x', { size: 14 })))))) : h('p', { class: 'empty' }, 'No revision topics. Add topics you want to keep fresh before exams.')));
}

function renderWhatIf(d) {
  const state = app.state;
  const w = app.whatIf || { protectEvenings: false, eveningCutoff: state.preferences.eveningCutoff, maxDaily: state.preferences.maxDailyStudyMin, taskId: '', factor: 1, skip: [], result: null };
  app.whatIf = w;
  const open = state.tasks.filter((t) => t.status !== 'done' && taskRemaining(t) > 0);
  const opts = optionalOccurrences(7);
  const read = (form) => {
    w.protectEvenings = form.elements.wiEve.checked;
    w.eveningCutoff = parseClockInput(form.elements.wiEveAt.value) ?? state.preferences.eveningCutoff;
    const md = Number(form.elements.wiMax.value) * 60;
    w.maxDaily = Number.isFinite(md) ? Math.max(0, Math.min(960, Math.round(md))) : state.preferences.maxDailyStudyMin;
    w.taskId = form.elements.wiTask.value;
    w.factor = Number(form.elements.wiFactor.value);
    w.skip = opts.filter((o) => form.elements[`wi-skip-${o.id}`]?.checked).map((o) => o.id);
  };
  const taskSel = h('select', { name: 'wiTask', id: 'wi-task' }, [h('option', { value: '' }, 'Choose a task (optional)'), ...open.map((t) => h('option', { value: t.id }, t.title))]);
  taskSel.value = w.taskId;
  const factorSel = h('select', { name: 'wiFactor', id: 'wi-factor' }, [[0.75, '75% of the estimate'], [1, 'Unchanged'], [1.25, '125%'], [1.5, '150%']].map(([v, l]) => h('option', { value: String(v) }, l)));
  factorSel.value = String(w.factor);
  const form = h('form', { class: 'form whatif', novalidate: true, onsubmit: (e) => { e.preventDefault(); read(form); w.result = runWhatIf(w); app.render(); } },
    h('p', { class: 'muted small' }, 'Try a change without touching your plan. Preview it as a proposal if you like the result.'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'wiEve', checked: w.protectEvenings }), h('span', null, 'Protect evenings after')),
    h('input', { type: 'time', name: 'wiEveAt', step: 300, value: toClockInput(w.eveningCutoff), 'aria-label': 'Evenings start at' }),
    h('label', { class: 'field-label', for: 'wi-max' }, 'Daily study limit (hours)'), h('input', { type: 'number', id: 'wi-max', name: 'wiMax', min: 0, max: 16, step: 0.25, value: w.maxDaily / 60 }),
    h('label', { class: 'field-label', for: 'wi-task' }, 'Change a task estimate'), h('div', { class: 'row gap-sm wrap' }, taskSel, h('label', { class: 'sr-only', for: 'wi-factor' }, 'Estimate change'), factorSel),
    opts.length ? h('fieldset', { class: 'fieldset' }, h('legend', null, 'Skip optional commitments (next 7 days)'),
      h('div', { class: 'checks checks-col' }, opts.map((o) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name: `wi-skip-${o.id}`, checked: w.skip.includes(o.id) }), h('span', null, `${o.title}, ${fmtDate(o.date)} ${fmtTime(o.startMs, tz())}`)))))
      : h('p', { class: 'muted small' }, 'Mark a commitment as optional to try skipping it here.'),
    h('button', { type: 'submit', class: 'btn btn-primary', dataset: { fk: 'run-whatif' } }, 'Run what-if'));
  let result = null;
  if (w.result) {
    const a = w.result.alt.metrics;
    const b = w.result.baseline.metrics;
    const rowM = (label, x, y, fmt = fmtDuration) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, fmt(y)), h('td', null, fmt(x)));
    result = h('section', { class: 'stack' },
      h('h3', { class: 'h-sm' }, 'Result'),
      h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', { scope: 'col' }, 'Balanced now'), h('th', { scope: 'col' }, 'With your changes'))),
        h('tbody', null,
          rowM('Placed', a.placedMin, b.placedMin), rowM('Not placed', a.unplacedMin, b.unplacedMin), rowM('Evening study', a.eveningMin, b.eveningMin),
          rowM('Busiest day', a.busiest?.min || 0, b.busiest?.min || 0), rowM('Sessions', a.sessions, b.sessions, String))),
      w.result.alt.unplaced.length ? h('ul', { class: 'bullets small' }, w.result.alt.unplaced.map((u) => h('li', null, `${u.title}: ${fmtDuration(u.minutes)} not placed. ${u.text}`))) : h('p', null, 'Everything due in the planning window fits with these changes.'),
      w.result.alt.factChanges.length ? h('p', { class: 'muted small' }, `Previewing as a proposal keeps these as pending changes, applied only if you approve: ${w.result.alt.factChanges.map((f) => f.label).join('; ')}.`) : null,
      w.result.notes.map((n2) => h('p', { class: 'muted small' }, n2)),
      h('button', { type: 'button', class: 'btn', onclick: () => whatIfToProposal(w.result) }, 'Preview as proposal'));
  }
  return h('div', { class: 'stack' }, form, result);
}

