// "What should I do now?" Picks a task that genuinely fits the time before the
// next commitment, accounting for travel, equipment, focus, and deadlines. When
// nothing fits, it says so and points to the next realistic opportunity.

import { buildContext, freeIntervals, neighbors, locationBefore, usableWindow, candidateLocations } from './scheduler.js';
import { MINUTE, HOUR, msToDate, msToMinuteOfDay, roundUpTo, fmtTime, fmtDuration, fmtDateTime, fmtRelative } from './time.js';
import { travelBetween, travelCost, locationName } from './travel.js';
import { taskUnits, deadlineMs, taskRemaining } from './model.js';
import { futureMinutes } from './proposal.js';

const STEP = 5 * MINUTE;
const MIN_WINDOW = 15;

function nextOpenWindow(ctx, afterMs, minMin = 30) {
  for (const day of ctx.days) {
    for (const [s, e] of freeIntervals(ctx, day)) {
      if (e <= afterMs) continue;
      const s2 = Math.max(s, afterMs);
      if (e - s2 >= minMin * MINUTE) return { start: s2, end: e };
    }
  }
  return null;
}

function eligibleUnits(state, nowMs) {
  const out = [];
  for (const t of state.tasks) {
    if (t.status === 'done' || taskRemaining(t) <= 0) continue;
    const blockedBy = t.dependsOn.map((id) => state.tasks.find((x) => x.id === id)).filter((d) => d && d.status !== 'done' && taskRemaining(d) > 0);
    const units = taskUnits(t);
    if (!units.length) continue;
    out.push({ ...units[0], task: t, blockedBy, nextStep: units[1] || null });
  }
  return out;
}

