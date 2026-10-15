// The weekly calendar. Fixed commitments, approved study, proposed study, travel,
// sleep, and recorded sessions are distinguished by shape, border, and a text label,
// never by color alone. Each future study block carries a "margin tail": how far it
// could run over its estimate before colliding with the next thing in the day.

import { h, icon } from './dom.js';
import { app, now, tz } from './app.js';
import { openBlock, openOccurrence, openCommitmentForm, openTaskForm } from './forms.js';
import { addDays, zonedToMs, msToMinuteOfDay, msToDate, fmtTimeRange, fmtDuration, fmtTime, fmtMonthDay, WEEKDAY_SHORT, weekdayOf, MINUTE, fmtClock } from '../core/time.js';
import { expandCommitments } from '../core/recurrence.js';
import { sleepInterval, CONFIDENCE_MARGIN } from '../core/scheduler.js';
import { travelBetween, travelCost, isPhysical, locationName } from '../core/travel.js';
import { deadlineMs } from '../core/model.js';
import { blockTitle, blockStatus, typeLabel } from './common.js';
import { workloadForDates } from '../core/analysis.js';

const START_H = 6;
const END_H = 24;
const PPM = 1;
const top = (min) => (min - START_H * 60) * PPM;

function clipToDay(s, e, d0, d1) { return [Math.max(s, d0), Math.min(e, d1)]; }

function minuteIn(ms, date) {
  const d = msToDate(ms, tz());
  if (d < date) return 0;
  if (d > date) return 1440;
  return msToMinuteOfDay(ms, tz());
}

// Assigns side-by-side lanes to overlapping items so conflicts stay visible.
function layoutLanes(items) {
  const sorted = items.slice().sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const it of cluster) {
      let i = lanes.findIndex((end) => end <= it.s);
      if (i === -1) { i = lanes.length; lanes.push(0); }
      lanes[i] = it.e;
      it.lane = i;
    }
    for (const it of cluster) it.lanes = lanes.length;
    cluster = [];
  };
  for (const it of sorted) {
    if (it.s >= clusterEnd && cluster.length) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return sorted;
}

export function displayBlocks(state, alt) {
  if (!alt) return { blocks: state.plan.blocks.map((b) => ({ b, kind: 'approved' })), ghosts: [] };
  const replaced = new Set(alt.replacedIds);
  const moved = new Set(alt.diff.moved.map((m) => m.from));
  const blocks = [
    ...state.plan.blocks.filter((b) => !replaced.has(b.id)).map((b) => ({ b, kind: 'approved' })),
    ...alt.newBlocks.map((b) => ({ b, kind: 'proposed', added: alt.diff.added.includes(b.id) })),
  ];
  const ghosts = state.plan.blocks.filter((b) => replaced.has(b.id) && !alt.newBlocks.some((n) => n.id === b.id && n.start === b.start)).map((b) => ({ b, kind: 'ghost', moved: moved.has(b.id) }));
  return { blocks, ghosts };
}

