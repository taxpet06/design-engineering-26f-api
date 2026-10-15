// Scenario-based robustness check of the approved plan. It re-runs the real
// scheduler in "smallest change" mode under two kinds of disruption and reports
// which deadlines stop fitting. These are deterministic what-ifs, not probabilities.

import { generatePlan, CONFIDENCE_MARGIN } from './scheduler.js';
import { deadlineMs, CONFIDENCE } from './model.js';
import { HOUR, MINUTE, fmtDateTime, fmtDuration, fmtTime, fmtDate, msToDate } from './time.js';
import { fingerprint } from './model.js';

const TIGHT_BUFFER_HOURS = 12;

function unplacedByTask(res) {
  const m = new Map();
  for (const u of res.unplaced) m.set(u.taskId, (m.get(u.taskId) || 0) + u.minutes);
  return m;
}

export function stressTest(state, nowMs, { maxSessions = 10, windowHours = 72 } = {}) {
  const tz = state.settings.timezone;
  const opts = { strategy: 'minimal', keepExistingFuture: true };
  const base = generatePlan(state, nowMs, opts);
  const baseU = unplacedByTask(base);
  const horizonEnd = base.endMs;
  const open = state.tasks.filter((t) => t.status !== 'done' && deadlineMs(t, state.settings) > nowMs && deadlineMs(t, state.settings) <= horizonEnd);

  // Scenario 1: estimates run long, by a margin tied to how sure the estimate was.
  const scale = {};
  for (const t of open) scale[t.id] = 1 + CONFIDENCE_MARGIN[t.confidence || 'medium'];
  const over = generatePlan(state, nowMs, { ...opts, estimateScale: scale });
  const overU = unplacedByTask(over);

  // Scenario 2: lose one upcoming session at a time.
  const upcoming = state.plan.blocks.filter((b) => b.status === 'planned' && !b.locked && b.start >= nowMs && b.start < nowMs + windowHours * HOUR)
    .sort((a, b) => a.start - b.start).slice(0, maxSessions);
  const sessions = [];
  for (const b of upcoming) {
    const s2 = { ...state, plan: { ...state.plan, blocks: state.plan.blocks.filter((x) => x.id !== b.id) } };
    const r = generatePlan(s2, nowMs, { ...opts, extraBusy: [[b.start, b.end]] });
    const lost = (unplacedByTask(r).get(b.taskId) || 0) - (baseU.get(b.taskId) || 0);
    const task = state.tasks.find((t) => t.id === b.taskId);
    const repl = r.blocks.filter((x) => x.taskId === b.taskId).sort((a, c) => a.start - c.start)[0];
    sessions.push({
      blockId: b.id, taskId: b.taskId, start: b.start, end: b.end, critical: lost > 0, lostMin: Math.max(0, lost),
      text: lost > 0
        ? `If you lose ${fmtDate(msToDate(b.start, tz))} at ${fmtTime(b.start, tz)}, ${fmtDuration(lost)} of "${task?.title}" no longer fits before its deadline without moving other sessions.`
        : repl ? `Recoverable: the work could move to ${fmtDateTime(repl.start, tz)} without touching other sessions.` : 'Recoverable without changes.',
    });
  }

  const tasks = open.map((t) => {
    const dl = deadlineMs(t, state.settings);
    const notes = [];
    let status = 'holds';
    const baseGap = baseU.get(t.id) || 0;
    if (baseGap > 0) {
      status = 'uncovered';
      notes.push(`${fmtDuration(baseGap)} has no session yet and does not fit in the remaining free time.`);
    }
    const overGap = (overU.get(t.id) || 0) - baseGap;
    const margin = Math.round(CONFIDENCE_MARGIN[t.confidence || 'medium'] * 100);
    if (overGap > 0) { if (status === 'holds') status = 'fragile'; notes.push(`If it takes ${margin}% longer (estimate marked "${CONFIDENCE[t.confidence]}"), ${fmtDuration(overGap)} would not fit before the deadline.`); }
    else notes.push(`Absorbs a ${margin}% overrun in free time before the deadline.`);
    const crit = sessions.filter((s) => s.taskId === t.id && s.critical);
    if (crit.length) { if (status === 'holds') status = 'fragile'; notes.push(`${crit.length} upcoming session${crit.length === 1 ? ' is' : 's are'} critical: losing ${crit.length === 1 ? 'it' : 'one'} breaks the deadline.`); }
    const unit = base.units.filter((u) => u.taskId === t.id);
    const lastEnd = Math.max(0, ...unit.map((u) => u.lastEnd));
    if (status === 'holds' && lastEnd && (dl - lastEnd) / HOUR < TIGHT_BUFFER_HOURS) {
      status = 'tight';
      notes.push(`The last session ends ${fmtDuration((dl - lastEnd) / MINUTE)} before the deadline.`);
    }
    return { taskId: t.id, title: t.title, deadline: dl, status, notes };
  });
  const order = { uncovered: 0, fragile: 1, tight: 2, holds: 3 };
  tasks.sort((a, b) => order[a.status] - order[b.status] || a.deadline - b.deadline);
  return {
    ranAt: nowMs,
    basis: fingerprint(state),
    assumptions: [
      `Overrun scenario: rough-guess estimates run 50% long, fairly-sure ones 25%, confident ones 10%.`,
      `Lost-session scenario: each of your next ${upcoming.length} unlocked sessions (within ${windowHours} hours) is removed one at a time.`,
      'Recovery is tested by placing the lost work into free time without moving any other approved session.',
      'These are scenario checks, not predictions or probabilities.',
    ],
    tasks,
    sessions,
  };
}
