'use strict';
/* Follow-up actions: recommendations sent to institutions after the Commission's decision, and monitoring of their implementation.
   Two types: case recommendations (one complaint) and systemic recommendations (an institution's practice, policy or law; may cover several complaints). */

const REC_TYPES = { case: ['Case recommendation', 'info'], systemic: ['Systemic recommendation', 'warn'] };
const REC_STATUS = {
  issued: ['Issued — awaiting response', 'warn', true], acknowledged: ['Acknowledged by the institution', 'info', true], in_progress: ['Implementation in progress', 'info', true],
  partial: ['Partially implemented', 'warn', true], implemented: ['Implemented', 'ok', false], not_implemented: ['Not implemented', 'bad', false], closed: ['Closed', 'muted', false],
};
const recOpen = r => REC_STATUS[r.status]?.[2] !== false;
const recOverdue = r => recOpen(r) && r.due && r.due < today();
function recsList() { return Object.entries(S.recs || {}).map(([id, r]) => ({ id, ...r })); }
function recsForCase(cid) { return recsList().filter(r => (r.complaintIds || []).includes(cid)); }
function canManageRecs() { return can('supervise') || hasRole('admin_officer') || hasRole('support') || hasRole('reg_officer') || can('admin'); }
function recVisible(r) { if (can('viewAll')) return true; return r.owner === S.me.id || (r.complaintIds || []).some(id => canSeeCase(S.complaints[id])); }

