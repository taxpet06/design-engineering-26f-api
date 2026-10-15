// Proposals never touch the active plan. Approval re-checks that nothing the
// proposal depended on has changed, then swaps in the new sessions.

import { generatePlan, STRATEGIES } from './scheduler.js';
import { fingerprint, FINGERPRINT_LABELS } from './model.js';
import { withException } from './recurrence.js';
import { MINUTE } from './time.js';

const byStart = (a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const unitOf = (b) => (b.stepId ? `${b.taskId}:${b.stepId}` : b.taskId);

// Pairs old and new sessions per task step: identical times are unchanged, the rest
// pair up in time order as moves, and leftovers are additions or removals.
export function diffBlocks(oldBlocks, newBlocks) {
  const groups = new Map();
  const add = (b, side) => {
    const k = unitOf(b);
    if (!groups.has(k)) groups.set(k, { old: [], neu: [] });
    groups.get(k)[side].push(b);
  };
  oldBlocks.forEach((b) => add(b, 'old'));
  newBlocks.forEach((b) => add(b, 'neu'));
  const added = [];
  const removed = [];
  const moved = [];
  const unchanged = [];
  for (const { old, neu } of groups.values()) {
    const o = old.slice().sort(byStart);
    const n = neu.slice().sort(byStart);
    const restO = [];
    const used = new Set();
    for (const b of o) {
      const i = n.findIndex((x, j) => !used.has(j) && x.start === b.start && x.end === b.end && x.locationId === b.locationId);
      if (i >= 0) { used.add(i); unchanged.push({ from: b, to: n[i] }); } else restO.push(b);
    }
    const restN = n.filter((_, j) => !used.has(j));
    const pairs = Math.min(restO.length, restN.length);
    for (let i = 0; i < pairs; i++) moved.push({ from: restO[i], to: restN[i] });
    for (let i = pairs; i < restN.length; i++) added.push(restN[i]);
    for (let i = pairs; i < restO.length; i++) removed.push(restO[i]);
  }
  const s = (l) => l.sort((a, b) => ((a.to || a).start - (b.to || b).start));
  return { added: s(added), removed: s(removed), moved: s(moved), unchanged: s(unchanged) };
}

export function makeProposal(state, nowMs, opts = {}) {
  const strategy = opts.strategy || 'balanced';
  const res = generatePlan(state, nowMs, opts);
  const diff = diffBlocks(res.replaceable, res.blocks);
  const relaxed = !!(opts.relax && (opts.relax.extraDailyMin || opts.relax.useReserve));
  const label = relaxed ? 'Relaxed limits' : STRATEGIES[strategy]?.label || strategy;
  return {
    id: `alt_${strategy}${relaxed ? '_relaxed' : ''}${opts.variant ? `_${opts.variant}` : ''}`,
    strategy, label, relaxed,
    summary: relaxed ? 'Fits more work by exceeding limits you set. Needs your explicit approval.' : STRATEGIES[strategy]?.summary || '',
    createdAt: nowMs,
    basis: fingerprint(state),
    planVersion: state.plan.version,
    startMs: res.startMs,
    endMs: res.endMs,
    newBlocks: res.blocks,
    replacedIds: res.replaceable.map((b) => b.id),
    diff: {
      added: diff.added.map((b) => b.id),
      removed: diff.removed.map((b) => b.id),
      moved: diff.moved.map((m) => ({ from: m.from.id, to: m.to.id })),
      unchanged: diff.unchanged.length,
    },
    unplaced: res.unplaced,
    deferred: res.deferred,
    decisions: res.decisions,
    metrics: res.metrics,
    units: res.units,
    options: {
      strategy,
      relax: opts.relax || null,
      dayCaps: opts.dayCaps || null,
      estimateScale: opts.estimateScale || null,
      skipOccurrenceIds: opts.skipOccurrenceIds || null,
      protectEveningsAfter: opts.protectEveningsAfter ?? null,
    },
    factChanges: opts.factChanges || [],
  };
}

export function hasMovableFuture(state, nowMs) {
  return state.plan.blocks.some((b) => b.status === 'planned' && !b.locked && b.start >= nowMs);
}

// Builds a small set of meaningful alternatives. A relaxed option is added only when
// every normal option leaves work unplaced, and it is always labeled as relaxing limits.
export function makeAlternatives(state, nowMs, base = {}, { origin = 'plan' } = {}) {
  const strategies = ['balanced', 'early', 'evenings'];
  if (hasMovableFuture(state, nowMs)) strategies.unshift('minimal');
  const list = strategies.map((s) => makeProposal(state, nowMs, { ...base, strategy: s }));
  if (list.every((p) => p.metrics.capacityShortMin > 0)) {
    list.push(makeProposal(state, nowMs, { ...base, strategy: 'balanced', relax: { extraDailyMin: 60, useReserve: true } }));
  }
  const firstClean = list.find((p) => !p.relaxed && p.metrics.unplacedMin === 0);
  const selected = origin === 'recovery' && list[0].strategy === 'minimal' && list[0].metrics.unplacedMin === 0 ? list[0] : firstClean || list[0];
  return { origin, createdAt: nowMs, alternatives: list, selectedId: selected.id, base };
}

export function selectedAlternative(proposal) {
  if (!proposal) return null;
  return proposal.alternatives.find((a) => a.id === proposal.selectedId) || proposal.alternatives[0] || null;
}

export function proposalStaleness(state, alt, nowMs) {
  const reasons = [];
  const fp = fingerprint(state);
  for (const k of Object.keys(FINGERPRINT_LABELS)) if (fp[k] !== alt.basis[k]) reasons.push(FINGERPRINT_LABELS[k]);
  if (alt.newBlocks.some((b) => b.start < nowMs)) reasons.push('Some proposed sessions now start in the past');
  return { stale: reasons.length > 0, reasons };
}

function applyFactChanges(next, changes) {
  for (const ch of changes || []) {
    if (ch.type === 'taskRemaining') {
      const t = next.tasks.find((x) => x.id === ch.taskId);
      if (!t) continue;
      if (t.steps.length) {
        const open = t.steps.filter((s) => !s.done);
        const total = open.reduce((s, x) => s + x.remainingMin, 0) || 1;
        let left = ch.to;
        open.forEach((s, i) => {
          const v = i === open.length - 1 ? left : Math.round((s.remainingMin / total) * ch.to);
          s.remainingMin = Math.max(0, v);
          left -= s.remainingMin;
        });
      } else t.remainingMin = ch.to;
    } else if (ch.type === 'skipOccurrence') {
      const i = next.commitments.findIndex((c) => c.id === ch.commitmentId);
      if (i >= 0) next.commitments[i] = withException(next.commitments[i], ch.date, { action: 'skip' });
    }
  }
}

export function approveProposal(state, alt, nowMs) {
  const st = proposalStaleness(state, alt, nowMs);
  if (st.stale) return { ok: false, reasons: st.reasons };
  const next = structuredClone(state);
  applyFactChanges(next, alt.factChanges);
  const removed = new Set(alt.replacedIds);
  const keptBlocks = state.plan.blocks.filter((b) => !removed.has(b.id));
  const keptIds = new Set(keptBlocks.map((b) => b.id));
  const added = alt.newBlocks.filter((b) => !keptIds.has(b.id)).map((b) => ({ ...b, approvedAt: nowMs }));
  next.plan = {
    version: state.plan.version + 1,
    approvedAt: nowMs,
    strategy: alt.strategy,
    blocks: structuredClone([...keptBlocks, ...added]).sort(byStart),
  };
  next.proposal = null;
  return { ok: true, state: next };
}

export function cancelProposal(state) {
  const next = structuredClone(state);
  next.proposal = null;
  return next;
}

export function setBlockLock(state, blockId, locked) {
  const next = structuredClone(state);
  const b = next.plan.blocks.find((x) => x.id === blockId);
  if (b) b.locked = !!locked;
  return next;
}

export function removeBlock(state, blockId) {
  const next = structuredClone(state);
  next.plan.blocks = next.plan.blocks.filter((b) => b.id !== blockId);
  next.plan.version += 1;
  return next;
}

// Accounting per task, kept explicit so proposals never reduce remaining effort.
export function futureMinutes(blocks, taskId, nowMs, beforeMs = Infinity) {
  let m = 0;
  for (const b of blocks) {
    if (b.taskId !== taskId || b.status !== 'planned' || b.end <= nowMs) continue;
    const end = Math.min(b.end, beforeMs);
    const start = Math.max(b.start, nowMs);
    if (end > start) m += (end - start) / MINUTE;
  }
  return Math.round(m);
}
