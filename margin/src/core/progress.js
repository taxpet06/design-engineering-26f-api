// Recording what actually happened. Remaining effort changes only here (or by the
// user editing a task); proposals and approvals never reduce it.

import { taskRemaining, taskEstimate } from './model.js';
import { msToDate } from './time.js';
import { futureMinutes } from './proposal.js';

export const OUTCOMES = {
  completed: 'Done as planned',
  partial: 'Partly done',
  interrupted: 'Interrupted',
  missed: 'Missed',
};

export function validateProgress(state, input) {
  const e = {};
  const task = state.tasks.find((t) => t.id === input.taskId);
  if (!task) { e.task = 'That task no longer exists.'; return e; }
  if (input.stepId && !task.steps.some((s) => s.id === input.stepId)) e.step = 'That step no longer exists.';
  if (!Object.prototype.hasOwnProperty.call(OUTCOMES, input.outcome) && input.outcome !== 'logged') e.outcome = 'Choose what happened.';
  if (input.outcome !== 'missed' && !(Number.isInteger(input.actualMin) && input.actualMin >= 0 && input.actualMin <= 720)) e.actualMin = 'Time spent must be a whole number from 0 to 720 minutes.';
  if (input.outcome !== 'missed' && input.finish !== 'task' && input.finish !== 'step' && !(Number.isInteger(input.remainingAfter) && input.remainingAfter >= 0 && input.remainingAfter <= 6000)) e.remainingAfter = 'Remaining effort must be a whole number from 0 to 6000 minutes.';
  if (input.blockId && !state.plan.blocks.some((b) => b.id === input.blockId)) e.block = 'That session is no longer in the plan.';
  if (input.outcome === 'missed' && input.finish) e.finish = 'A missed session cannot finish a task or step.';
  const block = input.blockId ? state.plan.blocks.find((b) => b.id === input.blockId) : null;
  if (block && (block.taskId !== input.taskId || (block.stepId || null) !== (input.stepId || null))) e.block = 'That session belongs to a different task or step.';
  if (block && block.status !== 'planned') e.block = 'This session already has a recorded outcome. Use Undo to correct the latest entry.';
  return e;
}

export function recordProgress(state, input, nowMs) {
  const errors = validateProgress(state, input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const next = structuredClone(state);
  const task = next.tasks.find((t) => t.id === input.taskId);
  const step = input.stepId ? task.steps.find((s) => s.id === input.stepId) : null;
  const unitBefore = step ? step.remainingMin : task.remainingMin;
  const taskBefore = taskRemaining(task);
  const missed = input.outcome === 'missed';
  const actual = missed ? 0 : input.actualMin;
  let unitAfter = missed ? unitBefore : input.remainingAfter;
  if (input.finish === 'step' || input.finish === 'task') unitAfter = 0;
  if (step) {
    step.remainingMin = unitAfter;
    if (input.finish === 'step') step.done = true;
  } else task.remainingMin = unitAfter;
  if (input.finish === 'task') {
    task.status = 'done';
    task.completedAt = nowMs;
    task.remainingMin = 0;
    for (const s of task.steps) { s.done = true; s.remainingMin = 0; }
  } else if (actual > 0 && task.status === 'todo') task.status = 'in_progress';
  if (input.blockId) {
    const b = next.plan.blocks.find((x) => x.id === input.blockId);
    b.status = input.outcome === 'logged' ? 'completed' : input.outcome;
    b.actualMin = actual;
    b.recordedAt = nowMs;
  }
  next.log.push({
    id: input.id || `log_${nowMs}_${next.log.length}`,
    at: nowMs,
    date: msToDate(nowMs, state.settings.timezone),
    blockId: input.blockId || null,
    taskId: task.id,
    stepId: step ? step.id : null,
    outcome: input.outcome,
    actualMin: actual,
    unitRemainingBefore: unitBefore,
    unitRemainingAfter: step ? step.remainingMin : task.remainingMin,
    taskRemainingBefore: taskBefore,
    taskRemainingAfter: taskRemaining(task),
    focus: input.focus ?? null,
    difficulty: input.difficulty ?? null,
    note: input.note || '',
    finished: input.finish === 'step' || input.finish === 'task' ? input.finish : null,
  });
  return { ok: true, state: next };
}

export function setTaskDone(state, taskId, done, nowMs) {
  const next = structuredClone(state);
  const t = next.tasks.find((x) => x.id === taskId);
  if (!t) return next;
  if (done) {
    t.status = 'done';
    t.completedAt = nowMs;
    t.remainingMin = 0;
    for (const s of t.steps) { s.done = true; s.remainingMin = 0; }
  } else {
    t.status = next.log.some((l) => l.taskId === taskId) ? 'in_progress' : 'todo';
    t.completedAt = null;
  }
  return next;
}

// Completed effort (estimate credited by recorded progress) and actual time are tracked
// separately: 90 minutes spent may only move the remaining estimate by 60.
export function taskAccounting(state, task, nowMs, proposalAlt = null, deadline = Infinity) {
  const logs = state.log.filter((l) => l.taskId === task.id);
  const proposedBlocks = proposalAlt ? proposalAlt.newBlocks : [];
  return {
    estimate: taskEstimate(task),
    remaining: taskRemaining(task),
    completedEffort: logs.reduce((s, l) => s + Math.max(0, l.taskRemainingBefore - l.taskRemainingAfter), 0),
    actualMin: logs.reduce((s, l) => s + l.actualMin, 0),
    sessionsRecorded: logs.length,
    approvedFutureMin: futureMinutes(state.plan.blocks, task.id, nowMs),
    approvedBeforeDeadlineMin: futureMinutes(state.plan.blocks, task.id, nowMs, deadline),
    proposedFutureMin: futureMinutes(proposedBlocks, task.id, nowMs),
  };
}
