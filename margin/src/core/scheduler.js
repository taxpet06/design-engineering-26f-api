// Deterministic scheduling engine. No network, no randomness, no clock reads:
// the caller passes "now". Identical inputs always produce identical plans.
//
// Hard constraints (never relaxed unless the caller passes an explicit `relax` option
// that the user approved): fixed commitments, protected sleep, study availability,
// approved locked sessions, travel before and after each session, breaks between
// sessions, maximum continuous work, daily study limit, deadlines, dependencies,
// required locations and equipment, minimum useful session length.
//
// Soft preferences (influence where work goes): focus hours, preferred locations,
// preferred session length, reserved flexibility time, strategy.

import { MINUTE, HOUR, DAY, addDays, msToDate, msToMinuteOfDay, weekdayOf, zonedToMs, roundUpTo, roundDownTo, fmtDateTime, fmtDate, fmtClock, fmtDuration, fmtTime, overlapMs } from './time.js';
import { expandCommitments } from './recurrence.js';
import { travelBetween, travelCost, isPhysical, locationName } from './travel.js';
import { taskUnits, deadlineMs, unitKey } from './model.js';

const STEP = 5 * MINUTE;
export const PRIORITY_SHIFT = { high: 6 * HOUR, medium: 0, low: -6 * HOUR };
export const CONFIDENCE_MARGIN = { low: 0.5, medium: 0.25, high: 0.1 };

export const STRATEGIES = {
  balanced: { id: 'balanced', label: 'Balanced', summary: 'Spaces each task across the days before its deadline.' },
  early: { id: 'early', label: 'Finish early', summary: 'Places work as soon as possible, leaving later days open.' },
  evenings: { id: 'evenings', label: 'Protect evenings', summary: 'Keeps study out of evenings, even if some work is left unplaced.' },
  minimal: { id: 'minimal', label: 'Smallest change', summary: 'Keeps every approved session where it is and places only work without a session.' },
};

// ---------- Interval helpers ----------

export function subtractIntervals(intervals, cuts) {
  let out = intervals.slice();
  for (const [cs, ce] of cuts) {
    const next = [];
    for (const [s, e] of out) {
      if (ce <= s || cs >= e) { next.push([s, e]); continue; }
      if (cs > s) next.push([s, cs]);
      if (ce < e) next.push([ce, e]);
    }
    out = next;
  }
  return out;
}

function insertSorted(list, item) {
  let i = list.length;
  while (i > 0 && (list[i - 1].start > item.start || (list[i - 1].start === item.start && list[i - 1].end > item.end))) i--;
  list.splice(i, 0, item);
}

export function sleepInterval(date, sleep, tz) {
  if (sleep.start > sleep.end) return [zonedToMs(date, sleep.start, tz), zonedToMs(addDays(date, 1), sleep.end, tz)];
  return [zonedToMs(date, sleep.start, tz), zonedToMs(date, sleep.end, tz)];
}

// Splits plan blocks into history (finished before start), kept (in progress, locked,
// recorded, or everything when keepExistingFuture), and replaceable (future, unlocked, planned).
export function partitionPlan(blocks, startMs, keepExistingFuture = false) {
  const history = [];
  const kept = [];
  const replaceable = [];
  for (const b of blocks) {
    if (b.end <= startMs) history.push(b);
    else if (b.start < startMs || b.locked || b.status !== 'planned' || keepExistingFuture) kept.push(b);
    else replaceable.push(b);
  }
  return { history, kept, replaceable };
}

// ---------- Context ----------