export function renderCalendar(d) {
  const state = app.state;
  const n = d.now;
  const zone = tz();
  const weekStart = app.ui.weekStart;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const occ = expandCommitments(state.commitments, addDays(weekStart, -1), dates[6], zone);
  const { blocks, ghosts } = displayBlocks(state, d.alt);
  const load = workloadForDates(state, n, dates, d.alt);
  const fragile = app.stressCache && app.stressCache.key === d.stressKey ? new Map(app.stressCache.result.sessions.filter((s) => s.critical).map((s) => [s.blockId, s.text])) : new Map();
  const prefs = state.preferences;
  const selected = app.ui.selectedDate && dates.includes(app.ui.selectedDate) ? app.ui.selectedDate : (dates.includes(d.today) ? d.today : dates[0]);

  const hours = [];
  for (let hr = START_H; hr < END_H; hr++) hours.push(h('div', { class: 'cal-hour', style: { top: `${top(hr * 60)}px` } }, h('span', null, fmtClock(hr * 60).replace(':00', ''))));
  const gutter = h('div', { class: 'cal-gutter', 'aria-hidden': 'true', style: { height: `${top(END_H * 60)}px` } }, hours);

  const heads = [];
  const cols = [];
  dates.forEach((date, i) => {
    const d0 = zonedToMs(date, 0, zone);
    const d1 = zonedToMs(addDays(date, 1), 0, zone);
    const isToday = date === d.today;
    const wl = load[i];
    const studyShown = d.alt ? wl.studyProposedTotal : wl.studyApproved;
    const pct = Math.min(100, (studyShown / Math.max(1, wl.limit)) * 100);
    const dayLength = Math.round((d1 - d0) / 3600000);
    heads.push(h('div', { class: ['cal-dayhead', isToday && 'is-today', date === selected && 'is-selected'], role: 'columnheader' },
      h('div', { class: 'dh-date' }, h('span', { class: 'dh-wd' }, WEEKDAY_SHORT[weekdayOf(date)]), h('span', { class: 'dh-num' }, String(Number(date.slice(8)))), isToday ? h('span', { class: 'dh-today' }, 'Today') : null),
      h('div', { class: 'ribbon', title: `${fmtDuration(studyShown)} of study${d.alt ? ' with the proposal' : ''}, limit ${fmtDuration(wl.limit)}` },
        h('div', { class: 'ribbon-bar' }, h('div', { class: ['ribbon-fill', studyShown > wl.limit && 'over', d.alt && 'proposed'], style: { width: `${pct}%` } })),
        h('span', { class: 'ribbon-text' }, fmtDuration(studyShown), wl.deadlines.length ? `, ${wl.deadlines.length} due` : '')),
      dayLength !== 24 ? h('div', { class: 'dh-note' }, `Clocks change: ${dayLength}-hour day`) : null));

    const col = h('div', { class: ['cal-col', isToday && 'is-today', date === selected && 'is-selected'], role: 'gridcell', 'aria-label': `${WEEKDAY_SHORT[weekdayOf(date)]} ${fmtMonthDay(date)}`, style: { height: `${top(END_H * 60)}px` } });
    // Availability shading: study hours are light, everything else is muted.
    for (const w of prefs.availability[weekdayOf(date)] || []) {
      col.append(h('div', { class: 'cal-avail', 'aria-hidden': 'true', style: { top: `${Math.max(0, top(w.start))}px`, height: `${(Math.min(w.end, END_H * 60) - Math.max(w.start, START_H * 60)) * PPM}px` } }));
    }
    for (const di of [-1, 0]) {
      const [s, e] = sleepInterval(addDays(date, di), prefs.sleep, zone);
      const [cs, ce] = clipToDay(s, e, d0, d1);
      if (ce <= cs) continue;
      const m0 = Math.max(START_H * 60, minuteIn(cs, date));
      const m1 = Math.min(END_H * 60, minuteIn(ce, date) || (ce >= d1 ? 1440 : 0));
      if (m1 <= m0) continue;
      col.append(h('div', { class: 'cal-sleep', style: { top: `${top(m0)}px`, height: `${(m1 - m0) * PPM}px` } }, h('span', null, 'Sleep')));
    }
    // Items with lanes.
    const items = [];
    for (const o of occ) {
      const [cs, ce] = clipToDay(o.startMs, o.endMs, d0, d1);
      if (ce <= cs) continue;
      items.push({ s: cs, e: ce, type: 'occ', o });
    }
    for (const x of [...blocks, ...ghosts]) {
      const [cs, ce] = clipToDay(x.b.start, x.b.end, d0, d1);
      if (ce <= cs) continue;
      items.push({ s: cs, e: ce, type: 'block', x });
    }
    const physical = items.filter((it) => !(it.type === 'occ' && it.o.skipped) && !(it.type === 'block' && it.x.kind === 'ghost')).sort((a, b) => a.s - b.s);
    const laid = layoutLanes(items.filter((it) => it.type === 'occ' || it.x.kind !== 'ghost'));
    const ghostItems = items.filter((it) => it.type === 'block' && it.x.kind === 'ghost');

    const occupied = physical.map(it => [it.s, it.e]);
    // Travel strips between consecutive physical places, starting the day at home.
    let prevLoc = state.settings.homeLocationId;
    let prevEnd = d0;
    for (const it of physical) {
      const loc = it.type === 'occ' ? it.o.locationId : it.x.b.locationId;
      if (it.type === 'occ' && it.o.type === 'protected') continue;
      if (!isPhysical(state, loc)) continue;
      const t = travelBetween(state, prevLoc, loc);
      if (t.minutes > 0) {
        const endM = minuteIn(it.s, date);
        const startM = Math.max(minuteIn(prevEnd, date), endM - t.minutes - state.settings.travelBufferMin);
        const tight = endM - minuteIn(prevEnd, date) < t.minutes;
        occupied.push([it.s - (t.minutes + state.settings.travelBufferMin) * MINUTE, it.s]);
        if (endM > START_H * 60 && endM - startM >= 3) {
          col.append(h('div', { class: ['cal-travel', t.kind === 'fallback' && 'is-estimate', tight && 'is-tight'], style: { top: `${top(Math.max(START_H * 60, startM))}px`, height: `${Math.max(6, (endM - Math.max(START_H * 60, startM)) * PPM)}px` }, title: `${t.minutes} min to ${locationName(state, loc)}${t.kind === 'fallback' ? ' (estimate, no route entered)' : ''}` },
            (endM - Math.max(START_H * 60, startM)) * PPM >= 13 || tight ? h('span', null, `${tight ? 'Too far: ' : ''}${t.kind === 'fallback' ? '~' : ''}${t.minutes} min to ${locationName(state, loc)}`) : null));
        }
      }
      prevLoc = loc;
      prevEnd = it.e;
    }

    for (const offset of [-1, 0]) occupied.push(sleepInterval(addDays(date, offset), prefs.sleep, zone));
    const free = [];
    for (const w of prefs.availability[weekdayOf(date)] || []) {
      let cursor = zonedToMs(date, Math.max(START_H * 60, w.start), zone);
      const end = zonedToMs(date, Math.min(END_H * 60, w.end), zone);
      for (const [a,b] of occupied.slice().sort((a,b) => a[0]-b[0])) {
        if (b <= cursor || a >= end) continue;
        if (a > cursor) free.push([cursor, Math.min(a,end)]);
        cursor = Math.max(cursor,b);
      }
      if (cursor < end) free.push([cursor,end]);
    }
    const freeMin = free.reduce((sum,[a,b]) => sum + (b-a)/MINUTE, 0);
    heads[heads.length-1].append(h('div', { class: 'day-margin' }, `${fmtDuration(freeMin)} free`));
    for (const [a,b] of free) {
      const minutes = (b-a)/MINUTE;
      if (minutes < 20) continue;
      col.append(h('div', { class: 'free-window', style: { top: `${top(minuteIn(a,date))}px`, height: `${minutes*PPM}px` } }, `${Math.round(minutes)} min free`));
    }
    for (const it of laid) {
      const m0 = Math.max(START_H * 60, minuteIn(it.s, date));
      const m1 = Math.min(END_H * 60, minuteIn(it.e, date) || (it.e >= d1 ? 1440 : 0));
      if (m1 <= m0) continue;
      const style = { top: `${top(m0)}px`, height: `${Math.max(14, (m1 - m0) * PPM - 2)}px`, left: `calc(${(it.lane / it.lanes) * 100}% + 2px)`, width: `calc(${100 / it.lanes}% - 4px)` };
      const px = (m1 - m0) * PPM;
      const compact = px < 46 ? 'ev-compact' : px < 76 ? 'ev-medium' : null;
      if (it.type === 'occ') { const node = renderOccurrence(it.o, style, compact); if (it.lanes > 1) { node.classList.add('has-conflict'); node.title = 'Overlapping events: ' + it.o.title; } col.append(node); }
      else col.append(...renderBlock(state, it.x, style, compact, n, fragile, physical, date, d1, top(m0) + Math.max(14, (m1 - m0) * PPM - 2)));
    }
    for (const it of ghostItems) {
      const m0 = Math.max(START_H * 60, minuteIn(it.s, date));
      const m1 = Math.min(END_H * 60, minuteIn(it.e, date) || 1440);
      if (m1 <= m0) continue;
      col.append(...renderBlock(state, it.x, { top: `${top(m0)}px`, height: `${Math.max(14, (m1 - m0) * PPM - 2)}px`, left: '2px', width: 'calc(100% - 4px)' }, (m1 - m0) * PPM < 46 ? 'ev-compact' : 'ev-medium', n, fragile, physical, date, d1, 0));
    }

    const due = state.tasks.filter(t => t.status !== 'done' && t.deadline.date === date);
    if (due.length) heads[heads.length-1].append(h('button', { type:'button', class:'cal-deadline', title:due.map(t => t.title).join('; '), onclick:() => openTaskForm(due[0]), 'aria-label':`${due.length} deadlines on ${date}: ${due.map(t=>t.title).join(', ')}. Open first task.` }, icon('flag', {size:12}), `${due.length} due`));
    if (isToday) {
      const m = msToMinuteOfDay(n, zone);
      if (m >= START_H * 60) col.append(h('div', { class: 'cal-now', style: { top: `${top(m)}px` }, 'aria-hidden': 'true' }, h('span', null, `${app.mode === 'demo' ? 'Demo now' : 'Now'} ${fmtTime(n, zone)}`)));
    }
    col.addEventListener('dblclick', (e) => {
      if (e.target !== col && !e.target.classList.contains('cal-avail')) return;
      openCommitmentForm(null, date);
    });
    cols.push(col);
  });

  const chips = h('div', { class: 'daychips', role: 'tablist', 'aria-label': 'Day' }, dates.map((date) => h('button', {
    type: 'button', role: 'tab', class: ['chip', date === selected && 'is-selected', date === d.today && 'is-today'], 'aria-selected': date === selected ? 'true' : 'false',
    onclick: () => { app.ui.selectedDate = date; app.render(); },
  }, h('span', null, WEEKDAY_SHORT[weekdayOf(date)]), h('strong', null, String(Number(date.slice(8)))))));

  const nowHour = Math.floor(msToMinuteOfDay(n, zone) / 60);
  const startH = Math.max(START_H, Math.min(END_H - 3, nowHour - 1));
  const body = h('div', { class: 'cal-body', dataset: { scroll: 'cal', initial: String(top(startH * 60)) } }, gutter, h('div', { class: 'cal-cols' }, cols));
  return h('section', { class: 'cal', 'aria-label': 'Week calendar' },
    chips,
    h('div', { class: 'cal-head', role: 'row' }, h('div', { class: 'cal-gutter-head', 'aria-hidden': 'true' }), h('div', { class: 'cal-heads' }, heads)),
    body,
    legend(!!d.alt));
}

