(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SideQuest = Object.assign(root.SideQuest || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function hashFraction(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function signalForTag(state, tag) {
    let score = 0;
    for (const [taskId, vote] of Object.entries(state.votes || {})) {
      const task = (state.catalog || []).find((item) => item.id === taskId);
      if (task && task.tags.includes(tag)) score += vote > 0 ? 3 : -4;
    }
    for (const taskId of state.saved || []) {
      const task = (state.catalog || []).find((item) => item.id === taskId);
      if (task && task.tags.includes(tag)) score += 1.25;
    }
    for (const taskId of state.completed || []) {
      const task = (state.catalog || []).find((item) => item.id === taskId);
      if (task && task.tags.includes(tag)) score += 0.35;
    }
    return score;
  }

  function scoreTask(task, state, position) {
    const interests = new Set(state.interests || []);
    const recentCategories = state.recentCategories || [];
    let score = task.tags.reduce((sum, tag) => sum + (interests.has(tag) ? 4 : 0) + signalForTag(state, tag), 0);
    if (recentCategories.includes(task.category)) score -= 1.8 * recentCategories.filter((category) => category === task.category).length;
    if (task.source && task.source.type === "dartmouth") score += 0.45;
    score += hashFraction(`${task.id}:${state.explorationSeed || 1}`) * 2.2;
    score -= (position || 0) * 0.0001;
    return score;
  }

  function eligibleTasks(catalog, state) {
    const excluded = new Set([...(state.dismissed || []), ...(state.completed || [])]);
    return catalog.filter((task) => !excluded.has(task.id));
  }

  function rankTasks(catalog, state) {
    const context = Object.assign({}, state, { catalog });
    return eligibleTasks(catalog, state)
      .map((task, index) => ({ task, score: scoreTask(task, context, index) }))
      .sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id))
      .map((item) => item.task);
  }

  function selectDiverse(catalog, state, count) {
    const ranked = rankTasks(catalog, state);
    const selected = [];
    const categoryCounts = new Map();
    while (selected.length < count && ranked.length) {
      let index = ranked.findIndex((task) => (categoryCounts.get(task.category) || 0) === 0);
      if (index < 0) index = ranked.findIndex((task) => (categoryCounts.get(task.category) || 0) < 2);
      if (index < 0) index = 0;
      const [task] = ranked.splice(index, 1);
      selected.push(task);
      categoryCounts.set(task.category, (categoryCounts.get(task.category) || 0) + 1);
    }
    return selected;
  }

  function replacementFor(currentId, catalog, state, visibleIds) {
    const blocked = new Set([currentId, ...(visibleIds || [])]);
    return rankTasks(catalog, state).find((task) => !blocked.has(task.id)) || null;
  }

  return { hashFraction, scoreTask, eligibleTasks, rankTasks, selectDiverse, replacementFor };
});