export function buildContext(state, nowMs, opts = {}) {
  const settings = state.settings;
  const tz = settings.timezone;
  const prefs = { ...state.preferences, ...(opts.prefOverrides || {}) };
  const horizonDays = opts.horizonDays ?? settings.planningHorizonDays;
  const startMs = roundUpTo(nowMs, STEP);
  const today = msToDate(nowMs, tz);
  const dates = Array.from({ length: horizonDays }, (_, i) => addDays(today, i));
  const endMs = zonedToMs(addDays(today, horizonDays), 0, tz);
  const skip = new Set(opts.skipOccurrenceIds || []);
  const occurrences = expandCommitments(state.commitments, addDays(today, -1), dates[dates.length - 1], tz)
    .filter((o) => !o.skipped && !skip.has(o.id) && o.endMs > startMs - DAY && o.startMs < endMs + DAY);
  const { history, kept, replaceable } = partitionPlan(state.plan.blocks, startMs, !!opts.keepExistingFuture);
  const homeId = settings.homeLocationId && state.locations.some((l) => l.id === settings.homeLocationId) ? settings.homeLocationId : null;

  const timeline = [];
  for (const o of occurrences) timeline.push({ start: o.startMs, end: o.endMs, kind: o.type === 'protected' ? 'protected' : 'commitment', locationId: o.locationId, label: o.title, ref: o });
  for (let i = -1; i <= horizonDays; i++) {
    const [s, e] = sleepInterval(addDays(today, i), prefs.sleep, tz);
    timeline.push({ start: s, end: e, kind: 'sleep', locationId: homeId, label: 'sleep' });
  }
  for (const b of kept) timeline.push({ start: b.start, end: b.end, kind: 'study', locationId: b.locationId, label: 'a study session', ref: b });
  for (const [s, e] of opts.extraBusy || []) timeline.push({ start: s, end: e, kind: 'blocked', locationId: null, label: 'unavailable time', ref: null });
  timeline.sort((a, b) => a.start - b.start || a.end - b.end);

  const focusOf = (date) => prefs.focusHours.map((w) => [zonedToMs(date, w.start, tz), zonedToMs(date, w.end, tz)]);
  const days = dates.map((date) => {
    let windows = (prefs.availability[weekdayOf(date)] || []).map((w) => [zonedToMs(date, w.start, tz), zonedToMs(date, w.end, tz)]);
    if (opts.protectEveningsAfter != null) {
      const cut = zonedToMs(date, opts.protectEveningsAfter, tz);
      windows = windows.map(([s, e]) => [s, Math.min(e, cut)]);
    }
    windows = windows.map(([s, e]) => [Math.max(s, startMs), e]).filter(([s, e]) => e - s >= STEP).sort((a, b) => a[0] - b[0]);
    return { date, windows, focus: focusOf(date), studyMin: 0, cap: 0, initialCap: 0, freeInitial: [] };
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const b of [...history, ...kept]) {
    if (b.status === 'missed') continue;
    const day = byDate.get(msToDate(b.start, tz));
    if (day) day.studyMin += (b.end - b.start) / MINUTE;
  }
  const ctx = { state, settings, prefs, tz, nowMs, startMs, endMs, today, dates, days, byDate, timeline, occurrences, history, kept, replaceable, homeId, opts, horizonDays };
  const reserve = opts.relax?.useReserve ? 0 : prefs.reserveFlexMin;
  const maxDaily = prefs.maxDailyStudyMin + (opts.relax?.extraDailyMin || 0);
  for (const day of days) {
    day.freeInitial = freeIntervals(ctx, day);
    const freeMin = day.freeInitial.reduce((s, [a, b]) => s + (b - a) / MINUTE, 0);
    const limit = opts.dayCaps?.[day.date] != null ? Math.min(maxDaily, opts.dayCaps[day.date]) : maxDaily;
    day.cap = Math.max(0, Math.min(limit - day.studyMin, freeMin - reserve));
    day.initialCap = day.cap;
  }
  return ctx;
}

export function freeIntervals(ctx, day) {
  if (!day.windows.length) return [];
  const lo = day.windows[0][0];
  const hi = day.windows[day.windows.length - 1][1];
  const cuts = [];
  for (const it of ctx.timeline) {
    if (it.start >= hi) break;
    if (it.end > lo) cuts.push([it.start, it.end]);
  }
  return subtractIntervals(day.windows, cuts).filter(([s, e]) => e - s >= STEP);
}

export function neighbors(ctx, f0, f1) {
  let prev = null;
  let next = null;
  for (const it of ctx.timeline) {
    if (it.start >= f1) { next = it; break; }
    if (it.end <= f0 && (!prev || it.end > prev.end || (it.end === prev.end && it.start > prev.start))) prev = it;
  }
  return { prev, next };
}

// Physical place you are at, at instant t: the latest item ending by t that has a physical
// location. Sleep means home. Virtual items and items without a location are transparent.
export function locationBefore(ctx, t) {
  let best = null;
  for (const it of ctx.timeline) {
    if (it.start >= t) break;
    if (it.end > t) continue;
    if (it.kind === 'sleep' || isPhysical(ctx.state, it.locationId)) {
      if (!best || it.end >= best.end) best = it;
    }
  }
  if (!best || best.kind === 'sleep') return ctx.homeId;
  return best.locationId;
}

// The part of a free interval usable for a session at `locId`, after travel, buffers, and breaks.
export function usableWindow(ctx, f0, f1, nb, locId, fromLocOverride) {
  const { prefs, settings, state } = ctx;
  const prevLoc = fromLocOverride !== undefined ? fromLocOverride : locationBefore(ctx, f0);
  const tin = travelBetween(state, prevLoc, locId);
  const nextLoc = nb.next && isPhysical(state, nb.next.locationId) ? nb.next.locationId : null;
  const tout = nextLoc ? travelBetween(state, locId, nextLoc) : { minutes: 0, kind: 'none' };
  const inCost = travelCost(tin, settings) * MINUTE;
  const outCost = travelCost(tout, settings) * MINUTE;
  let s = f0;
  let e = f1;
  if (nb.prev) s = Math.max(s, nb.prev.end + (nb.prev.kind === 'study' ? Math.max(inCost, prefs.breakMin * MINUTE) : inCost));
  else s = Math.max(s, f0 + inCost);
  if (nb.next) e = Math.min(e, nb.next.start - (nb.next.kind === 'study' ? Math.max(outCost, prefs.breakMin * MINUTE) : outCost));
  return { s: roundUpTo(s, STEP), e: roundDownTo(e, STEP), tin, tout, prevLoc, nextLoc };
}

export function candidateLocations(state, u) {
  let locs;
  if (u.location?.mode === 'required' && u.location.ids.length) locs = state.locations.filter((l) => u.location.ids.includes(l.id));
  else locs = state.locations.filter((l) => l.studyOk && l.kind !== 'virtual');
  const eq = u.equipment || [];
  if (eq.length) locs = locs.filter((l) => eq.every((x) => (l.equipment || []).includes(x)));
  const ids = locs.map((l) => l.id).sort();
  // With no places defined and no requirements, plan without a location.
  if (!ids.length && u.location?.mode !== 'required' && !eq.length && !state.locations.some((l) => l.studyOk)) return [null];
  return ids;
}

// ---------- Units ----------

function blockUnitKey(b, taskById) {
  const t = taskById.get(b.taskId);
  if (!t) return unitKey(b.taskId, b.stepId);
  if (t.steps.length) {
    const open = t.steps.filter((s) => !s.done);
    if (b.stepId && open.some((s) => s.id === b.stepId)) return unitKey(t.id, b.stepId);
    return open.length ? unitKey(t.id, open[0].id) : unitKey(t.id, b.stepId);
  }
  return t.id;
}

function prepareUnits(ctx) {
  const { state, settings, opts, prefs } = ctx;
  const taskById = new Map(state.tasks.map((t) => [t.id, t]));
  const allocated = new Map();
  const keptEnd = new Map();
  for (const b of ctx.kept) {
    const key = blockUnitKey(b, taskById);
    keptEnd.set(key, Math.max(keptEnd.get(key) || 0, b.end));
    if (b.status !== 'planned') continue;
    allocated.set(key, (allocated.get(key) || 0) + (b.end - Math.max(b.start, ctx.startMs)) / MINUTE);
  }
  const units = [];
  for (const t of state.tasks) {
    if (t.status === 'done') continue;
    const dl = deadlineMs(t, settings);
    let latestRaw = dl;
    let overdue = dl <= ctx.nowMs;
    if (overdue && t.lateTarget) {
      const late = zonedToMs(t.lateTarget, settings.dateOnlyCutoff, ctx.tz);
      if (late > ctx.nowMs) { latestRaw = late; overdue = false; }
    }
    const scale = opts.estimateScale?.[t.id] ?? 1;
    for (const x of taskUnits(t)) {
      const remaining = Math.round(x.remaining * scale);
      const alloc = allocated.get(x.unitId) || 0;
      const need = Math.max(0, Math.round(remaining - alloc));
      units.push({
        ...x, task: t, deadline: dl, latestRaw, overdue, lateTarget: t.lateTarget && latestRaw !== dl ? t.lateTarget : null,
        priority: t.priority, focus: t.focus, splittable: t.splittable,
        minSession: Math.max(5, Math.min(t.minSessionMin ?? prefs.minSessionMin, prefs.maxContinuousMin)),
        location: t.location, equipment: t.equipment || [], deps: [], need, totalNeed: need, allocatedKept: alloc,
        keptEnd: keptEnd.get(x.unitId) || 0, blocks: [], unplacedMin: 0, deferredMin: 0, reason: null,
      });
    }
  }
  const byTask = new Map();
  for (const u of units) { if (!byTask.has(u.taskId)) byTask.set(u.taskId, []); byTask.get(u.taskId).push(u); }
  for (const [taskId, list] of byTask) {
    list.forEach((u, i) => {
      if (i > 0) u.deps.push(list[i - 1].unitId);
      else for (const depId of taskById.get(taskId).dependsOn) for (const d of byTask.get(depId) || []) u.deps.push(d.unitId);
    });
  }
  return units;
}

function orderUnits(units) {
  const key = (u) => (u.overdue ? -Infinity : u.latestRaw - (PRIORITY_SHIFT[u.priority] || 0));
  const sorted = units.slice().sort((a, b) => key(a) - key(b) || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0) || a.index - b.index);
  const done = new Set();
  const out = [];
  const pending = sorted.slice();
  while (pending.length) {
    const i = pending.findIndex((u) => u.deps.every((d) => done.has(d)));
    if (i === -1) { for (const u of pending) { u.cycle = true; out.push(u); } break; }
    const [u] = pending.splice(i, 1);
    done.add(u.unitId);
    out.push(u);
  }
  return out;
}

