const G = typeof window !== "undefined" ? window : globalThis;
const CLUBS = G.CLUBS;
const COURSES = G.COURSES || [];
const BY_ID = new Map(CLUBS.map((c) => [c.id, c]));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TABS = ["browse", "profile", "recs", "saved"];
const JOIN = { open: "Open to all", signup: "Sign-up", application: "Application", audition: "Audition", tryout: "Tryout" };

// Course department prefix -> interest words (so "COSC 10" counts as a programming interest).
const DEPT = {
  cosc: "cosc programming python data ai", engs: "engs engineering design hardware robot", econ: "econ finance markets business",
  math: "math logic statistics", govt: "govt politics debate international", bio: "bio biology science health research",
  biol: "bio biology science health research", chem: "chem chemistry science research", phys: "physics astronomy science",
  psyc: "psychology health", pbs: "psychology health science", envs: "envs environment climate sustainability",
  engl: "english writing literature creative", writ: "writing creative", film: "film media cinema", musi: "music singing performance",
  arth: "art design visual", art: "art design visual", sart: "art design visual", thea: "theater acting performance",
  phil: "philosophy ethics debate", educ: "education teaching tutoring", hist: "history writing politics", qss: "data statistics politics",
  jpn: "japan culture language", span: "language culture international", fren: "language culture international", chin: "language culture international",
};
// Synonyms: bio word -> an existing club tag (matched at half weight).
const RAW_SYN = {
  hike: "hiking", hikes: "hiking", coding: "programming", code: "programming", coder: "programming", software: "programming",
  sing: "singing", song: "singing", acting: "theater", act: "theater", drama: "theater", paint: "art", painting: "art",
  draw: "art", drawing: "art", bake: "baking", write: "writing", dancing: "dance", dancer: "dance", robots: "robot",
  invest: "investing", stock: "stocks", camp: "camping", swim: "water", run: "fitness", gym: "fitness", workout: "fitness",
};

// ---- text matching: one normalizer is applied to tags AND profile text so they always agree ----
const stem = (w) => (w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const toks = (s) => (String(s ?? "").toLowerCase().match(/[a-z0-9]+/g) || []).map(stem);
const normTag = (t) => toks(t).join(" ");
const terms = (s) => {
  const t = toks(s), out = new Set(t);
  for (let i = 0; i < t.length - 1; i++) out.add(t[i] + " " + t[i + 1]);
  return [...out];
};
const SYN = Object.fromEntries(Object.entries(RAW_SYN).map(([k, v]) => [normTag(k), normTag(v)]));
const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
for (const c of CLUBS) c.nt = new Set(c.tags.map(normTag));

// ---- state (localStorage with in-memory fallback) ----
const KEY = "clubfinder.v2";
const arr = (v) => (Array.isArray(v) ? v : []);
let S = { profile: {}, saved: [], dismissed: [], liked: [], muted: [], mode: "balanced" };
function loadState() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    const old = JSON.parse(localStorage.getItem("clubfinder.profile")); // v1 profile
    const base = v && typeof v === "object" && !Array.isArray(v) ? v : { profile: old };
    S.profile = base.profile && typeof base.profile === "object" && !Array.isArray(base.profile) ? base.profile : {};
    for (const k of ["saved", "dismissed", "liked", "muted"]) S[k] = arr(base[k]);
    if (["focused", "balanced", "adventurous"].includes(base.mode)) S.mode = base.mode;
  } catch {}
  const p = S.profile;
  if (typeof p.clubs === "string") { // v1 stored club names as text
    p.clubs = list(p.clubs).map((n) => CLUBS.find((c) => [c.name, c.name.replace(/^Dartmouth /, "")].some((x) => x.toLowerCase() === n.toLowerCase()))?.id).filter(Boolean);
  }
  p.clubs = arr(p.clubs).filter((id) => BY_ID.has(id));
  p.interests = arr(p.interests);
  for (const k of ["saved", "dismissed", "liked"]) S[k] = S[k].filter((id) => BY_ID.has(id));
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const mine = () => S.profile.clubs.map((id) => BY_ID.get(id));
const hasProfile = () => { const p = S.profile; return !!(p.bio || p.classes || p.clubs?.length || p.interests?.length || S.saved.length || S.liked.length); };

