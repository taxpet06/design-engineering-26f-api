// Transparent duration calibration. Compares the original estimate of each finished
// task with the time actually logged for it. Suggestions are offered, never applied
// automatically, and only when a group has enough observations.

import { taskEstimate, taskRemaining, TASK_KINDS } from './model.js';

export const MIN_SAMPLES = 3;
export const SUGGEST_THRESHOLD = 0.15;

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function observations(state) {
  const cleared = state.calibration?.clearedAt ?? -Infinity;
  const out = [];
  for (const t of state.tasks) {
    // Review tasks are short fixed-length blocks; they say little about estimation and are excluded.
    if (t.status !== 'done' || !t.completedAt || t.completedAt <= cleared || t.kind === 'review') continue;
    const logs = state.log.filter((l) => l.taskId === t.id);
    if (!logs.length) continue;
    const estimate = taskEstimate(t);
    if (!estimate) continue;
    const actual = logs.reduce((s, l) => s + l.actualMin, 0);
    if (!actual) continue;
    out.push({
      taskId: t.id, title: t.title, category: t.category, kind: t.kind, estimate, actual,
      ratio: actual / estimate,
      interrupted: logs.some((l) => l.outcome === 'interrupted'),
      completedAt: t.completedAt,
    });
  }
  return out;
}

export function calibrationGroups(state) {
  const obs = observations(state);
  const groups = new Map();
  const add = (key, label, o) => {
    if (!groups.has(key)) groups.set(key, { key, label, all: [], usable: [] });
    const g = groups.get(key);
    g.all.push(o);
    if (!o.interrupted) g.usable.push(o);
  };
  for (const o of obs) {
    add(`ck:${o.category}|${o.kind}`, `${o.category}, ${(TASK_KINDS[o.kind] || o.kind).toLowerCase()}`, o);
    add(`kind:${o.kind}`, `${TASK_KINDS[o.kind] || o.kind}, any course`, o);
  }
  return [...groups.values()].map((g) => {
    const n = g.usable.length;
    const ratios = g.usable.map((o) => o.ratio);
    const ratio = n ? median(ratios) : null;
    return {
      ...g, n, excluded: g.all.length - n, ratio,
      min: n ? Math.min(...ratios) : null, max: n ? Math.max(...ratios) : null,
      enough: n >= MIN_SAMPLES,
      suggests: n >= MIN_SAMPLES && Math.abs(ratio - 1) >= SUGGEST_THRESHOLD,
    };
  }).sort((a, b) => (a.key.startsWith('ck:') === b.key.startsWith('ck:') ? b.n - a.n : a.key.startsWith('ck:') ? -1 : 1));
}

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

// Same course and type takes precedence over the type alone. Groups never mix task types.
export function calibrationSuggestions(state) {
  if (!state.settings.calibrationEnabled) return [];
  const groups = calibrationGroups(state);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const out = [];
  for (const t of state.tasks) {
    if (t.status === 'done' || t.kind === 'review') continue;
    const rem = taskRemaining(t);
    if (!rem) continue;
    const cat = byKey.get(`ck:${t.category}|${t.kind}`);
    const kind = byKey.get(`kind:${t.kind}`);
    const g = cat?.enough ? cat : kind?.enough ? kind : null;
    if (!g || !g.suggests) continue;
    const to = round5(rem * g.ratio);
    if (to === rem) continue;
    const dismissKey = `${t.id}:${g.key}:${g.n}`;
    if (state.calibration.dismissed?.[dismissKey]) continue;
    if (t.calibratedFrom && t.calibratedFrom.group === g.key && t.calibratedFrom.n === g.n) continue;
    out.push({ taskId: t.id, title: t.title, from: rem, to, group: g.key, groupLabel: g.label, n: g.n, ratio: g.ratio, excluded: g.excluded, dismissKey });
  }
  return out;
}

export function applySuggestion(state, s, nowMs) {
  const next = structuredClone(state);
  const t = next.tasks.find((x) => x.id === s.taskId);
  if (!t) return next;
  const open = t.steps.filter((x) => !x.done);
  if (open.length) {
    const total = open.reduce((a, x) => a + x.remainingMin, 0) || 1;
    let left = s.to;
    open.forEach((x, i) => {
      const v = i === open.length - 1 ? left : Math.round((x.remainingMin / total) * s.to);
      x.remainingMin = Math.max(0, v);
      left -= x.remainingMin;
    });
  } else t.remainingMin = s.to;
  t.calibratedFrom = { from: s.from, to: s.to, group: s.group, n: s.n, at: nowMs };
  return next;
}

export function dismissSuggestion(state, s) {
  const next = structuredClone(state);
  next.calibration.dismissed = { ...next.calibration.dismissed, [s.dismissKey]: true };
  return next;
}

export function clearCalibration(state, nowMs) {
  const next = structuredClone(state);
  next.calibration = { clearedAt: nowMs, dismissed: {} };
  return next;
}
