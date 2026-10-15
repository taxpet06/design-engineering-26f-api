// Optional revision scheduling with a deliberately simple interval rule.
// It is a heuristic, not a scientifically optimized spaced-repetition algorithm.
//
// Rule: confidence 1 (forgot) resets to 1 day. Otherwise the next interval is the
// previous interval times a factor: 2 -> x1.2, 3 -> x1.8, 4 -> x2.5, 5 -> x3.
// First reviews use 1, 1, 2, 4, 7 days for confidence 1 to 5. Capped at 60 days.

import { addDays } from './time.js';

export const FIRST_INTERVAL = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 7 };
export const FACTOR = { 2: 1.2, 3: 1.8, 4: 2.5, 5: 3 };
export const CONFIDENCE_LABELS = { 1: 'Forgot', 2: 'Shaky', 3: 'Okay', 4: 'Good', 5: 'Solid' };

export function nextInterval(prev, confidence) {
  if (confidence <= 1) return 1;
  if (!prev) return FIRST_INTERVAL[confidence];
  return Math.min(60, Math.max(1, Math.round(prev * FACTOR[confidence])));
}

export function addTopic(state, { id, title, category, reviewMin = 20, confidence = 3 }, today) {
  const next = structuredClone(state);
  const interval = nextInterval(null, confidence);
  next.revision.topics.push({ id, title, category: category || 'General', reviewMin, confidence, intervalDays: interval, lastReviewed: today, nextDue: addDays(today, interval), history: [{ date: today, confidence, intervalDays: interval }] });
  return next;
}

export function logReview(state, topicId, confidence, today, nowMs) {
  const next = structuredClone(state);
  const topic = next.revision.topics.find((t) => t.id === topicId);
  if (!topic) return next;
  const interval = nextInterval(topic.intervalDays, confidence);
  topic.confidence = confidence;
  topic.intervalDays = interval;
  topic.lastReviewed = today;
  topic.nextDue = addDays(today, interval);
  topic.history.push({ date: today, confidence, intervalDays: interval });
  for (const t of next.tasks) {
    if (t.revisionTopicId === topicId && t.status !== 'done') { t.status = 'done'; t.completedAt = nowMs; t.remainingMin = 0; }
  }
  return next;
}

export function removeTopic(state, topicId) {
  const next = structuredClone(state);
  next.revision.topics = next.revision.topics.filter((t) => t.id !== topicId);
  next.tasks = next.tasks.filter((t) => !(t.revisionTopicId === topicId && t.status !== 'done'));
  return next;
}

// Creates at most one open review task per topic whose review falls inside the horizon.
// Review tasks are ordinary tasks, so they go through the normal scheduling constraints.
export function syncReviewTasks(state, today, horizonDays) {
  const last = addDays(today, horizonDays - 1);
  const created = [];
  const next = structuredClone(state);
  for (const topic of next.revision.topics) {
    if (!topic.nextDue || topic.nextDue > last) continue;
    const open = next.tasks.some((t) => t.revisionTopicId === topic.id && t.status !== 'done');
    if (open) continue;
    const due = topic.nextDue < today ? today : topic.nextDue;
    const id = `rev_${topic.id}_${topic.nextDue}`;
    if (next.tasks.some((t) => t.id === id)) continue;
    const task = {
      id, title: `Review: ${topic.title}`, category: topic.category, kind: 'review', priority: 'medium',
      deadline: { date: due, time: null }, estimateMin: topic.reviewMin, remainingMin: topic.reviewMin,
      confidence: 'high', focus: 'normal', location: { mode: 'any', ids: [] }, equipment: [], status: 'todo',
      notes: 'Created from your revision topics. Log the review in Learning to schedule the next one.',
      doneWhen: 'Recalled the key ideas without notes, then checked against them.',
      splittable: false, minSessionMin: null, steps: [], dependsOn: [], lateTarget: null,
      revisionTopicId: topic.id, calibratedFrom: null, createdAt: null, completedAt: null, source: { system: 'revision', id: topic.id },
    };
    next.tasks.push(task);
    created.push(task);
  }
  return { state: created.length ? next : state, created };
}