// ---- profile -> weighted terms, each remembering why it is there ----
function buildProfile() {
  const m = new Map();
  const add = (term, w, src) => { const o = m.get(term); if (!o || o.w < w) m.set(term, { w, src }); };
  const addText = (text, w, src) => {
    for (const t of terms(text)) { add(t, w, src); if (SYN[t]) add(SYN[t], w * 0.5, src); }
  };
  const p = S.profile;
  addText(p.bio, 1, "your bio");
  for (const raw of list(p.classes)) {
    const code = raw.toLowerCase().match(/^[a-z]+/)?.[0];
    addText(DEPT[code] || "", 1, `you take ${raw.toUpperCase()}`);
  }
  p.interests.forEach((t) => addText(t, 1.5, `you picked “${t}”`));
  mine().forEach((c) => c.tags.forEach((t) => addText(t, 0.5, `you're in ${c.name}`)));
  S.liked.forEach((id) => BY_ID.get(id).tags.forEach((t) => addText(t, 0.75, `you liked ${BY_ID.get(id).name}`)));
  S.saved.forEach((id) => BY_ID.get(id).tags.forEach((t) => addText(t, 0.75, `you saved ${BY_ID.get(id).name}`)));
  S.muted.forEach((t) => m.delete(normTag(t)));
  return m;
}
function match(c, prof) {
  let score = 0;
  const reasons = [];
  for (const t of c.tags) {
    const o = prof.get(normTag(t));
    if (o) { score += o.w; reasons.push({ tag: t, src: o.src, w: o.w }); }
  }
  return { score, reasons };
}
function reasonText(reasons, max = 2) {
  const by = new Map();
  for (const r of reasons) by.set(r.src, [...(by.get(r.src) || []), r.tag]);
  const parts = [...by].sort((a, b) => b[1].length - a[1].length).map(([src, tags]) => ({ src, tags }));
  return parts.length ? { short: parts.slice(0, max), full: parts } : null;
}
const overlap = (a, b) => [...a.nt].filter((t) => b.nt.has(t)).length;

// ---- schedule parsing ("COSC 10: Mon Wed 10:10-11:15") ----
const TIME_RE = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
const mins = (h, m) => +h * 60 + +m;
function parseBusy(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const t = line.match(TIME_RE), first = line.search(/\b(mon|tue|wed|thu|fri|sat|sun)/i);
    if (!t || first < 0) continue;
    const label = line.slice(0, first).replace(/[:\s]+$/, "") || "a class";
    for (const d of line.matchAll(/\b(mon|tue|wed|thu|fri|sat|sun)/gi)) {
      out.push({ label, day: DAYS.find((x) => x.toLowerCase() === d[1].toLowerCase()), start: mins(t[1], t[2]), end: mins(t[3], t[4]) });
    }
  }
  return out;
}
function conflicts(c, busy) {
  const t = c.time?.match(TIME_RE);
  if (!t) return [];
  const s = mins(t[1], t[2]), e = mins(t[3], t[4]);
  return [...new Set(busy.filter((b) => b.day === c.day && b.start < e && s < b.end).map((b) => b.label))];
}

