'use strict';
/* Complaint classification against the HRCM Human Rights Classification Reference Catalogue, with optional AI suggestions. */

let CATX = null;
function catalogue() { return (S.catalogue && Array.isArray(S.catalogue.issues) && S.catalogue.issues.length) ? S.catalogue : CATALOGUE_DEFAULT; }
function catIndex() {
  const c = catalogue(); if (CATX && CATX.src === c) return CATX;
  const byIssue = {}, cats = [], catMap = {}, subs = {}, catByName = {};
  c.issues.forEach(x => {
    byIssue[x.i] = x;
    if (!catMap[x.c]) { catMap[x.c] = { id: x.c, name: x.cn, domain: x.d, subs: [] }; cats.push(catMap[x.c]); catByName[normName(x.cn)] = catMap[x.c]; }
    if (!subs[x.s]) { subs[x.s] = { id: x.s, name: x.sn, c: x.c, issues: [] }; catMap[x.c].subs.push(subs[x.s]); }
    subs[x.s].issues.push(x);
  });
  const groupBy = {}; const groupNames = []; c.groups.forEach(g => { groupBy[g.id] = g; if (!groupNames.includes(g.g)) groupNames.push(g.g); });
  const topicBy = {}; c.topics.forEach(t => { topicBy[t.id] = t; });
  CATX = { src: c, byIssue, cats, catMap, subs, catByName, groupBy, groupNames, topicBy };
  return CATX;
}
function clsOf(c) { const X = catIndex(); if (c.classification && c.classification.catId) return c.classification; const m = X.catByName[normName(c.category)]; return m ? { catId: m.id } : {}; }
function clsPath(cl) { const X = catIndex(); const cat = X.catMap[cl.catId]; const sub = X.subs[cl.subId]; const iss = X.byIssue[cl.issueId]; return [cat?.name, sub?.name, iss && iss.in !== sub?.name ? iss.in : null].filter(Boolean); }
function isCatalogued(c) { return !!(c.classification && c.classification.catId && catIndex().catMap[c.classification.catId]); }
function clsFields(d) { const X = catIndex(); const cat = X.catMap[d.catId]; const sub = X.subs[d.subId]; return { category: cat?.name || '', subcategory: sub?.name || '', rightsDomain: cat?.domain || '' }; }
function cleanCls(d) { return { catId: d.catId || '', subId: d.subId || '', issueId: d.issueId || '', secondary: [...new Set(d.secondary || [])].filter(x => x !== d.issueId), groups: [...new Set(d.groups || [])], topics: [...new Set(d.topics || [])], source: d.source || 'manual', aiNote: d.aiNote || '', by: S.me.id, at: nowISO() }; }

