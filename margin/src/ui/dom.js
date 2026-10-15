// Minimal DOM helpers. User content is always inserted as text nodes, never as HTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let seq = 0;
export function uid(prefix = 'u') { seq += 1; return `${prefix}-${seq}`; }

const PATHS = {
  chart: 'M4 20V11h4v9M10 20V6h4v14M16 20V3h4v17',
  search: 'M20 20l-5-5M16 10a6 6 0 1 1-12 0a6 6 0 0 1 12 0',
  settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  help: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17v.1',
  today: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h3v3H8z',
  week: 'M3 5h18v15H3zM3 10h18M9 10v10M15 10v10',
  tasks: 'M4 6l2 2 3-4M12 6h8M4 13l2 2 3-4M12 13h8M4 20h4M12 20h8',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 3.5l9.5 17h-19zM12 10v4.5M12 17.5v.5',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v6M12 7.5v.5',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3.5 2',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  flag: 'M6 21V4M6 4h11l-2.5 4L17 12H6',
  pin: 'M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21zM12 7.5a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6',
  play: 'M8 5.5v13l10.5-6.5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export function icon(name, { label = null, size = 16 } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', `icon icon-${name}`);
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', PATHS[name] || PATHS.info);
  svg.append(p);
  return svg;
}

export function plural(n, one, many = `${one}s`) { return `${n} ${n === 1 ? one : many}`; }

// Small typed tag used to distinguish hard rules, preferences, estimates, and heuristics.
export const REASON_LABELS = { hard: 'Fixed', soft: 'Your preference', estimate: 'Estimate', heuristic: 'Best guess', relaxed: 'Relaxed limit' };
export function reasonList(reasons) {
  return h('ul', { class: 'reasons' }, reasons.map((r) => h('li', { class: `reason reason-${r.type}` },
    h('span', { class: 'reason-tag' }, REASON_LABELS[r.type] || 'Note'), h('span', { class: 'reason-text' }, r.text))));
}

export function download(filename, text, mime = 'application/json') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}
