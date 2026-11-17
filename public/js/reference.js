'use strict';
/* Reference: the HRCM Human Rights Classification Reference Catalogue, browsable and searchable by staff. */

const CATREF_TABS = [['rights', 'Rights and issues'], ['groups', 'Affected groups'], ['topics', 'Cross-cutting topics'], ['frameworks', 'Legal frameworks'], ['guide', 'How to use']];

function catUsage() {
  const cs = visibleCases(); const key = cs.length + ':' + (S._catUseRev || 0);
  if (S._catUse && S._catUse.key === key) return S._catUse;
  const u = { key, issue: {}, sec: {}, cat: {}, sub: {}, group: {}, topic: {} }; const add = (m, k) => { if (k) m[k] = (m[k] || 0) + 1; };
  cs.forEach(c => { const cl = clsOf(c); add(u.cat, cl.catId); add(u.sub, cl.subId); add(u.issue, cl.issueId); (cl.secondary || []).forEach(x => add(u.sec, x)); [...new Set(cl.groups || [])].forEach(x => add(u.group, x)); [...new Set(cl.topics || [])].forEach(x => add(u.topic, x)); });
  return (S._catUse = u);
}
// Highlight search words in already-escaped text.
function hiTerms(htmlText, q) {
  const toks = String(q || '').trim().split(/\s+/).filter(t => t.length > 1).map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return toks.length ? htmlText.replace(new RegExp(`(${toks.join('|')})`, 'gi'), '<mark>$1</mark>') : htmlText;
}
function catMatch(q, hay) { const toks = normName(q).split(' ').filter(t => t.length > 1); const h = normName(hay); return !toks.length || toks.every(t => h.includes(t)); }

