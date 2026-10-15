// Small deterministic helpers used for fingerprints and generated block ids.

export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function stableStringify(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

let seq = 0;
// Ids for records the user creates. Not used by the scheduler, which derives ids deterministically.
export function newId(prefix = 'id') {
  seq = (seq + 1) % 1679616;
  const rand = Math.floor(Math.random() * 1679616).toString(36);
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${rand}`;
}
