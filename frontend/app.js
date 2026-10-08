const $ = (s) => document.querySelector(s);
const CLUBS = window.CLUBS;
const KEY = "clubfinder.profile";

// Course department prefix -> interest words (so "COSC 10" counts as programming interest).
const DEPT = {
  cosc: "cosc programming python data ai", engs: "engs engineering design hardware robot", econ: "econ finance markets business",
  math: "math logic statistics", govt: "govt politics debate international", bio: "bio biology science health research",
  chem: "chem chemistry science research", phys: "physics astronomy science", psyc: "psychology health", envs: "envs environment climate sustainability",
  engl: "english writing literature creative", writ: "writing creative", film: "film media cinema", musi: "music singing performance",
  arth: "art design visual", thea: "theater acting performance", phil: "philosophy ethics debate", educ: "education teaching tutoring",
  jpn: "japan culture language", span: "language culture international", fren: "language culture international", chin: "language culture international",
};

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const list = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

// Everything the user told us, as one lowercase blob to match tags against.
function profileText(p) {
  const depts = list(p.classes).map((c) => DEPT[c.toLowerCase().match(/^[a-z]+/)?.[0]] || c.toLowerCase());
  return [p.bio, ...depts, ...list(p.classes)].join(" ").toLowerCase();
}
const score = (club, text) => club.tags.filter((t) => text.includes(t)).length + (text.includes(club.category.toLowerCase()) ? 0.5 : 0);
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const why = (club, text) => { const m = club.tags.filter((t) => text.includes(t)); return m.length ? "Matches: " + m.join(", ") : ""; };

function card(c, note = "") {
  return `<article class="card"><div class="meta"><span class="badge ${c.kind}">${c.kind === "serious" ? "Serious" : "Fun"}</span><span class="badge">${c.category}</span><span class="badge">${c.day}</span></div>
  <h3>${c.name}</h3><p>${c.desc}</p>${note ? `<p class="why">${note}</p>` : ""}</article>`;
}

function renderBrowse() {
  const q = $("#q").value.toLowerCase(), cat = $("#cat").value;
  const hits = CLUBS.filter((c) => (!cat || c.category === cat) &&
    (c.name + " " + c.desc + " " + c.tags.join(" ")).toLowerCase().includes(q));
  $("#count").textContent = `${hits.length} club${hits.length === 1 ? "" : "s"}`;
  $("#list").innerHTML = hits.map((c) => card(c)).join("") || `<p class="empty">No clubs match.</p>`;
}

function renderRecs() {
  const p = load(), box = $("#recs");
  if (!p.bio && !p.classes && !p.clubs) { box.innerHTML = `<p class="empty">Fill in your profile first to get recommendations.</p>`; return; }
  const text = profileText(p);
  const mine = new Set(list(p.clubs).map((s) => s.toLowerCase()));
  const pool = CLUBS.filter((c) => !mine.has(c.name.toLowerCase()));
  const byScore = (kind) => pool.filter((c) => c.kind === kind).map((c) => ({ c, s: score(c, text) })).sort((a, b) => b.s - a.s);

  const serious = byScore("serious").slice(0, 3).filter((x) => x.s > 0);
  // "Try something new": fun clubs that don't overlap the user's existing clubs' tags, picked at random from the best of the rest.
  const mineTags = new Set(CLUBS.filter((c) => mine.has(c.name.toLowerCase())).flatMap((c) => c.tags));
  const fresh = shuffle(byScore("fun").filter((x) => !x.c.tags.some((t) => mineTags.has(t)))).slice(0, 3);
  const used = new Set([...serious, ...fresh].map((x) => x.c.id));
  const random = shuffle(pool.filter((c) => !used.has(c.id))).slice(0, 3);

  const section = (title, sub, items, note) => `<h2>${title}</h2><p class="sub">${sub}</p><div class="grid">${items.join("") || `<p class="empty">${note}</p>`}</div>`;
  box.innerHTML =
    `<p>${p.name ? `Hi ${p.name}! ` : ""}<button class="reroll" id="reroll">Shuffle fun &amp; random picks</button></p>` +
    section("Serious picks for you", "Skill-building clubs that match your classes and interests.", serious.map((x) => card(x.c, why(x.c, text))), "Add more detail to your profile to get matches.") +
    section("Try something new", "Fun clubs outside what you already do.", fresh.map((x) => card(x.c, why(x.c, text))), "Nothing new to suggest.") +
    section("Random", "Pure chance — who knows?", random.map((c) => card(c)), "No clubs left.");
  $("#reroll").onclick = renderRecs;
}

function show(tab) {
  document.querySelectorAll("main > section").forEach((s) => (s.hidden = s.id !== tab));
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "recs") renderRecs();
}

document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => show(b.dataset.tab)));
$("#q").oninput = $("#cat").onchange = renderBrowse;
[...new Set(CLUBS.map((c) => c.category))].sort().forEach((c) => $("#cat").insertAdjacentHTML("beforeend", `<option>${c}</option>`));
$("#clubnames").innerHTML = CLUBS.map((c) => `<option value="${c.name}">`).join("");

const form = $("#form");
const saved = load();
for (const [k, v] of Object.entries(saved)) if (form.elements[k]) form.elements[k].value = v;
form.onsubmit = (e) => {
  e.preventDefault();
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
  show("recs");
};
renderBrowse();