export function recommendNow(state, nowMs, { locationId = null, energy = null, windowMin = null, onlyTaskId = null } = {}) {
  const { settings, preferences: prefs } = state;
  const tz = settings.timezone;
  const ctx = buildContext(state, nowMs, { horizonDays: 2, keepExistingFuture: true });
  const today = msToDate(nowMs, tz);
  const mood = energy || state.checkins?.[today] || null;
  const upcomingSession = state.plan.blocks.filter((b) => b.status === 'planned' && b.start > nowMs).sort((a, b) => a.start - b.start)[0] || null;
  const base = { energy: mood, nextSession: upcomingSession, location: null };

  const inBlock = state.plan.blocks.find((b) => b.status === 'planned' && b.start <= nowMs && b.end > nowMs);
  if (inBlock && !windowMin) {
    const task = state.tasks.find((t) => t.id === inBlock.taskId);
    return { ...base, status: 'in-session', block: inBlock, task, location: inBlock.locationId,
      headline: `Planned now: ${task?.title || 'study session'}`, sub: `Until ${fmtTime(inBlock.end, tz)} at ${locationName(state, inBlock.locationId)}.`, options: [], pick: null };
  }
  const inOcc = ctx.occurrences.find((o) => o.startMs <= nowMs && o.endMs > nowMs);
  const inSleep = ctx.timeline.find((it) => it.kind === 'sleep' && it.start <= nowMs && it.end > nowMs);
  const day0 = ctx.days[0];
  const free = day0 ? freeIntervals(ctx, day0) : [];
  const cur = free.find(([s, e]) => s <= ctx.startMs && e > ctx.startMs);

  if (!cur || inOcc || inSleep) {
    const after = inOcc ? inOcc.endMs : nowMs;
    const next = nextOpenWindow(ctx, after);
    let headline;
    let sub;
    if (inSleep) { headline = 'Protected sleep time'; sub = 'Rest now. Nothing is recommended during sleep.'; }
    else if (inOcc) { headline = `In ${inOcc.title} until ${fmtTime(inOcc.endMs, tz)}`; sub = 'No study recommended during a fixed commitment.'; }
    else { headline = 'Outside your study hours'; sub = 'Take the time off. Your study hours are set in Preferences.'; }
    return { ...base, status: inSleep ? 'resting' : inOcc ? 'busy' : 'off-hours', headline, sub, next, options: [], pick: null, occurrence: inOcc || null };
  }

  const nb = neighbors(ctx, cur[0], cur[1]);
  const here = locationId !== null && locationId !== undefined ? locationId : locationBefore(ctx, nowMs);
  const windowEnd = windowMin ? Math.min(cur[1], ctx.startMs + windowMin * MINUTE) : cur[1];
  const rawMinutes = Math.round((windowEnd - ctx.startMs) / MINUTE);
  const nextLabel = nb.next ? (nb.next.kind === 'sleep' ? 'sleep' : nb.next.kind === 'study' ? 'your next planned session' : nb.next.label) : 'the end of your study hours';
  const nextStart = nb.next && nb.next.start < windowEnd + 1 ? nb.next.start : windowEnd;

  const units = eligibleUnits(state, nowMs).filter((u) => !onlyTaskId || u.taskId === onlyTaskId);
  const dependents = new Map();
  for (const t of state.tasks) for (const d of t.dependsOn) if (t.status !== 'done') dependents.set(d, [...(dependents.get(d) || []), t.title]);

  const options = units.map((u) => {
    const t = u.task;
    const dl = deadlineMs(t, settings);
    const minSession = Math.max(5, Math.min(t.minSessionMin ?? prefs.minSessionMin, prefs.maxContinuousMin));
    const need = u.remaining;
    const minNeeded = Math.min(need, minSession);
    const opt = { unitId: u.unitId, taskId: t.id, stepId: u.stepId, title: u.title, task: t, need, nextStep: u.nextStep, fits: false, reasons: [], whyNot: null, score: -Infinity, minutes: 0, locationId: null, travelMin: 0 };
    if (u.blockedBy.length) { opt.whyNot = `Waits on "${u.blockedBy[0].title}" to be finished first.`; return opt; }
    let bestLoc = null;
    for (const loc of candidateLocations(state, { location: t.location, equipment: t.equipment })) {
      const tin = travelBetween(state, here, loc);
      const s = roundUpTo(ctx.startMs + travelCost(tin, settings) * MINUTE, STEP);
      const w = usableWindow(ctx, cur[0], cur[1], nb, loc, here);
      const e = Math.min(w.e, windowEnd);
      const minutes = Math.min(prefs.maxContinuousMin, Math.max(0, Math.round((e - s) / MINUTE)));
      const cand = { loc, minutes, tin, s };
      if (!bestLoc || cand.minutes - cand.tin.minutes * 0.5 > bestLoc.minutes - bestLoc.tin.minutes * 0.5 || (cand.minutes === bestLoc.minutes && loc === here)) bestLoc = cand;
    }
    if (!bestLoc) { opt.whyNot = 'No place has the location or equipment this task needs.'; return opt; }
    opt.locationId = bestLoc.loc;
    opt.travelMin = bestLoc.tin.minutes;
    if (bestLoc.minutes < minNeeded) {
      const travelNote = bestLoc.tin.minutes ? `, after ${bestLoc.tin.minutes} min to get to ${locationName(state, bestLoc.loc)}` : '';
      opt.whyNot = `Needs at least ${fmtDuration(minNeeded)}${t.focus === 'deep' ? ' of deep focus' : ''}; only ${fmtDuration(bestLoc.minutes)} fit before ${nextLabel}${travelNote}.`;
      return opt;
    }
    opt.fits = true;
    opt.minutes = Math.min(bestLoc.minutes, need, Math.max(prefs.preferredSessionMin, minNeeded));
    opt.sessionStart = bestLoc.s;
    opt.sessionEnd = bestLoc.s + opt.minutes * MINUTE;
    const hoursLeft = (dl - nowMs) / HOUR;
    const overdue = hoursLeft <= 0;
    // Overdue work matters, but its lateness is already sunk; it should not automatically beat work due tomorrow.
    let score = overdue ? 7 : Math.max(0, 12 - hoursLeft / 12);
    opt.reasons.push(overdue ? `Overdue since ${fmtDateTime(dl, tz)}.` : `Due ${fmtDateTime(dl, tz)} (${fmtRelative(dl, nowMs)}).`);
    const planned = futureMinutes(state.plan.blocks, t.id, nowMs, dl);
    const gap = taskRemaining(t) - planned;
    if (gap > 0) { score += 4; opt.reasons.push(`${fmtDuration(gap)} of it has no session in your plan yet.`); }
    score += { high: 4, medium: 2, low: 0 }[t.priority] || 0;
    const mod = msToMinuteOfDay(opt.sessionStart, tz);
    const inFocus = prefs.focusHours.some((w) => mod >= w.start && mod < w.end);
    if (mood === 'low') {
      if (t.focus === 'deep') { score -= 6; opt.reasons.push('Deep focus work, but you checked in with low energy.'); }
      else if (t.focus === 'light') { score += 3; opt.reasons.push('Light work suits your low-energy check-in.'); }
    } else if (t.focus === 'deep' && (inFocus || mood === 'high')) { score += 3; opt.reasons.push(inFocus ? 'Deep work during your focus hours.' : 'Deep work while your energy is high.'); }
    if (t.focus === 'light' && rawMinutes < 50) { score += 2; opt.reasons.push('Light work that fits a short gap.'); }
    if (opt.minutes >= need) { score += 2; opt.reasons.push(`You can finish ${u.stepId ? 'this step' : 'it'} in this window.`); }
    const plannedLater = state.plan.blocks.some((b) => b.taskId === t.id && b.status === 'planned' && b.start > nowMs && msToDate(b.start, tz) === today);
    if (plannedLater) { score += 1; opt.reasons.push('Pulls forward work planned for later today.'); }
    const deps = dependents.get(t.id) || [];
    if (deps.length) { score += 2 * deps.length; opt.reasons.push(`Unblocks ${deps.map((d) => `"${d}"`).join(', ')}.`); }
    score -= bestLoc.tin.minutes / 5;
    opt.reasons.push(`${fmtDuration(opt.minutes)} at ${locationName(state, bestLoc.loc)}${bestLoc.tin.minutes ? ` (${bestLoc.tin.minutes} min away${bestLoc.tin.kind === 'fallback' ? ', estimated' : ''})` : ''}, ending before ${nextLabel} at ${fmtTime(nextStart, tz)}.`);
    opt.score = score;
    return opt;
  });
  options.sort((a, b) => (b.fits - a.fits) || b.score - a.score || (a.taskId < b.taskId ? -1 : 1));
  const pick = options.find((o) => o.fits) || null;
  const usable = rawMinutes;
  const soonBlock = nb.next && nb.next.kind === 'study' && nb.next.ref && nb.next.start - nowMs <= 30 * MINUTE ? nb.next.ref : null;
  if ((usable < MIN_WINDOW || !pick) && soonBlock && !windowMin) {
    const task = state.tasks.find((t) => t.id === soonBlock.taskId);
    const tin = travelBetween(state, here, soonBlock.locationId);
    return { ...base, status: 'upcoming', block: soonBlock, task, location: here,
      headline: `Next planned session at ${fmtTime(soonBlock.start, tz)}`,
      sub: `${locationName(state, soonBlock.locationId)}${tin.minutes ? `, ${tin.minutes} min away${tin.kind === 'fallback' ? ' (estimated)' : ''}` : ''}. Use the gap to get there and get set up.`,
      window: { start: ctx.startMs, end: windowEnd, minutes: usable, nextLabel, nextStart }, options, pick: null };
  }
  if (usable < MIN_WINDOW || !pick) {
    const next = nextOpenWindow(ctx, windowEnd + MINUTE);
    return { ...base, status: 'no-window', location: here,
      headline: usable < MIN_WINDOW ? `Only ${fmtDuration(Math.max(0, usable))} before ${nextLabel}` : `Nothing fits the ${fmtDuration(usable)} before ${nextLabel}`,
      sub: 'No realistic study window right now. Take a break.',
      window: { start: ctx.startMs, end: windowEnd, minutes: usable, nextLabel, nextStart }, options, pick: null, next };
  }
  return { ...base, status: 'window', location: here,
    headline: `${fmtDuration(rawMinutes)} free before ${nextLabel}`,
    sub: `Until ${fmtTime(nextStart, tz)}.`,
    window: { start: ctx.startMs, end: windowEnd, minutes: rawMinutes, nextLabel, nextStart }, options, pick };
}

// A short-on-time fallback: what still fits if only `minutes` are available.
export function fallbackFor(state, nowMs, minutes, opts = {}) {
  return recommendNow(state, nowMs, { ...opts, windowMin: minutes });
}
