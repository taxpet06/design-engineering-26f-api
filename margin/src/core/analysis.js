// Observable planning issues. Everything here is derived from entered facts and
// the approved plan; nothing is inferred about the student's wellbeing.

import { MINUTE, HOUR, DAY, addDays, msToDate, zonedToMs, fmtDate, fmtTime, fmtTimeRange, fmtDateTime, fmtDuration, fmtClock, overlapMs } from './time.js';
import { expandCommitments } from './recurrence.js';
import { travelBetween, isPhysical, locationName } from './travel.js';
import { deadlineMs, taskRemaining, findDependencyCycle } from './model.js';
import { sleepInterval } from './scheduler.js';
import { futureMinutes } from './proposal.js';

const SEV = { conflict: 0, warning: 1, info: 2 };
export const LONG_STRETCH_MIN = 180;

export function analyze(state, nowMs) {
  const { settings, preferences: prefs } = state;
  const tz = settings.timezone;
  const today = msToDate(nowMs, tz);
  const horizonEnd = zonedToMs(addDays(today, settings.planningHorizonDays), 0, tz);
  const occ = expandCommitments(state.commitments, addDays(today, -1), addDays(today, settings.planningHorizonDays), tz).filter((o) => !o.skipped && o.endMs > nowMs - DAY);
  const issues = [];
  const push = (i) => issues.push(i);

  // Overlapping fixed commitments: both are kept as entered.
  for (let i = 0; i < occ.length; i++) {
    for (let j = i + 1; j < occ.length && occ[j].startMs < occ[i].endMs; j++) {
      const a = occ[i];
      const b = occ[j];
      if (overlapMs(a.startMs, a.endMs, b.startMs, b.endMs) <= 0) continue;
      push({ id: `overlap:${a.id}:${b.id}`, severity: 'conflict', kind: 'overlap', at: b.startMs,
        title: `${a.title} overlaps ${b.title}`,
        detail: `${fmtDate(a.date)}: ${fmtTimeRange(a.startMs, a.endMs, tz)} and ${fmtTimeRange(b.startMs, b.endMs, tz)}. Both are kept exactly as entered. Edit or skip one to resolve it.`,
        refs: { occurrences: [a.id, b.id], commitments: [a.commitmentId, b.commitmentId] }, action: 'openCommitment' });
    }
  }

  // Transitions between consecutive fixed commitments that travel makes impossible or tight.
  const physical = occ.filter((o) => isPhysical(state, o.locationId) && o.type !== 'protected');
  for (let i = 0; i + 1 < physical.length; i++) {
    const a = physical[i];
    const b = physical[i + 1];
    if (msToDate(a.startMs, tz) !== msToDate(b.startMs, tz) || b.startMs < a.endMs) continue;
    const t = travelBetween(state, a.locationId, b.locationId);
    if (t.minutes <= 0) continue;
    const gap = (b.startMs - a.endMs) / MINUTE;
    const est = t.kind === 'fallback' ? ' (fallback estimate)' : '';
    if (gap < t.minutes) {
      push({ id: `transition:${a.id}:${b.id}`, severity: 'conflict', kind: 'transition', at: b.startMs,
        title: `Can't reach ${b.title} in time`,
        detail: `${fmtDate(a.date)}: ${a.title} ends at ${fmtTime(a.endMs, tz)} at ${locationName(state, a.locationId)}; ${b.title} starts at ${fmtTime(b.startMs, tz)} at ${locationName(state, b.locationId)}. That is ${gap} min apart, and travel takes ${t.minutes} min${est}.`,
        refs: { occurrences: [a.id, b.id], commitments: [a.commitmentId, b.commitmentId] }, action: 'openCommitment' });
    } else if (gap < t.minutes + settings.travelBufferMin) {
      push({ id: `tight:${a.id}:${b.id}`, severity: 'warning', kind: 'tight', at: b.startMs,
        title: `Tight walk to ${b.title}`,
        detail: `${fmtDate(a.date)}: ${gap} min between ${a.title} and ${b.title}, for ${t.minutes} min of travel${est} and your ${settings.travelBufferMin} min buffer.`,
        refs: { occurrences: [a.id, b.id], commitments: [a.commitmentId, b.commitmentId] }, action: 'openCommitment' });
    }
  }

  // Commitments inside protected sleep.
  for (const o of occ) {
    if (o.startMs < nowMs - HOUR) continue;
    for (const d of [addDays(o.date, -1), o.date]) {
      const [s, e] = sleepInterval(d, prefs.sleep, tz);
      if (overlapMs(o.startMs, o.endMs, s, e) > 0) {
        push({ id: `sleep:${o.id}:${d}`, severity: 'warning', kind: 'sleep', at: o.startMs, title: `${o.title} overlaps protected sleep`,
          detail: `${fmtDate(o.date)} ${fmtTimeRange(o.startMs, o.endMs, tz)} falls inside your sleep (${fmtClock(prefs.sleep.start)} to ${fmtClock(prefs.sleep.end)}). The commitment is kept; no study is planned there.`,
          refs: { commitments: [o.commitmentId] }, action: 'openCommitment' });
        break;
      }
    }
  }

  // Approved sessions that no longer fit the facts (for example after a commitment was edited).
  const future = state.plan.blocks.filter((b) => b.status === 'planned' && b.end > nowMs);
  for (const b of future) {
    const task = state.tasks.find((t) => t.id === b.taskId);
    const clash = occ.find((o) => o.type !== 'protected' && overlapMs(b.start, b.end, o.startMs, o.endMs) > 0)
      || occ.find((o) => o.type === 'protected' && overlapMs(b.start, b.end, o.startMs, o.endMs) > 0);
    if (clash) push({ id: `blockclash:${b.id}`, severity: 'conflict', kind: 'blockClash', at: b.start, title: `Approved session overlaps ${clash.title}`,
      detail: `${task?.title || 'A session'} on ${fmtDateTime(b.start, tz)} now overlaps ${clash.title}. Adjust the plan to move it.`, refs: { blocks: [b.id] }, action: 'adjust' });
    if (task?.status === 'done') push({ id: `donetask:${b.id}`, severity: 'info', kind: 'doneTask', at: b.start, title: `Session for a finished task`,
      detail: `${task.title} is marked done but still has a session on ${fmtDateTime(b.start, tz)}${b.locked ? ' (locked)' : ''}. Remove it or adjust the plan.`, refs: { blocks: [b.id] }, action: 'openBlock' });
    if (task && task.status !== 'done' && b.end > deadlineMs(task, settings) && !task.lateTarget) push({ id: `afterdl:${b.id}`, severity: 'conflict', kind: 'afterDeadline', at: b.start,
      title: `Session after the deadline: ${task.title}`, detail: `The session on ${fmtDateTime(b.start, tz)} ends after the deadline (${fmtDateTime(deadlineMs(task, settings), tz)}).`, refs: { blocks: [b.id] }, action: 'adjust' });
  }

  // Past sessions without a recorded outcome.
  const unrecorded = state.plan.blocks.filter((b) => b.status === 'planned' && b.end <= nowMs && b.end > nowMs - 7 * DAY).sort((a, b) => a.start - b.start);
  if (unrecorded.length) {
    push({ id: 'unrecorded', severity: 'warning', kind: 'unrecorded', at: unrecorded[0].start,
      title: `${unrecorded.length} past session${unrecorded.length === 1 ? '' : 's'} not recorded`,
      detail: 'Record what happened so remaining work stays accurate. Nothing is assumed done until you say so.', refs: { blocks: unrecorded.map((b) => b.id) }, action: 'recover' });
  }
  const missed = state.plan.blocks.filter((b) => b.status === 'missed' && b.end > nowMs - 3 * DAY);

  // Coverage: does the approved plan hold enough time before each deadline?
  const coverage = new Map();
  for (const t of state.tasks) {
    if (t.status === 'done') continue;
    const dl = deadlineMs(t, settings);
    const remaining = taskRemaining(t);
    const before = futureMinutes(state.plan.blocks, t.id, nowMs, t.lateTarget && dl <= nowMs ? zonedToMs(t.lateTarget, settings.dateOnlyCutoff, tz) : dl);
    const gap = Math.max(0, remaining - before);
    const overdue = dl <= nowMs;
    coverage.set(t.id, { remaining, planned: before, gap, overdue, deadline: dl, inHorizon: dl <= horizonEnd });
    if (overdue && remaining > 0) {
      push({ id: `overdue:${t.id}`, severity: 'conflict', kind: 'overdue', at: dl, title: `Overdue: ${t.title}`,
        detail: `Was due ${fmtDateTime(dl, tz)} with ${fmtDuration(remaining)} left.${t.lateTarget ? ` Planning toward your finish-late-by date, ${fmtDate(t.lateTarget)}.` : ' Set a finish-late-by date to plan it, or mark it done.'}`, refs: { tasks: [t.id] }, action: 'openTask' });
    } else if (!overdue && gap > 0 && dl <= horizonEnd) {
      push({ id: `coverage:${t.id}`, severity: 'warning', kind: 'coverage', at: dl, title: `Not fully planned: ${t.title}`,
        detail: `The approved plan holds ${fmtDuration(before)} of the ${fmtDuration(remaining)} left before ${fmtDateTime(dl, tz)}.`, refs: { tasks: [t.id] }, action: 'adjust' });
    }
  }
  if (missed.length && issues.some((i) => i.kind === 'coverage')) {
    push({ id: 'missed', severity: 'warning', kind: 'missed', at: missed[0].start, title: `${missed.length} recent session${missed.length === 1 ? '' : 's'} missed`,
      detail: 'Their work is still in your remaining effort. Recovery options can re-place it without redoing the whole plan.', refs: { blocks: missed.map((b) => b.id) }, action: 'recover' });
  }

  const cycle = findDependencyCycle(state.tasks.filter((t) => t.status !== 'done'));
  if (cycle) push({ id: 'cycle', severity: 'conflict', kind: 'cycle', at: nowMs, title: 'Task dependencies form a loop',
    detail: `${cycle.map((id) => state.tasks.find((t) => t.id === id)?.title).join(' depends on ')}. None of these can be planned until the loop is removed.`, refs: { tasks: cycle }, action: 'openTask' });

  // Assumptions and uncertainty worth knowing about.
  const dateOnly = state.tasks.filter((t) => t.status !== 'done' && t.deadline.time == null);
  if (dateOnly.length) push({ id: 'dateonly', severity: 'info', kind: 'assumption', at: nowMs, title: `${dateOnly.length} deadline${dateOnly.length === 1 ? ' has' : 's have'} no time`,
    detail: `Treated as due at ${fmtClock(settings.dateOnlyCutoff)} on that date. Change the assumed cutoff in Preferences.`, refs: { tasks: dateOnly.map((t) => t.id) }, action: 'preferences' });
  const noLoc = occ.filter((o) => o.startMs >= nowMs && !o.locationId && o.type !== 'protected');
  if (noLoc.length) {
    const names = [...new Set(noLoc.map((o) => o.title))];
    push({ id: 'noloc', severity: 'info', kind: 'uncertainty', at: nowMs, title: `${names.length} commitment${names.length === 1 ? ' has' : 's have'} no location`,
      detail: `${names.slice(0, 4).join(', ')}${names.length > 4 ? ', and others' : ''}. Travel to and from these is assumed to be zero, which may be optimistic.`, refs: { commitments: [...new Set(noLoc.map((o) => o.commitmentId))] }, action: 'openCommitment' });
  }
  if (!settings.homeLocationId && state.locations.length) push({ id: 'nohome', severity: 'info', kind: 'uncertainty', at: nowMs, title: 'No home place set',
    detail: 'Morning and late-night travel from home is not counted. Set a home place under Places and travel.', refs: {}, action: 'places' });

  issues.sort((a, b) => SEV[a.severity] - SEV[b.severity] || a.at - b.at);
  return { issues, coverage, unrecorded, missed, counts: { conflict: issues.filter((i) => i.severity === 'conflict').length, warning: issues.filter((i) => i.severity === 'warning').length, info: issues.filter((i) => i.severity === 'info').length } };
}

