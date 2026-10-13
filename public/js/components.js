(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SideQuest = Object.assign(root.SideQuest || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, options, children) {
    const node = document.createElement(tag);
    const opts = options || {};
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = opts.text;
    for (const [name, value] of Object.entries(opts.attrs || {})) {
      if (value != null) node.setAttribute(name, String(value));
    }
    for (const [event, handler] of Object.entries(opts.on || {})) node.addEventListener(event, handler);
    for (const child of children || []) if (child) node.append(child);
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const paths = {
      up: '<path d="M12 4 4.5 14h15L12 4Z"/>',
      down: '<path d="m12 20 7.5-10h-15L12 20Z"/>',
      refresh: '<path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    };
    svg.innerHTML = paths[name];
    if (name === "up" || name === "down") svg.setAttribute("class", "vote-icon");
    return svg;
  }

  function sourceElement(task) {
    if (task.source.type === "dartmouth") {
      return el("a", { className: "source-badge source-link", text: "Dartmouth ↗", attrs: { href: task.source.url, target: "_blank", rel: "noopener noreferrer", "aria-label": `View official Dartmouth source for ${task.title}` } });
    }
    if (task.source.type !== "prototype") return el("span", { className: "source-badge", text: task.source.label });
    const id = `prototype-tip-${task.id.replace(/[^a-z0-9]/gi, "-")}`;
    const button = el("button", { className: "info-button", attrs: { type: "button", "aria-label": "About prototype data", "aria-describedby": id } }, [icon("info")]);
    const tip = el("span", { className: "info-tip", text: "This activity comes from sample repository data and may not represent a real Dartmouth opportunity.", attrs: { id, role: "tooltip" } });
    return el("span", { className: "prototype-wrap" }, [el("span", { className: "source-badge", text: "Prototype" }), button, tip]);
  }

  function voteControl(task, state, actions) {
    const value = state.votes[task.id] || 0;
    const up = el("button", { className: `vote-button${value === 1 ? " is-active" : ""}`, attrs: { type: "button", "aria-label": `Upvote ${task.title}`, "aria-pressed": value === 1 }, on: { click: () => actions.vote(task, 1) } }, [icon("up")]);
    const score = el("span", { className: "vote-score", text: value > 0 ? "+1" : String(value), attrs: { title: "Your vote. Shared community scores are not available yet.", "aria-label": `Your vote: ${value}` } });
    const down = el("button", { className: `vote-button down${value === -1 ? " is-active" : ""}`, attrs: { type: "button", "aria-label": `Downvote ${task.title}`, "aria-pressed": value === -1 }, on: { click: () => actions.vote(task, -1) } }, [icon("down")]);
    return el("div", { className: "vote-control", attrs: { "aria-label": "Personal voting control" } }, [up, score, down]);
  }

  function taskRow(task, state, actions, options) {
    const saved = state.saved.includes(task.id);
    const completed = state.completed.includes(task.id);
    const opts = options || {};
    const meta = el("div", { className: "quest-meta" }, [
      el("span", { className: "category", text: task.category }),
      sourceElement(task),
      task.effort ? el("span", { className: "effort", text: task.effort }) : null,
    ]);
    const actionList = [];
    if (!completed) actionList.push(el("button", { className: `button${saved ? " secondary" : ""}`, text: saved ? "Saved" : "Save quest", attrs: { type: "button", "aria-pressed": saved }, on: { click: () => actions.save(task) } }));
    actionList.push(el("button", { className: `button ${completed ? "secondary" : "success"}`, text: completed ? "Undo complete" : "Mark complete", attrs: { type: "button" }, on: { click: () => actions.complete(task) } }));
    if (opts.allowRemove) actionList.push(el("button", { className: "button secondary danger", text: "Remove", attrs: { type: "button" }, on: { click: () => actions.remove(task) } }));
    if (opts.allowReplace) actionList.push(el("button", { className: "icon-button", attrs: { type: "button", "aria-label": `Replace ${task.title}`, title: "Try a different quest" }, on: { click: (event) => actions.replace(task, event.currentTarget.closest(".quest-row")) } }, [icon("refresh")]));
    const content = el("div", { className: "quest-content" }, [
      meta,
      el("h2", { className: "quest-title", text: task.title }),
      task.description ? el("p", { className: "quest-description", text: task.description }) : null,
      el("div", { className: "quest-actions" }, actionList),
    ]);
    return el("article", { className: `quest-row${completed ? " is-complete" : ""}`, attrs: { "data-task-id": task.id } }, [voteControl(task, state, actions), content]);
  }

  function heading(eyebrow, title, intro) {
    return el("header", { className: "page-heading" }, [
      el("p", { className: "eyebrow", text: eyebrow }),
      el("h1", { text: title }),
      intro ? el("p", { className: "page-intro", text: intro }) : null,
    ]);
  }

  function emptyState(title, copy, actionText, action) {
    return el("div", { className: "empty-state" }, [
      el("h2", { text: title }),
      el("p", { text: copy }),
      actionText ? el("button", { className: "button", text: actionText, attrs: { type: "button" }, on: { click: action } }) : null,
    ]);
  }

  function renderFeed(context) {
    const { tasks, state, actions, loadErrors } = context;
    const fragment = document.createDocumentFragment();
    fragment.append(heading("A better kind of detour", "What should you try next?", "Quests tune themselves as you vote, save, finish, and skip."));
    if (loadErrors.length) fragment.append(el("div", { className: "notice", text: "Some prototype activities could not be loaded. Verified and curated quests are still available.", attrs: { role: "status" } }));
    if (!tasks.length) fragment.append(emptyState("You reached the end—for now", "Reset dismissed recommendations in Settings to bring past options back.", "Open settings", actions.openSettings));
    else fragment.append(el("section", { className: "feed", attrs: { "aria-label": "Recommended side quests" } }, tasks.map((task) => taskRow(task, state, actions, { allowReplace: true }))));
    return fragment;
  }

  function renderMyQuests(context) {
    const { catalog, state, actions } = context;
    const saved = state.saved.filter((id) => !state.completed.includes(id)).map((id) => catalog.find((task) => task.id === id)).filter(Boolean);
    const completed = state.completed.map((id) => catalog.find((task) => task.id === id)).filter(Boolean);
    const fragment = document.createDocumentFragment();
    fragment.append(heading("Your list", "My Quests", `${completed.length} completed · saved in this browser`));
    fragment.append(el("div", { className: "section-heading" }, [el("h2", { text: "Saved" }), el("span", { className: "count", text: String(saved.length) })]));
    fragment.append(saved.length ? el("section", { className: "feed", attrs: { "aria-label": "Saved quests" } }, saved.map((task) => taskRow(task, state, actions, { allowRemove: true }))) : emptyState("Nothing waiting", "Save a recommendation and it will land here.", "Browse quests", actions.openFeed));
    fragment.append(el("div", { className: "section-heading" }, [el("h2", { text: "Completed" }), el("span", { className: "count", text: String(completed.length) })]));
    fragment.append(completed.length ? el("section", { className: "feed", attrs: { "aria-label": "Completed quests" } }, completed.map((task) => taskRow(task, state, actions, { allowRemove: true }))) : emptyState("A clean slate", "Finished quests will collect here, one real experience at a time."));
    return fragment;
  }

  function renderLeaderboard(context) {
    const count = context.state.completed.length;
    const fragment = document.createDocumentFragment();
    fragment.append(heading("Distinct quests completed", "Leaderboard", "A deliberately small start. Real rankings need real accounts."));
    fragment.append(el("div", { className: "leaderboard-note" }, [el("span", { className: "local-label", text: "Local" }), el("span", { text: "This is a browser-only leaderboard. No other students, shared scores, or activity records are being invented." })]));
    fragment.append(el("ol", { className: "ranking", attrs: { "aria-label": "Local quest ranking" } }, [
      el("li", { className: "ranking-row" }, [
        el("span", { className: "rank", text: "1" }),
        el("span", { className: "player-name", text: "You" }, [el("span", { className: "player-meta", text: "This browser" })]),
        el("span", { className: "completion-number", text: `${count} ${count === 1 ? "quest" : "quests"}` }),
      ]),
    ]));
    return fragment;
  }

  function renderSettings(context) {
    const { interests, state, actions } = context;
    const fragment = document.createDocumentFragment();
    fragment.append(heading("Make the feed yours", "Settings", "Interests help with ranking, but they never fence you into one lane."));
    const buttons = interests.map((interest) => el("button", { className: "button secondary interest-button", text: interest.label, attrs: { type: "button", "aria-pressed": state.interests.includes(interest.id) }, on: { click: (event) => actions.interest(interest.id, event.currentTarget) } }));
    fragment.append(el("section", { className: "settings-group" }, [
      el("h2", { text: "Interests" }),
      el("p", { className: "settings-copy", text: "Choose any that sound like you today. You can change them whenever you like." }),
      el("div", { className: "interest-grid" }, buttons),
      el("p", { className: "settings-status", attrs: { id: "settings-status", "aria-live": "polite" } }),
    ]));
    fragment.append(el("section", { className: "settings-group" }, [
      el("h2", { text: "Recommendation history" }),
      el("p", { className: "settings-copy", text: "Reset votes, saved quests, dismissed suggestions, and interests. Completed quests stay safely in your history." }),
      el("button", { className: "button secondary danger", text: "Reset recommendations", attrs: { type: "button" }, on: { click: actions.reset } }),
    ]));
    return fragment;
  }

  return { el, taskRow, renderFeed, renderMyQuests, renderLeaderboard, renderSettings };
});