// ---------- Placement ----------

function focusShare(start, end, focus) {
  const total = (end - start) || 1;
  return focus.reduce((s, [a, b]) => s + overlapMs(start, end, a, b), 0) / total;
}

function scoreCandidate(ctx, u, c, want, day) {
  const end = c.start + c.maxLen * MINUTE;
  const share = focusShare(c.start, end, day.focus);
  let score = 0;
  if (u.focus === 'deep') score += 20 * share;
  else if (u.focus === 'light') score -= 6 * share;
  if (u.location?.mode === 'preferred' && u.location.ids.includes(c.loc)) score += 10;
  if (u.focus === 'deep' && c.quiet) score += 6;
  score -= 0.4 * (c.tin.minutes + c.tout.minutes);
  if (c.maxLen < want) score -= 15 * (1 - c.maxLen / want);
  const mod = msToMinuteOfDay(c.start, ctx.tz);
  score -= mod * 0.002;
  if (u.focus === 'deep' && mod >= 21 * 60) score -= 4;
  return score;
}

function findSlot(ctx, u, day, want, minLen) {
  const free = freeIntervals(ctx, day);
  const quietIds = new Set(ctx.state.locations.filter((l) => (l.equipment || []).includes('quiet')).map((l) => l.id));
  let best = null;
  for (const [f0, f1] of free) {
    const lo = Math.max(f0, u.earliest);
    const hi = Math.min(f1, u.latest);
    if (hi - lo < minLen * MINUTE) continue;
    const nb = neighbors(ctx, f0, f1);
    for (const loc of u.locs) {
      const w = usableWindow(ctx, f0, f1, nb, loc);
      const s0 = Math.max(w.s, roundUpTo(lo, STEP));
      const e0 = Math.min(w.e, hi);
      if (e0 - s0 < minLen * MINUTE) continue;
      const starts = [s0];
      if (u.focus === 'deep') for (const [fs] of day.focus) if (fs > s0 && fs + minLen * MINUTE <= e0) starts.push(fs);
      for (const s of starts) {
        const maxLen = Math.min(want, Math.floor((e0 - s) / MINUTE), ctx.prefs.maxContinuousMin, day.cap);
        if (maxLen < minLen) continue;
        const cand = { start: s, maxLen, loc, tin: w.tin, tout: w.tout, prevLoc: w.prevLoc, nextItem: nb.next, prevItem: nb.prev, windowEnd: e0, quiet: quietIds.has(loc) };
        cand.score = scoreCandidate(ctx, u, cand, want, day);
        const better = !best || cand.score > best.score + 1e-9
          || (Math.abs(cand.score - best.score) <= 1e-9 && (cand.start < best.start || (cand.start === best.start && String(cand.loc) < String(best.loc))));
        if (better) best = cand;
      }
    }
  }
  return best;
}

