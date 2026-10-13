(function () {
  const SQ = window.SideQuest;
  const main = document.querySelector("#main");
  const announcer = document.querySelector("#announcer");
  const store = SQ.createStateStore();
  let state = store.load();
  let catalog = [...SQ.CURATED_TASKS];
  let currentFeedIds = [];
  let loadErrors = [];

  const routes = {
    "/": "feed",
    "/quests": "quests",
    "/leaderboard": "leaderboard",
    "/settings": "settings",
  };

  function currentRoute() {
    return routes[window.location.pathname] || "feed";
  }

  function announce(message) {
    announcer.textContent = "";
    window.setTimeout(() => { announcer.textContent = message; }, 20);
  }

  function persist(next) {
    state = store.save(next);
  }

  function taskById(id) {
    return catalog.find((task) => task.id === id);
  }

  function freshFeed() {
    const tasks = SQ.selectDiverse(catalog, state, 8);
    currentFeedIds = tasks.map((task) => task.id);
    return tasks;
  }

  function visibleFeed() {
    const tasks = currentFeedIds.map(taskById).filter((task) => task && !state.dismissed.includes(task.id) && !state.completed.includes(task.id));
    if (!tasks.length) return freshFeed();
    return tasks;
  }

  function navigate(path) {
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    render();
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const actions = {
    vote(task, direction) {
      persist(SQ.applyVote(state, task.id, direction));
      announce(state.votes[task.id] ? `${state.votes[task.id] > 0 ? "Upvoted" : "Downvoted"} ${task.title}.` : `Vote removed from ${task.title}.`);
      render();
    },
    save(task) {
      persist(SQ.toggleInList(state, "saved", task.id));
      announce(state.saved.includes(task.id) ? `${task.title} saved.` : `${task.title} removed from saved quests.`);
      render();
    },
    complete(task) {
      persist(SQ.toggleInList(state, "completed", task.id));
      if (state.completed.includes(task.id)) {
        state.recentCategories = [...state.recentCategories, task.category].slice(-5);
        persist(state);
        currentFeedIds = currentFeedIds.filter((id) => id !== task.id);
        announce(`${task.title} marked complete.`);
      } else {
        announce(`${task.title} moved back to your quests.`);
      }
      render();
    },
    remove(task) {
      const next = { ...state, saved: state.saved.filter((id) => id !== task.id), completed: state.completed.filter((id) => id !== task.id) };
      persist(next);
      announce(`${task.title} removed from My Quests.`);
      render();
    },
    replace(task, row) {
      row.classList.add("is-changing");
      const next = {
        ...state,
        dismissed: [...new Set([...state.dismissed, task.id])],
        recentCategories: [...state.recentCategories, task.category].slice(-5),
        explorationSeed: state.explorationSeed + 1,
      };
      persist(next);
      const replacement = SQ.replacementFor(task.id, catalog, state, currentFeedIds);
      currentFeedIds = currentFeedIds.map((id) => id === task.id ? replacement && replacement.id : id).filter(Boolean);
      window.setTimeout(() => {
        announce(replacement ? `${task.title} replaced with ${replacement.title}.` : `${task.title} dismissed.`);
        render();
      }, 150);
    },
    interest(id, button) {
      persist(SQ.toggleInList(state, "interests", id));
      button.setAttribute("aria-pressed", String(state.interests.includes(id)));
      const status = document.querySelector("#settings-status");
      if (status) status.textContent = "Saved. Your next feed will use this preference.";
      currentFeedIds = [];
    },
    reset() {
      if (!window.confirm("Reset votes, saved quests, dismissals, and interests? Completed quests will stay.")) return;
      state = store.clearPreferences(state);
      currentFeedIds = [];
      announce("Recommendation preferences reset. Completed quests were kept.");
      render();
    },
    openFeed: () => navigate("/"),
    openSettings: () => navigate("/settings"),
  };

  function updateNavigation() {
    const path = routes[window.location.pathname] ? window.location.pathname : "/";
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function render() {
    updateNavigation();
    main.replaceChildren();
    const context = { catalog, state, actions, interests: SQ.INTERESTS, loadErrors };
    if (currentRoute() === "quests") main.append(SQ.renderMyQuests(context));
    else if (currentRoute() === "leaderboard") main.append(SQ.renderLeaderboard(context));
    else if (currentRoute() === "settings") main.append(SQ.renderSettings(context));
    else main.append(SQ.renderFeed({ ...context, tasks: visibleFeed() }));
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-route]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });
  window.addEventListener("popstate", render);

  SQ.loadQuestResources().then((result) => {
    loadErrors = result.errors;
    catalog = SQ.uniqueById([...SQ.CURATED_TASKS, ...SQ.normalizeResources(result.data)]);
    freshFeed();
    render();
  }).catch(() => {
    loadErrors = [{ key: "all", message: "Could not load prototype data" }];
    freshFeed();
    render();
  });
})();
