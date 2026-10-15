// Local persistence. Demo and personal data live under separate keys and are
// never read into or written over each other. Nothing leaves the browser.

import { normalizeState, emptyState, SCHEMA_VERSION, APP_ID } from './model.js';

const PREFIX = 'margin-planner';
export const KEYS = {
  mode: `${PREFIX}.active-mode`,
  data: (mode) => `${PREFIX}.${mode}.v${SCHEMA_VERSION}`,
  backup: (mode) => `${PREFIX}.${mode}.backup`,
  corrupt: (mode) => `${PREFIX}.${mode}.unreadable`,
};
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function memoryBackend(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    name: 'memory', persistent: false, map: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v) { m.set(k, String(v)); },
    async remove(k) { m.delete(k); },
  };
}

export function localStorageBackend(ls) {
  const probe = `${PREFIX}.probe`;
  ls.setItem(probe, '1');
  ls.removeItem(probe);
  return {
    name: 'browser', persistent: true,
    async get(k) { return ls.getItem(k); },
    async set(k, v) { ls.setItem(k, v); },
    async remove(k) { ls.removeItem(k); },
  };
}

// The key-value store some sandboxed previews provide on window.storage.
export function hostStorageBackend(ws) {
  return {
    name: 'host', persistent: true,
    async get(k) { try { const r = await ws.get(k, false); return r ? r.value : null; } catch { return null; } },
    async set(k, v) { const r = await ws.set(k, v, false); if (!r) throw new Error('The host storage rejected the write.'); },
    async remove(k) { try { await ws.delete(k, false); } catch { /* already absent */ } },
  };
}

export function pickBackend(win) {
  try { if (win && win.localStorage) return localStorageBackend(win.localStorage); } catch { /* blocked */ }
  try { if (win && win.storage && typeof win.storage.get === 'function') return hostStorageBackend(win.storage); } catch { /* unavailable */ }
  return memoryBackend();
}

export function describeStorageError(err) {
  const name = err && (err.name || '');
  if (/quota/i.test(name) || /quota/i.test(String(err && err.message))) return 'Browser storage is full. Export your data, then delete unneeded data or free space.';
  return `Browser storage refused the change (${String((err && err.message) || err).slice(0, 120)}).`;
}

export function createRepository(backend, { seedDemo, seedPersonal = () => emptyState('personal') }) {
  async function keepUnreadable(mode, raw) {
    try { await backend.set(KEYS.corrupt(mode), raw); } catch { /* best effort */ }
  }
  return {
    backend,
    async getActiveMode() {
      try { const m = await backend.get(KEYS.mode); return m === 'personal' ? 'personal' : 'demo'; } catch { return 'demo'; }
    },
    async setActiveMode(mode) {
      try { await backend.set(KEYS.mode, mode); return { ok: true }; } catch (e) { return { ok: false, error: describeStorageError(e) }; }
    },
    async loadMode(mode) {
      const fresh = () => (mode === 'demo' ? seedDemo() : seedPersonal());
      let raw;
      try { raw = await backend.get(KEYS.data(mode)); } catch (e) { return { state: fresh(), status: 'unavailable', warnings: [describeStorageError(e)] }; }
      if (raw == null) return { state: fresh(), status: 'new', warnings: [] };
      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        await keepUnreadable(mode, raw);
        return { state: fresh(), status: 'recovered', warnings: ['Saved data could not be read. A copy was kept (Data, Recovery) and a fresh start was loaded.'] };
      }
      const res = normalizeState(parsed, mode);
      if (!res.ok) {
        await keepUnreadable(mode, raw);
        return { state: fresh(), status: 'recovered', warnings: [`Saved data could not be used: ${res.errors.join(' ')} A copy was kept.`] };
      }
      return { state: res.state, status: 'stored', warnings: res.warnings };
    },
    async saveMode(mode, state) {
      if (state.mode !== mode) return { ok: false, error: `Refused to save ${state.mode} data into ${mode} storage.` };
      try { await backend.set(KEYS.data(mode), JSON.stringify(state)); return { ok: true }; } catch (e) { return { ok: false, error: describeStorageError(e) }; }
    },
    async removeMode(mode) {
      try { await backend.remove(KEYS.data(mode)); return { ok: true }; } catch (e) { return { ok: false, error: describeStorageError(e) }; }
    },
    async backup(mode, state, nowMs) {
      try { await backend.set(KEYS.backup(mode), JSON.stringify({ savedAt: nowMs, state })); return { ok: true }; } catch (e) { return { ok: false, error: describeStorageError(e) }; }
    },
    async getBackup(mode) {
      try {
        const raw = await backend.get(KEYS.backup(mode));
        if (!raw) return null;
        const obj = JSON.parse(raw);
        const res = normalizeState(obj.state, mode);
        return res.ok ? { savedAt: obj.savedAt, state: res.state } : null;
      } catch { return null; }
    },
    async removeBackup(mode) {
      try { await backend.remove(KEYS.backup(mode)); return { ok: true }; } catch (e) { return { ok: false, error: describeStorageError(e) }; }
    },
    async getUnreadable(mode) {
      try { return await backend.get(KEYS.corrupt(mode)); } catch { return null; }
    },
  };
}

export function exportPayload(state, nowMs) {
  return JSON.stringify({ app: APP_ID, kind: 'export', schemaVersion: SCHEMA_VERSION, exportedAt: new Date(nowMs).toISOString(), mode: state.mode, data: { ...state, proposal: null } }, null, 2);
}

export function summarize(state) {
  return {
    tasks: state.tasks.length,
    openTasks: state.tasks.filter((t) => t.status !== 'done').length,
    commitments: state.commitments.length,
    places: state.locations.length,
    sessions: state.plan.blocks.length,
    progress: state.log.length,
    topics: state.revision.topics.length,
  };
}

// Validates an import without touching any stored data.
export function parseImport(text, mode = 'personal') {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['The file is empty.'] };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ['The file is larger than 5 MB, which is more than planner data should need.'] };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, errors: ['This file is not valid JSON.'] }; }
  const isExport = obj && obj.kind === 'export' && obj.data;
  const data = isExport ? { ...obj.data, schemaVersion: obj.data.schemaVersion ?? obj.schemaVersion } : obj;
  const res = normalizeState(data, mode);
  if (!res.ok) return res;
  const warnings = [...res.warnings];
  if (isExport && obj.mode === 'demo' && mode === 'personal') warnings.push('This file was exported from demo mode. Its synthetic data will become your personal data.');
  res.state.proposal = null;
  res.state.mode = mode;
  if (mode === 'personal') res.state.meta.demoNow = null;
  return { ok: true, state: res.state, warnings, summary: summarize(res.state), exportedAt: isExport ? obj.exportedAt : null };
}