function buildReasons(ctx, u, c, len, sessionLen, dayCount) {
  const { state, settings, tz, prefs } = ctx;
  const r = [];
  if (u.lateTarget) r.push({ type: 'hard', text: `Overdue since ${fmtDateTime(u.deadline, tz)}. Planned before your finish-late-by date, ${fmtDate(u.lateTarget)}.` });
  else r.push({ type: 'hard', text: `Due ${fmtDateTime(u.deadline, tz)}. Every session for it ends before then.` });
  if (u.index > 0) r.push({ type: 'hard', text: `Step ${u.index + 1} of ${u.count}. Starts after the previous step's last session.` });
  else if (u.task.dependsOn.length) {
    const names = u.task.dependsOn.map((id) => state.tasks.find((t) => t.id === id)?.title).filter(Boolean);
    if (names.length) r.push({ type: 'hard', text: `Starts after ${names.map((n) => `"${n}"`).join(' and ')} is planned to finish.` });
  }
  const end = c.start + len * MINUTE;
  const day = ctx.byDate.get(msToDate(c.start, tz));
  const share = focusShare(c.start, end, day.focus);
  const fh = prefs.focusHours.map((w) => `${fmtClock(w.start)} to ${fmtClock(w.end)}`).join(', ');
  if (u.focus === 'deep' && share >= 0.5) r.push({ type: 'soft', text: `Deep-focus work placed in your focus hours (${fh}).` });
  else if (u.focus === 'deep' && fh) r.push({ type: 'soft', text: 'Deep-focus work outside your focus hours: they were taken or unavailable before the deadline.' });
  else if (u.focus === 'light') r.push({ type: 'soft', text: 'Light work, suitable for a shorter gap.' });
  if (c.loc) {
    const name = locationName(state, c.loc);
    if (u.location?.mode === 'required') r.push({ type: 'hard', text: `${name} is required for this task.` });
    else if (u.equipment.length) r.push({ type: 'hard', text: `${name} has the equipment this task needs.` });
    else if (u.location?.mode === 'preferred' && u.location.ids.includes(c.loc)) r.push({ type: 'soft', text: `${name} is one of your preferred places for this task.` });
    else if (u.focus === 'deep' && c.quiet) r.push({ type: 'soft', text: `${name} is marked as a quiet space, which suits deep focus.` });
    if (c.tin.kind === 'same') r.push({ type: 'hard', text: `No travel: you are already at ${name}.` });
    else if (c.tin.minutes > 0) r.push({ type: c.tin.kind === 'fallback' ? 'estimate' : 'hard', text: `${c.tin.minutes} min to get here from ${locationName(state, c.prevLoc)}${c.tin.kind === 'fallback' ? ' (fallback estimate: no route entered)' : ''}, plus ${settings.travelBufferMin} min buffer.` });
    if (c.tout.minutes > 0 && c.nextItem) r.push({ type: c.tout.kind === 'fallback' ? 'estimate' : 'hard', text: `Ends early enough to reach ${c.nextItem.label} at ${locationName(state, c.nextItem.locationId)} (${c.tout.minutes} min${c.tout.kind === 'fallback' ? ', estimated' : ''} plus buffer).` });
  } else r.push({ type: 'estimate', text: 'No study places are set up, so travel is not accounted for.' });
  if (c.prevItem?.kind === 'study' || c.nextItem?.kind === 'study') r.push({ type: 'hard', text: `Keeps at least a ${prefs.breakMin} min break from your other sessions.` });
  if (len < sessionLen && len < u.totalNeed) r.push({ type: 'heuristic', text: `Shorter than the planned ${fmtDuration(sessionLen)} because the free time here ends at ${fmtTime(c.windowEnd, tz)} or the day's study limit was reached.` });
  if (!u.splittable) r.push({ type: 'hard', text: 'Cannot be split, so it gets one unbroken session.' });
  else if (u.totalNeed > len) r.push({ type: 'heuristic', text: `Split into sessions of about ${fmtDuration(sessionLen)} (minimum useful session ${fmtDuration(u.minSession)}).` });
  const strat = ctx.opts.strategy || 'balanced';
  if (strat === 'early') r.push({ type: 'heuristic', text: 'Finish-early option: earliest workable time.' });
  else if (strat === 'minimal') r.push({ type: 'heuristic', text: 'Smallest-change option: fills free time without moving approved sessions.' });
  else if (dayCount > 1) r.push({ type: 'heuristic', text: `Spaced across the ${dayCount} days with study time before the deadline.` });
  return r;
}