VIEWS.catalogue = () => {
  if (!can('viewAll') && !can('viewAssigned')) return noAccess();
  const C = catalogue(); const X = catIndex(); const tab = S.catTab || 'rights';
  const counts = { rights: C.issues.length, groups: C.groups.length, topics: C.topics.length, frameworks: C.frameworks.length };
  return `<div class="page-head"><div><h1>${esc(t('catref'))}</h1><p>${esc(C.name || 'HRCM Human Rights Classification Reference Catalogue')}: ${X.cats.length} rights categories, ${Object.keys(X.subs).length} subcategories and ${C.issues.length} specific issues, with affected groups, cross-cutting topics and legal frameworks. Use it to find the right classification for a complaint.</p></div>
    <div class="row"><button class="btn" data-act="catRefExport">Export to Excel</button></div></div>
  <div class="card">
    <div class="filters" style="margin-bottom:10px"><div class="f wide"><label for="cr_q">${esc(t('search'))}</label><input id="cr_q" type="search" value="${esc(S.catQ || '')}" data-on="input:catRefQ" placeholder="Search names, keywords and Dhivehi terms, e.g. passport, detention, wages, child" autocomplete="off"></div>
      ${tab === 'rights' ? `<div class="f"><label for="cr_dom">Rights domain</label><select id="cr_dom" data-on="change:catRefDom"><option value="">All domains</option>${[...new Set(X.cats.map(c => c.domain).filter(Boolean))].map(d => `<option ${S.catDom === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>` : ''}</div>
    <div class="tabs" role="tablist">${CATREF_TABS.map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="catRefTab" data-tab="${k}">${esc(l)}${counts[k] ? ` <span class="badge">${counts[k]}</span>` : ''}</button>`).join('')}</div>
    <div id="catRefBody">${catRefBody()}</div>
  </div>`;
};
function catRefBody() {
  const tab = S.catTab || 'rights'; const q = S.catQ || '';
  return { rights: catRefRights, groups: catRefGroups, topics: catRefTopics, frameworks: catRefFrameworks, guide: catRefGuide }[tab](q);
}
function catRefRights(q) {
  const X = catIndex(); const U = catUsage(); const dom = S.catDom || ''; const open = S.catOpen || (S.catOpen = {});
  let shown = 0;
  const cats = X.cats.filter(c => !dom || c.domain === dom).map(cat => {
    const catHit = q && catMatch(q, `${cat.id} ${cat.name} ${cat.domain}`);
    const subs = cat.subs.map(sub => {
      const subHit = q && catMatch(q, `${sub.id} ${sub.name}`);
      const iss = sub.issues.filter(x => !q || catHit || subHit || catMatch(q, `${x.i} ${x.in} ${x.k} ${x.f} ${x.dv || ''} ${x.def || ''} ${x.g || ''}`));
      return { sub, iss };
    }).filter(s => s.iss.length);
    return { cat, subs };
  }).filter(c => c.subs.length);
  cats.forEach(c => c.subs.forEach(s => { shown += s.iss.length; }));
  if (!cats.length) return `<div class="empty">Nothing in the catalogue matches “${esc(q)}”. Try a shorter word or another spelling, or look under Affected groups and Cross-cutting topics.</div>`;
  const h = s => hiTerms(esc(s), q);
  return `<div class="row small muted" style="justify-content:space-between;margin:8px 0">${q || dom ? `<span>${shown} specific issue${shown === 1 ? '' : 's'} in ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}</span>` : '<span>Click a category to see its subcategories and specific issues.</span>'}
    <span><button class="btn sm" data-act="catRefAll" data-o="1">Expand all</button> <button class="btn sm" data-act="catRefAll" data-o="0">Collapse all</button></span></div>
  ${cats.map(({ cat, subs }) => `<details class="catref" ${q || open[cat.id] ? 'open' : ''} data-on="toggle:catRefToggle" data-id="${esc(cat.id)}">
    <summary><span class="mono small">${esc(cat.id)}</span> <b>${h(cat.name)}</b> <span class="muted small">${h(cat.domain || '')}</span><span class="cr-count" title="Complaints with this main category">${U.cat[cat.id] || 0} case${U.cat[cat.id] === 1 ? '' : 's'}</span></summary>
    ${subs.map(({ sub, iss }) => `<div class="catref-sub"><h3><span class="mono small muted">${esc(sub.id)}</span> ${h(sub.name)} <span class="muted small">· ${U.sub[sub.id] || 0} case${U.sub[sub.id] === 1 ? '' : 's'}</span></h3>
      <div class="tbl-wrap"><table><thead><tr><th style="width:80px">Code</th><th>Specific issue</th><th>Keywords</th><th>Frameworks</th><th class="r" style="width:70px">Cases</th></tr></thead><tbody>${iss.map(x => `<tr>
        <td class="mono small">${esc(x.i)}</td>
        <td><b>${h(x.in)}</b>${x.dv ? `<div class="dv small" lang="dv" dir="rtl">${h(x.dv)}</div>` : ''}${x.def ? `<div class="small">${h(x.def)}</div>` : ''}${x.g ? `<div class="muted small">${h(x.g)}</div>` : ''}</td>
        <td class="small">${h(x.k || '')}</td><td class="small">${h(x.f || '')}</td>
        <td class="r">${U.issue[x.i] || 0}${U.sec[x.i] ? `<div class="muted small" title="Recorded as a secondary issue">+${U.sec[x.i]} sec.</div>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}
  </details>`).join('')}`;
}
function catRefGroups(q) {
  const C = catalogue(); const U = catUsage(); const h = s => hiTerms(esc(s), q);
  const list = C.groups.filter(g => !q || catMatch(q, `${g.id} ${g.g} ${g.p} ${g.k} ${g.dv || ''} ${g.def || ''}`));
  if (!list.length) return `<div class="empty">No affected group matches “${esc(q)}”.</div>`;
  const by = {}; list.forEach(g => (by[g.g] = by[g.g] || []).push(g));
  return `<p class="small muted" style="margin:8px 0">Affected groups describe who is affected (for example children, migrant workers, persons in detention). A complaint can have several. Apply them from the facts, not from assumptions.</p>
  ${Object.entries(by).map(([gname, gs]) => `<div class="catref-sub"><h3>${h(gname)} <span class="muted small">· ${gs.length} profile${gs.length === 1 ? '' : 's'}</span></h3><div class="tbl-wrap"><table><thead><tr><th style="width:90px">Code</th><th>Profile</th><th>Keywords</th><th>Guidance</th><th class="r" style="width:70px">Cases</th></tr></thead><tbody>${gs.map(g => `<tr><td class="mono small">${esc(g.id)}</td><td><b>${h(g.p)}</b>${g.dv ? `<div class="dv small" lang="dv" dir="rtl">${h(g.dv)}</div>` : ''}${g.def ? `<div class="small">${h(g.def)}</div>` : ''}</td><td class="small">${h(g.k || '')}</td><td class="small muted">${h(g.h || '')}</td><td class="r">${U.group[g.id] || 0}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}`;
}
function catRefTopics(q) {
  const C = catalogue(); const U = catUsage(); const h = s => hiTerms(esc(s), q);
  const list = C.topics.filter(x => !q || catMatch(q, `${x.id} ${x.t} ${x.h} ${x.f}`));
  if (!list.length) return `<div class="empty">No cross-cutting topic matches “${esc(q)}”.</div>`;
  return `<p class="small muted" style="margin:8px 0">Cross-cutting topics run across many rights (for example discrimination or gender). Record them in addition to the main right.</p>
  <div class="tbl-wrap"><table><thead><tr><th style="width:70px">Code</th><th>Topic</th><th>Guidance</th><th>Frameworks</th><th class="r" style="width:70px">Cases</th></tr></thead><tbody>${list.map(x => `<tr><td class="mono small">${esc(x.id)}</td><td><b>${h(x.t)}</b></td><td class="small">${h(x.h || '')}</td><td class="small">${h(x.f || '')}</td><td class="r">${U.topic[x.id] || 0}</td></tr>`).join('')}</tbody></table></div>`;
}
function catRefFrameworks(q) {
  const C = catalogue(); const h = s => hiTerms(esc(s), q);
  const list = C.frameworks.filter(x => !q || catMatch(q, `${x.id} ${x.n} ${x.type} ${x.y} ${x.rel} ${x.note}`));
  if (!list.length) return `<div class="empty">No legal framework matches “${esc(q)}”.</div>`;
  const abbr = x => (x.n.match(/\(([^)]+)\)\s*$/) || [])[1] || x.n; const uses = x => C.issues.filter(i => String(i.f || '').split(/\s*;\s*/).includes(abbr(x))).length;
  return `<p class="small muted" style="margin:8px 0">International instruments referred to in the catalogue. For Maldivian laws and regulations, see the Legal library.</p>
  <div class="tbl-wrap"><table><thead><tr><th style="width:70px">Code</th><th>Instrument</th><th>Type</th><th>Year</th><th>Relevance</th><th>Note</th><th class="r" style="width:80px">Issues citing</th></tr></thead><tbody>${list.map(x => `<tr><td class="mono small">${esc(x.id)}</td><td><b>${h(x.n)}</b></td><td class="small">${h(x.type || '')}</td><td>${esc(x.y || '')}</td><td class="small">${h(x.rel || '')}</td><td class="small muted">${h(x.note || '')}</td><td class="r">${uses(x)}</td></tr>`).join('')}</tbody></table></div>`;
}
function catRefGuide() {
  const C = catalogue(); const lines = (C.readme || []).map(r => (Array.isArray(r) ? r.filter(Boolean).join(' — ') : String(r || ''))).filter(Boolean);
  return `<div style="max-width:820px;margin-top:10px">
    <h3 style="margin-top:0">Classifying a complaint</h3>
    <ol class="small" style="line-height:1.6"><li>Choose the <b>main right</b> (category) and the <b>specific issue</b> that best describes the core of the complaint.</li><li>Add <b>secondary issues</b> when the complaint clearly raises other rights as well.</li><li>Record the <b>affected groups</b> that apply to the victim(s), and any <b>cross-cutting topics</b>.</li><li>Check the facts, the applicable law and the HRCM mandate before the classification is final. The catalogue labels are indicative.</li></ol>
    <p class="small">On the registration form and the case page, the classification box has its own search and an optional AI suggestion. This page is for looking things up.</p>
    ${lines.length ? `<h3>About the catalogue</h3><div class="small" style="line-height:1.6">${lines.map(l => `<p style="margin:0 0 6px">${esc(l)}</p>`).join('')}</div>` : ''}
    <p class="small muted">Source: ${esc(C.source || '')}${C.loadedAt ? ' · loaded ' + fmtD(C.loadedAt) : ''}. The System Administrator can upload a new version under Administration → Catalogue.</p></div>`;
}
ACT.catRefTab = el => { S.catTab = el.dataset.tab; render(); };
ON.catRefQ = el => { S.catQ = el.value; clearTimeout(ON._crt); ON._crt = setTimeout(() => { const b = $('#catRefBody'); if (b) b.innerHTML = catRefBody(); }, 160); };
ON.catRefDom = el => { S.catDom = el.value; const b = $('#catRefBody'); if (b) b.innerHTML = catRefBody(); };
ON.catRefToggle = el => { (S.catOpen || (S.catOpen = {}))[el.dataset.id] = el.open; };
ACT.catRefAll = el => { const o = el.dataset.o === '1'; catIndex().cats.forEach(c => { (S.catOpen || (S.catOpen = {}))[c.id] = o; }); $$('details.catref').forEach(d => { d.open = o; }); };
ACT.catRefExport = () => {
  const C = catalogue(); const U = catUsage();
  exportXLSX(`FREMYS-classification-catalogue-${today()}.xlsx`, [
    { name: 'Rights and issues', rows: [['Category code', 'Category', 'Domain', 'Subcategory code', 'Subcategory', 'Issue code', 'Specific issue', 'Dhivehi', 'Keywords', 'Frameworks', 'Guidance', 'Cases (main issue)'], ...C.issues.map(x => [x.c, x.cn, x.d, x.s, x.sn, x.i, x.in, x.dv || '', x.k || '', x.f || '', x.g || '', U.issue[x.i] || 0])] },
    { name: 'Affected groups', rows: [['Code', 'Group', 'Profile', 'Dhivehi', 'Keywords', 'Guidance', 'Cases'], ...C.groups.map(g => [g.id, g.g, g.p, g.dv || '', g.k || '', g.h || '', U.group[g.id] || 0])] },
    { name: 'Cross-cutting topics', rows: [['Code', 'Topic', 'Guidance', 'Frameworks', 'Cases'], ...C.topics.map(x => [x.id, x.t, x.h || '', x.f || '', U.topic[x.id] || 0])] },
    { name: 'Legal frameworks', rows: [['Code', 'Instrument', 'Type', 'Year', 'Relevance', 'Note'], ...C.frameworks.map(x => [x.id, x.n, x.type || '', x.y || '', x.rel || '', x.note || ''])] },
  ]);
};
