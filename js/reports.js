import { data, STATUS, categoryName, copiesOf } from './store.js';
import { esc, icon, button, emptyView } from './ui.js';
import { dueInfo, workHints, formatDate } from './insights.js';

export function notices(work) {
  const hints = workHints(data, work).slice(0, 3);
  return hints.length ? `<div class="work-notices">${hints.map(h => `<span class="stock-notice ${h.tone}">${icon('leaf')} ${esc(h.text)}</span>`).join('')}</div>` : '';
}
export function dashboardNotices() {
  const entries = data.works.map(w => ({ work: w, hint: workHints(data, w)[0] })).filter(x => x.hint).slice(0, 3);
  if (!entries.length) return '';
  return `<section class="shelf-notices" aria-label="Bestandshinweise">${entries.map(({ work, hint }) => `<button class="stock-notice ${hint.tone}" data-action="work" data-id="${esc(work.id)}">${icon('leaf')}<span><strong>${esc(work.title)}</strong>${esc(hint.text)}</span>${icon('arrow')}</button>`).join('')}</section>`;
}
function bars(rows, unit = 'Exemplare') {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<div class="report-bars">${rows.map(r => `<div class="report-bar"><div><span>${esc(r.label)}</span><strong>${r.value}<small> ${unit}</small></strong></div><div class="report-track"><i class="${r.tone || ''}" style="width:${r.value / max * 100}%"></i></div></div>`).join('') || '<p class="muted">Noch keine Daten vorhanden.</p>'}</div>`;
}
function rankings(works, quiet = false) {
  return `<div class="ranking-list">${works.map(w => `<button data-action="work" data-id="${esc(w.id)}"><span><strong>${esc(w.title)}</strong><small>${quiet ? w.lastLoanedAt ? `Zuletzt ${formatDate(w.lastLoanedAt)}` : 'Noch keine Ausleihe im erfassten Zeitraum' : esc(w.author)}</small></span><b>${w.loanCount || 0}<small> Ausleihen</small></b></button>`).join('') || '<p class="muted">Noch keine Ausleihen erfasst.</p>'}</div>`;
}
export function reportView() {
  const activeWorks = data.works.filter(w => copiesOf(w.id).some(c => c.status !== 'retired'));
  const popular = data.works.filter(w => w.loanCount > 0).sort((a, b) => b.loanCount - a.loanCount).slice(0, 5);
  const rare = [...activeWorks].sort((a, b) => (a.loanCount || 0) - (b.loanCount || 0) || (a.lastLoanedAt || '').localeCompare(b.lastLoanedAt || '')).slice(0, 5);
  const quiet = activeWorks.filter(w => workHints(data, w).some(h => h.tone === 'quiet')).sort((a, b) => (a.lastLoanedAt || a.addedAt || data.usageSince).localeCompare(b.lastLoanedAt || b.addedAt || data.usageSince)).slice(0, 5);
  const categoryIds = [...data.categories.map(c => c.id), ...(data.works.some(w => !w.categoryId) ? [''] : [])];
  const byCategory = categoryIds.map(id => {
    const works = data.works.filter(w => (w.categoryId || '') === id);
    return { label: categoryName(id), stock: data.copies.filter(c => works.some(w => w.id === c.workId) && c.status !== 'retired').length, value: works.reduce((n, w) => n + (w.loanCount || 0), 0) };
  });
  const grades = [...new Set(activeWorks.map(w => w.grade || 'Ohne Empfehlung'))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const totalLoans = data.works.reduce((n, w) => n + (w.loanCount || 0), 0);
  const counts = Object.keys(STATUS).map(status => ({ label: STATUS[status], value: data.copies.filter(c => c.status === status).length, tone: status }));
  const problemWorks = status => data.works.map(w => ({ work: w, count: copiesOf(w.id).filter(c => c.status === status).length })).filter(r => r.count);
  const problems = status => problemWorks(status).map(({ work, count }) => `<button class="problem-work" data-action="work" data-id="${esc(work.id)}"><span>${esc(work.title)}</span><b>${count}</b>${icon('arrow')}</button>`).join('') || '<p class="muted">Hier ist alles in Ordnung.</p>';
  return `<div class="page-heading"><div><div class="eyebrow">WAS DIE REGALAUSLEIHE ERZÄHLT</div><h1>Ein Blick auf die Sammlung</h1><p>Anonyme Werkzähler seit ${formatDate(data.usageSince)}. Frühere Ausleihen sind nicht nachträglich erfasst.</p></div></div>
  <div class="report-summary"><div class="stat total"><span>Erfasste Ausleihen</span><strong>${totalLoans}</strong><small>ohne Personenbezug</small></div><div class="stat available"><span>Verfügbar</span><strong>${counts[0].value}</strong><small>bereit zum Lesen</small></div><div class="stat loaned"><span>Unterwegs</span><strong>${counts[1].value}</strong><small>aktuelle Ausleihen</small></div><div class="stat overdue"><span>Überfällig</span><strong>${data.copies.filter(c => dueInfo(c)?.days < 0).length}</strong><small>Rückgabe prüfen</small></div></div>
  ${data.works.length ? `<div class="report-grid"><section class="panel"><h2>Oft auf Reisen</h2><p class="muted">Die meist ausgeliehenen Werke seit Beginn der Zählung.</p>${rankings(popular)}</section><section class="panel"><h2>Neue Chancen fürs Regal</h2><p class="muted">Werke mit den wenigsten erfassten Ausleihen.</p>${rankings(rare)}${quiet.length ? `<h3>Seit mindestens 90 Tagen ruhig</h3>${rankings(quiet, true)}` : ''}</section><section class="panel"><h2>Ausleihen nach Kategorie</h2><p class="muted">Alle erfassten Ausleihvorgänge, auch bereits zurückgegebene.</p>${bars(byCategory, 'Ausleihen')}</section><section class="panel"><h2>Was steht wo?</h2><p class="muted">Bestand nach Kategorie, ohne ausgesonderte Exemplare.</p>${bars(byCategory.map(r => ({ label: r.label, value: r.stock })))}</section><section class="panel"><h2>Verfügbar & unterwegs</h2>${bars(counts)}</section><section class="panel"><h2>Für welche Klassen?</h2><p class="muted">Bestand nach der eingetragenen Klassenempfehlung.</p>${bars(grades.map(g => ({ label: g === 'Ohne Empfehlung' ? g : 'Klasse ' + g, value: data.copies.filter(c => c.status !== 'retired' && activeWorks.some(w => w.id === c.workId && (w.grade || 'Ohne Empfehlung') === g)).length })))}</section><section class="panel"><h2>Beschädigte Exemplare · ${counts[2].value}</h2>${problems('damaged')}</section><section class="panel"><h2>Vermisste Exemplare · ${counts[3].value}</h2>${problems('missing')}</section></div>` : emptyView('Die Sammlung beginnt mit dem ersten Buch', 'Sobald Werke angelegt und Bücher ausgeliehen werden, entsteht hier eure Übersicht.')}
  <p class="report-footnote">Gespeichert werden nur die Anzahl und der letzte Ausleihzeitpunkt je Werk. Keine Zuordnung zu früheren Leserinnen und Lesern. Kategorien beziehen sich auf die aktuelle Einordnung der Werke.</p>`;
}