function place(ctx, u, c, len, sessionLen, dayCount, placed) {
  const start = c.start;
  const end = start + len * MINUTE;
  const block = {
    id: `${u.unitId}@${start}`, taskId: u.taskId, stepId: u.stepId, start, end, locationId: c.loc,
    status: 'planned', locked: false, origin: 'generated', approvedAt: null, actualMin: null, recordedAt: null,
    reasons: buildReasons(ctx, u, c, len, sessionLen, dayCount),
  };
  insertSorted(ctx.timeline, { start, end, kind: 'study', locationId: c.loc, label: 'a study session', ref: block });
  const day = ctx.byDate.get(msToDate(start, ctx.tz));
  day.cap -= len;
  day.studyMin += len;
  u.blocks.push(block);
  u.need -= len;
  placed.push(block);
  return block;
}

function placeOne(ctx, u, day, sessionLen, dayCount, placed) {
  if (day.cap <= 0) return false;
  const minLen = Math.min(u.need, u.minSession);
  let want = Math.min(u.need, sessionLen);
  if (u.need - want > 0 && u.need - want < u.minSession) want = u.need <= ctx.prefs.maxContinuousMin ? u.need : u.need - u.minSession;
  want = Math.min(want, day.cap);
  if (want < minLen) return false;
  const c = findSlot(ctx, u, day, want, minLen);
  if (!c) return false;
  let len = Math.min(want, c.maxLen);
  const rest = u.need - len;
  if (rest > 0 && rest < u.minSession) {
    // Never leave a leftover shorter than the minimum useful session.
    const alt = u.need - u.minSession;
    if (alt < minLen) return false;
    len = Math.min(len, alt);
  }
  place(ctx, u, c, len, sessionLen, dayCount, placed);
  return true;
}