/* ---------- Search ---------- */
function scoreText(q, hay) { const toks = normName(q).split(' ').filter(t => t.length > 1); if (!toks.length) return 0; const h = normName(hay); let s = 0; toks.forEach(t => { if (h.includes(t)) s += t.length > 3 ? 2 : 1; }); if (h.includes(normName(q))) s += 4; return s; }
function searchIssues(q, n = 8) { return catalogue().issues.map(x => ({ x, s: scoreText(q, `${x.in} ${x.sn} ${x.cn} ${x.k} ${x.dv || ''}`) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(r => r.x); }
function searchGroups(q, n = 8) { return catalogue().groups.map(g => ({ g, s: scoreText(q, `${g.g} ${g.p} ${g.k} ${g.dv || ''}`) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(r => r.g); }

/* ---------- Editor (used on the registration form and in the "Classify" dialog) ---------- */
function startCls(initial, getSummary, cid) { S.cls = { draft: { secondary: [], groups: [], topics: [], ...JSON.parse(JSON.stringify(initial || {})) }, getSummary, cid, ai: null }; }
function clsRefresh() { const box = $('#clsBox'); if (box) box.innerHTML = clsEditorHTML(); }
function chip(text, act, data, tone = '') { return `<span class="pill ${tone}" style="display:inline-flex;gap:6px;align-items:center;margin:2px 4px 2px 0">${esc(text)}<button type="button" class="btn link" style="padding:0;text-decoration:none" data-act="${act}" ${data} aria-label="Remove">✕</button></span>`; }
function clsEditorHTML() {
  const X = catIndex(); const d = S.cls.draft; const cat = X.catMap[d.catId]; const sub = X.subs[d.subId]; const iss = X.byIssue[d.issueId];
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  return `<div class="form">
    <div class="f"><label for="cls_cat" class="req">Main category</label><select id="cls_cat" data-on="change:clsCat"><option value="">Select…</option>${X.cats.map(c => opt(c.id, c.name, d.catId)).join('')}</select></div>
    <div class="f"><label for="cls_sub">Subcategory</label><select id="cls_sub" data-on="change:clsSub" ${cat ? '' : 'disabled'}><option value="">${cat ? 'Select…' : 'Choose a main category first'}</option>${(cat?.subs || []).map(s => opt(s.id, s.name, d.subId)).join('')}</select></div>
    ${sub && sub.issues.length > 1 ? `<div class="f"><label for="cls_iss">Specific issue</label><select id="cls_iss" data-on="change:clsIss"><option value="">Select…</option>${sub.issues.map(i => opt(i.i, i.in, d.issueId)).join('')}</select></div>` : ''}
  </div>
  ${cat ? `<div class="note small" style="margin-top:10px"><b>${esc(cat.domain)}</b>${iss ? ` · ${esc(iss.i)} · Indicative frameworks: ${esc(iss.f || '—')}${iss.dv ? ` · <span class="thaana">${esc(iss.dv)}</span>` : ''}${iss.def ? `<br>HRCM definition: ${esc(iss.def)}` : ''}<br><span class="muted">${esc(iss.g || '')}</span>` : ''}</div>` : ''}
  <div class="row" style="margin-top:12px;align-items:flex-end">
    <div class="f" style="flex:1;min-width:220px"><label for="cls_q">Search the catalogue</label><input id="cls_q" type="search" placeholder="e.g. wages, passport, detention, school" data-on="input:clsSearch" autocomplete="off"></div>
    ${S.sample && !S.sampleOff ? `<button type="button" class="btn primary" data-act="clsAI">✦ Suggest with AI</button>` : ''}
  </div>
  <div id="clsResults"></div>
  <div id="clsAIBox">${clsAIHTML()}</div>
  <div class="f" style="margin-top:12px"><label>Other issues engaged</label><div>${(d.secondary || []).map(id => chip(X.byIssue[id] ? X.byIssue[id].in : id, 'clsDelSec', `data-id="${esc(id)}"`)).join('') || '<span class="muted small">None. Use the search above and choose “Add as other issue”.</span>'}</div></div>
  <div class="f" style="margin-top:12px"><label for="cls_gq">Affected groups (vulnerability descriptors)</label><div>${(d.groups || []).map(id => chip(X.groupBy[id] ? `${X.groupBy[id].g}: ${X.groupBy[id].p}` : id, 'clsDelGroup', `data-id="${esc(id)}"`, 'info')).join('')}</div>
    <div class="typeahead" style="max-width:420px;margin-top:4px"><input id="cls_gq" type="search" placeholder="Search groups, e.g. child, migrant, detention" data-on="input:clsGroupSearch" autocomplete="off"><div id="clsGRes" class="ta-list hidden"></div></div>
    <span class="muted small">Apply only where the facts indicate it; a person may fit more than one group.</span></div>
  <div class="f" style="margin-top:12px"><label>Cross-cutting topics</label><div class="checks">${catalogue().topics.map(t => `<label title="${esc(t.h)}"><input type="checkbox" data-on="change:clsTopic" value="${esc(t.id)}" ${(d.topics || []).includes(t.id) ? 'checked' : ''}> ${esc(t.t)}</label>`).join('')}</div></div>
  <p class="small muted" style="margin-bottom:0">Indicative classification. Selecting a category does not establish that a violation occurred; record the alleged facts and make findings through the assessment process.</p>`;
}
ON.clsCat = el => { const d = S.cls.draft; d.catId = el.value; d.subId = ''; d.issueId = ''; clsRefresh(); };
ON.clsSub = el => { const d = S.cls.draft; d.subId = el.value; const sub = catIndex().subs[el.value]; d.issueId = sub && sub.issues.length === 1 ? sub.issues[0].i : ''; clsRefresh(); };
ON.clsIss = el => { S.cls.draft.issueId = el.value; clsRefresh(); };
ON.clsTopic = el => { const d = S.cls.draft; d.topics = (d.topics || []).filter(x => x !== el.value); if (el.checked) d.topics.push(el.value); };
ON.clsSearch = el => {
  const box = $('#clsResults'); const q = el.value.trim(); if (!q) { box.innerHTML = ''; return; }
  const hits = searchIssues(q);
  box.innerHTML = hits.length ? `<div class="tbl-wrap" style="margin-top:8px"><table><tbody>${hits.map(x => `<tr><td><b>${esc(x.in)}</b><div class="muted small">${esc(x.cn)} › ${esc(x.sn)} · ${esc(x.i)}</div></td><td class="r" style="white-space:nowrap"><button type="button" class="btn sm primary" data-act="clsSetPrimary" data-id="${esc(x.i)}">Use as main issue</button> <button type="button" class="btn sm" data-act="clsAddSec" data-id="${esc(x.i)}">Add as other issue</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small" style="margin-top:6px">No catalogue entry matches. Try another word.</div>';
};
ON.clsGroupSearch = el => {
  const box = $('#clsGRes'); const q = el.value.trim(); if (!q) { box.classList.add('hidden'); return; }
  const hits = searchGroups(q); box.classList.remove('hidden');
  box.innerHTML = hits.length ? hits.map(g => `<button type="button" data-act="clsAddGroup" data-id="${esc(g.id)}"><span><b>${esc(g.g)}</b> · ${esc(g.p)}</span></button>`).join('') : '<div class="empty" style="padding:10px">No matching group.</div>';
};
function setPrimary(issueId) { const x = catIndex().byIssue[issueId]; if (!x) return; const d = S.cls.draft; d.catId = x.c; d.subId = x.s; d.issueId = x.i; d.secondary = (d.secondary || []).filter(s => s !== x.i); }
ACT.clsSetPrimary = el => { setPrimary(el.dataset.id); clsRefresh(); };
ACT.clsAddSec = el => { const d = S.cls.draft; if (el.dataset.id !== d.issueId && !(d.secondary || []).includes(el.dataset.id)) d.secondary = [...(d.secondary || []), el.dataset.id]; clsRefresh(); };
ACT.clsDelSec = el => { const d = S.cls.draft; d.secondary = (d.secondary || []).filter(x => x !== el.dataset.id); clsRefresh(); };
ACT.clsAddGroup = el => { const d = S.cls.draft; if (!(d.groups || []).includes(el.dataset.id)) d.groups = [...(d.groups || []), el.dataset.id]; clsRefresh(); };
ACT.clsDelGroup = el => { const d = S.cls.draft; d.groups = (d.groups || []).filter(x => x !== el.dataset.id); clsRefresh(); };

/* ---------- AI suggestions ---------- */
let clsAbort = null;
function clsPrompt(summary) {
  const c = catalogue();
  return `You are assisting the Registration Department of the Human Rights Commission of the Maldives (HRCM). Classify the complaint summary below using ONLY the HRCM Human Rights Classification Reference Catalogue listed here. The summary may be in English or Dhivehi. The classification is indicative: it does not establish that a violation occurred.

Reply with only JSON in exactly this shape:
{"primary":{"issueId":"SI000","confidence":"high|medium|low","reason":"one short sentence"},"secondary":[{"issueId":"SI000","reason":"..."}],"groups":[{"id":"VG00-00","reason":"..."}],"topics":[{"id":"CT00","reason":"..."}],"note":"what staff should check, or an empty string"}

Rules:
- Use only ids that appear in the lists below.
- "primary" is the single best-fitting specific issue. Add up to 3 "secondary" issues only when the facts clearly engage them.
- Add vulnerable-group profiles only when the summary states facts that indicate them (age, disability, detention, migrant work, etc.). Do not infer a group from a name alone.
- Add cross-cutting topics only when clearly relevant.
- Write reasons in English, one short sentence each. If the summary is too vague, use confidence "low" and say what is missing in "note".

SPECIFIC ISSUES (id | main category > subcategory > issue | keywords)
${c.issues.map(x => `${x.i} | ${x.cn} > ${x.sn}${x.in !== x.sn ? ' > ' + x.in : ''} | ${x.k}`).join('\n')}

VULNERABLE GROUP PROFILES (id | group > profile)
${c.groups.map(g => `${g.id} | ${g.g} > ${g.p}`).join('\n')}

CROSS-CUTTING TOPICS (id | topic | how to consider)
${c.topics.map(t => `${t.id} | ${t.t} | ${t.h}`).join('\n')}

COMPLAINT SUMMARY
"""
${summary.slice(0, 5000)}
"""`;
}
ACT.clsAI = async () => {
  const summary = String(S.cls.getSummary() || '').trim();
  if (summary.length < 15) { toast('Write the complaint summary first, then ask for a suggestion.', 'error'); return; }
  if (!S.sample) return;
  clsAbort = new AbortController();
  S.cls.ai = { state: 'busy' }; $('#clsAIBox').innerHTML = clsAIHTML();
  try {
    const r = await S.sample.json(clsPrompt(summary), { modelTier: 'quick', signal: clsAbort.signal });
    const X = catIndex(); const okI = id => !!X.byIssue[id];
    const res = {
      primary: r && r.primary && okI(r.primary.issueId) ? { issueId: r.primary.issueId, confidence: ['high', 'medium', 'low'].includes(r.primary.confidence) ? r.primary.confidence : 'low', reason: String(r.primary.reason || '') } : null,
      secondary: (Array.isArray(r?.secondary) ? r.secondary : []).filter(s => s && okI(s.issueId) && s.issueId !== r.primary?.issueId).slice(0, 3).map(s => ({ issueId: s.issueId, reason: String(s.reason || '') })),
      groups: (Array.isArray(r?.groups) ? r.groups : []).filter(g => g && X.groupBy[g.id]).slice(0, 6).map(g => ({ id: g.id, reason: String(g.reason || '') })),
      topics: (Array.isArray(r?.topics) ? r.topics : []).filter(t => t && X.topicBy[t.id]).slice(0, 4).map(t => ({ id: t.id, reason: String(t.reason || '') })),
      note: String(r?.note || ''),
    };
    if (!res.primary) throw { code: 'invalid_json', message: 'no usable primary issue' };
    S.cls.ai = { state: 'done', res };
    logA('classification.ai_suggest', S.cls.cid || null, `${res.primary.issueId} (${res.primary.confidence})`);
  } catch (e) {
    const code = e && e.code;
    if (code === 'cancelled') S.cls.ai = null;
    else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { S.sampleOff = true; S.cls.ai = { state: 'error', msg: 'AI suggestions are not available for your account here. Classify using the catalogue search.' }; }
    else S.cls.ai = { state: 'error', msg: code === 'rate_limited' ? 'Claude is busy or your usage limit was reached. Try again in a little while.' : code === 'refused' ? 'Claude could not classify this summary. Classify it manually.' : code === 'invalid_json' ? 'The suggestion could not be read. Try again, or classify manually.' : 'The suggestion could not be completed. Try again, or classify manually.' };
  }
  const box = $('#clsAIBox'); if (box) box.innerHTML = clsAIHTML();
};
ACT.clsAIStop = () => { if (clsAbort) clsAbort.abort(); };
function clsAIHTML() {
  const a = S.cls && S.cls.ai; if (!a) return '';
  if (a.state === 'busy') return `<div class="note" style="margin-top:10px">✦ Reading the summary against the catalogue… <button type="button" class="btn sm" data-act="clsAIStop">Stop</button></div>`;
  if (a.state === 'error') return `<div class="note warn" style="margin-top:10px">${esc(a.msg)}</div>`;
  const X = catIndex(); const r = a.res; const p = X.byIssue[r.primary.issueId];
  const tone = { high: 'ok', medium: 'warn', low: 'bad' }[r.primary.confidence];
  const line = (label, reason, btn) => `<li style="margin:4px 0"><b>${esc(label)}</b>${reason ? ` <span class="muted">— ${esc(reason)}</span>` : ''} ${btn}</li>`;
  return `<div class="entry" style="margin-top:10px;border-color:#0ea5e9;box-shadow:none"><div class="meta"><span><b>✦ AI suggestion</b> ${pill(r.primary.confidence + ' confidence', tone)}</span><span><button type="button" class="btn sm primary" data-act="clsApplyAll">Apply all</button> <button type="button" class="btn sm" data-act="clsAIDismiss">Dismiss</button></span></div>
    <ul class="small" style="margin:6px 0;padding-inline-start:18px">
      ${line(`Main issue: ${p.cn} › ${p.in}`, r.primary.reason, `<button type="button" class="btn link small" data-act="clsSetPrimary" data-id="${esc(p.i)}">Use</button>`)}
      ${r.secondary.map(s => line(`Other issue: ${X.byIssue[s.issueId].in}`, s.reason, `<button type="button" class="btn link small" data-act="clsAddSec" data-id="${esc(s.issueId)}">Add</button>`)).join('')}
      ${r.groups.map(g => line(`Group: ${X.groupBy[g.id].g} › ${X.groupBy[g.id].p}`, g.reason, `<button type="button" class="btn link small" data-act="clsAddGroup" data-id="${esc(g.id)}">Add</button>`)).join('')}
      ${r.topics.map(t => line(`Topic: ${X.topicBy[t.id].t}`, t.reason, `<button type="button" class="btn link small" data-act="clsAddTopic" data-id="${esc(t.id)}">Add</button>`)).join('')}
    </ul>${r.note ? `<div class="small"><b>Check:</b> ${esc(r.note)}</div>` : ''}
    <div class="small muted" style="margin-top:6px">Suggested by Claude from the complaint summary only, using your Claude account. Review before saving; the officer's judgement decides.</div></div>`;
}
ACT.clsAddTopic = el => { const d = S.cls.draft; if (!(d.topics || []).includes(el.dataset.id)) d.topics = [...(d.topics || []), el.dataset.id]; clsRefresh(); };
ACT.clsAIDismiss = () => { S.cls.ai = null; $('#clsAIBox').innerHTML = ''; };
ACT.clsApplyAll = () => {
  const r = S.cls.ai.res; const d = S.cls.draft; setPrimary(r.primary.issueId);
  d.secondary = [...new Set([...(d.secondary || []), ...r.secondary.map(s => s.issueId)])].filter(x => x !== d.issueId);
  d.groups = [...new Set([...(d.groups || []), ...r.groups.map(g => g.id)])]; d.topics = [...new Set([...(d.topics || []), ...r.topics.map(t => t.id)])];
  d.source = 'ai-assisted'; d.aiNote = `${r.primary.confidence} confidence: ${r.primary.reason}`; clsRefresh();
};

/* ---------- Classification card and dialog on the complaint page ---------- */
function clsCardHTML(c) {
  const X = catIndex(); const cl = clsOf(c); const path = clsPath(cl);
  const mayEdit = can('register') || can('editCore') || can('mgmtComment') || c.assignedTo === S.me.id;
  return `<div class="card"><div class="card-head"><h2>Classification</h2>${mayEdit ? `<button class="btn sm" data-act="classifyCase" data-id="${esc(c.id)}">${isCatalogued(c) ? 'Edit' : 'Classify'}</button>` : ''}</div>
    ${!isCatalogued(c) ? `<div class="note warn" style="margin-bottom:8px">${c.category ? `Recorded as “${esc(c.category)}”, which is not in the classification catalogue.` : 'Not classified yet.'}${mayEdit ? ' Use Classify to choose from the catalogue.' : ''}</div>` : ''}
    ${path.length ? `<div style="font-size:15px"><b>${path.map(esc).join(' › ')}</b></div><div class="muted small">${esc(X.catMap[cl.catId]?.domain || '')}${cl.issueId ? ' · ' + esc(cl.issueId) + ' · ' + esc(X.byIssue[cl.issueId]?.f || '') : ''}</div>` : ''}
    ${(cl.secondary || []).length ? `<div style="margin-top:8px"><span class="small muted">Other issues:</span> ${cl.secondary.map(id => pill(X.byIssue[id]?.in || id)).join(' ')}</div>` : ''}
    ${(cl.groups || []).length ? `<div style="margin-top:6px"><span class="small muted">Affected groups:</span> ${cl.groups.map(id => pill(X.groupBy[id] ? `${X.groupBy[id].g}: ${X.groupBy[id].p}` : id, 'info')).join(' ')}</div>` : ''}
    ${(cl.topics || []).length ? `<div style="margin-top:6px"><span class="small muted">Cross-cutting:</span> ${cl.topics.map(id => pill(X.topicBy[id]?.t || id, 'warn')).join(' ')}</div>` : ''}
    ${cl.at ? `<div class="small muted" style="margin-top:8px">Classified ${fmtDT(cl.at)} by ${esc(nm(cl.by))}${cl.source === 'ai-assisted' ? ' · AI-assisted' : ''}</div>` : ''}</div>`;
}
ACT.classifyCase = el => {
  const c = S.complaints[el.dataset.id]; startCls(clsOf(c), () => c.summary, c.id);
  modal({ title: 'Classify ' + c.regNo, wide: true, body: `<div class="note small" style="margin-bottom:12px"><b>Summary:</b> ${esc(c.summary)}</div><div id="clsBox">${clsEditorHTML()}</div><div class="form" style="margin-top:12px">${fld('Reason for change', inp('reason', '', { ph: 'Optional for a first classification' }), { full: true, id: 'f_reason' })}</div>`,
    onSubmit: async o => {
      const d = S.cls.draft; if (!d.catId) throw new Error('Choose at least a main category.');
      if (isCatalogued(c) && !o.reason) throw new Error('Give a reason for changing the classification.');
      const before = clsPath(clsOf(c)).join(' › ') || c.category || 'unclassified'; const after = clsPath(d).join(' › ');
      await updC(c.id, { classification: cleanCls(d), ...clsFields(d) }, { note: `Classification ${isCatalogued(c) ? `changed from “${before}” to` : 'set to'} “${after}”${d.source === 'ai-assisted' ? ' (AI-assisted)' : ''}${o.reason ? ': ' + o.reason : ''}`, action: 'classification.set' });
    } });
};

/* ---------- Administration: catalogue tab ---------- */
function adminCatalogueView() {
  const c = catalogue(); const X = catIndex(); const custom = c !== CATALOGUE_DEFAULT; const q = S.catQ || '';
  const list = q ? searchIssues(q, 200) : c.issues;
  const use = id => vals(S.complaints).filter(x => x.classification?.issueId === id).length;
  return `<div class="grid2" style="margin-bottom:14px">
    <div class="card"><h3>Classification catalogue</h3><dl class="kv"><dt>In use</dt><dd>${esc(c.name || 'Catalogue')}${custom ? ' ' + pill('Uploaded version', 'info') : ' ' + pill('Bundled version')}</dd><dt>Source file</dt><dd class="small">${esc(c.source || '—')}</dd><dt>Loaded</dt><dd>${fmtD(c.loadedAt)}${c.loadedBy ? ' by ' + esc(nm(c.loadedBy)) : ''}</dd>
      <dt>Contents</dt><dd>${X.cats.length} main categories · ${Object.keys(X.subs).length} subcategories · ${c.issues.length} specific issues · ${c.groups.length} group profiles · ${c.topics.length} cross-cutting topics · ${(c.frameworks || []).length} frameworks</dd></dl></div>
    <div class="card"><h3>Load an updated workbook</h3><p class="small">Upload a new version of the catalogue (.xlsx) with the same sheets and column names (Violation_Catalogue, Vulnerable_Groups, Cross_Cutting_Topics, Legal_Frameworks). Existing complaint classifications keep their IDs, so keep IDs stable when editing the workbook.</p>
      <div class="row"><input type="file" id="catFile" accept=".xlsx"><button class="btn primary" data-act="catUpload">Load workbook</button>${custom ? '<button class="btn" data-act="catRestore">Restore bundled version</button>' : ''}</div></div></div>
  <div class="filters"><div class="f wide"><label for="cat_q">Search the catalogue</label><input id="cat_q" type="search" value="${esc(q)}" data-on="change:catQ" placeholder="Category, issue or keyword"></div></div>
  <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Main category</th><th>Subcategory / issue</th><th>Keywords</th><th>Frameworks</th><th>Dhivehi</th><th class="r">Complaints</th></tr></thead><tbody>${list.map(x => `<tr><td class="mono">${esc(x.i)}</td><td>${esc(x.cn)}<div class="muted small">${esc(x.d)}</div></td><td><b>${esc(x.sn)}</b>${x.in !== x.sn ? `<div class="small">${esc(x.in)}</div>` : ''}</td><td class="small">${esc(x.k)}</td><td class="small">${esc(x.f)}</td><td class="thaana">${esc(x.dv || '—')}</td><td class="r">${use(x.i)}</td></tr>`).join('')}</tbody></table></div>
  <div class="grid2 section"><div class="card"><h3>Cross-cutting topics</h3><ul class="small" style="padding-inline-start:18px">${c.topics.map(t => `<li><b>${esc(t.t)}</b> — ${esc(t.h)}</li>`).join('')}</ul></div>
    <div class="card"><h3>Usage notes from the catalogue</h3><dl class="kv small">${(c.readme || []).slice(1).map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div></div>`;
}
ON.catQ = el => { S.catQ = el.value; render(); };
function parseCatalogueWorkbook(wb, filename) {
  const sheet = n => { const ws = wb.Sheets[n]; if (!ws) throw new Error(`The workbook has no "${n}" sheet.`); return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), String(v).trim()]))); };
  const need = (rows, cols, n) => { cols.forEach(cn => { if (rows.length && !(cn in rows[0])) throw new Error(`Sheet "${n}" is missing the column "${cn}".`); }); };
  const vc = sheet('Violation_Catalogue'); need(vc, ['Category_ID', 'Main_Category', 'Rights_Domain', 'Subcategory_ID', 'Subcategory', 'Specific_Issue_ID', 'Specific_Issue_or_Example', 'Search_Keywords'], 'Violation_Catalogue');
  const issues = vc.filter(r => r.Specific_Issue_ID && r.Main_Category).map(r => ({ c: r.Category_ID, cn: r.Main_Category, d: r.Rights_Domain, s: r.Subcategory_ID, sn: r.Subcategory, i: r.Specific_Issue_ID, in: r.Specific_Issue_or_Example || r.Subcategory, k: r.Search_Keywords, f: r.Indicative_International_Frameworks || '', g: r.Classification_Guidance || '', dv: r.Dhivehi_Term_or_Translation || '', def: r.HRCM_Local_Definition || '' }));
  if (!issues.length) throw new Error('No catalogue rows were found.');
  const ids = new Set(); issues.forEach(x => { if (ids.has(x.i)) throw new Error(`Specific_Issue_ID ${x.i} appears twice.`); ids.add(x.i); });
  const cnt = {}; const groups = (wb.Sheets.Vulnerable_Groups ? sheet('Vulnerable_Groups') : []).filter(r => r.Group_ID).map(r => { cnt[r.Group_ID] = (cnt[r.Group_ID] || 0) + 1; return { id: `${r.Group_ID}-${String(cnt[r.Group_ID]).padStart(2, '0')}`, gid: r.Group_ID, g: r.Main_Vulnerable_Group, p: r.Subcategory_or_Profile, k: r.Search_Keywords || '', h: r.Classification_Guidance || '', dv: r.Dhivehi_Term_or_Translation || '', def: r.HRCM_Local_Definition || '' }; });
  const topics = (wb.Sheets.Cross_Cutting_Topics ? sheet('Cross_Cutting_Topics') : []).filter(r => r.Topic_ID).map(r => ({ id: r.Topic_ID, t: r.Cross_Cutting_Topic, h: r.How_to_Consider || '', f: r.Indicative_Frameworks || '' }));
  const frameworks = (wb.Sheets.Legal_Frameworks ? sheet('Legal_Frameworks') : []).filter(r => r.Framework_ID).map(r => ({ id: r.Framework_ID, n: r.Instrument_or_Framework, type: r.Type || '', y: r.Adoption_Year || '', rel: r.Main_Relevance || '', note: r.Verification_Note || '' }));
  const readme = wb.Sheets.READ_ME ? XLSX.utils.sheet_to_json(wb.Sheets.READ_ME, { header: 1, defval: '' }).map(r => [String(r[0] || ''), String(r[1] || '')]) : [];
  return { name: 'HRCM Human Rights Classification Reference Catalogue', source: filename, loadedAt: today(), loadedBy: S.me.id, issues, groups, topics, frameworks, readme };
}
ACT.catUpload = async () => {
  const f = $('#catFile')?.files?.[0]; if (!f) { toast('Choose the catalogue workbook first.', 'error'); return; }
  if (!window.XLSX) { toast('The spreadsheet reader did not load. Check your connection and reload.', 'error'); return; }
  try {
    const cat = parseCatalogueWorkbook(XLSX.read(await f.arrayBuffer(), { type: 'array' }), f.name);
    const used = new Set(vals(S.complaints).flatMap(c => [c.classification?.issueId, ...(c.classification?.secondary || [])]).filter(Boolean));
    const missing = [...used].filter(id => !cat.issues.some(x => x.i === id));
    confirmBox('Load this catalogue?', `${cat.issues.length} specific issues, ${cat.groups.length} group profiles and ${cat.topics.length} topics.${missing.length ? ` Warning: ${missing.length} issue ID(s) used by existing complaints are not in the new workbook (${missing.slice(0, 6).join(', ')}); those complaints will show as needing reclassification.` : ' All issue IDs used by existing complaints are present.'}`, 'Load catalogue', async () => {
      await setDoc('config/catalogue', cat); logA('catalogue.load', null, `${f.name}: ${cat.issues.length} issues`); toast('Catalogue loaded');
    });
  } catch (e) { toast(errText(e), 'error'); }
};
ACT.catRestore = () => confirmBox('Restore the bundled catalogue?', 'Go back to the catalogue that came with FREMYS (from HRCM_Human_Rights_Classification_Reference_Catalogue.xlsx).', 'Restore', async () => { await delDoc('config/catalogue'); logA('catalogue.restore', null, ''); });
