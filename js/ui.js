export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  book: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  out: '<path d="M14 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9M9 12h12m-5-5 5 5-5 5"/>',
  back: '<path d="M10 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9M15 12H3m5-5-5 5 5 5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  inventory: '<rect x="4" y="4" width="16" height="18" rx="3"/><path d="M9 2h6v4H9zM8 13l3 3 5-6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  chart: '<path d="M4 3v18h17M8 16v-5m5 5V6m5 10v-8"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 16c7 5 16-1 15-13zM4 21 16 9"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  wifi: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r=".5"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
export const button = (text, action, cls = '', attrs = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
export function toast(text, error = false) {
  const node = document.querySelector('#toast'); node.textContent = text; node.className = `visible ${error ? 'error' : ''}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.className = '', 4200);
}
export function modal(title, content, wide = false) {
  const dialog = document.querySelector('#dialog');
  dialog.className = wide ? 'wide' : '';
  dialog.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="Schließen">${icon('close')}</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
}
export const field = (label, name, value = '', attrs = '') => `<label>${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
export const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
export const emptyView = (title, text, action = '') => `<div class="empty">${icon('book')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob(['\ufeff', text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows) { return rows.map(row => row.map(cell => { let text = String(cell ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }).join(';')).join('\r\n'); }