VIEWS.actions = () => {
  if (!can('viewAll') && !can('viewAssigned')) return noAccess();
  const all = recsList().filter(recVisible); const td = today();
  const f = S.recF || (S.recF = { type: '', status: 'open', inst: '', mine: !can('viewAll') });
  const list = all.filter(r => !f.type || r.type === f.type).filter(r => f.status === 'open' ? recOpen(r) : f.status === 'overdue' ? recOverdue(r) : !f.status || r.status === f.status)
    .filter(r => !f.inst || r.institution === f.inst).filter(r => !f.mine || r.owner === S.me.id).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
  const open = all.filter(recOpen); const closedL = all.filter(r => !recOpen(r)); const impl = all.filter(r => r.status === 'implemented'); const part = all.filter(r => r.status === 'partial');
  const insts = [...new Set(all.map(r => r.institution).filter(Boolean))].sort();
  const tile = (k, l, n, sub, tone, set) => `<button class="tile ${tone}" data-act="recQuick" data-set='${esc(JSON.stringify(set))}'><div class="k">${esc(l)}</div><div class="v num">${n}</div><div class="s">${esc(sub)}</div></button>`;
  return `<div class="page-head"><div><h1>${esc(t('actions'))}</h1><p>After the Commission's decision, the Commission may send letters with recommendations to institutions. Each recommendation is monitored here until the institution implements it or the Commission closes it.</p></div>
    <div class="row">${canManageRecs() ? '<button class="btn primary" data-act="newRec" data-type="case">+ Case recommendation</button><button class="btn primary" data-act="newRec" data-type="systemic">+ Systemic recommendation</button>' : ''}<button class="btn" data-act="exportRecs">Export Excel</button></div></div>
  <div class="tiles tiles5">
    ${tile('open', 'Being monitored', open.length, `${open.filter(r => r.type === 'case').length} case · ${open.filter(r => r.type === 'systemic').length} systemic`, 'info', { status: 'open', type: '' })}
    ${tile('over', 'Follow-up overdue', all.filter(recOverdue).length, 'Past the follow-up date', 'bad', { status: 'overdue', type: '' })}
    ${tile('impl', 'Implemented', impl.length, `${part.length} partially`, 'ok', { status: 'implemented', type: '' })}
    ${tile('ni', 'Not implemented', all.filter(r => r.status === 'not_implemented').length, 'Institution did not act', 'bad', { status: 'not_implemented', type: '' })}
    <div class="tile" style="cursor:default"><div class="k">Implementation rate</div><div class="v num">${closedL.length ? pctOf(impl.length, closedL.length) + '%' : '—'}</div><div class="s">Implemented ÷ ${closedL.length} concluded</div></div>
  </div>
  <div class="tabs">${[['', 'All'], ['case', 'Case recommendations'], ['systemic', 'Systemic recommendations']].map(([k, l]) => `<button class="${f.type === k ? 'on' : ''}" data-act="recType" data-t="${k}">${esc(l)}<span class="cnt">${all.filter(r => !k || r.type === k).filter(r => f.status !== 'open' || recOpen(r)).length}</span></button>`).join('')}</div>
  <div class="filters"><div class="f"><label for="rf_status">${esc(t('status'))}</label><select id="rf_status" data-on="change:recF" name="status"><option value="">${esc(t('all'))}</option><option value="open" ${f.status === 'open' ? 'selected' : ''}>Open (being monitored)</option><option value="overdue" ${f.status === 'overdue' ? 'selected' : ''}>Follow-up overdue</option>${Object.entries(REC_STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select></div>
    <div class="f wide"><label for="rf_inst">Institution</label><select id="rf_inst" data-on="change:recF" name="inst"><option value="">All institutions</option>${insts.map(i => `<option ${f.inst === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></div>
    <div class="f" style="justify-content:flex-end"><label class="na"><input type="checkbox" data-on="change:recMine" ${f.mine ? 'checked' : ''}> Only those I monitor</label></div></div>
  ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Recommendation</th><th>Institution</th><th>Complaints</th><th>Letter</th><th>Next follow-up</th><th>${esc(t('status'))}</th><th>Monitored by</th><th></th></tr></thead><tbody>${list.map(r => { const od = recOverdue(r); const last = entries(r.updates).sort(byAt)[0]; return `<tr class="${od ? 'overdue' : ''}">
    <td style="min-width:240px;max-width:340px">${pill(REC_TYPES[r.type]?.[0] || r.type, REC_TYPES[r.type]?.[1])} <span class="mono small">${esc(r.ref || '')}</span><div style="margin-top:4px">${esc(r.text)}</div>${last ? `<div class="muted small" style="margin-top:4px">Latest: ${fmtD(last.at)} — ${esc(last.note)}</div>` : ''}</td>
    <td>${esc(r.institution)}</td><td>${(r.complaintIds || []).map(id => S.complaints[id] ? caseLink(S.complaints[id]) : '').join('<br>') || '<span class="muted">—</span>'}</td>
    <td>${fmtD(r.letterDate)}${r.letterRef ? `<div class="muted small">${esc(r.letterRef)}</div>` : ''}</td><td>${recOpen(r) ? (od ? pill(fmtD(r.due), 'bad') : fmtD(r.due)) : '—'}</td>
    <td>${pill(REC_STATUS[r.status]?.[0] || r.status, REC_STATUS[r.status]?.[1])}</td><td>${esc(nm(r.owner))}</td>
    <td><div class="stack" style="gap:4px;align-items:stretch">${canManageRecs() ? `<button class="btn sm primary" data-act="recUpdate" data-id="${esc(r.id)}">Follow-up</button>` : ''}<button class="btn sm" data-act="recView" data-id="${esc(r.id)}">History</button></div></td></tr>`; }).join('')}</tbody></table></div>`
    : `<div class="card empty">No recommendations in this view.${canManageRecs() && !all.length ? ' Add one with the buttons above once the Commission has decided a complaint.' : ''}</div>`}`;
};
ACT.recType = el => { S.recF = { ...S.recF, type: el.dataset.t }; render(); };
ACT.recQuick = el => { S.recF = { ...S.recF, ...JSON.parse(el.dataset.set) }; render(); };
ON.recF = el => { S.recF = { ...S.recF, [el.name]: el.value }; render(); };
ON.recMine = el => { S.recF = { ...S.recF, mine: el.checked }; render(); };

function recFields(type, r = {}, preset = []) {
  const decided = visibleCases().filter(c => finalDecision(c)).sort((a, b) => String(b.dateReceived).localeCompare(String(a.dateReceived)));
  const chosen = new Set(r.complaintIds || preset);
  return `<div class="form">
    ${fld('Recommendation', txt('text', r.text, { req: 'the recommendation', rows: 4, ph: type === 'systemic' ? 'e.g. Amend the procedure so detainees can call family within 24 hours of arrest' : 'e.g. Pay the outstanding wages to the complainant within 30 days' }), { req: true, full: true, id: 'f_text' })}
    ${fld('Institution', inp('institution', r.institution || (preset[0] && S.complaints[preset[0]]?.respondent?.name) || '', { req: 'the institution', ph: 'Who must implement it' }), { req: true, id: 'f_institution' })}
    ${fld('Monitored by', `<select id="f_owner" name="owner">${staffIds().map(id => `<option value="${esc(id)}" ${id === (r.owner || (preset[0] && S.complaints[preset[0]]?.assignedTo) || S.me.id) ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select>`, { id: 'f_owner' })}
    ${fld('Recommendation letter date', inp('letterDate', r.letterDate || today(), { type: 'date' }), { id: 'f_letterDate' })}
    ${fld('Letter reference no.', inp('letterRef', r.letterRef || '', { ph: 'e.g. HRCM/REC/2026/18' }), { id: 'f_letterRef' })}
    ${fld('First follow-up date', inp('due', r.due || addDays(today(), 30), { type: 'date' }), { id: 'f_due', hint: 'When to check with the institution' })}
    <div class="f full"><label>${type === 'case' ? 'Complaint' : 'Related complaints (optional)'}</label>
      <div style="max-height:200px;overflow:auto;border:1px solid #aab7c9;border-radius:6px;padding:6px 8px;background:#fff">${decided.length ? decided.map(c => `<label class="na" style="display:flex;padding:2px 0;color:#0f172a"><input type="${type === 'case' ? 'radio' : 'checkbox'}" ${type === 'case' ? '' : 'data-multi="1"'} name="cids" value="${esc(c.id)}" ${chosen.has(c.id) ? 'checked' : ''}> <span><b class="mono">${esc(c.regNo)}</b> · ${esc(c.respondent?.name || '')} · ${esc(c.subcategory || c.category || '')} · ${isLodged(c) ? 'lodged' : 'not lodged'}</span></label>`).join('') : '<span class="muted small">No complaints have a Commission decision yet.</span>'}</div>
      <span class="muted small">${type === 'case' ? 'Only complaints with a Commission decision can receive recommendations.' : 'A systemic recommendation addresses a practice, policy or law, and can relate to several complaints or none.'}</span></div>
    ${fld('Copy of the letter (optional)', fileInp('files', false), { full: true, id: 'f_files' })}</div>`;
}
ACT.newRec = el => openRecForm(el.dataset.type, el.dataset.cid ? [el.dataset.cid] : []);
function openRecForm(type, preset) {
  modal({ title: `New ${REC_TYPES[type][0].toLowerCase()}`, wide: true, body: recFields(type, {}, preset), submit: 'Add recommendation', onSubmit: async (o, form) => {
    const cids = type === 'case' ? (form.querySelector('input[name=cids]:checked') ? [form.querySelector('input[name=cids]:checked').value] : []) : (o.cids || []);
    if (type === 'case' && !cids.length) throw new Error('Choose the complaint this recommendation is about.');
    const up = await uploadFiles(form.querySelector('#f_files').files); const at = nowISO(); const id = 'rec' + nid(); const year = (o.letterDate || today()).slice(0, 4);
    const n = recsList().filter(r => (r.letterDate || '').startsWith(year) && r.type === type).length + 1;
    const ref = `${type === 'case' ? 'CR' : 'SR'}-${year}-${String(n).padStart(3, '0')}`;
    await setDoc('recs/' + id, { type, ref, text: o.text, institution: o.institution, owner: o.owner || S.me.id, letterDate: o.letterDate, letterRef: o.letterRef || '', due: o.due || null, status: 'issued', complaintIds: cids, letterDoc: up[0] || null, updates: { [nid('u')]: { at, by: S.me.id, status: 'issued', note: `Recommendation letter sent to ${o.institution}${o.letterRef ? ' (' + o.letterRef + ')' : ''}` } }, createdAt: at, createdBy: S.me.id });
    for (const cid of cids) { const c = S.complaints[cid]; if (c) await updC(cid, {}, { note: `${REC_TYPES[type][0]} ${ref} issued to ${o.institution}`, action: 'rec.create' }); }
    logA('rec.create', cids[0] || null, `${ref} ${o.institution}`); if (o.owner && o.owner !== S.me.id) notify(o.owner, `You are monitoring recommendation ${ref} (${o.institution})`, cids[0] || null);
    toast(`Recommendation ${ref} added`);
  } });
}
ACT.recUpdate = el => {
  const r = { id: el.dataset.id, ...S.recs[el.dataset.id] };
  modal({ title: `Record follow-up — ${r.ref}`, body: `<div class="note small" style="margin-bottom:12px"><b>${esc(r.institution)}:</b> ${esc(r.text)}</div><div class="form">
    ${fld('Status after this follow-up', sel('status', Object.entries(REC_STATUS).map(([k, v]) => [k, v[0]]), r.status, { blank: false }), { id: 'f_status' })}
    ${fld('Follow-up method', sel('method', ['Letter', 'Email', 'Phone call', 'Meeting', 'Site visit', 'Response received from institution'], 'Letter', { blank: false }), { id: 'f_method' })}
    ${fld('What happened', txt('note', '', { req: 'what happened', rows: 3, ph: 'e.g. Ministry replied that the policy is under review; expected by March' }), { req: true, full: true, id: 'f_note' })}
    ${fld('Next follow-up date', inp('due', addDays(today(), 30), { type: 'date' }), { id: 'f_due', hint: 'Leave as is, or clear it if the recommendation is concluded' })}
    ${fld('Supporting document (optional)', fileInp('files', false), { full: true, id: 'f_files' })}</div>`, submit: 'Save follow-up', onSubmit: async (o, form) => {
    const up = await uploadFiles(form.querySelector('#f_files').files); const at = nowISO(); const open = REC_STATUS[o.status][2];
    await updDoc('recs/' + r.id, { status: o.status, due: open ? (o.due || null) : null, updatedAt: at, updates: { [nid('u')]: { at, by: S.me.id, status: o.status, method: o.method, note: o.note, doc: up[0] || null } }, ...(open ? {} : { concludedAt: at }) });
    for (const cid of r.complaintIds || []) if (S.complaints[cid]) await updC(cid, {}, { note: `Recommendation ${r.ref}: ${REC_STATUS[o.status][0]} — ${o.note}`, action: 'rec.update' });
    logA('rec.update', (r.complaintIds || [])[0] || null, `${r.ref}: ${o.status}`);
    if (!open) notify(supervisors(), `Recommendation ${r.ref} (${r.institution}): ${REC_STATUS[o.status][0]}`, (r.complaintIds || [])[0] || null);
  } });
};
ACT.recView = el => {
  const r = { id: el.dataset.id, ...S.recs[el.dataset.id] }; const ups = entries(r.updates).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  modal({ title: `${r.ref} — ${REC_TYPES[r.type]?.[0]}`, wide: true, body: `<dl class="kv"><dt>Institution</dt><dd>${esc(r.institution)}</dd><dt>Recommendation</dt><dd style="white-space:pre-wrap">${esc(r.text)}</dd><dt>Letter</dt><dd>${fmtD(r.letterDate)} ${esc(r.letterRef || '')}${r.letterDoc ? ` · <a href="${esc(r.letterDoc.url)}" target="_blank" rel="noopener">copy of letter</a>` : ''}</dd><dt>Complaints</dt><dd>${(r.complaintIds || []).map(id => S.complaints[id] ? caseLink(S.complaints[id]) : '').join(', ') || '—'}</dd><dt>Status</dt><dd>${pill(REC_STATUS[r.status]?.[0], REC_STATUS[r.status]?.[1])}${recOpen(r) && r.due ? ` · next follow-up ${fmtD(r.due)}` : ''}</dd><dt>Monitored by</dt><dd>${esc(nm(r.owner))}</dd></dl>
    <h3 style="margin:14px 0 6px">Follow-up history</h3><ul class="timeline">${ups.map(u => `<li><span class="small">${fmtDT(u.at)}</span><span>${pill(REC_STATUS[u.status]?.[0] || u.status, REC_STATUS[u.status]?.[1])} ${u.method ? `<span class="muted small">${esc(u.method)}</span> ` : ''}${esc(u.note)}${u.doc ? ` · <a href="${esc(u.doc.url)}" target="_blank" rel="noopener">document</a>` : ''} <span class="muted small">— ${esc(nm(u.by))}</span></span></li>`).join('')}</ul>`,
    foot: canManageRecs() ? `<button type="button" class="btn primary" data-act="recUpdate" data-id="${esc(r.id)}">Record follow-up</button>` : '' });
};
ACT.exportRecs = () => {
  const rows = [['Ref', 'Type', 'Institution', 'Recommendation', 'Complaints', 'Letter date', 'Letter ref', 'Status', 'Next follow-up', 'Monitored by', 'Latest update']];
  recsList().filter(recVisible).forEach(r => { const last = entries(r.updates).sort(byAt)[0]; rows.push([r.ref, REC_TYPES[r.type]?.[0], r.institution, r.text, (r.complaintIds || []).map(id => S.complaints[id]?.regNo).filter(Boolean).join('; '), r.letterDate || '', r.letterRef || '', REC_STATUS[r.status]?.[0], recOpen(r) ? r.due || '' : '', nm(r.owner), last ? `${last.at.slice(0, 10)}: ${last.note}` : '']); });
  exportXLSX(`FREMYS-recommendations-${today()}.xlsx`, [{ name: 'Recommendations', rows }]);
};

/* Case page section */
function caseRecsHTML(c) {
  const list = recsForCase(c.id); const decided = !!finalDecision(c);
  return `<div class="card-head" style="margin-top:18px"><h2>Recommendations</h2>${canManageRecs() && decided ? `<div class="row"><button class="btn sm" data-act="newRec" data-type="case" data-cid="${esc(c.id)}">+ Case recommendation</button><button class="btn sm" data-act="newRec" data-type="systemic" data-cid="${esc(c.id)}">+ Systemic recommendation</button></div>` : ''}</div>
    ${list.length ? `<div class="stack">${list.map(r => `<div class="entry"><div class="meta"><span>${pill(REC_TYPES[r.type]?.[0], REC_TYPES[r.type]?.[1])} <b>${esc(r.ref)}</b> · ${esc(r.institution)}</span><span>${pill(REC_STATUS[r.status]?.[0], REC_STATUS[r.status]?.[1])}${recOpen(r) && r.due ? ` ${recOverdue(r) ? pill('Follow-up overdue ' + fmtD(r.due), 'bad') : pill('Next follow-up ' + fmtD(r.due), 'muted')}` : ''}</span></div><div class="body">${esc(r.text)}</div><div class="row" style="margin-top:8px">${canManageRecs() ? `<button class="btn sm primary" data-act="recUpdate" data-id="${esc(r.id)}">Record follow-up</button>` : ''}<button class="btn sm" data-act="recView" data-id="${esc(r.id)}">History</button></div></div>`).join('')}</div>`
      : `<div class="card empty">${decided ? 'No recommendations issued for this complaint.' : 'Recommendations can be issued once the Commission has decided this complaint.'}</div>`}`;
}

/* Statistics section */
function recStatsHTML(f) {
  const all = recsList(); const inPd = r => r.letterDate && r.letterDate >= f.from && r.letterDate <= f.to;
  const issued = all.filter(inPd); const concludedP = all.filter(r => r.concludedAt && r.concludedAt.slice(0, 10) >= f.from && r.concludedAt.slice(0, 10) <= f.to);
  const byStatus = Object.entries(REC_STATUS).map(([k, v]) => ({ label: v[0], ids: all.filter(r => r.status === k).flatMap(r => r.complaintIds || []) , n: all.filter(r => r.status === k).length }));
  const inst = Object.values(all.reduce((m, r) => { const e = m[r.institution] = m[r.institution] || { label: r.institution, open: 0, impl: 0, ni: 0 }; if (recOpen(r)) e.open++; else if (r.status === 'implemented') e.impl++; else if (r.status === 'not_implemented') e.ni++; return m; }, {})).sort((a, b) => (b.open + b.impl + b.ni) - (a.open + a.impl + a.ni)).slice(0, 10);
  const max = Math.max(1, ...byStatus.map(x => x.n));
  if (!all.length) return '';
  return `<div class="card section" style="border-top:5px solid #7c3aed"><div class="card-head"><h2>Recommendations follow-up</h2><a class="btn sm" href="#actions">Open follow-up actions</a></div>
    <div class="tiles"><div class="tile" style="cursor:default"><div class="k">Issued in period</div><div class="v num">${issued.length}</div><div class="s">${issued.filter(r => r.type === 'case').length} case · ${issued.filter(r => r.type === 'systemic').length} systemic</div></div>
      <div class="tile info" style="cursor:default"><div class="k">Being monitored now</div><div class="v num">${all.filter(recOpen).length}</div><div class="s">${all.filter(recOverdue).length} follow-ups overdue</div></div>
      <div class="tile ok" style="cursor:default"><div class="k">Concluded in period</div><div class="v num">${concludedP.length}</div><div class="s">${concludedP.filter(r => r.status === 'implemented').length} implemented</div></div>
      <div class="tile" style="cursor:default"><div class="k">Implementation rate</div><div class="v num">${(() => { const c2 = all.filter(r => !recOpen(r)); return c2.length ? pctOf(c2.filter(r => r.status === 'implemented').length, c2.length) + '%' : '—'; })()}</div><div class="s">Case ${(() => { const c2 = all.filter(r => !recOpen(r) && r.type === 'case'); return c2.length ? pctOf(c2.filter(r => r.status === 'implemented').length, c2.length) + '%' : '—'; })()} · systemic ${(() => { const c2 = all.filter(r => !recOpen(r) && r.type === 'systemic'); return c2.length ? pctOf(c2.filter(r => r.status === 'implemented').length, c2.length) + '%' : '—'; })()}</div></div></div>
    <div class="grid2"><div><h3 style="margin-bottom:6px">Current status (all recommendations)</h3><div class="bars">${byStatus.map(x => `<div class="bar-row" style="cursor:default"><span>${esc(x.label)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${x.n / max * 100}%"></span></span><span class="n num">${x.n}</span></div>`).join('')}</div></div>
      <div><h3 style="margin-bottom:6px">By institution</h3><div class="tbl-wrap"><table><thead><tr><th>Institution</th><th class="r">Open</th><th class="r">Implemented</th><th class="r">Not implemented</th></tr></thead><tbody>${inst.map(i => `<tr><td>${esc(i.label)}</td><td class="r">${i.open}</td><td class="r">${i.impl}</td><td class="r">${i.ni}</td></tr>`).join('')}</tbody></table></div></div></div></div>`;
}
