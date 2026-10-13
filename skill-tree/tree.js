// Shared node rendering, icons, and selection state for the Skill Tree pages.
const GREEN = "#023020";
const NS = "http://www.w3.org/2000/svg";
const KEY = "skilltree:selected";

function loadSelected() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}
function saveSelected(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
}

const S = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';
const gear = (r) => {
  const teeth = 16, c = 2 * Math.PI * (r + 4);
  return `<circle r="${r + 4}" fill="none" stroke="currentColor" stroke-width="8" stroke-dasharray="${c / teeth / 2} ${c / teeth / 2}"/>
  <path fill="currentColor" fill-rule="evenodd" d="M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0M-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0"/>`;
};

const ICONS = {
  tech: `<g transform="translate(-12 -10)">${gear(17)}</g><g transform="translate(24 22) scale(.65)">${gear(17)}</g>`,
  academic: `<path fill="currentColor" d="M-3 -19C-14 -27-30 -27-42 -22V26C-30 21-14 21-3 28Z"/><path fill="currentColor" d="M3 -19C14 -27 30 -27 42 -22V26C30 21 14 21 3 28Z"/>`,
  career: `<rect x="-40" y="-20" width="80" height="58" rx="7" fill="currentColor"/><path d="M-14 -20V-30H14V-20" ${S}/><path class="cut" d="M-40 2H40" fill="none" stroke-width="4"/><rect x="-6" y="-3" width="12" height="12" rx="2" fill="currentColor" class="cut" stroke-width="4"/>`,
  recreation: `<g ${S} stroke-width="7"><circle cx="10" cy="-34" r="8" fill="currentColor"/><path d="M4 -22L-4 4"/><path d="M4 -20L20 -8L32 -14"/><path d="M3 -18L-12 -8L-22 -18"/><path d="M-4 4L10 16L6 36"/><path d="M-4 4L-18 18L-34 12"/><path d="M-44 -22H-30M-46 -8H-34M-44 6H-36" stroke-width="4"/></g>`,
  arts: `<g transform="translate(-14 -6)"><path fill="currentColor" d="M-26 -26Q-8 -34 10 -26V4Q10 28 -8 32Q-26 28 -26 4Z"/><g class="cut" fill="none" stroke-width="3.5" stroke-linecap="round"><circle cx="-16" cy="-10" r="0"/><path d="M-20 -12Q-16 -16 -12 -12M-4 -12Q0 -16 4 -12M-18 8Q-8 18 2 8"/></g></g>
    <g transform="translate(20 14)"><path fill="currentColor" d="M-26 -26Q-8 -34 10 -26V4Q10 28 -8 32Q-26 28 -26 4Z"/><g class="cut" fill="none" stroke-width="3.5" stroke-linecap="round"><path d="M-20 -8L-12 -12M-4 -12L4 -8M-18 18Q-8 8 2 18"/></g></g>
    <g transform="translate(22 -4) rotate(10)" class="brush"><g stroke="var(--cut)" stroke-width="7" stroke-linejoin="round" style="paint-order:stroke" fill="currentColor"><rect x="-4" y="-44" width="8" height="46" rx="4"/><rect x="-6" y="2" width="12" height="10"/><path d="M-7 14H7C7 28 2 38 0 46C-2 38-7 28-7 14Z"/></g></g>`,
  service: `<rect x="-48" y="-16" width="9" height="34" rx="2" fill="currentColor"/><rect x="39" y="-16" width="9" height="34" rx="2" fill="currentColor"/><path fill="currentColor" d="M-36 -12L-16 -20L0 -12L14 -20L36 -12V10L20 24L8 30L-4 26L-20 18L-36 8Z"/><path class="cut" fill="none" stroke-width="3" stroke-linecap="round" d="M-8 -8L10 6M2 -2L14 12M-6 6L6 18M-14 2L-2 14"/>`,
  leadership: `<g ${S}><path d="M-40 -10H-22L24 -32V32L-22 10H-40Z"/><path d="M-26 10L-20 36H-6L-8 20"/><path d="M34 -12Q42 0 34 12"/><path d="M40 -24Q56 0 40 24"/></g>`,
  social: `<g ${S} stroke-width="5"><circle cx="-34" cy="-8" r="8"/><path d="M-48 28V20Q-48 8 -34 8Q-26 8 -22 12"/><circle cx="34" cy="-8" r="8"/><path d="M48 28V20Q48 8 34 8Q26 8 22 12"/><circle cx="0" cy="-20" r="11" style="fill:var(--cut)"/><path d="M-20 30V14Q-20 2 0 2Q20 2 20 14V30Z" style="fill:var(--cut)"/></g>`,
  sports: `<g stroke="var(--cut)" stroke-width="4" style="paint-order:stroke" fill="currentColor">
    <ellipse cx="2" cy="22" rx="30" ry="17" transform="rotate(-20 2 22)"/>
    <circle cx="-20" cy="-12" r="22"/><circle cx="22" cy="-14" r="22"/></g>
    <g class="cut" fill="none" stroke-width="2.5" stroke-linecap="round"><path d="M-20 -34V10M-42 -12H2M-36 -28Q-24 -12 -36 4M-4 -28Q-16 -12 -4 4"/><path d="M22 -36Q10 -22 22 -14Q38 -10 42 -8M6 -30Q22 -26 32 -4M44 -18Q30 -14 22 -14"/><path d="M-14 25L18 17M-6 19L-3 27M2 17L5 25M10 15L13 23" transform="rotate(0)"/></g>`,
  wellness: `<path fill="currentColor" d="M0 38C-52 2-42 -36-20 -36C-8 -36 0 -28 0 -20C0 -28 8 -36 20 -36C42 -36 52 2 0 38Z"/>`,
  concert: `<rect x="-12" y="-42" width="24" height="46" rx="12" fill="currentColor"/><path class="cut" fill="none" stroke-width="3" d="M-12 -28H12M-12 -18H12M-12 -8H12"/><path d="M-24 -6V2A24 24 0 0 0 24 2V-6M0 26V40M-14 42H14" ${S}/>`,
  dartmouth: `<path fill="currentColor" fill-rule="evenodd" d="M-30 -36H0C26 -36 38 -20 38 0C38 20 26 36 0 36H-30V28H-24V-28H-30ZM-10 -26V26H-2C14 26 20 14 20 0C20 -14 14 -26 -2 -26Z" transform="translate(-4 0)"/>`,
  cultural: `<g ${S} stroke-width="5"><circle r="38"/><ellipse rx="16" ry="38"/><path d="M-38 0H38M-33 -19Q0 -10 33 -19M-33 19Q0 28 33 19"/></g>`,
  speaker: `<g ${S} stroke-width="5"><circle cx="-10" cy="-20" r="13"/><path d="M-36 38V24Q-36 8 -10 8Q16 8 16 24V38"/><path d="M26 -28Q34 -20 26 -12"/><path d="M34 -38Q50 -20 34 -2"/></g>`,
};

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// spec: {id, x, y, r, label, fontPt, icon, iconScale, href}
function addNode(svg, spec, selected) {
  const g = el("g", { class: "node", tabindex: 0, role: "button", "aria-label": spec.label, transform: `translate(${spec.x} ${spec.y})` }, svg);
  el("circle", { class: "disc", r: spec.r }, g);
  const icon = el("g", { class: "icon", transform: `scale(${spec.iconScale || 1})` }, g);
  icon.innerHTML = ICONS[spec.icon];
  const t = el("text", { class: "label", "font-size": spec.fontPt * 4 / 3 }, g);
  t.textContent = spec.label;
  const paint = (on) => g.classList.toggle("selected", on);
  paint(spec.forceSelected ?? selected.has(spec.id));
  const act = () => {
    if (spec.href) { location.href = spec.href; return; }
    const on = !selected.has(spec.id);
    on ? selected.add(spec.id) : selected.delete(spec.id);
    saveSelected(selected);
    paint(on);
  };
  g.addEventListener("click", act);
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
  return g;
}
