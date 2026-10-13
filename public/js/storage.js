(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SideQuest = Object.assign(root.SideQuest || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STORAGE_KEY = "side-quest-state-v1";
  const DEFAULT_STATE = Object.freeze({
    version: 1,
    interests: [],
    votes: {},
    saved: [],
    completed: [],
    dismissed: [],
    recentCategories: [],
    explorationSeed: 1,
  });

  function normalizeState(input) {
    const value = input && typeof input === "object" ? input : {};
    return {
      version: 1,
      interests: Array.isArray(value.interests) ? [...new Set(value.interests)] : [],
      votes: value.votes && typeof value.votes === "object" ? Object.fromEntries(Object.entries(value.votes).filter(([, vote]) => vote === 1 || vote === -1)) : {},
      saved: Array.isArray(value.saved) ? [...new Set(value.saved)] : [],
      completed: Array.isArray(value.completed) ? [...new Set(value.completed)] : [],
      dismissed: Array.isArray(value.dismissed) ? [...new Set(value.dismissed)] : [],
      recentCategories: Array.isArray(value.recentCategories) ? value.recentCategories.slice(-5) : [],
      explorationSeed: Number.isFinite(value.explorationSeed) ? value.explorationSeed : 1,
    };
  }

  function createStateStore(adapter) {
    const storage = adapter || (typeof localStorage !== "undefined" ? localStorage : null);
    return {
      load() {
        if (!storage) return normalizeState(DEFAULT_STATE);
        try {
          return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY)));
        } catch (_error) {
          return normalizeState(DEFAULT_STATE);
        }
      },
      save(state) {
        const normalized = normalizeState(state);
        if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      },
      clearPreferences(state) {
        return this.save({
          ...normalizeState(DEFAULT_STATE),
          completed: normalizeState(state).completed,
        });
      },
    };
  }

  function applyVote(state, taskId, direction) {
    const next = normalizeState(state);
    if (next.votes[taskId] === direction) delete next.votes[taskId];
    else next.votes[taskId] = direction;
    return next;
  }

  function toggleInList(state, key, taskId) {
    const next = normalizeState(state);
    const values = new Set(next[key]);
    values.has(taskId) ? values.delete(taskId) : values.add(taskId);
    next[key] = [...values];
    return next;
  }

  return { STORAGE_KEY, DEFAULT_STATE, normalizeState, createStateStore, applyVote, toggleInList };
});