function placeUnit(ctx, u, strategy, placed) {
  const { prefs } = ctx;
  const days = ctx.days.filter((d) => d.windows.some(([s, e]) => e > u.earliest && s < u.latest));
  if (!u.splittable) {
    if (u.need > prefs.maxContinuousMin) { u.reason = 'tooLong'; return; }
    for (const d of days) {
      if (d.cap < u.need) continue;
      const c = findSlot(ctx, u, d, u.need, u.need);
      if (c) { place(ctx, u, c, u.need, u.need, 1, placed); return; }
    }
    return;
  }
  const pref = Math.min(prefs.preferredSessionMin, prefs.maxContinuousMin);
  const nSess = Math.max(1, Math.ceil(u.need / pref));
  const sessionLen = Math.min(prefs.maxContinuousMin, Math.max(u.minSession, Math.ceil(u.need / nSess / 5) * 5));
  if (strategy === 'early') {
    for (const d of days) {
      while (u.need > 0 && placeOne(ctx, u, d, sessionLen, days.length, placed));
      if (u.need <= 0) break;
    }
    return;
  }
  // Balanced, protect-evenings, and smallest-change: spaced target days first, then fill.
  const D = days.length;
  for (let i = 0; i < nSess && u.need > 0 && D; i++) {
    const target = Math.min(D - 1, Math.floor((i * D) / nSess));
    for (let j = target; j < D; j++) if (placeOne(ctx, u, days[j], sessionLen, D, placed)) break;
  }
  let progress = true;
  while (u.need > 0 && progress) {
    progress = false;
    for (const d of days) {
      if (u.need <= 0) break;
      if (placeOne(ctx, u, d, sessionLen, D, placed)) progress = true;
    }
  }
}

function rawCapacity(ctx, from, to) {
  let total = 0;
  for (const day of ctx.days) {
    let m = 0;
    for (const [s, e] of day.freeInitial) m += overlapMs(s, e, from, to) / MINUTE;
    total += Math.min(m, day.initialCap);
  }
  return Math.round(total);
}

function diagnose(ctx, u, unitMap, orderIndex) {
  const { tz, prefs } = ctx;
  if (u.cycle) return { code: 'cycle', text: 'Its dependencies form a loop, so no order works. Edit the task dependencies.' };
  if (u.overdue) return { code: 'overdue', text: `The deadline passed (${fmtDateTime(u.deadline, tz)}). Overdue work is not placed automatically. Set a finish-late-by date on the task to plan it.` };
  if (u.blockedBy) return { code: 'dependency', text: `Waits on "${u.blockedBy.title}", which this attempt could not fully place.` };
  if (u.reason === 'tooLong') return { code: 'tooLong', text: `Needs one unbroken ${fmtDuration(u.need)} session, longer than your ${fmtDuration(prefs.maxContinuousMin)} limit on continuous work. Allow splitting or raise the limit.` };
  if (u.reason === 'noLocation') {
    const eq = u.equipment.length ? 'the required equipment' : 'the required location';
    return { code: 'noLocation', text: `No place has ${eq}. Check the task's location and equipment, or the places list.` };
  }
  if (u.earliest >= u.latest) return { code: 'depLate', text: 'Its prerequisite is planned to finish after this deadline.' };
  const cap = rawCapacity(ctx, u.earliest, u.latest);
  if (cap < u.totalNeed) return { code: 'capacity', text: `About ${fmtDuration(cap)} is free within your study hours and daily limits before the deadline, short of the ${fmtDuration(u.totalNeed)} needed.` };
  if (!u.splittable) return { code: 'window', text: `No single free window of ${fmtDuration(u.totalNeed)} remained before the deadline after other work was placed.` };
  const rivals = [];
  for (const other of unitMap.values()) {
    if (orderIndex.get(other.unitId) >= orderIndex.get(u.unitId) || other.taskId === u.taskId) continue;
    if (other.blocks.some((b) => b.start < u.latest && b.end > u.earliest) && !rivals.includes(other.task.title)) rivals.push(other.task.title);
  }
  const capped = ctx.days.filter((d) => d.cap < u.minSession && d.windows.some(([s, e]) => e > u.earliest && s < u.latest)).map((d) => fmtDate(d.date));
  let text = 'Free time before the deadline went to work placed first';
  if (rivals.length) text += ` (${rivals.slice(0, 3).map((t) => `"${t}"`).join(', ')}${rivals.length > 3 ? ', and others' : ''})`;
  if (capped.length) text += `, and these days reached your daily limit: ${capped.slice(0, 4).join(', ')}${capped.length > 4 ? ', and more' : ''}`;
  return { code: 'contention', text: `${text}.` };
}

