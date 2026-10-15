// Travel times between places. Only times the user (or the demo data) entered are
// treated as known. Missing routes use a configurable fallback that is always
// labeled as an estimate. Virtual places and unset locations need no travel.

const indexCache = new WeakMap();
const locCache = new WeakMap();

export function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function travelIndex(state) {
  let idx = indexCache.get(state.travel);
  if (!idx) {
    idx = new Map();
    for (const t of state.travel) idx.set(pairKey(t.a, t.b), t.minutes);
    indexCache.set(state.travel, idx);
  }
  return idx;
}

function locIndex(state) {
  let idx = locCache.get(state.locations);
  if (!idx) {
    idx = new Map(state.locations.map((l) => [l.id, l]));
    locCache.set(state.locations, idx);
  }
  return idx;
}

export function locationById(state, id) { return id ? locIndex(state).get(id) || null : null; }
export function locationName(state, id) { return locationById(state, id)?.name || (id ? 'Unknown place' : 'No location set'); }

// A place you physically have to be at. Virtual activities and unset locations are not.
export function isPhysical(state, id) {
  const l = locationById(state, id);
  return !!l && l.kind !== 'virtual';
}

// kind: 'none' (no travel needed), 'same', 'entered' (a known time), 'fallback' (estimate).
export function travelBetween(state, fromId, toId) {
  if (!isPhysical(state, fromId) || !isPhysical(state, toId)) return { minutes: 0, kind: 'none' };
  if (fromId === toId) return { minutes: 0, kind: 'same' };
  const m = travelIndex(state).get(pairKey(fromId, toId));
  if (m != null) return { minutes: m, kind: 'entered' };
  return { minutes: state.settings.unknownTravelFallbackMin, kind: 'fallback' };
}

// Minutes to leave free for a trip, including the optional buffer.
export function travelCost(info, settings) {
  return info.minutes > 0 ? info.minutes + settings.travelBufferMin : 0;
}

export function describeTravel(info, settings) {
  if (info.minutes <= 0) return 'no travel';
  const est = info.kind === 'fallback' ? ' (fallback estimate, no route entered)' : '';
  const buf = settings.travelBufferMin ? ` plus ${settings.travelBufferMin} min buffer` : '';
  return `${info.minutes} min travel${est}${buf}`;
}
