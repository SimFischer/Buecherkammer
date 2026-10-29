export const STATUS = { available: 'Verfügbar', loaned: 'Ausgeliehen', damaged: 'Beschädigt', missing: 'Vermisst', retired: 'Ausgesondert' };
export const empty = () => ({ version: 1, revision: 0, nextCopy: 1, works: [], copies: [], students: [], categories: [], actions: [], inventory: null, demo: false });
let db;
export let data = empty();
export async function openStore() {
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('buecherkammer', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('state');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  data = await read() || empty();
}
function read() {
  return new Promise((resolve, reject) => {
    const req = db.transaction('state').objectStore('state').get('main');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function reload() { data = await read() || empty(); }
export function uid() { return crypto.randomUUID(); }
export async function change(update, label) {
  const next = structuredClone(data);
  update(next);
  if (label) next.actions.unshift({ id: uid(), label, at: new Date().toISOString() });
  next.actions = next.actions.slice(0, 30);
  next.revision = data.revision + 1;
  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    const store = tx.objectStore('state');
    const req = store.get('main');
    req.onsuccess = () => {
      if ((req.result?.revision || 0) !== data.revision) {
        tx.abort();
        return;
      }
      store.put(next, 'main');
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(new Error('Daten wurden in einem anderen Fenster geändert. Bitte erneut versuchen.'));
    tx.onerror = () => reject(tx.error || new Error('Speichern fehlgeschlagen.'));
  });
  data = next;
}
export function addCopies(state, workId, count, location = '') {
  if (!Number.isInteger(count) || count < 1 || count > 2000) throw new Error('Bitte 1 bis 2000 Exemplare angeben.');
  for (let i = 0; i < count; i++) {
    let id;
    do { id = `BK-${String(state.nextCopy++).padStart(6, '0')}`; } while (state.copies.some(c => c.id === id));
    state.copies.push({ id, workId, status: 'available', condition: '', location, note: '' });
  }
}
export function lend(state, copyId, studentId) {
  const copy = state.copies.find(c => c.id === copyId);
  const student = state.students.find(s => s.id === studentId);
  if (!student?.active) throw new Error('Bitte eine aktive Schüler-ID wählen.');
  if (!copy || copy.status !== 'available') throw new Error('Dieses Exemplar ist nicht verfügbar.');
  copy.status = 'loaned'; copy.studentId = studentId; copy.loanedAt = new Date().toISOString();
}
export function giveBack(state, copyId) {
  const copy = state.copies.find(c => c.id === copyId);
  if (!copy || copy.status !== 'loaned') throw new Error('Dieses Exemplar ist nicht ausgeliehen.');
  copy.status = 'available'; delete copy.studentId; delete copy.loanedAt;
}
export const copiesOf = id => data.copies.filter(c => c.workId === id);
export const workOf = copy => data.works.find(w => w.id === copy.workId);
export const loansOf = id => data.copies.filter(c => c.studentId === id);
export const categoryName = id => data.categories.find(c => c.id === id)?.name || 'Ohne Kategorie';
export function matches(work, query) {
  return [work.title, work.author, work.isbn, work.series, work.grade, work.description, categoryName(work.categoryId), ...(work.tags || []), ...copiesOf(work.id).map(c => c.id)].join(' ').toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));
}
export function validateBackup(raw) {
  const fail = () => { throw new Error('Ungültiges Backup: Daten oder Verknüpfungen sind fehlerhaft.'); };
  if (!raw || raw.version !== 1 || !['works', 'copies', 'students', 'categories', 'actions'].every(k => Array.isArray(raw[k]))) fail();
  const str = (v, max = 10000) => typeof v === 'string' && v.length <= max;
  const unique = arr => arr.every(x => x && str(x.id, 120) && x.id.trim()) && new Set(arr.map(x => x.id)).size === arr.length;
  if (![raw.works, raw.copies, raw.students, raw.categories].every(unique)) fail();
  const has = (arr, id) => arr.some(x => x.id === id);
  if (!raw.categories.every(c => str(c.name, 100) && c.name.trim())) fail();
  if (!raw.works.every(w => str(w.title, 300) && w.title.trim() && str(w.author, 300) && Array.isArray(w.tags) && w.tags.every(t => str(t, 100)) && (!w.categoryId || has(raw.categories, w.categoryId)) && ['isbn', 'series', 'grade', 'description', 'cover'].every(k => w[k] === undefined || str(w[k], k === 'cover' ? 4000000 : 10000)) && (!w.cover || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(w.cover)))) fail();
  if (!raw.students.every(s => /^[A-Z0-9ÄÖÜ][A-Z0-9ÄÖÜ._-]{0,39}$/.test(s.id) && str(s.className, 30) && s.className.trim() && typeof s.active === 'boolean')) fail();
  if (!raw.copies.every(c => has(raw.works, c.workId) && Object.hasOwn(STATUS, c.status) && ['location', 'condition', 'note'].every(k => c[k] === undefined || str(c[k])) && (c.status === 'loaned' ? has(raw.students, c.studentId) && str(c.loanedAt) && Number.isFinite(Date.parse(c.loanedAt)) : !c.studentId && !c.loanedAt))) fail();
  if (raw.inventory !== null && raw.inventory !== undefined) {
    const inv = raw.inventory;
    if (!str(inv.id) || !str(inv.startedAt) || !Number.isFinite(Date.parse(inv.startedAt)) || !Array.isArray(inv.expected) || !Array.isArray(inv.found) || !inv.expected.every(id => has(raw.copies, id)) || !inv.found.every(id => inv.expected.includes(id)) || new Set(inv.expected).size !== inv.expected.length || new Set(inv.found).size !== inv.found.length) fail();
  }
  // Whitelist fields: backups cannot introduce names or personal reading histories.
  const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
  const clean = empty();
  clean.works = raw.works.map(w => pick(w, ['id', 'title', 'author', 'isbn', 'series', 'categoryId', 'tags', 'grade', 'description', 'cover']));
  clean.copies = raw.copies.map(c => pick(c, ['id', 'workId', 'status', 'condition', 'location', 'note', 'studentId', 'loanedAt']));
  clean.students = raw.students.map(s => pick(s, ['id', 'className', 'active']));
  clean.categories = raw.categories.map(c => pick(c, ['id', 'name']));
  clean.inventory = raw.inventory ? pick(raw.inventory, ['id', 'startedAt', 'expected', 'found', 'completedAt']) : null;
  clean.demo = raw.demo === true;
  clean.nextCopy = clean.copies.reduce((max, c) => {
    const number = Number(c.id.match(/^BK-(\d+)$/)?.[1] || 0);
    return Number.isSafeInteger(number) && number < Number.MAX_SAFE_INTEGER - 2000 ? Math.max(max, number + 1) : max;
  }, 1);
  return clean;
}
export function demoState() {
  const state = empty(); state.demo = true;
  state.categories = ['Abenteuer', 'Fantasy', 'Comic', 'Sachbuch'].map((name, i) => ({ id: `cat${i}`, name }));
  const books = [
    ['Die unendliche Geschichte', 'Michael Ende', 'cat1', '5–7', ['Magie', 'Freundschaft']],
    ['Rico, Oskar und die Tieferschatten', 'Andreas Steinhöfel', 'cat0', '5–6', ['Freundschaft', 'Krimi']],
    ['Die drei ??? – Das Gespensterschloss', 'Robert Arthur', 'cat0', '5–7', ['Krimi', 'Spannung']],
    ['Gregs Tagebuch – Von Idioten umzingelt!', 'Jeff Kinney', 'cat2', '5–6', ['Humor', 'Schule']],
    ['WAS IST WAS: Unser Planet Erde', 'Manfred Baur', 'cat3', '5–8', ['Natur', 'Wissen']],
    ['Momo', 'Michael Ende', 'cat1', '5–8', ['Zeit', 'Freundschaft']]
  ];
  books.forEach(([title, author, categoryId, grade, tags], i) => {
    const id = `work${i}`; state.works.push({ id, title, author, categoryId, grade, tags, description: '', isbn: '', series: '' });
    addCopies(state, id, i === 0 ? 6 : 4, `Regal ${String.fromCharCode(65 + i % 3)}`);
  });
  ['5A', '5B', '6A'].forEach(className => { for (let i = 1; i <= 8; i++) state.students.push({ id: `${className}-${String(i).padStart(3, '0')}`, className, active: true }); });
  lend(state, 'BK-000001', '5A-003'); lend(state, 'BK-000007', '5A-003'); lend(state, 'BK-000011', '5B-002');
  state.copies[4].status = 'damaged'; state.copies[19].status = 'missing';
  state.actions = [{ id: uid(), label: 'Demobestand angelegt', at: new Date().toISOString() }];
  return state;
}