function renderOccurrence(o, style, compact) {
  const place = locationName(app.state, o.locationId);
  const label = o.skipped ? 'Skipped' : typeLabel(o.type);
  return h('button', {
    type: 'button', class: ['ev', 'ev-fixed', `ev-t-${o.type}`, o.skipped && 'ev-skipped', o.modified && 'ev-modified', compact], style,
    'aria-label': `${label}: ${o.title}, ${fmtTimeRange(o.startMs, o.endMs, tz())}${o.locationId ? `, ${place}` : ''}${o.modified ? ', changed for this date' : ''}`,
    onclick: () => openOccurrence(o),
  },
  h('span', { class: 'ev-kind' }, label, o.modified ? ' (changed)' : ''),
  h('span', { class: 'ev-title' }, o.title),
  compact === 'ev-compact' ? null : h('span', { class: 'ev-meta' }, fmtTimeRange(o.startMs, o.endMs, tz())),
  compact || !o.locationId ? null : h('span', { class: 'ev-meta' }, place));
}

function marginTail(state, b, physical, date, d1) {
  const task = state.tasks.find((t) => t.id === b.taskId);
  if (!task) return null;
  const dur = (b.end - b.start) / MINUTE;
  const overrun = Math.round(dur * (CONFIDENCE_MARGIN[task.confidence] || 0.25));
  const next = physical.filter((it) => it.s >= b.end && !(it.type === 'block' && it.x.b.id === b.id)).sort((a, c) => a.s - c.s)[0];
  const sleepStart = sleepInterval(date, state.preferences.sleep, tz())[0];
  let limitMs = Math.min(sleepStart > b.end ? sleepStart : d1, next ? next.s : Infinity);
  let label = next ? (next.type === 'occ' ? next.o.title : 'your next session') : 'sleep';
  if (next && next.type === 'occ' && isPhysical(state, next.o.locationId)) limitMs -= travelCost(travelBetween(state, b.locationId, next.o.locationId), state.settings) * MINUTE;
  const slack = Math.max(0, Math.round((limitMs - b.end) / MINUTE));
  return { overrun, slack, ok: slack >= overrun, label };
}