// ---- display helpers ----
const hoursLabel = (h) => (h <= 2 ? "Low" : h <= 5 ? "Medium" : "High");
const cost = (c) => (c.dues === 0 ? "Free" : `$${c.dues}/yr`);
function deadlineText(c) {
  if (!c.deadline) return "";
  const days = Math.ceil((new Date(c.deadline + "T23:59:59") - new Date()) / 864e5);
  const d = new Date(c.deadline + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return days < 0 ? "Deadline passed" : `Apply by ${d} (${days} day${days === 1 ? "" : "s"})`;
}
const joinNow = (c) => c.accepting && (c.join === "open" || c.join === "signup");

// ---- rendering ----
let curTab = "browse", sharedList = null, lastToast = null;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ICON = {
  x: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  // Hand-drawn loose ellipse that overshoots its start, like a pen circling a number.
  ring: `<svg class="ring" viewBox="0 0 48 48" aria-hidden="true"><path pathLength="1" d="M26 5C37 4 45 13 44 25C43 37 33 45 22 44C10 43 3 34 4 22C5 11 14 4 29 6C33 7 35 8 36 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};
const pad = (n) => String(n).padStart(2, "0");

function card(c, o = {}) {
  const saved = S.saved.includes(c.id);
  const bad = conflicts(c, o.busy || []);
  const flags = [
    `<span class="kind ${c.kind}">${c.kind === "serious" ? "Serious" : "Fun"}</span>`,
    `<span>${esc(c.category)}</span>`,
    joinNow(c) ? `<span class="good">Join anytime</span>` : "",
    c.beginner ? `<span>Beginner friendly</span>` : "",
    c.deadline ? `<span class="stamp">${esc(deadlineText(c))}</span>` : "",
    bad.length ? `<span class="stamp">Conflicts with ${esc(bad.join(", "))}</span>` : "",
  ].filter(Boolean).join("");
  const facts = [
    ["Meets", `${esc(c.day)}${c.time ? " " + esc(c.time.replace("-", "–")) : ""}`],
    c.hours != null && ["Time", `~${c.hours} h/week <span class="soft">${hoursLabel(c.hours)}</span>`],
    c.dues != null && ["Cost", cost(c)],
    c.join && ["To join", JOIN[c.join]],
  ].filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  const why = o.why ? `<p class="why">Because ${o.why.short.map((p) => `${esc(p.src)}: <mark>${esc(p.tags.slice(0, 3).join(", "))}</mark>`).join("; ")}.</p>` : "";
  const fb = o.feedback ? `<div class="entry-actions"><button type="button" class="text" data-like="${c.id}">More like this</button><button type="button" class="text" data-dismiss="${c.id}">Not for me</button></div>` : "";
  return `<article class="entry${saved ? " is-saved" : ""}${S.dismissed.includes(c.id) ? " struck" : ""}" data-id="${c.id}">
    <button type="button" class="mark" data-save="${c.id}" aria-pressed="${saved}" aria-label="Save ${esc(c.name)}" title="Circle to save">${ICON.ring}<span class="no">${pad(c.id)}</span></button>
    <div class="entry-body"><h3><button type="button" class="link" data-open="${c.id}">${esc(c.name)}</button></h3>
      <p class="desc">${esc(c.desc)}</p>${why}<p class="flags">${flags}</p>${fb}</div>
    <dl class="facts">${facts}</dl></article>`;
}
const grid = (items, empty) => `<div class="catalog">${items.join("") || `<p class="empty">${empty}</p>`}</div>`;

const F = { q: "", cat: "", kind: "", day: "", sort: "match", free: false, noapp: false, beginner: false, low: false, accepting: false, fits: false };
function renderBrowse() {
  const busy = parseBusy(S.profile.times), prof = buildProfile();
  const words = F.q.toLowerCase().split(/\s+/).filter(Boolean);
  const fitsChip = $("#fitsChip");
  fitsChip.disabled = !busy.length;
  $("#fitsHint").hidden = !!busy.length;
  const hits = CLUBS.filter((c) => {
    const hay = [c.name, c.desc, c.category, c.day, c.kind, ...c.tags].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w)) && (!F.cat || c.category === F.cat) && (!F.kind || c.kind === F.kind) && (!F.day || c.day === F.day) &&
      (!F.free || c.dues === 0) && (!F.noapp || c.join === "open" || c.join === "signup") && (!F.beginner || c.beginner) &&
      (!F.low || c.hours <= 3) && (!F.accepting || joinNow(c)) && (!F.fits || (busy.length && !conflicts(c, busy).length));
  });
  const sorts = {
    match: (a, b) => match(b, prof).score - match(a, prof).score,
    name: (a, b) => a.name.localeCompare(b.name),
    day: (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || (a.time || "").localeCompare(b.time || ""),
    hours: (a, b) => a.hours - b.hours,
  };
  hits.sort(sorts[F.sort]);
  $("#count").textContent = `${hits.length} club${hits.length === 1 ? "" : "s"}`;
  $("#list").innerHTML = hits.map((c) => card(c, { busy })).join("") || `<div class="empty"><p>No clubs match those filters.</p><button type="button" class="secondary" id="clearInline">Clear filters</button></div>`;
}

const MODES = { focused: [4, 2, 1], balanced: [3, 3, 2], adventurous: [2, 3, 4] };
function renderRecs() {
  const box = $("#recs");
  if (!hasProfile()) { box.innerHTML = `<div class="intro"><h2 id="h-recs">Your picks</h2></div><div class="empty"><p>Tell us about your classes and interests and we'll suggest clubs, with reasons.</p><a class="btn" href="#profile">Set up my profile</a></div>`; return; }
  const prof = buildProfile(), busy = parseBusy(S.profile.times);
  const mineSet = new Set(S.profile.clubs);
  const mineTags = new Set(mine().flatMap((c) => [...c.nt]));
  const pool = CLUBS.filter((c) => !mineSet.has(c.id) && !S.dismissed.includes(c.id) && !S.saved.includes(c.id));
  const scored = pool.map((c) => ({ c, ...match(c, prof) }));
  const [nS, nF, nR] = MODES[S.mode];

  // Serious: best scores, but each pick is penalized for overlapping one already chosen (variety).
  const cand = scored.filter((x) => x.c.kind === "serious" && x.score > 0);
  const serious = [];
  while (serious.length < nS && cand.length) {
    let bi = 0, bs = -1e9;
    cand.forEach((x, i) => { const s = x.score - serious.reduce((a, o) => a + 0.5 * overlap(x.c, o.c), 0); if (s > bs) { bs = s; bi = i; } });
    serious.push(cand.splice(bi, 1)[0]);
  }
  // Try something new: fun clubs ranked by interest match, minus a penalty for repeating clubs you're in, plus luck.
  const used = new Set(serious.map((x) => x.c.id));
  const fresh = scored.filter((x) => x.c.kind === "fun")
    .map((x) => ({ ...x, r: x.score - 0.75 * [...x.c.nt].filter((t) => mineTags.has(t)).length + Math.random() * 1.5 })).sort((a, b) => b.r - a.r).slice(0, nF);
  fresh.forEach((x) => used.add(x.c.id));
  const random = scored.filter((x) => !used.has(x.c.id)).sort(() => Math.random() - 0.5).slice(0, nR);

  const item = (x) => card(x.c, { why: reasonText(x.reasons), busy, feedback: true });
  const seen = new Set(), chips = [];
  for (const c of CLUBS) for (const t of c.tags) {
    const o = prof.get(normTag(t));
    if (o && !seen.has(normTag(t))) { seen.add(normTag(t)); chips.push({ t, o }); }
  }
  chips.sort((a, b) => b.o.w - a.o.w);
  const panel = `<details class="panel"><summary>What we think you're into <span class="soft">${chips.length}</span></summary>
    <p class="hint">Remove anything that's off and the picks update.</p>
    <div class="chips">${chips.slice(0, 30).map(({ t, o }) => `<span class="chip pill" title="${esc(o.src)}"><mark>${esc(t)}</mark><button type="button" data-mute="${esc(t)}" aria-label="Remove ${esc(t)}">${ICON.x}</button></span>`).join("") || "<span class='hint'>Nothing yet.</span>"}</div>
    ${S.muted.length ? `<p class="hint">Removed: ${S.muted.map((t) => `<button type="button" class="link" data-unmute="${esc(t)}">${esc(t)}, undo</button>`).join(" ")}</p>` : ""}</details>`;
  const sec = (title, sub, items, empty) => `<div class="band"><h3>${title}</h3><p>${sub}</p></div>${grid(items.map(item), empty)}`;
  box.innerHTML = `<div class="intro"><h2 id="h-recs">${S.profile.name ? `${esc(S.profile.name)}, here` : "Here"} are your picks</h2>
    <p>Each one says why it was chosen. Circle what you like; hide what you don't.</p></div>
    <div class="toolbar"><fieldset class="seg"><legend>Mix</legend>${[["focused", "Focused"], ["balanced", "Balanced"], ["adventurous", "Adventurous"]].map(([v, l]) => `<label><input type="radio" name="mode" value="${v}" ${S.mode === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</fieldset>
    <button type="button" class="secondary" id="reroll">Shuffle fun and random</button>${S.dismissed.length ? `<button type="button" class="secondary" id="restore">Show ${S.dismissed.length} hidden</button>` : ""}</div>
    ${panel}
    ${sec("Serious picks", "Skill-building clubs that match your classes and interests, with variety.", serious, "Add classes, interests or a bio to get matches.")}
    ${sec("Try something new", "Fun clubs outside what you already do.", fresh, "Nothing new to suggest.")}
    ${sec("Random", "Pure chance.", random, "No clubs left.")}`;
}

function renderSaved() {
  const box = $("#saved"), shared = sharedList;
  const ids = shared || S.saved, clubs = ids.map((id) => BY_ID.get(id)).filter(Boolean), busy = parseBusy(S.profile.times);
  const total = clubs.reduce((a, c) => a + (c.hours || 0), 0);
  const deadlines = clubs.filter((c) => c.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const bar = Array.from({ length: 15 }, (_, i) => `<i class="${i < total ? (i >= 10 ? "on over" : "on") : ""}"></i>`).join("");
  box.innerHTML = `<div class="intro"><h2 id="h-saved">${shared ? "A shared shortlist" : "My shortlist"}</h2></div>` +
    (shared ? `<p class="banner">Someone shared ${clubs.length} club${clubs.length === 1 ? "" : "s"} with you. <button type="button" id="adoptList">Add all to my shortlist</button> <a href="#saved">Back to mine</a></p>` : "") +
    (clubs.length ? `<div class="load"><p><strong>${total} hours a week</strong> across ${clubs.length} club${clubs.length === 1 ? "" : "s"}</p>
        <div class="loadbar" role="img" aria-label="${total} of 15 weekly hours">${bar}</div>
        <p class="hint">${total > 10 ? "That's a lot. Most students do 2 to 3 activities." : "Each block is one hour a week."}</p></div>
      <div class="row noprint"><button type="button" id="print">Print checklist</button><button type="button" class="secondary" id="shareList">Share this list</button></div>
      ${deadlines.length ? `<div class="band"><h3>Deadlines</h3></div><ul class="deadlines">${deadlines.map((c) => `<li><span>${esc(c.name)}</span><span class="stamp">${esc(deadlineText(c))}</span></li>`).join("")}</ul>` : ""}
      <div class="band"><h3>Your clubs</h3></div>${grid(clubs.map((c) => card(c, { busy })), "")}`
      : `<div class="empty"><p>Nothing circled yet. Tap a club's number to keep it here.</p><a class="btn" href="#browse">Browse clubs</a></div>`);
}

function showDetail(id) {
  const c = BY_ID.get(id), dlg = $("#detail");
  if (!c) return;
  const busy = parseBusy(S.profile.times), bad = conflicts(c, busy), saved = S.saved.includes(id);
  const similar = CLUBS.filter((x) => x.id !== id).map((x) => ({ x, o: overlap(c, x) + (x.category === c.category ? 0.5 : 0) })).filter((s) => s.o > 0).sort((a, b) => b.o - a.o).slice(0, 3);
  const fm = c.firstMeeting;
  const facts = [
    c.day && ["Meets", `${esc(c.day)} ${esc((c.time || "").replace("-", "–"))}`],
    c.hours != null && ["Time", `~${c.hours} hours a week (${hoursLabel(c.hours)})`],
    c.dues != null && ["Cost", cost(c)],
    c.join && ["How to join", `${JOIN[c.join]}${c.deadline ? ". " + esc(deadlineText(c)) : ""}`],
    c.beginner != null && ["Beginners", c.beginner ? "Welcome" : "Some experience expected"],
  ].filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  const hard = ["application", "audition", "tryout"].includes(c.join);
  dlg.innerHTML = `<form method="dialog" class="dhead"><h2 id="detailTitle">${esc(c.name)}</h2><button aria-label="Close">${ICON.x}</button></form>
    <p class="flags"><span class="kind ${c.kind}">${c.kind === "serious" ? "Serious" : "Fun"}</span><span>${esc(c.category)}</span>${joinNow(c) ? `<span class="good">Join anytime</span>` : ""}${bad.length ? `<span class="stamp">Conflicts with ${esc(bad.join(", "))}</span>` : ""}</p>
    <p class="desc">${esc(c.desc)}</p><dl class="facts wide">${facts}</dl>
    ${fm ? `<h3>Your first meeting</h3><p>${esc(fm.where || "")} ${fm.bring ? "Bring: " + esc(fm.bring) + "." : ""} ${esc(fm.note || "")}</p>` : ""}
    ${c.contact ? `<p><a href="mailto:${esc(c.contact)}">Contact the club</a></p>` : ""}
    ${/^https:\/\//.test(c.groupsUrl || "") ? `<p><a href="${esc(c.groupsUrl)}" rel="noopener">View on Dartmouth Groups</a></p>` : ""}
    <div class="row"><button type="button" class="savebtn" data-save="${id}" aria-pressed="${saved}">${saved ? "Saved" : "Save to shortlist"}</button>
      <button type="button" class="secondary" data-share="club">Share</button>
      <button type="button" class="secondary" data-like="${id}">More like this</button>${S.dismissed.includes(id) ? `<button type="button" class="secondary" data-undismiss="${id}">Show again</button>` : `<button type="button" class="secondary" data-dismiss="${id}">Not for me</button>`}</div>
    ${hard ? `<p><button type="button" class="text" data-alt="${id}">Didn't get in? See open alternatives</button></p>` : ""}
    <div id="alts"></div>
    ${similar.length ? `<h3>Similar clubs</h3><ul class="similar">${similar.map((s) => `<li><button type="button" class="link" data-open="${s.x.id}">${esc(s.x.name)}</button></li>`).join("")}</ul>` : ""}`;
  if (!dlg.open) dlg.showModal();
}

function toast(msg, undo) {
  const t = $("#toast");
  t.hidden = false;
  t.innerHTML = `${esc(msg)} ${undo ? `<button type="button" id="undo">Undo</button>` : ""}`;
  if (undo) $("#undo").onclick = () => { undo(); t.hidden = true; };
  clearTimeout(lastToast);
  lastToast = setTimeout(() => (t.hidden = true), 10000);
}

// ---- actions ----
function refresh() {
  persist();
  $("#savedCount").textContent = S.saved.length;
  if (curTab === "browse") renderBrowse();
  if (curTab === "recs") renderRecs();
  if (curTab === "saved") renderSaved();
  const open = $("#detail").open && location.hash.match(/^#club-(\d+)$/);
  if (open) showDetail(+open[1]);
}
function toggleSave(id) {
  S.saved = S.saved.includes(id) ? S.saved.filter((x) => x !== id) : [...S.saved, id];
  if (curTab !== "saved") { persist(); syncStars(); $("#savedCount").textContent = S.saved.length; return; } // update in place so the pen circle animates and focus stays put
  refresh();
}
function syncStars() {
  $$("[data-save]").forEach((b) => {
    const on = S.saved.includes(+b.dataset.save);
    b.setAttribute("aria-pressed", on);
    if (b.classList.contains("savebtn")) b.textContent = on ? "Saved" : "Save to shortlist";
    b.closest(".entry")?.classList.toggle("is-saved", on);
  });
}
function dismiss(id) {
  S.dismissed.push(id);
  S.saved = S.saved.filter((x) => x !== id);
  const undo = () => { S.dismissed = S.dismissed.filter((x) => x !== id); refresh(); };
  if (curTab === "recs") { persist(); $$(`.entry[data-id="${id}"]`).forEach((r) => r.remove()); $("#savedCount").textContent = S.saved.length; } // keep the other picks as they are
  else refresh();
  toast(`Hidden “${BY_ID.get(id).name}”.`, undo);
}
async function share(text, url) {
  try {
    if (navigator.share) await navigator.share({ title: "Dartmouth Club Finder", text, url });
    else { await navigator.clipboard.writeText(url); toast("Link copied."); }
  } catch { toast("Couldn't share. Copy the address bar link instead."); }
}

function show(tab) {
  curTab = tab;
  $$("main > section").forEach((s) => (s.hidden = s.id !== tab));
  $$("nav a").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  refresh();
}
function route() {
  const h = location.hash.slice(1) || "browse";
  const club = h.match(/^club-(\d+)$/);
  if (club) { if ($$("main > section:not([hidden])").length === 0) show(curTab); showDetail(+club[1]); return; }
  if ($("#detail").open) $("#detail").close();
  sharedList = null;
  if (h.startsWith("list=")) { sharedList = h.slice(5).split(",").map(Number).filter((id) => BY_ID.has(id)); show("saved"); return; }
  show(TABS.includes(h) ? h : "browse");
  $("#main").focus({ preventScroll: true });
}

// ---- profile form ----
function fillForm() {
  const f = $("#form"), p = S.profile;
  for (const k of ["name", "times", "bio"]) f.elements[k].value = typeof p[k] === "string" ? p[k] : "";
  const have = list(p.classes), known = new Set(COURSES.map(([code]) => code));
  f.elements.classes.value = have.filter((c) => !known.has(c.toUpperCase())).join(", ");
  $("#courseChecks").innerHTML = COURSES.map(([code, title]) => `<label><input type="checkbox" name="course" value="${esc(code)}" ${have.some((c) => c.toUpperCase() === code) ? "checked" : ""}> ${esc(code)} — ${esc(title)}</label>`).join("");
  renderInterests(false);
  $("#clubChecks").innerHTML = CLUBS.map((c) => `<label><input type="checkbox" name="clubs" value="${c.id}" ${p.clubs.includes(c.id) ? "checked" : ""}> ${esc(c.name)}</label>`).join("");
}
function renderInterests(all) {
  const freq = {};
  CLUBS.forEach((c) => c.tags.forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
  let tags = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
  const chosen = new Set(S.profile.interests);
  const shown = all ? tags.sort() : [...new Set([...tags.slice(0, 30), ...chosen])].sort();
  $("#interestChips").innerHTML = shown.map((t) => `<label class="chip"><input type="checkbox" name="interests" value="${esc(t)}" ${chosen.has(t) ? "checked" : ""}> ${esc(t)}</label>`).join("");
  $("#moreInterests").hidden = all;
}
function init() {
  loadState();
  [...new Set(CLUBS.map((c) => c.category))].sort().forEach((c) => $("#cat").insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));
  DAYS.forEach((d) => $("#day").insertAdjacentHTML("beforeend", `<option>${d}</option>`));
  fillForm();
  if (!hasProfile()) $("#sort").value = F.sort = "name";

  const readFilters = () => { F.q = $("#q").value; F.cat = $("#cat").value; F.kind = $("#kind").value; F.day = $("#day").value; F.sort = $("#sort").value; $$("[data-f]").forEach((i) => (F[i.dataset.f] = i.checked)); renderBrowse(); };
  $$(".rail input,.rail select").forEach((el) => el.addEventListener("input", readFilters));
  const clear = () => { $("#q").value = ""; $$(".rail select").forEach((s) => (s.selectedIndex = 0)); $$("[data-f]").forEach((i) => (i.checked = false)); $("#sort").value = hasProfile() ? "match" : "name"; readFilters(); };
  $("#clearFilters").onclick = clear;
  $("#moreInterests").onclick = () => renderInterests(true);
  const filterChecks = (input, box) => (input.oninput = (e) => $$(`${box} label`).forEach((l) => (l.hidden = !l.textContent.toLowerCase().includes(e.target.value.toLowerCase()))));
  filterChecks($("#clubFilter"), "#clubChecks");
  filterChecks($("#courseFilter"), "#courseChecks");
  $("#form").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    S.profile = { name: fd.get("name").trim(), classes: [...fd.getAll("course"), ...list(fd.get("classes"))].join(", "), times: fd.get("times"), bio: fd.get("bio").trim(), interests: fd.getAll("interests"), clubs: fd.getAll("clubs").map(Number) };
    persist();
    location.hash = "#recs";
  };
  $("#clearProfile").onclick = () => { S = { ...S, profile: { clubs: [], interests: [] }, liked: [], muted: [], dismissed: [] }; persist(); fillForm(); toast("Profile cleared."); };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset, id = +(d.open || d.save || d.like || d.dismiss || d.alt);
    if (d.open) location.hash = "#club-" + id;
    else if (d.save) toggleSave(id);
    else if (d.dismiss) {
      const rows = $$(`.entry[data-id="${id}"]`);
      rows.forEach((r) => r.classList.add("struck"));
      const go = () => { $("#detail").open && $("#detail").close(); dismiss(id); };
      matchMedia("(prefers-reduced-motion: reduce)").matches || !rows.length ? go() : setTimeout(go, 380);
    }
    else if (d.undismiss) { S.dismissed = S.dismissed.filter((x) => x !== +d.undismiss); refresh(); }
    else if (d.like) { if (!S.liked.includes(id)) S.liked.push(id); refresh(); toast(`Showing more like “${BY_ID.get(id).name}”.`); }
    else if (d.mute !== undefined) { S.muted.push(d.mute); refresh(); }
    else if (d.unmute !== undefined) { S.muted = S.muted.filter((x) => x !== d.unmute); refresh(); }
    else if (d.alt) {
      const c = BY_ID.get(id), alts = CLUBS.filter((x) => x.id !== id && joinNow(x) && x.join === "open" && (overlap(c, x) || x.category === c.category)).slice(0, 3);
      $("#alts").innerHTML = `<h3>Open alternatives</h3><ul class="similar">${alts.map((x) => `<li><button type="button" class="link" data-open="${x.id}">${esc(x.name)}</button> — join anytime</li>`).join("") || "<li>None right now.</li>"}</ul>`;
    }
    else if (d.share) share(BY_ID.get(+location.hash.slice(6))?.name || "A club", location.href);
    else if (t.id === "reroll") renderRecs();
    else if (t.id === "restore") { S.dismissed = []; refresh(); }
    else if (t.id === "print") window.print();
    else if (t.id === "shareList") share("My club shortlist", location.origin + location.pathname + "#list=" + S.saved.join(","));
    else if (t.id === "adoptList") { S.saved = [...new Set([...S.saved, ...sharedList])]; location.hash = "#saved"; }
    else if (t.id === "clearInline") clear();
  });
  document.addEventListener("change", (e) => { if (e.target.name === "mode") { S.mode = e.target.value; refresh(); } });
  // Filters sit open beside the list on wide screens and fold away on phones.
  const wide = matchMedia("(min-width: 860px)");
  const fold = () => { $("#filterBox").open = wide.matches; };
  wide.addEventListener("change", fold); fold();
  const dlg = $("#detail");
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  // Watch the `open` attribute rather than the "close" event, which some embedded browsers never fire.
  new MutationObserver(() => { if (!dlg.open && /^#club-/.test(location.hash)) history.replaceState(null, "", "#" + curTab); }).observe(dlg, { attributes: true, attributeFilter: ["open"] });
  addEventListener("hashchange", route);
  route();
}

if (typeof document !== "undefined") init();
if (typeof module !== "undefined") module.exports = { normTag, terms, SYN, buildProfile, match, parseBusy, conflicts, S, CLUBS, loadState };