// Per-day workload indicators for a set of dates.
export function workloadForDates(state, nowMs, dates, alt = null) {
  const { settings, preferences: prefs } = state;
  const tz = settings.timezone;
  const occ = expandCommitments(state.commitments, addDays(dates[0], -1), dates[dates.length - 1], tz).filter((o) => !o.skipped);
  const replaced = new Set(alt ? alt.replacedIds : []);
  const approved = state.plan.blocks.filter((b) => b.status !== 'missed');
  const proposed = alt ? alt.newBlocks : [];
  return dates.map((date) => {
    const d0 = zonedToMs(date, 0, tz);
    const d1 = zonedToMs(addDays(date, 1), 0, tz);
    const inDay = (s, e) => overlapMs(s, e, d0, d1) / MINUTE;
    const dayOcc = occ.filter((o) => o.type !== 'protected' && o.type !== 'meal' && inDay(o.startMs, o.endMs) > 0);
    const commitMin = dayOcc.reduce((s, o) => s + inDay(o.startMs, o.endMs), 0);
    const studyBlocks = approved.filter((b) => !(alt && replaced.has(b.id)) && inDay(b.start, b.end) > 0);
    const studyApproved = approved.filter((b) => inDay(b.start, b.end) > 0).reduce((s, b) => s + inDay(b.start, b.end), 0);
    const propBlocks = proposed.filter((b) => inDay(b.start, b.end) > 0);
    const studyProposedTotal = [...studyBlocks, ...propBlocks].reduce((s, b) => s + inDay(b.start, b.end), 0);
    const studyDone = state.plan.blocks.filter((b) => (b.status === 'completed' || b.status === 'partial') && inDay(b.start, b.end) > 0).reduce((s, b) => s + (b.actualMin ?? 0), 0);
    const deadlines = state.tasks.filter((t) => t.status !== 'done' && t.deadline.date === date);
    const effective = alt ? [...studyBlocks, ...propBlocks] : studyBlocks;
    // Longest stretch of commitments and study with gaps shorter than the break length.
    const items = [...dayOcc.map((o) => [o.startMs, o.endMs]), ...effective.map((b) => [b.start, b.end])].sort((a, b) => a[0] - b[0]);
    let longest = 0;
    let cur = null;
    for (const [s, e] of items) {
      if (cur && s - cur[1] < prefs.breakMin * MINUTE) cur[1] = Math.max(cur[1], e);
      else { if (cur) longest = Math.max(longest, cur[1] - cur[0]); cur = [s, e]; }
    }
    if (cur) longest = Math.max(longest, cur[1] - cur[0]);
    const sorted = effective.slice().sort((a, b) => a.start - b.start);
    let backToBack = 0;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start - sorted[i - 1].end < prefs.breakMin * MINUTE) backToBack++;
    const shown = alt ? studyProposedTotal : studyApproved;
    const flags = [];
    if (shown > prefs.maxDailyStudyMin) flags.push({ kind: 'limit', text: `Over your ${fmtDuration(prefs.maxDailyStudyMin)} daily limit` });
    if (longest / MINUTE > Math.max(LONG_STRETCH_MIN, prefs.maxContinuousMin + 60)) flags.push({ kind: 'stretch', text: `${fmtDuration(longest / MINUTE)} without a ${prefs.breakMin} min break` });
    if (backToBack) flags.push({ kind: 'breaks', text: `${backToBack} session${backToBack === 1 ? '' : 's'} without a full break` });
    return { date, commitMin: Math.round(commitMin), studyApproved: Math.round(studyApproved), studyProposedTotal: Math.round(studyProposedTotal), studyDone, deadlines, longestStretchMin: Math.round(longest / MINUTE), backToBack, flags, limit: prefs.maxDailyStudyMin };
  });
}

// Three or more open deadlines within 48 hours.
export function deadlineClusters(state, nowMs) {
  const open = state.tasks.filter((t) => t.status !== 'done').map((t) => ({ t, dl: deadlineMs(t, state.settings) })).filter((x) => x.dl > nowMs).sort((a, b) => a.dl - b.dl);
  const clusters = [];
  for (let i = 0; i < open.length; i++) {
    const group = open.filter((x) => x.dl >= open[i].dl && x.dl - open[i].dl <= 48 * HOUR);
    if (group.length >= 3 && !clusters.some((c) => c.ids.includes(open[i].t.id))) clusters.push({ start: open[i].dl, ids: group.map((x) => x.t.id), titles: group.map((x) => x.t.title) });
  }
  return clusters;
}
