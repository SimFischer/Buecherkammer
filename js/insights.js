export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const formatDate = value => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE');
export function dueInfo(copy, day = today()) {
  if (copy.status !== 'loaned' || !validDate(copy.dueDate)) return null;
  const days = daysBetween(day, copy.dueDate);
  return { days, kind: days < 0 ? 'overdue' : days === 0 ? 'due-today' : 'due-later', text: days < 0 ? `Überfällig seit ${-days} ${days === -1 ? 'Tag' : 'Tagen'} · fällig am ${formatDate(copy.dueDate)}` : days === 0 ? `Heute fällig · ${formatDate(copy.dueDate)}` : `Fällig am ${formatDate(copy.dueDate)} · noch ${days} ${days === 1 ? 'Tag' : 'Tage'}` };
}
export function workHints(state, work) {
  const copies = state.copies.filter(c => c.workId === work.id);
  const count = status => copies.filter(c => c.status === status).length;
  const hints = [];
  if (count('missing')) hints.push({ tone: 'problem', text: `${count('missing')} ${count('missing') === 1 ? 'Exemplar vermisst' : 'Exemplare vermisst'}` });
  if (count('damaged')) hints.push({ tone: 'care', text: `${count('damaged')} ${count('damaged') === 1 ? 'Exemplar beschädigt' : 'Exemplare beschädigt'}` });
  if (count('available') === 1 && copies.filter(c => c.status !== 'retired').length > 1) hints.push({ tone: 'care', text: 'Nur noch 1 Exemplar verfügbar' });
  const counts = state.works.map(w => w.loanCount || 0).filter(n => n > 0);
  const average = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  if ((work.loanCount || 0) >= 5 && work.loanCount >= average) hints.push({ tone: 'popular', text: 'Dieses Werk wird besonders häufig ausgeliehen' });
  const last = work.lastLoanedAt || work.addedAt || state.usageSince;
  if (last && daysBetween(last.slice(0, 10), today()) >= 90 && copies.some(c => c.status !== 'retired')) hints.push({ tone: 'quiet', text: work.lastLoanedAt ? 'Dieses Werk wurde seit mindestens 90 Tagen nicht ausgeliehen' : 'Seit mindestens 90 Tagen keine Ausleihe erfasst' });
  return hints;
}