function renderBlock(state, x, style, compact, n, fragile, physical, date, d1, bottomPx) {
  const b = x.b;
  const st = blockStatus(b, n);
  const title = blockTitle(state, b);
  let kind;
  if (x.kind === 'proposed') kind = x.added ? 'Proposed' : 'Moved here';
  else if (x.kind === 'ghost') kind = x.moved ? 'Moving' : 'Removed';
  else kind = { planned: 'Study', now: 'Study now', unrecorded: 'Not recorded', completed: 'Done', partial: 'Partly done', interrupted: 'Interrupted', missed: 'Missed' }[st.key] || 'Study';
  const future = b.end > n && b.status === 'planned' && x.kind !== 'ghost';
  const tail = future ? marginTail(state, b, physical, date, d1) : null;
  const frag = fragile.get(b.id);
  const aria = `${kind}: ${title}, ${fmtTimeRange(b.start, b.end, tz())}, ${locationName(state, b.locationId)}${b.locked ? ', locked' : ''}${frag ? ', fragile' : ''}${tail ? (tail.ok ? `, room to run ${tail.overrun} min over` : `, only ${tail.slack} min before ${tail.label}`) : ''}`;
  const el = h('button', {
    type: 'button', style, 'aria-label': aria,
    class: ['ev', x.kind === 'proposed' ? 'ev-proposed' : x.kind === 'ghost' ? 'ev-ghost' : 'ev-study', `ev-s-${st.key}`, b.locked && 'ev-locked', frag && 'ev-fragile', compact],
    onclick: () => openBlock(b, { proposed: x.kind === 'proposed', removed: x.kind === 'ghost', fragile: frag }),
  },
  h('span', { class: 'ev-kind' }, b.locked ? icon('lock', { size: 11 }) : st.key === 'completed' ? icon('check', { size: 11 }) : null, kind, frag ? ', fragile' : ''),
  h('span', { class: 'ev-title' }, x.kind === 'proposed' ? '＋ ' : st.key === 'missed' ? 'Missed: ' : '', title),
  compact === 'ev-compact' ? null : h('span', { class: 'ev-meta' }, compact ? fmtTimeRange(b.start, b.end, tz()) : `${fmtTimeRange(b.start, b.end, tz())}, ${locationName(state, b.locationId)}`));
  let tailEl = null;
  if (tail && tail.overrun > 0) {
    const hpx = tail.ok ? Math.max(4, Math.min(tail.overrun, 90) * PPM) : 3;
    tailEl = h('div', { class: ['tail', tail.ok ? 'tail-ok' : 'tail-tight'], 'aria-hidden': 'true', title: tail.ok ? `Room to run ${tail.overrun} min over` : `Only ${tail.slack} min before ${tail.label}`,
      style: { top: `${bottomPx + 1}px`, height: `${hpx}px`, left: style.left, width: style.width } });
  }
  return [el, tailEl].filter(Boolean);
}

function legend(withProposal) {
  const item = (cls, label) => h('li', null, h('span', { class: `lg ${cls}`, 'aria-hidden': 'true' }), label);
  return h('details', { class: 'legend' }, h('summary', null, 'Legend'),
    h('ul', null,
      item('lg-fixed', 'Classes & events'),
      item('lg-study', 'Study'), item('lg-meal', 'Meals'), item('lg-personal', 'Personal'),
      withProposal ? item('lg-proposed', 'Proposed session (+)') : null,
      withProposal ? item('lg-ghost', 'Previous position (faded)') : null,
      item('lg-done', 'Recorded session (check mark)'),
      item('lg-sleep', 'Protected sleep')),
    h('p', { class: 'muted' }, 'Double-click an empty spot to add a commitment on that day. Every block opens with Enter or a click.'));
}