export function generatePlan(state, nowMs, opts = {}) {
  const strategy = opts.strategy || 'balanced';
  const ctxOpts = {
    ...opts,
    strategy,
    keepExistingFuture: strategy === 'minimal' || !!opts.keepExistingFuture,
    protectEveningsAfter: strategy === 'evenings' ? (opts.protectEveningsAfter ?? state.preferences.eveningCutoff) : opts.protectEveningsAfter,
  };
  const ctx = buildContext(state, nowMs, ctxOpts);
  const units = prepareUnits(ctx);
  const ordered = orderUnits(units);
  const unitMap = new Map(ordered.map((u) => [u.unitId, u]));
  const orderIndex = new Map(ordered.map((u, i) => [u.unitId, i]));
  const placed = [];
  const unplaced = [];
  const deferred = [];
  for (const u of ordered) {
    if (u.need <= 0) continue;
    let earliest = ctx.startMs;
    if (!u.cycle) {
      for (const dId of u.deps) {
        const d = unitMap.get(dId);
        if (!d) continue;
        if (d.unplacedMin > 0 || d.blockedBy || d.cycle) { u.blockedBy = d.task.title === u.task.title ? { title: d.stepTitle || d.title } : { title: d.task.title }; break; }
        const lastEnd = Math.max(d.keptEnd, ...d.blocks.map((b) => b.end), 0);
        earliest = Math.max(earliest, lastEnd);
      }
    }
    u.earliest = earliest;
    u.latest = Math.min(u.latestRaw, ctx.endMs);
    if (!u.cycle && !u.overdue && !u.blockedBy && u.latest > u.earliest) {
      u.locs = candidateLocations(state, u);
      if (!u.locs.length) u.reason = 'noLocation';
      else placeUnit(ctx, u, strategy, placed);
    }
    if (u.need > 0) {
      const beyond = u.latestRaw > ctx.endMs && !u.overdue && !u.blockedBy && !u.cycle && u.reason == null;
      if (beyond) {
        u.deferredMin = u.need;
        deferred.push({ unitId: u.unitId, taskId: u.taskId, stepId: u.stepId, title: u.title, minutes: u.need, text: `Due after the ${ctx.horizonDays}-day planning window. The rest is planned as the date gets closer.` });
      } else {
        u.unplacedMin = u.need;
        const d = diagnose(ctx, u, unitMap, orderIndex);
        unplaced.push({ unitId: u.unitId, taskId: u.taskId, stepId: u.stepId, title: u.title, minutes: u.need, code: d.code, text: d.text });
      }
    }
  }
  placed.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  return {
    strategy, startMs: ctx.startMs, endMs: ctx.endMs, horizonDays: ctx.horizonDays, today: ctx.today,
    blocks: placed, kept: ctx.kept, history: ctx.history, replaceable: ctx.replaceable,
    unplaced, deferred,
    decisions: buildDecisions(ctx, placed, opts),
    metrics: computeMetrics(ctx, placed, ordered, unplaced, deferred),
    units: ordered.map((u) => ({ unitId: u.unitId, taskId: u.taskId, stepId: u.stepId, need: u.totalNeed, placed: u.blocks.reduce((s, b) => s + (b.end - b.start) / MINUTE, 0), unplaced: u.unplacedMin, deferred: u.deferredMin, deadline: u.deadline, lastEnd: Math.max(u.keptEnd, ...u.blocks.map((b) => b.end), 0) })),
  };
}

function buildDecisions(ctx, placed, opts) {
  const { prefs, tz, settings, state } = ctx;
  const out = [];
  const last = ctx.dates[ctx.dates.length - 1];
  out.push({ type: 'hard', text: `Plans from ${fmtDateTime(ctx.startMs, tz)} through ${fmtDate(last)} (${ctx.horizonDays}-day window).` });
  out.push({ type: 'hard', text: `Respects sleep (${fmtClock(prefs.sleep.start)} to ${fmtClock(prefs.sleep.end)}), your study hours, fixed commitments, travel, ${prefs.breakMin} min breaks between sessions, and at most ${fmtDuration(prefs.maxContinuousMin)} per session.` });
  const extra = opts.relax?.extraDailyMin || 0;
  out.push({ type: extra ? 'relaxed' : 'hard', text: `Daily study limit: ${fmtDuration(prefs.maxDailyStudyMin + extra)}${extra ? ` (your limit plus ${fmtDuration(extra)})` : ''}.` });
  if (opts.relax?.useReserve) out.push({ type: 'relaxed', text: 'Uses the flexibility time you normally keep free each day.' });
  else if (prefs.reserveFlexMin) out.push({ type: 'soft', text: `Leaves at least ${fmtDuration(prefs.reserveFlexMin)} of each day's free study time unplanned.` });
  if (ctx.opts.keepExistingFuture) out.push({ type: 'hard', text: 'Keeps every approved session where it is.' });
  else if (ctx.kept.length) out.push({ type: 'hard', text: `Keeps ${ctx.kept.length} locked, in-progress, or recorded session${ctx.kept.length === 1 ? '' : 's'} unchanged.` });
  if (ctx.opts.protectEveningsAfter != null) out.push({ type: 'soft', text: `No study after ${fmtClock(ctx.opts.protectEveningsAfter)} in this option.` });
  if (opts.dayCaps) for (const [d, cap] of Object.entries(opts.dayCaps)) out.push({ type: 'soft', text: `Lighter day on ${fmtDate(d)}: at most ${fmtDuration(cap)} of study.` });
  if (opts.estimateScale) {
    const names = Object.entries(opts.estimateScale).filter(([, f]) => f !== 1).map(([id, f]) => `${state.tasks.find((t) => t.id === id)?.title || id} (${Math.round(f * 100)}% of the estimate)`);
    if (names.length) out.push({ type: 'estimate', text: `Uses adjusted estimates: ${names.join(', ')}.` });
  }
  if (opts.skipOccurrenceIds?.length) out.push({ type: 'soft', text: `Assumes you skip ${opts.skipOccurrenceIds.length} optional commitment occurrence${opts.skipOccurrenceIds.length === 1 ? '' : 's'}.` });
  out.push({ type: 'heuristic', text: 'Work is placed in deadline order. High-priority tasks are treated as due 6 hours sooner and low-priority tasks 6 hours later. This is a heuristic, not a guarantee of the best possible schedule.' });
  const fallbackTrips = placed.reduce((n, b) => n + b.reasons.filter((r) => r.type === 'estimate' && /fallback|estimated/.test(r.text)).length, 0);
  if (fallbackTrips) out.push({ type: 'estimate', text: `${fallbackTrips} trip${fallbackTrips === 1 ? ' uses' : 's use'} the ${settings.unknownTravelFallbackMin} min fallback travel estimate because no time was entered for that route.` });
  if (!ctx.homeId && state.locations.length) out.push({ type: 'estimate', text: 'No home place is set, so travel from home in the morning is not counted.' });
  return out;
}

