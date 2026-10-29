import { data, openStore, change, reload, uid, addCopies, lend, giveBack, validateBackup, demoState, empty, STATUS, categoryName, workOf } from './store.js';
import { ui, shell, content, workDetail, workForm, dueBadge } from './views.js';
import { validDate } from './insights.js';
import { esc, button, field, option, modal, toast, download, csv } from './ui.js';
const dialog = document.querySelector('#dialog');
let busy = false, installPrompt;
const close = () => dialog.close();
function render() { document.querySelector('#app').innerHTML = shell(); }
function renderMain() { document.querySelector('#main').innerHTML = content(); }
function go(page) { ui.search = ''; ui.page = page; location.hash = page; render(); window.scrollTo(0, 0); }
function detail(id) { const work = data.works.find(w => w.id === id); if (work) modal('Ein Blick ins Buch', workDetail(work), true); }
function confirm(title, text, action) { modal(title, `<p>${text}</p><div class="form-footer">${button('Abbrechen', 'close', 'secondary')}${button('Bestätigen', action, 'danger')}</div>`); }
async function commit(fn, label, message) { await change(fn, label); render(); if (message) toast(message); }
function focusNext(id) { document.getElementById(id)?.focus({ preventScroll: true }); }
function selectStudent(id) {
  if (ui.sessionLoans.length && ui.selectedStudent !== id) throw new Error('Bitte zuerst den laufenden Ausleihvorgang beenden.');
  const student = data.students.find(s => s.id === id);
  if (!student?.active) throw new Error('Bitte eine aktive Schüler-ID wählen.');
  ui.selectedStudent = id; ui.loanClass = student.className;
}
function clearSession() { ui.selectedStudent = ''; ui.sessionLoans = []; ui.dueDate = ''; ui.loanQuery = ''; }
async function performLoan(id, studentId, dueDate) {
  selectStudent(studentId);
  await change(s => lend(s, id, studentId, dueDate), `${id} ausgeliehen`);
  ui.sessionLoans.push(id); ui.dueDate = dueDate; ui.loanQuery = '';
  render(); toast(`${id} ausgeliehen. Bereit für das nächste Buch.`);
  if (ui.page === 'lend' && !ui.search) focusNext('loan-query');
}
function studentForm(s = {}) {
  modal(s.id ? 'Schüler-ID bearbeiten' : 'Schüler-ID anlegen', `<form id="student-form" data-id="${esc(s.id || '')}">${field('Interne Schüler-ID *', 'id', s.id, 'required maxlength="40" placeholder="5A-017" pattern="[A-Za-z0-9ÄÖÜäöü][A-Za-z0-9ÄÖÜäöü._\\-]{0,39}"')}${field('Klasse *', 'className', s.className || ui.className, 'required maxlength="30" placeholder="5A"')}<label class="toggle-chip"><input type="checkbox" name="active" ${s.active !== false ? 'checked' : ''}> Aktiv – darf Bücher ausleihen</label><p class="hint">Nur interne IDs verwenden. Keine Namen eintragen. Laufende Ausleihen bleiben beim Deaktivieren erhalten.</p><div class="form-footer"><button class="btn primary" type="submit">Speichern</button></div></form>`);
}
const actions = {
  close,
  navigate: el => go(el.dataset.page),
  'clear-search': () => { ui.search = ''; render(); },
  'end-session': () => { clearSession(); render(); toast('Vorgang beendet. Die nächste Schüler-ID kann gewählt werden.'); },
  'show-overdue': () => { ui.returnQuery = ''; ui.loanFilter = 'overdue'; go('return'); },
  'loan-category-chip': el => { ui.loanCategory = ui.loanCategory === el.dataset.id ? '' : el.dataset.id; renderMain(); focusNext('loan-query'); },
  'new-work': () => modal('Eine neue Geschichte fürs Regal', workForm(), true),
  work: el => detail(el.dataset.id),
  'edit-work': el => modal('Werk bearbeiten', workForm(data.works.find(w => w.id === el.dataset.id)), true),
  'new-copies': el => modal('Mehr Exemplare fürs Regal', `<form id="copies-form" data-id="${esc(el.dataset.id)}">${field('Anzahl *', 'count', 1, 'type="number" min="1" max="2000" required')}${field('Standort / Regal', 'location', '', 'maxlength="100"')}<div class="form-footer"><button type="submit" class="btn primary">Exemplare hinzufügen</button></div></form>`),
  'edit-copy': el => {
    const c = data.copies.find(c => c.id === el.dataset.id);
    dialog.dataset.copyWork = dialog.open && dialog.querySelector('.work-detail') ? 'yes' : '';
    modal(c.id, `<form id="copy-form" data-id="${esc(c.id)}"><label>Status<select name="status" ${c.status === 'loaned' ? 'disabled' : ''}>${Object.entries(STATUS).filter(([key]) => key !== 'loaned' || c.status === 'loaned').map(([key, name]) => option(key, name, c.status)).join('')}</select></label>${c.status === 'loaned' ? `<p class="hint">Ausgeliehen an ${esc(c.studentId)}. Zuerst über die Rückgabe zurückgeben, um den Status zu ändern.</p>${field('Rückgabedatum (optional)', 'dueDate', c.dueDate || '', 'type="date"')}` : ''}${field('Zustand', 'condition', c.condition, 'maxlength="300"')}${field('Standort / Regal', 'location', c.location, 'maxlength="100"')}<label>Notiz<textarea name="note" rows="3" maxlength="2000">${esc(c.note)}</textarea></label><div class="form-footer"><button type="submit" class="btn primary">Speichern</button></div></form>`);
  },
  'new-student': () => studentForm(),
  'edit-student': el => studentForm(data.students.find(s => s.id === el.dataset.id)),
  'new-class': () => modal('Eine ganze Klasse anlegen', `<form id="class-form">${field('Klasse *', 'className', '', 'required maxlength="20" placeholder="5A" pattern="[A-Za-z0-9ÄÖÜäöü][A-Za-z0-9ÄÖÜäöü._\\-]{0,19}"')}${field('Anzahl Schüler-IDs *', 'count', 27, 'type="number" min="1" max="500" required')}<p class="hint">Beispiel: 5A-001 bis 5A-027. Bereits vorhandene IDs werden übersprungen.</p><div class="form-footer"><button type="submit" class="btn primary">Klasse erzeugen</button></div></form>`),
  'lend-student': el => { if (ui.sessionLoans.length && ui.selectedStudent !== el.dataset.id) { go('lend'); toast('Bitte zuerst den laufenden Vorgang beenden.', true); return; } selectStudent(el.dataset.id); go('lend'); },
  'student-loans': el => {
    const student = data.students.find(s => s.id === el.dataset.id);
    const loans = data.copies.filter(c => c.studentId === student.id);
    modal(`Aktuelle Ausleihen · ${student.id}`, loans.map(c => `<div class="search-copy-row"><div><strong>${esc(workOf(c)?.title)}</strong><small>${esc(c.id)}</small>${dueBadge(c)}</div>${button('Zurückgeben', 'return-copy', 'primary', `data-id="${esc(c.id)}"`)}</div>`).join('') || '<p class="muted">Zurzeit keine Bücher ausgeliehen.</p>');
  },
  'quick-lend': el => {
    const copy = data.copies.find(c => c.id === el.dataset.id);
    if (copy?.status !== 'available') throw new Error('Dieses Exemplar ist nicht verfügbar.');
    const students = data.students.filter(s => s.active).sort((a,b) => {const ids=data.preferences.recentStudents;const ai=ids.indexOf(a.id),bi=ids.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi)||a.id.localeCompare(b.id,'de',{numeric:true});});
    modal('Direkt ausleihen', `<form id="quick-loan-form" data-id="${esc(copy.id)}"><h3>${esc(workOf(copy)?.title)}</h3><p class="hint">${esc(copy.id)} · ${esc(copy.location || 'Ohne Standort')}</p><label>Schüler-ID<select name="studentId" required ${ui.sessionLoans.length ? 'disabled' : ''}>${option('', 'Schüler-ID wählen …', ui.selectedStudent)}${students.map(s=>option(s.id, `${data.preferences.recentStudents.includes(s.id)?'Zuletzt · ':''}${s.id}`,ui.selectedStudent)).join('')}</select></label>${field('Rückgabedatum (optional)','dueDate',ui.dueDate,'type="date"')}<div class="form-footer"><button type="submit" class="btn primary">Ausleihen</button></div></form>`);
  },
  'lend-copy': async el => {
    const id = [...document.querySelectorAll('.copy-choice')].find(e => e.dataset.work === el.dataset.work)?.value;
    await performLoan(id, ui.selectedStudent, ui.dueDate);
  },
  'return-copy': async el => {
    await change(s => giveBack(s, el.dataset.id), `${el.dataset.id} zurückgegeben`);
    ui.sessionLoans = ui.sessionLoans.filter(id => id !== el.dataset.id);
    if (ui.page === 'return' && !ui.search) ui.returnQuery = '';
    render(); toast('Zurückgegeben. Bereit für das nächste Buch.');
    if (dialog.open) close();
    if (ui.page === 'return' && !ui.search) focusNext('return-query');
  },
  'start-inventory': () => {
    if (data.inventory) confirm('Neue Inventur starten?', 'Die bisherige Inventur wird ersetzt. Der Bücherbestand bleibt erhalten.', 'confirm-inventory');
    else return actions['confirm-inventory']();
  },
  'confirm-inventory': async () => { await commit(s => { s.inventory = { id: uid(), startedAt: new Date().toISOString(), expected: s.copies.filter(c => c.status !== 'retired').map(c => c.id), found: [] }; }, 'Inventur gestartet', 'Inventur gestartet. Fortschritt wird automatisch gespeichert.'); close(); },
  'found-copy': async el => {
    await commit(s => { if (!s.inventory || s.inventory.completedAt) throw new Error('Keine laufende Inventur.'); if (!s.inventory.found.includes(el.dataset.id)) s.inventory.found.push(el.dataset.id); }, null, `${el.dataset.id} als gefunden erfasst.`);
  },
  'finish-inventory': async () => { await commit(s => { s.inventory.completedAt = new Date().toISOString(); }, 'Inventur abgeschlossen', 'Inventur gespeichert und abgeschlossen.'); },
  'edit-category': el => { const c = data.categories.find(c => c.id === el.dataset.id); modal('Kategorie bearbeiten', `<form id="edit-category-form" data-id="${esc(c.id)}">${field('Bezeichnung *', 'name', c.name, 'required maxlength="100"')}<div class="form-footer"><button type="submit" class="btn primary">Speichern</button></div></form>`); },
  'delete-category': el => { const c = data.categories.find(c => c.id === el.dataset.id); confirm('Kategorie löschen?', `„${esc(c.name)}“ löschen? Zugeordnete Werke erhalten „Ohne Kategorie“.`, 'confirm-category'); dialog.dataset.category = c.id; },
  'confirm-category': async () => { const id = dialog.dataset.category; await commit(s => { s.categories = s.categories.filter(c => c.id !== id); delete s.preferences.categoryUses[id]; if (ui.loanCategory === id) ui.loanCategory = ''; s.works.forEach(w => { if (w.categoryId === id) w.categoryId = ''; }); }, 'Kategorie gelöscht', 'Kategorie gelöscht.'); close(); },
  demo: async () => { if (data.works.length || data.students.length || data.categories.length) throw new Error('Demodaten benötigen eine leere Bücherkammer.'); await commit(s => Object.assign(s, demoState()), null, 'Demobestand ist bereit.'); },
  'clear-demo': () => confirm('Demobestand löschen?', 'Alle Daten im Demomodus, einschließlich deiner dortigen Änderungen, werden gelöscht. Exportiere bei Bedarf vorher ein Backup.', 'confirm-clear-demo'),
  'confirm-clear-demo': async () => { if (!data.demo) return; clearSession(); ui.loanClass = ''; ui.loanCategory = ''; ui.category = ''; await commit(s => Object.assign(s, empty()), null, 'Demodaten gelöscht. Bereit für eure Bücher.'); ui.selectedStudent = ''; ui.className = ''; close(); },
  'export-backup': () => { download(`buecherkammer-backup-${date()}.json`, JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2), 'application/json'); toast('Vollständiges Backup exportiert.'); },
  'import-backup': () => document.querySelector('#backup-file').click(),
  'confirm-import': async () => { const imported = actions.pendingImport; if (!imported) return; clearSession(); ui.loanClass = imported.preferences.lastClass; ui.loanCategory = ''; ui.category = ''; await commit(s => Object.assign(s, imported), 'Backup importiert', 'Backup vollständig importiert.'); actions.pendingImport = null; ui.selectedStudent = ''; ui.className = ''; close(); },
  'csv-works': () => download(`buecherbestand-${date()}.csv`, csv([['Werk-ID', 'Titel', 'Autor', 'ISBN', 'Reihe/Band', 'Kategorie', 'Schlagwörter', 'Klassenstufe', 'Beschreibung', 'Gesamt', ...Object.values(STATUS)], ...data.works.map(w => { const copies = data.copies.filter(c => c.workId === w.id); return [w.id, w.title, w.author, w.isbn, w.series, categoryName(w.categoryId), w.tags.join(', '), w.grade, w.description, copies.length, ...Object.keys(STATUS).map(status => copies.filter(c => c.status === status).length)]; })]), 'text/csv;charset=utf-8'),
  'csv-copies': () => download(`exemplare-${date()}.csv`, csv([['Exemplar-ID', 'Werk-ID', 'Titel', 'Status', 'Zustand', 'Standort', 'Notiz'], ...data.copies.map(c => [c.id, c.workId, workOf(c)?.title, STATUS[c.status], c.condition, c.location, c.note])]), 'text/csv;charset=utf-8'),
  'csv-loans': () => download(`aktuelle-ausleihen-${date()}.csv`, csv([['Exemplar-ID', 'Titel', 'Schüler-ID', 'Klasse', 'Ausgeliehen am', 'Rückgabedatum'], ...data.copies.filter(c => c.status === 'loaned').map(c => [c.id, workOf(c)?.title, c.studentId, data.students.find(s => s.id === c.studentId)?.className, c.loanedAt, c.dueDate])]), 'text/csv;charset=utf-8'),
  persist: async () => { const saved = await navigator.storage?.persist?.(); toast(saved ? 'Dauerhafte Speicherung wurde erlaubt.' : 'Der Browser entscheidet über den Speicher. Regelmäßig Backups exportieren.'); },
  install: async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; } else toast('iPad: Teilen → Zum Home-Bildschirm. Desktop: Installationssymbol in der Adressleiste.'); }
};
const date = () => new Date().toLocaleDateString('sv-SE');
async function safe(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); }
  catch (error) { console.error(error); toast(error.message || 'Die Aktion konnte nicht gespeichert werden.', true); await reload(); render(); }
  finally { busy = false; }
}
document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (el && actions[el.dataset.action] && !el.disabled) { event.preventDefault(); safe(() => actions[el.dataset.action](el)); }
});
const textFilters = { 'global-search': 'search', 'book-query': 'bookQuery', 'grade-filter': 'grade', 'student-query': 'studentQuery', 'loan-query': 'loanQuery', 'return-query': 'returnQuery', 'inventory-query': 'inventoryQuery' };
document.addEventListener('input', event => {
  const key = textFilters[event.target.id];
  if (!key) return;
  ui[key] = event.target.value;
  const id = event.target.id, start = event.target.selectionStart, end = event.target.selectionEnd;
  renderMain();
  const next = document.getElementById(id); if (next !== event.target && next) { next.focus(); next.setSelectionRange(start, end); }
});
document.addEventListener('change', event => {
  const el = event.target;
  const filters = { 'category-filter': 'category', 'class-filter': 'className', 'inventory-filter': 'inventoryFilter', 'loan-filter': 'loanFilter', 'loan-category': 'loanCategory' };
  if (filters[el.id]) { ui[filters[el.id]] = el.value; renderMain(); }
  if (el.id === 'loan-due') ui.dueDate = el.value;
  if (el.id === 'loan-student') { ui.selectedStudent = el.value; renderMain(); }
  if (el.id === 'loan-class') safe(async () => { if (ui.sessionLoans.length) return; ui.loanClass = el.value; ui.selectedStudent = ''; await change(s => { s.preferences.lastClass = ui.loanClass; }); renderMain(); });
  if (el.id === 'available-filter') { ui.available = el.checked; renderMain(); }
  if (el.id === 'backup-file' && el.files[0]) safe(async () => {
    const file = el.files[0]; el.value = '';
    if (file.size > 50000000) throw new Error('Das Backup darf höchstens 50 MB groß sein.');
    let raw; try { raw = JSON.parse((await file.text()).replace(/^\uFEFF/, '')); } catch { throw new Error('Die Datei enthält kein gültiges JSON-Backup.'); }
    const imported = validateBackup(raw); actions.pendingImport = imported;
    confirm('Bestand durch Backup ersetzen?', `Das Backup enthält <strong>${imported.works.length} Werke, ${imported.copies.length} Exemplare und ${imported.students.length} Schüler-IDs</strong>. Der gesamte aktuelle Bestand wird überschrieben. Exportiere bei Bedarf zuerst ein Backup.`, 'confirm-import');
  });
});
document.addEventListener('submit', event => {
  const form = event.target; event.preventDefault();
  safe(async () => {
    const values = Object.fromEntries(new FormData(form)); const id = form.dataset.id; const formType = form.getAttribute('id');
    for (const key of Object.keys(values)) if (typeof values[key] === 'string') values[key] = values[key].trim();
    if (formType === 'quick-loan-form') {
      await performLoan(id, values.studentId || ui.selectedStudent, values.dueDate); close();
    } else if (formType === 'work-form') {
      if (!values.title) throw new Error('Bitte einen Titel eingeben.');
      const old = data.works.find(w => w.id === id);
      const work = { ...old, id: id || uid(), addedAt: old?.addedAt || (old ? data.usageSince : new Date().toISOString()), ...Object.fromEntries(['title', 'author', 'isbn', 'series', 'categoryId', 'grade', 'description'].map(k => [k, values[k]])), tags: [...new Set(values.tags.split(',').map(t => t.trim()).filter(Boolean))], cover: values.removeCover ? '' : old?.cover || '' };
      if (work.tags.some(t => t.length > 100)) throw new Error('Ein Schlagwort darf maximal 100 Zeichen enthalten.');
      const file = values.cover;
      if (file?.size) {
        if (file.size > 2000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Bitte PNG, JPEG oder WebP mit maximal 2 MB auswählen.');
        work.cover = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      }
      await commit(s => { if (id) s.works[s.works.findIndex(w => w.id === id)] = work; else { s.works.push(work); addCopies(s, work.id, Number(values.count), values.location); } }, id ? 'Werk bearbeitet' : 'Werk und Exemplare angelegt', 'Werk gespeichert.'); detail(work.id);
    } else if (formType === 'copies-form') {
      await commit(s => addCopies(s, id, Number(values.count), values.location), 'Exemplare hinzugefügt', 'Neue Exemplare angelegt.'); detail(id);
    } else if (formType === 'copy-form') {
      const workId = data.copies.find(c => c.id === id).workId;
      await commit(s => { const c = s.copies.find(c => c.id === id); if (c.status !== 'loaned') c.status = values.status; else if (values.dueDate) { if (!validDate(values.dueDate)) throw new Error('Bitte ein gültiges Rückgabedatum wählen.'); c.dueDate = values.dueDate; } else delete c.dueDate; c.condition = values.condition; c.location = values.location; c.note = values.note; }, `${id} aktualisiert`, 'Exemplar gespeichert.'); if (dialog.dataset.copyWork === 'yes') detail(workId); else close();
    } else if (formType === 'student-form') {
      const newId = values.id.toUpperCase(); const className = values.className.toUpperCase();
      if (!/^[A-Z0-9ÄÖÜ][A-Z0-9ÄÖÜ._-]{0,39}$/.test(newId) || !className) throw new Error('Bitte eine gültige interne ID und Klasse eingeben.');
      await commit(s => { if (s.students.some(student => student.id === newId && student.id !== id)) throw new Error('Diese Schüler-ID existiert bereits.'); const student = { id: newId, className, active: values.active === 'on' }; if (id) { s.students[s.students.findIndex(s => s.id === id)] = student; s.preferences.recentStudents = s.preferences.recentStudents.map(recent => recent === id ? newId : recent); s.copies.forEach(c => { if (c.studentId === id) c.studentId = newId; }); } else s.students.push(student); }, 'Schülerverwaltung aktualisiert', 'Schüler-ID gespeichert.'); if (ui.selectedStudent === id) ui.selectedStudent = newId; close();
    } else if (formType === 'class-form') {
      const className = values.className.toUpperCase(), count = Number(values.count);
      if (!/^[A-Z0-9ÄÖÜ][A-Z0-9ÄÖÜ._-]{0,19}$/.test(className) || !Number.isInteger(count) || count < 1 || count > 500) throw new Error('Bitte gültige Klasse und Anzahl von 1 bis 500 eingeben.');
      let added = 0;
      await commit(s => { for (let i = 1; i <= count; i++) { const id = `${className}-${String(i).padStart(3, '0')}`; if (!s.students.some(student => student.id === id)) { s.students.push({ id, className, active: true }); added++; } } }, 'Klasse in Schülerverwaltung angelegt'); toast(`${added} Schüler-IDs angelegt.`); close();
    } else if (formType === 'category-form' || formType === 'edit-category-form') {
      if (!values.name) throw new Error('Bitte eine Bezeichnung eingeben.');
      await commit(s => { if (s.categories.some(c => c.name.toLowerCase() === values.name.toLowerCase() && c.id !== id)) throw new Error('Diese Kategorie existiert bereits.'); if (id) s.categories.find(c => c.id === id).name = values.name; else s.categories.push({ id: uid(), name: values.name }); }, 'Kategorien aktualisiert', 'Kategorie gespeichert.'); close();
    }
  });
});
window.addEventListener('hashchange', () => { ui.page = location.hash.slice(1) || 'dashboard'; ui.search = ''; render(); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('online', render); window.addEventListener('offline', render);
window.addEventListener('focus', () => { if (!dialog.open && !busy) safe(async () => { await reload(); render(); }); });
try {
  await openStore(); ui.loanClass = data.students.some(s => s.className === data.preferences.lastClass) ? data.preferences.lastClass : ''; ui.page = location.hash.slice(1) || 'dashboard'; render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => toast('Offline-Vorbereitung fehlgeschlagen. Bitte die App über localhost oder HTTPS öffnen.', true));
} catch { document.querySelector('#app').innerHTML = '<div class="empty"><h1>Der lokale Speicher ist nicht verfügbar.</h1><p>Bitte in einem regulären Browserfenster öffnen und die Speicherung von Website-Daten erlauben. Die App benötigt IndexedDB.</p></div>'; }

