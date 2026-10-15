// Native <dialog> elements: focus trapping and Escape handling come from the platform.

import { h, icon, uid } from './dom.js';

export function openDialog({ title, subtitle = null, content, actions = [], size = 'md', onClose = null, initialFocus = null }) {
  const titleId = uid('dlg-title');
  const returnTo = document.activeElement;
  const dlg = h('dialog', { class: `dlg dlg-${size}`, 'aria-labelledby': titleId });
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    if (dlg.open) dlg.close();
    dlg.remove();
    if (returnTo && document.contains(returnTo) && typeof returnTo.focus === 'function') returnTo.focus();
    if (onClose) onClose(result);
  };
  const body = h('div', { class: 'dlg-body' });
  const header = h('header', { class: 'dlg-head' },
    h('div', null, h('h2', { id: titleId, class: 'dlg-title' }, title), subtitle ? h('p', { class: 'dlg-sub' }, subtitle) : null),
    h('button', { type: 'button', class: 'btn-icon', 'aria-label': 'Close', onclick: () => close(null) }, icon('x')));
  const footer = h('footer', { class: 'dlg-foot' });
  dlg.append(header, body, footer);
  const api = { close, dlg, body, footer, setActions };
  function setActions(list) {
    footer.replaceChildren(...list.filter(Boolean).map((a) => (a instanceof Node ? a : h('button', {
      type: a.submit ? 'submit' : 'button', form: a.form || null,
      class: ['btn', a.primary && 'btn-primary', a.danger && 'btn-danger', a.quiet && 'btn-quiet'], onclick: a.onClick ? (e) => a.onClick(e, api) : null, disabled: a.disabled,
    }, a.label))));
    footer.hidden = !list.filter(Boolean).length;
  }
  const node = typeof content === 'function' ? content(api) : content;
  if (node) body.append(node);
  setActions(actions);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
  dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) close(null); });
  document.body.append(dlg);
  dlg.showModal();
  const focusTarget = (initialFocus && dlg.querySelector(initialFocus)) || body.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, button');
  if (focusTarget) focusTarget.focus();
  return api;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, requireText = null }) {
  return new Promise((resolve) => {
    let input = null;
    const api = openDialog({
      title, size: 'sm', onClose: (r) => resolve(r === true),
      content: () => h('div', { class: 'stack' },
        typeof message === 'string' ? h('p', null, message) : message,
        requireText ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, `Type ${requireText} to confirm`),
          (input = h('input', { type: 'text', autocomplete: 'off', oninput: () => { btn.disabled = input.value.trim() !== requireText; } }))) : null),
      actions: [],
    });
    const btn = h('button', { type: 'button', class: ['btn', danger ? 'btn-danger' : 'btn-primary'], disabled: !!requireText, onclick: () => api.close(true) }, confirmLabel);
    api.setActions([{ label: 'Cancel', quiet: true, onClick: () => api.close(false) }, btn]);
    if (!requireText) btn.focus();
  });
}

let region = null;
export function toast(message, { actionLabel = null, onAction = null, tone = 'neutral', timeout = 7000 } = {}) {
  if (!region) {
    region = document.getElementById('toasts');
    if (!region) { region = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite', role: 'status' }); document.body.append(region); }
  }
  const el = h('div', { class: `toast toast-${tone}` }, h('span', null, message));
  let timer = null;
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  if (actionLabel && onAction) el.append(h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => { dismiss(); onAction(); } }, actionLabel));
  el.append(h('button', { type: 'button', class: 'btn-icon btn-sm', 'aria-label': 'Dismiss', onclick: dismiss }, icon('x', { size: 14 })));
  region.append(el);
  timer = setTimeout(dismiss, timeout);
  return dismiss;
}
