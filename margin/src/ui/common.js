// Labels shared by several views. Keeps vocabulary consistent across the interface.

import { fmtDate, fmtClock, fmtRelative, fmtDuration, fmtTimeRange, msToDate, fmtDayRelative } from '../core/time.js';
import { deadlineMs, COMMITMENT_TYPES } from '../core/model.js';
import { h } from './dom.js';

export function deadlineInfo(task, settings, nowMs) {
  const dl = deadlineMs(task, settings);
  const assumed = task.deadline.time == null;
  const time = assumed ? fmtClock(settings.dateOnlyCutoff) : fmtClock(task.deadline.time);
  const overdue = dl <= nowMs;
  return {
    ms: dl, overdue, assumed,
    text: `${fmtDate(task.deadline.date)}, ${time}${assumed ? ' (assumed)' : ''}`,
    rel: overdue ? `overdue, due ${fmtRelative(dl, nowMs)}` : `due ${fmtRelative(dl, nowMs)}`,
  };
}

export function blockTitle(state, b) {
  const t = state.tasks.find((x) => x.id === b.taskId);
  if (!t) return 'Removed task';
  const step = b.stepId ? t.steps.find((s) => s.id === b.stepId) : null;
  return step ? `${t.title}: ${step.title}` : t.title;
}

export const BLOCK_STATUS = {
  planned: 'Planned', completed: 'Done', partial: 'Partly done', interrupted: 'Interrupted', missed: 'Missed',
};

export function blockStatus(b, nowMs) {
  if (b.status === 'planned' && b.end <= nowMs) return { key: 'unrecorded', label: 'Not recorded' };
  if (b.status === 'planned' && b.start <= nowMs) return { key: 'now', label: 'In progress' };
  return { key: b.status, label: BLOCK_STATUS[b.status] || b.status };
}

export function whenLabel(startMs, endMs, tz, todayDate) {
  return `${fmtDayRelative(msToDate(startMs, tz), todayDate)}, ${fmtTimeRange(startMs, endMs, tz)}`;
}

export function typeLabel(type) { return COMMITMENT_TYPES[type] || 'Commitment'; }

export function minutesRow(label, minutes, note = null) {
  return h('div', { class: 'mrow' }, h('dt', null, label), h('dd', null, fmtDuration(minutes), note ? h('span', { class: 'muted' }, ` ${note}`) : null));
}

export const SEVERITY_LABEL = { conflict: 'Conflict', warning: 'Needs attention', info: 'Assumption' };