function computeMetrics(ctx, placed, units, unplaced, deferred) {
  const { tz, prefs } = ctx;
  const future = [...ctx.kept.filter((b) => b.status === 'planned'), ...placed];
  const perDay = new Map();
  let evening = 0;
  let deep = 0;
  let deepFocus = 0;
  for (const b of future) {
    const d = msToDate(b.start, tz);
    const min = (b.end - b.start) / MINUTE;
    perDay.set(d, (perDay.get(d) || 0) + min);
    evening += overlapMs(b.start, b.end, zonedToMs(d, prefs.eveningCutoff, tz), zonedToMs(addDays(d, 1), 0, tz)) / MINUTE;
  }
  const unitById = new Map(units.map((u) => [u.unitId, u]));
  for (const b of placed) {
    const u = unitById.get(b.stepId ? `${b.taskId}:${b.stepId}` : b.taskId);
    if (u?.focus !== 'deep') continue;
    const day = ctx.byDate.get(msToDate(b.start, tz));
    deep += (b.end - b.start) / MINUTE;
    deepFocus += focusShare(b.start, b.end, day.focus) * (b.end - b.start) / MINUTE;
  }
  let busiest = null;
  for (const [date, min] of perDay) if (!busiest || min > busiest.min) busiest = { date, min };
  const byTask = new Map();
  for (const u of units) {
    if (!byTask.has(u.taskId)) byTask.set(u.taskId, { deadline: u.deadline, lastEnd: 0, ok: true, any: false });
    const t = byTask.get(u.taskId);
    t.lastEnd = Math.max(t.lastEnd, u.keptEnd, ...u.blocks.map((b) => b.end));
    if (u.unplacedMin > 0 || u.deferredMin > 0 || u.overdue) t.ok = false;
    if (u.blocks.length || u.keptEnd) t.any = true;
  }
  let tightest = null;
  for (const [taskId, t] of byTask) {
    if (!t.ok || !t.any || t.deadline > ctx.endMs || t.lastEnd === 0) continue;
    const buf = (t.deadline - t.lastEnd) / MINUTE;
    if (!tightest || buf < tightest.minutes) tightest = { taskId, minutes: Math.round(buf) };
  }
  return {
    placedMin: placed.reduce((s, b) => s + (b.end - b.start) / MINUTE, 0),
    plannedTotalMin: Math.round(future.reduce((s, b) => s + (b.end - Math.max(b.start, ctx.startMs)) / MINUTE, 0)),
    unplacedMin: unplaced.filter((x) => x.code !== 'overdue').reduce((s, x) => s + x.minutes, 0),
    overdueMin: unplaced.filter((x) => x.code === 'overdue').reduce((s, x) => s + x.minutes, 0),
    capacityShortMin: unplaced.filter((x) => ['capacity', 'contention', 'window', 'dependency'].includes(x.code)).reduce((s, x) => s + x.minutes, 0),
    deferredMin: deferred.reduce((s, x) => s + x.minutes, 0),
    eveningMin: Math.round(evening),
    busiest,
    tightest,
    deepFocusShare: deep ? deepFocus / deep : null,
    sessions: placed.length,
    daysUsed: new Set(placed.map((b) => msToDate(b.start, tz))).size,
  };
}
