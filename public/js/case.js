'use strict';
/* Complaint record: one continuous record from registration to panel outcome. */

const CASE_TABS = [
  ['overview', 'Overview'], ['review', 'Review & comments'], ['requests', 'Information requests'], ['legal', 'Legal checks'],
  ['panel', 'Panel & recommendations'], ['referrals', 'Referrals'], ['documents', 'Documents'], ['corr', 'Correspondence'], ['activity', 'Activity'],
];
function isAssignedOfficer(c) { return c.assignedTo === S.me.id; }
function canReview(c) { return can('mgmtComment') || (can('review') && isAssignedOfficer(c)); }
function canSeeRestricted(c) { return can('restrictedDocs') || isAssignedOfficer(c); }

VIEWS.case = (cid) => {
  const c = S.complaints[cid];
  if (!c) return S.loaded.complaints ? `<div class="card gate"><h2>Complaint not found</h2><p class="muted">It may have been removed, or the link is incorrect.</p><a class="btn" href="#register">Open the register</a></div>` : '<div class="loading">Loading complaint…</div>';
  if (!canSeeCase(c)) return noAccess('This complaint is not assigned to you. Ask a supervisor if you need access.');
  const tab = S.caseTab || 'overview'; const od = overdueItems(c);
  const counts = { review: Object.keys(c.reviews || {}).length, requests: openReqs(c).length, legal: Object.keys(c.legal || {}).length, panel: Object.keys(c.decisions || {}).length + openActions(c).length + recsForCase(c.id).filter(recOpen).length, referrals: Object.keys(c.referrals || {}).length, documents: Object.keys(c.docs || {}).length, corr: Object.keys(c.corr || {}).length };
  const rd = readiness(c);
  const btns = [];
  if (can('assign') && !isDone(c)) btns.push(`<button class="btn" data-act="assignCase" data-id="${esc(cid)}">${c.assignedTo ? 'Reassign' : 'Assign officer'}</button>`);
  if (['prelim_review', 'further_work'].includes(c.stage) && (isAssignedOfficer(c) || can('supervise'))) btns.push(`<button class="btn primary" data-act="markReady" data-id="${esc(cid)}">${c.stage === 'further_work' ? 'Resubmit to panel' : 'Mark ready for panel'}</button>`);
  if (can('commission')) pendingCommission(c).forEach(d => btns.push(`<button class="btn primary" data-act="commDecide" data-id="${esc(cid)}" data-d="${esc(d.id)}">Record Commission decision</button>`));
  if (c.stage === 'on_agenda' && c.panelMeetingId && S.meetings[c.panelMeetingId] && can('decide')) btns.push(`<button class="btn primary" data-act="recordOutcome" data-id="${esc(c.panelMeetingId)}" data-c="${esc(cid)}">Record panel decision</button>`);
  if (can('editCore')) btns.push(`<button class="btn" data-act="editCore" data-id="${esc(cid)}">Edit details</button>`);
  if (can('setStage')) btns.push(`<button class="btn" data-act="setStage" data-id="${esc(cid)}">Change stage</button>`);
  btns.push(`<button class="btn" data-act="casePdf" data-id="${esc(cid)}">Case summary PDF</button>`);
  return `
  <div class="row small muted" style="margin-bottom:8px"><a href="#register">← ${esc(t('register'))}</a></div>
  <div class="case-head">
    <div>
      <div class="row"><span class="reg mono">${esc(c.regNo)}</span>${c.demo ? '<span class="demo-tag">DEMO</span>' : ''} ${stagePill(c.stage)} ${c.confidential ? pill('Confidential identity', 'bad') : ''} ${(c.dupWarnings || []).length ? pill('Potential duplicate', 'warn') : ''}</div>
      <div class="muted small" style="margin-top:4px">${esc(c.category || '—')} · received ${fmtD(c.dateReceived)}${c.cmsRef ? ' · CMS ' + esc(c.cmsRef) : ''} · ${esc(t('officer'))}: <b>${c.assignedTo ? esc(nm(c.assignedTo)) : 'not assigned'}</b></div>
      ${interimPending(c) ? `<div class="note warn" style="margin-top:8px"><b>Interim phase:</b> send the interim letter informing the complainant that the complaint was ${c.interim.outcome === 'lodge' ? 'lodged' : 'not lodged'} · due ${fmtD(c.interim.due)}${canSendInterim(c) ? ` <button class="btn sm" data-act="interimLetter" data-id="${esc(c.id)}">Prepare letter</button> <button class="btn sm primary" data-act="interimSent" data-id="${esc(c.id)}">Record as sent</button>` : ''}</div>` : interimSent(c) ? `<div class="small muted" style="margin-top:6px">Interim letter sent ${fmtD(c.interim.sentAt)} (${esc(c.interim.method || '')}${c.interim.ref ? ', ' + esc(c.interim.ref) : ''})</div>` : ''}
      ${c.stage === 'further_work' && c.clarification ? `<div class="note warn" style="margin-top:8px"><b>Returned by the panel for clarification:</b> ${esc(c.clarification.text)}${c.clarification.due ? ` · due ${fmtD(c.clarification.due)}` : ''}</div>` : ''}
      <div class="next ${od.length ? 'overdue' : ''}"><div class="small muted">${esc(t('next_action'))}</div><b>${esc(c.nextAction || '—')}</b>${c.nextActionDue ? ` <span class="pill ${c.nextActionDue < today() && !isDone(c) ? 'bad' : 'muted'}">${esc(t('due'))} ${fmtD(c.nextActionDue)}</span>` : ''}${(can('supervise') || isAssignedOfficer(c)) && !isDone(c) ? ` <button class="btn link small" data-act="editNext" data-id="${esc(cid)}">Change</button>` : ''}
        ${od.length > 1 || (od.length && od[0].kind !== 'next') ? `<div class="small" style="color:var(--bad);margin-top:4px">${od.length} overdue item(s): ${esc(od.map(x => x.text).join('; '))}</div>` : ''}</div>
    </div>
    <div class="row" style="align-content:flex-start;justify-content:flex-end">${btns.join('')}</div>
  </div>
  <div class="tabs" role="tablist">${CASE_TABS.map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-act="caseTab" data-tab="${k}">${esc(l)}${counts[k] ? `<span class="cnt">${counts[k]}</span>` : ''}</button>`).join('')}</div>
  <div id="caseBody">${(CASE_TAB_VIEWS[tab] || CASE_TAB_VIEWS.overview)(c, rd)}</div>`;
};
ACT.caseTab = el => { S.caseTab = el.dataset.tab; render(); };

const CASE_TAB_VIEWS = {};
CASE_TAB_VIEWS.overview = (c, rd) => {
  const cp = cpOf(c); const vs = victimsOf(c); const showId = !c.confidential || canSeeRestricted(c) || can('editCore'); const mayLink = can('editCore') || can('register') || isAssignedOfficer(c);
  const miss = (c.missing || []).map(k => NA_FIELDS[k] || k);
  return `<div class="ov-grid">
    <div class="card ov-wide"><div class="card-head"><h2>Complaint details</h2>${(can('editCore') || can('register') || isAssignedOfficer(c)) && !isDone(c) ? `<button class="btn sm" data-act="editDetention" data-id="${esc(c.id)}">${detOf(c) ? 'Edit detention setting' : 'Add detention setting'}</button>` : ''}</div><dl class="kv">
      <dt>${esc(t('summary'))}</dt><dd style="white-space:pre-wrap">${esc(c.summary)}</dd>
      <dt>Date of incident</dt><dd>${fmtD(c.incidentDate)}</dd>
      <dt>Location</dt><dd>${esc([c.island, ATOLL[c.atoll]].filter(Boolean).join(', ') || '—')}</dd>
      <dt>${esc(t('respondent'))}</dt><dd>${esc(c.respondent?.name || '—')}${c.respondent?.type ? ` <span class="muted small">(${esc(c.respondent.type)})</span>` : ''}</dd>
      ${detSummaryHTML(c)}
      <dt>Received via</dt><dd>${esc(c.channel || '—')} · received by ${esc(nm(c.receivedBy))}</dd>
      <dt>Registered</dt><dd>${fmtDT(c.createdAt)} by ${esc(nm(c.createdBy))}</dd>
    </dl></div>
    <div class="card"><div class="card-head"><h2>${esc(t('complainant'))}</h2>${c.complainantId && showId ? `<a class="btn sm" href="#complainant-${esc(c.complainantId)}">Open record</a>` : ''}</div>
      ${showId ? `<dl class="kv">
        <dt>Name</dt><dd>${esc(cp.name || '—')}${c.confidential ? ' ' + pill('Confidential', 'bad') : ''}</dd>
        <dt>ID / passport</dt><dd>${esc(cp.nid || '—')}</dd><dt>Sex · age</dt><dd>${esc([cp.sex, ageOf(cp) != null && 'age ' + ageOf(cp)].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>Contact</dt><dd>${esc([cp.phone, cp.email].filter(Boolean).join(' · ') || '—')}</dd><dt>Address</dt><dd>${esc(cp.address || '—')}</dd>
        ${c.complainantId ? `<dt>Other complaints</dt><dd>${PTYPE.complainants.cases(c.complainantId).filter(x => x.id !== c.id).map(x => canSeeCase(x) ? `<a href="#case-${esc(x.id)}">${esc(x.regNo)}</a>` : esc(x.regNo)).join(', ') || 'None'}</dd>` : ''}
      </dl>` : '<div class="note">The complainant asked for their identity to be kept confidential. Identity details are visible only to the assigned officer, the Director General, the Director, the panel and Administrative Officers.</div>'}
    </div>
    <div class="card"><div class="card-head"><h2>${esc(t('victim'))}</h2>${mayLink && !isDone(c) ? `<button class="btn sm" data-act="addVictim" data-id="${esc(c.id)}">Add victim</button>` : ''}</div>
      ${c.victimSame && !vs.length ? '<p class="small">The complainant is the victim.</p>' : ''}
      ${vs.length ? `<div class="stack" style="gap:8px">${vs.map(v => `<div class="entry" style="box-shadow:none"><div class="meta"><span><b>${showId ? esc(v.name) : 'Confidential'}</b>${v.rel ? ` · ${esc(v.rel)}` : ''}</span><span>${v.id && showId ? `<a href="#victim-${esc(v.id)}">Open record</a>` : ''}${v.id && mayLink ? ` <button class="btn link small" data-act="unlinkVictim" data-id="${esc(c.id)}" data-v="${esc(v.id)}">Remove</button>` : ''}</span></div>
        <div class="small">${esc([v.sex, ageOf(v) != null && 'age ' + ageOf(v), v.nationality].filter(Boolean).join(' · '))}${showId && (v.nid || v.phone) ? ' · ' + esc([v.nid, v.phone].filter(Boolean).join(' · ')) : ''}</div>${(v.vulnerable || []).length ? `<div style="margin-top:4px">${v.vulnerable.map(g => pill(g, 'info')).join(' ')}</div>` : ''}</div>`).join('')}</div>` : (!c.victimSame ? '<p class="small muted">No victim record linked.</p>' : '')}
    </div>
    ${clsCardHTML(c)}
    <div class="card"><h2>Readiness for the Registration Panel</h2>
      <ul class="checklist">${rd.items.map(i => `<li class="${i.ok ? 'done' : ''}">${esc(i.text)}</li>`).join('')}</ul>
      <p class="small muted" style="margin-bottom:0">${rd.ok ? 'All configured requirements are met.' : 'The case can be marked ready once these are complete; a supervisor may override with a recorded reason.'}</p>
    </div>
    <div class="card"><h2>Data quality</h2>
      ${miss.length ? `<p class="small" style="margin-top:0"><b>Not yet available:</b></p><ul class="small">${miss.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="small muted">No details were marked as not yet available.</p>'}
      ${(c.dupWarnings || []).length ? `<p class="small"><b>Potential duplicates noted at registration:</b> ${c.dupWarnings.map(id => S.complaints[id] ? (canSeeCase(S.complaints[id]) ? `<a href="#case-${esc(id)}">${esc(S.complaints[id].regNo)}</a>` : esc(S.complaints[id].regNo)) : 'removed record').join(', ')}</p>` : ''}
      ${!Object.keys(c.docs || {}).length ? '<p class="small" style="color:var(--warn)">No documents are attached to this complaint.</p>' : ''}
    </div>
  </div>`;
};

/* ----- Review & management comments ----- */
CASE_TAB_VIEWS.review = c => {
  const sup = supersededIds(c);
  const list = kind => entries(c.reviews).filter(r => r.kind === kind).sort(byAt);
  const entry = r => `<div class="entry ${sup.has(r.id) ? 'superseded' : ''}"><div class="meta"><span><b>${esc(nm(r.by))}</b> · ${esc(ROLES[r.role] || '')}</span><span>${fmtDT(r.at)}${sup.has(r.id) ? ' · superseded by a later entry' : ''}${r.supersedes ? ' · corrects an earlier entry' : ''}</span></div>
    ${r.kind === 'mgmt' ? `<div class="body">${esc(r.text)}</div>${r.requiredActions ? `<div class="sub"><b>Actions required:</b> ${esc(r.requiredActions)}</div>` : ''}`
      : `${r.docCheck ? `<div class="sub" style="border:none;margin:0;padding:0"><b>Document checks:</b> ${esc(r.docCheck)}</div>` : ''}${r.contacts ? `<div class="sub"><b>Contact with relevant parties:</b> ${esc(r.contacts)}</div>` : ''}${r.laws ? `<div class="sub"><b>Applicable laws considered:</b> ${esc(r.laws)}</div>` : ''}${r.questions ? `<div class="sub"><b>Outstanding questions:</b> ${esc(r.questions)}</div>` : ''}${r.text ? `<div class="sub"><b>Preliminary assessment:</b> <span class="body">${esc(r.text)}</span></div>` : ''}`}
    ${r.by === S.me.id && !sup.has(r.id) ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="${r.kind === 'mgmt' ? 'addMgmt' : 'addOfficer'}" data-id="${esc(c.id)}" data-sup="${esc(r.id)}">Correct this entry</button></div>` : ''}</div>`;
  return `<div class="grid2">
    <div class="stack"><div class="card-head"><h2>Director General / Director comments</h2>${can('mgmtComment') ? `<button class="btn primary sm" data-act="addMgmt" data-id="${esc(c.id)}">Add comment</button>` : ''}</div>
      ${list('mgmt').map(entry).join('') || '<div class="card empty">No comments. Comments from the Director General or Director are optional and can be added at any stage.</div>'}</div>
    <div class="stack"><div class="card-head"><h2>Officer's preliminary review</h2>${canReview(c) && can('review') ? `<button class="btn primary sm" data-act="addOfficer" data-id="${esc(c.id)}">Add review note</button>` : ''}</div>
      ${list('officer').map(entry).join('') || '<div class="card empty">No preliminary review recorded yet.</div>'}</div>
  </div><p class="small muted">Entries are never overwritten. A correction is saved as a new entry and the earlier one stays visible.</p>`;
};
ACT.addMgmt = el => {
  const c = S.complaints[el.dataset.id]; const prev = el.dataset.sup ? c.reviews[el.dataset.sup] : null;
  modal({ title: (prev ? 'Correct comment — ' : 'Management comment — ') + c.regNo, body: `<div class="form">${fld('Comment', txt('text', prev?.text, { req: 'a comment', rows: 5 }), { req: true, full: true, id: 'f_text' })}${fld('Actions required', txt('requiredActions', prev?.requiredActions, { ph: 'e.g. obtain the detention record; contact the employer' }), { full: true, id: 'f_requiredActions' })}</div>`,
    onSubmit: async o => {
      const rid = nid('rv'); const role = myRoles().find(r => ['dg', 'director'].includes(r));
      await updC(c.id, { reviews: { [rid]: { kind: 'mgmt', by: S.me.id, role, at: nowISO(), text: o.text, requiredActions: o.requiredActions, supersedes: prev ? el.dataset.sup : null } } }, { note: `${ROLES[role]} ${prev ? 'corrected a comment' : 'added comments'}`, action: 'review.mgmt' });
      notify([c.assignedTo], `${ROLES[role]} commented on ${c.regNo}`, c.id);
    } });
};
ACT.addOfficer = el => {
  const c = S.complaints[el.dataset.id]; const p = el.dataset.sup ? c.reviews[el.dataset.sup] : {};
  modal({ title: (el.dataset.sup ? 'Correct review note — ' : 'Preliminary review — ') + c.regNo, wide: true, body: `<div class="form">
    ${fld('Document checks', txt('docCheck', p.docCheck, { ph: 'Which documents were checked and what was found' }), { id: 'f_docCheck' })}
    ${fld('Contact with relevant parties', txt('contacts', p.contacts, { ph: 'Who was contacted, when and the result' }), { id: 'f_contacts' })}
    ${fld('Applicable laws considered', txt('laws', p.laws, { ph: 'Link specific provisions on the Legal checks tab' }), { id: 'f_laws' })}
    ${fld('Outstanding questions', txt('questions', p.questions), { id: 'f_questions' })}
    ${fld('Preliminary assessment and way forward', txt('text', p.text, { req: 'your preliminary assessment', rows: 4 }), { req: true, full: true, id: 'f_text' })}
  </div>`, onSubmit: async o => {
    const rid = nid('rv');
    await updC(c.id, { reviews: { [rid]: { kind: 'officer', by: S.me.id, role: 'reg_officer', at: nowISO(), ...o, supersedes: el.dataset.sup || null } } }, { note: el.dataset.sup ? 'Officer corrected a review note' : 'Officer recorded preliminary review', action: 'review.officer' });
  } });
};
ACT.markReady = el => {
  const c = S.complaints[el.dataset.id]; const rd = readiness(c); const supv = can('supervise');
  if (!rd.ok && !supv) { modal({ title: 'Not ready yet', body: `<p>Complete these before marking ${esc(c.regNo)} ready for the panel:</p><ul class="checklist">${rd.items.map(i => `<li class="${i.ok ? 'done' : ''}">${esc(i.text)}</li>`).join('')}</ul>` }); return; }
  modal({ title: c.stage === 'further_work' ? `Resubmit ${c.regNo} to the panel` : `Mark ${c.regNo} ready for panel`, body: `<ul class="checklist">${rd.items.map(i => `<li class="${i.ok ? 'done' : ''}">${esc(i.text)}</li>`).join('')}</ul>
    ${c.stage === 'further_work' && c.clarification ? `<div class="note warn" style="margin-top:12px"><b>The panel asked:</b> ${esc(c.clarification.text)}</div>` : ''}
    <div class="form" style="margin-top:12px">${c.stage === 'further_work' && c.clarification ? fld('Clarification provided', txt('clarified', '', { req: 'the clarification', rows: 4 }), { req: true, full: true, id: 'f_clarified' }) : ''}${!rd.ok ? fld('Reason for proceeding before all requirements are met', txt('override', '', { req: 'the reason' }), { req: true, full: true, id: 'f_override' }) : ''}
    ${fld('Requested action for the panel', txt('requested', '', { ph: 'What the panel is asked to decide', req: 'the requested action' }), { req: true, full: true, id: 'f_requested' })}
    ${fld('Unresolved issues', txt('issues', ''), { full: true, id: 'f_issues' })}</div>`, submit: 'Mark ready', onSubmit: async o => {
    const resub = c.stage === 'further_work'; const done = {};
    if (resub) openActions(c).filter(a => a.decisionId && /^Clarify/.test(a.text || '')).forEach(a => { done[a.id] = { status: 'done', completedAt: nowISO(), completedBy: S.me.id, note: o.clarified || '' }; });
    await updC(c.id, { stage: 'ready_panel', readyAt: nowISO(), panelRequest: { requested: o.requested, issues: o.issues || '', clarification: o.clarified || '', resubmission: resub, by: S.me.id, at: nowISO(), override: o.override || '' }, ...(Object.keys(done).length ? { actions: done } : {}), nextAction: 'Await scheduling on a Registration Panel agenda', nextActionDue: null },
      { stage: 'ready_panel', note: (resub ? 'Clarification provided — resubmitted to the panel' : 'Review complete — ready for panel') + (o.override ? ` (override: ${o.override})` : ''), action: resub ? 'case.resubmit' : 'case.ready' });
    notify(staffIds('support').concat(supervisors()), `${c.regNo} is ready for the Registration Panel`, c.id);
  } });
};
ACT.editNext = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Next action — ' + c.regNo, body: `<div class="form">${fld('Next action', inp('nextAction', c.nextAction, { req: 'the next action' }), { req: true, full: true, id: 'f_nextAction' })}${fld('Due date', inp('nextActionDue', c.nextActionDue || '', { type: 'date' }), { id: 'f_nextActionDue' })}</div>`,
    onSubmit: async o => updC(c.id, { nextAction: o.nextAction, nextActionDue: o.nextActionDue || null }, { note: `Next action set: ${o.nextAction}${o.nextActionDue ? ' (due ' + o.nextActionDue + ')' : ''}`, action: 'case.next' }) });
};
ACT.setStage = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Change stage — ' + c.regNo, body: `<div class="note warn" style="margin-bottom:12px">Use this only to correct the workflow. Normal progress happens through assignment, review, panel decisions and referrals.</div><div class="form">${fld(t('stage'), sel('stage', STAGES.map(s => [s.k, stageLabel(s.k)]), c.stage, { blank: false }), { id: 'f_stage' })}${fld('Reason', txt('reason', '', { req: 'a reason' }), { req: true, full: true, id: 'f_reason' })}</div>`,
    onSubmit: async o => { if (o.stage === c.stage) throw new Error('Choose a different stage.'); await updC(c.id, { stage: o.stage }, { stage: o.stage, note: `Stage changed from "${stageLabel(c.stage)}" to "${stageLabel(o.stage)}": ${o.reason}`, action: 'case.stage' }); } });
};
ACT.editCore = el => {
  const c = S.complaints[el.dataset.id]; const k = cfg();
  modal({ title: 'Edit details — ' + c.regNo, wide: true, body: `<div class="form">
    ${fld('CMS / paper reference', inp('cmsRef', c.cmsRef), { id: 'f_cmsRef' })}${fld(t('date_received'), inp('dateReceived', c.dateReceived, { type: 'date', req: 'the date received' }), { req: true, id: 'f_dateReceived' })}
    ${fld('Linked complainant record', sel('complainantId', Object.entries(S.complainants).sort((a, b) => String(a[1].name).localeCompare(String(b[1].name))).map(([id, p]) => [id, `${p.name}${p.nid ? ' (' + p.nid + ')' : ''}`]), c.complainantId || '', { req: 'a complainant' }), { req: true, full: true, id: 'f_complainantId', hint: "To correct the complainant's name, ID or contact details, open their record from the complaint overview." })}
${fld(t('atoll'), sel('atoll', ATOLLS, c.atoll), { id: 'f_atoll' })}${fld(t('island'), inp('island', c.island), { id: 'f_island' })}
    ${fld(t('respondent'), inp('r_name', c.respondent?.name), { id: 'f_r_name' })}${fld('Date of incident', inp('incidentDate', c.incidentDate, { type: 'date' }), { id: 'f_incidentDate' })}
    ${fld(t('summary'), txt('summary', c.summary, { req: 'a summary', rows: 4 }), { req: true, full: true, id: 'f_summary' })}
    <div class="f full"><label class="na"><input type="checkbox" name="confidential" id="f_conf" ${c.confidential ? 'checked' : ''}> Keep complainant identity confidential</label></div>
    <div class="f full"><label>Details still not available</label><div class="checks">${Object.entries(NA_FIELDS).map(([kk, l]) => `<label><input type="checkbox" data-multi="1" name="missing" value="${kk}" ${(c.missing || []).includes(kk) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
    ${fld('Reason for the change', inp('reason', '', { req: 'the reason for the change' }), { req: true, full: true, id: 'f_reason' })}
  </div>`, onSubmit: async o => {
    const patch = { cmsRef: o.cmsRef, dateReceived: o.dateReceived, complainantId: o.complainantId, atoll: o.atoll, island: o.island, respondent: { name: o.r_name }, incidentDate: o.incidentDate, summary: o.summary, confidential: !!o.confidential, missing: o.missing || [] };
    const changed = []; const cmp = (a, b, l) => { if (String(a ?? '') !== String(b ?? '')) changed.push(l); };
    cmp(c.cmsRef, o.cmsRef, 'CMS ref'); cmp(c.dateReceived, o.dateReceived, 'date received'); cmp(c.complainantId, o.complainantId, 'linked complainant'); cmp(c.atoll, o.atoll, 'atoll'); cmp(c.island, o.island, 'island'); cmp(c.respondent?.name, o.r_name, 'respondent'); cmp(c.summary, o.summary, 'summary'); cmp(!!c.confidential, !!o.confidential, 'confidentiality'); cmp((c.missing || []).join(), (o.missing || []).join(), 'missing details');
    if (!changed.length) throw new Error('Nothing was changed.');
    await updC(c.id, patch, { note: `Details edited (${changed.join(', ')}): ${o.reason}`, action: 'case.edit' });
  } });
};

/* ----- Information requests ----- */
CASE_TAB_VIEWS.requests = c => {
  const list = entries(c.requests).sort(byAt); const td = today(); const mayEdit = can('infoReq') && (isAssignedOfficer(c) || can('supervise') || hasRole('admin_officer'));
  return `<div class="card-head"><h2>Requests for additional information</h2>${mayEdit && !isDone(c) ? `<button class="btn primary sm" data-act="newReq" data-id="${esc(c.id)}">New request</button>` : ''}</div>
  <div class="stack">${list.map(r => { const od = ['pending', 'partial'].includes(r.status) && r.due && r.due < td; const att = entries(r.attempts).sort(byAt); const res = entries(r.responses).sort(byAt); return `<div class="entry" style="${od ? 'border-color:var(--bad)' : ''}">
    <div class="meta"><span><b>To ${esc(r.to)}</b> ${r.toType ? `(${esc(r.toType)})` : ''} · requested ${fmtD(r.requestedAt)} by ${esc(nm(r.by))}</span><span>${pill(REQ_STATUS[r.status]?.[0], REQ_STATUS[r.status]?.[1])} ${r.due ? (od ? pill('Overdue since ' + fmtD(r.due), 'bad') : pill('Due ' + fmtD(r.due), 'muted')) : ''}</span></div>
    <div class="body">${esc(r.details)}</div>
    ${att.length ? `<div class="sub"><b>Communication attempts</b><ul class="small">${att.map(a => `<li>${fmtDT(a.at)} · ${esc(a.method)} · ${esc(a.note)} — ${esc(nm(a.by))}</li>`).join('')}</ul></div>` : ''}
    ${res.length ? `<div class="sub"><b>Responses</b><ul class="small">${res.map(a => `<li>${fmtDT(a.at)} · ${esc(a.note)}${(a.docIds || []).length ? ` · ${a.docIds.length} document(s)` : ''} — recorded by ${esc(nm(a.by))}</li>`).join('')}</ul></div>` : ''}
    ${mayEdit && r.status !== 'closed' ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="reqAttempt" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Log contact attempt</button><button class="btn sm" data-act="reqResponse" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Record response</button><button class="btn sm" data-act="reqClose" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Close request</button></div>` : ''}
  </div>`; }).join('') || '<div class="card empty">No information has been requested for this complaint.</div>'}</div>`;
};
ACT.newReq = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Request additional information — ' + c.regNo, body: `<div class="form">
    ${fld('Requested from', inp('to', '', { req: 'who the request is directed to', ph: 'Person, office or institution' }), { req: true, id: 'f_to' })}
    ${fld('Type', sel('toType', ['Complainant', 'Victim', 'Respondent', 'Government institution', 'Other party']), { id: 'f_toType' })}
    ${fld('Information requested', txt('details', '', { req: 'what is requested', rows: 4 }), { req: true, full: true, id: 'f_details' })}
    ${fld('Request date', inp('requestedAt', today(), { type: 'date' }), { id: 'f_requestedAt' })}${fld('Due date', inp('due', addDays(today(), cfg().sla.requestDays), { type: 'date', req: 'a due date' }), { req: true, id: 'f_due' })}
  </div>`, submit: 'Create request', onSubmit: async o => {
    const rid = nid('rq');
    await updC(c.id, { requests: { [rid]: { to: o.to, toType: o.toType, details: o.details, requestedAt: o.requestedAt || today(), due: o.due, status: 'pending', by: S.me.id, at: nowISO(), attempts: {}, responses: {} } }, nextAction: `Awaiting information from ${o.to}`, nextActionDue: o.due },
      { note: `Information requested from ${o.to} (due ${o.due})`, action: 'request.create' });
  } });
};
ACT.reqAttempt = el => {
  const c = S.complaints[el.dataset.id]; const rid = el.dataset.r;
  modal({ title: 'Log contact attempt', body: `<div class="form">${fld('Method', sel('method', ['Phone call', 'Letter', 'Email', 'Viber / WhatsApp', 'In person', 'Other'], 'Phone call', { blank: false }), { id: 'f_method' })}${fld('Result / note', txt('note', '', { req: 'a note' }), { req: true, full: true, id: 'f_note' })}</div>`,
    onSubmit: async o => updC(c.id, { requests: { [rid]: { attempts: { [nid('at')]: { at: nowISO(), by: S.me.id, method: o.method, note: o.note } } } } }, { note: `Contact attempt (${o.method}) for request to ${c.requests[rid].to}`, action: 'request.attempt' }) });
};
ACT.reqResponse = el => {
  const c = S.complaints[el.dataset.id]; const rid = el.dataset.r; const r = c.requests[rid];
  modal({ title: 'Record response from ' + r.to, body: `<div class="form">${fld('Summary of the response', txt('note', '', { req: 'a summary', rows: 4 }), { req: true, full: true, id: 'f_note' })}
    ${fld('Status after this response', sel('status', [['received', 'Received in full'], ['partial', 'Partially received']], 'received', { blank: false }), { id: 'f_status' })}
    ${fld('Incoming documents', fileInp('files'), { full: true, id: 'f_files' })}</div>`, onSubmit: async (o, form) => {
    const files = await uploadFiles(form.querySelector('#f_files').files); const docs = {}; const ids = [];
    files.forEach(f => { const d = nid('d'); ids.push(d); docs[d] = { ...f, type: 'Response from relevant party', version: 1, author: S.me.id, source: r.to, date: today(), restricted: false, at: nowISO() }; });
    const patch = { requests: { [rid]: { status: o.status, responses: { [nid('rs')]: { at: nowISO(), by: S.me.id, note: o.note, docIds: ids } } } }, docs };
    const stillOpen = openReqs(c).filter(x => x.id !== rid).length + (o.status === 'partial' ? 1 : 0);
    if (!stillOpen) { patch.nextAction = 'Review the information received'; patch.nextActionDue = addDays(today(), 7); }
    await updC(c.id, patch, { note: `Response recorded from ${r.to} (${REQ_STATUS[o.status][0].toLowerCase()})`, action: 'request.response' });
    notify([c.assignedTo], `Information received from ${r.to} for ${c.regNo}`, c.id);
  } });
};
ACT.reqClose = el => { const c = S.complaints[el.dataset.id]; const rid = el.dataset.r; confirmBox('Close this request?', 'Closing marks the request as no longer pending, even if no response arrived.', 'Close request', async () => updC(c.id, { requests: { [rid]: { status: 'closed', closedAt: nowISO() } } }, { note: `Information request to ${c.requests[rid].to} closed`, action: 'request.close' })); };

/* ----- Legal and procedural checks ----- */
CASE_TAB_VIEWS.legal = c => {
  const list = entries(c.legal).sort(byAt);
  return `<div class="card-head"><h2>Legal and procedural checks</h2>${can('legal') && canReview(c) ? `<button class="btn primary sm" data-act="linkLaw" data-id="${esc(c.id)}">Link a provision</button>` : ''}</div>
  <div class="note" style="margin-bottom:12px">These records support and document the officer's assessment. FREMYS does not make legal determinations; the authorized officer and panel do.</div>
  <div class="stack">${list.map(l => `<div class="entry"><div class="meta"><span><b>${esc(l.lawTitle)}</b> ${esc(l.lawRef || '')}${l.provision ? ' · ' + esc(l.provision) : ''}${l.lawVersion ? ` <span class="muted">(version: ${esc(l.lawVersion)})</span>` : ''}</span><span>${fmtDT(l.at)} · ${esc(nm(l.by))}</span></div>
    ${l.issue ? `<div><b>Issue identified:</b> ${esc(l.issue)}</div>` : ''}<div class="sub"><b>Preliminary assessment:</b> <span class="body">${esc(l.assessment)}</span></div>${l.reasons ? `<div class="sub"><b>Supporting reasons:</b> ${esc(l.reasons)}</div>` : ''}
    ${entries(l.comments).sort((a, b) => String(a.at).localeCompare(String(b.at))).map(cm => `<div class="sub small"><b>${esc(nm(cm.by))}</b> (${fmtDT(cm.at)})${cm.clarify ? ' ' + pill('Clarification requested', 'warn') : ''}: ${esc(cm.text)}</div>`).join('')}
    ${can('legalComment') ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="lawComment" data-id="${esc(c.id)}" data-l="${esc(l.id)}">Comment or request clarification</button></div>` : ''}</div>`).join('') || '<div class="card empty">No legal or procedural provisions linked yet.</div>'}</div>`;
};
ACT.linkLaw = el => {
  const c = S.complaints[el.dataset.id]; const laws = cfg().laws;
  modal({ title: 'Link a legal or procedural provision', wide: true, body: `<div class="form">
    ${fld('Law, regulation or procedure', sel('lawId', laws.map(l => [l.id, `${l.title} (${l.ref})`]), '', { req: 'a law or procedure' }), { req: true, full: true, id: 'f_lawId', hint: 'Manage the library under Administration → Legal library.' })}
    ${fld('Article / section / clause', inp('provision', '', { ph: 'e.g. Article 41(a)' }), { id: 'f_provision' })}
    ${fld('Legal or procedural issue identified', inp('issue'), { id: 'f_issue' })}
    ${fld('Preliminary assessment', txt('assessment', '', { req: 'the assessment', rows: 4 }), { req: true, full: true, id: 'f_assessment' })}
    ${fld('Supporting reasons', txt('reasons'), { full: true, id: 'f_reasons' })}</div>`, onSubmit: async o => {
    const law = laws.find(l => l.id === o.lawId) || {}; const lid = nid('lg');
    await updC(c.id, { legal: { [lid]: { lawId: o.lawId, lawTitle: law.title, lawRef: law.ref, lawVersion: law.version || '', lawDate: law.date || '', provision: o.provision, issue: o.issue, assessment: o.assessment, reasons: o.reasons, by: S.me.id, at: nowISO(), comments: {} } } }, { note: `Linked ${law.title}${o.provision ? ' ' + o.provision : ''}`, action: 'legal.link' });
  } });
};
ACT.lawComment = el => {
  const c = S.complaints[el.dataset.id]; const lid = el.dataset.l;
  modal({ title: 'Comment on legal assessment', body: `<div class="form">${fld('Comment', txt('text', '', { req: 'a comment' }), { req: true, full: true, id: 'f_text' })}<div class="f full"><label class="na"><input type="checkbox" name="clarify" id="f_clarify"> Request clarification from the officer</label></div></div>`,
    onSubmit: async o => { await updC(c.id, { legal: { [lid]: { comments: { [nid('cm')]: { by: S.me.id, at: nowISO(), text: o.text, clarify: !!o.clarify } } } } }, { note: o.clarify ? 'Clarification requested on legal assessment' : 'Comment on legal assessment', action: 'legal.comment' }); if (o.clarify) notify([c.legal[lid].by, c.assignedTo], `Clarification requested on the legal assessment for ${c.regNo}`, c.id); } });
};

/* ----- Panel decisions & follow-up actions ----- */
CASE_TAB_VIEWS.panel = c => {
  const ds = entries(c.decisions).sort(byAt); const as = entries(c.actions).sort(byAt); const td = today();
  const appearances = vals(S.meetings).filter(m => (m.agenda || []).includes(c.id) || ds.some(d => d.meetingId === m.id));
  return `${c.panelRequest ? `<div class="card" style="margin-bottom:14px"><h3>Submitted to the panel</h3><dl class="kv"><dt>Requested action</dt><dd>${esc(c.panelRequest.requested)}</dd><dt>Unresolved issues</dt><dd>${esc(c.panelRequest.issues || '—')}</dd>${c.panelRequest.clarification ? `<dt>Clarification provided</dt><dd>${esc(c.panelRequest.clarification)}</dd>` : ''}<dt>Submitted</dt><dd>${fmtDT(c.panelRequest.at)} by ${esc(nm(c.panelRequest.by))}${c.panelRequest.override ? `<div class="small" style="color:var(--warn)">Override: ${esc(c.panelRequest.override)}</div>` : ''}</dd></dl></div>` : ''}
  <div class="grid2"><div class="stack"><h2>Panel decisions</h2>
    ${ds.map(d => { const m = S.meetings[d.meetingId]; return `<div class="entry"><div class="meta"><span><b>${esc(outcomeLabel(d.outcome))}</b> · ${esc(d.ref || '')}</span><span>${d.needsCommission ? (d.commission ? (d.commission.status === 'approved' ? pill('Approved by the Commission', 'ok') : pill('Commission changed to: ' + outcomeLabel(d.commission.preferred), 'bad')) : pill('Awaiting Commission decision', 'info')) : d.status === 'approved' ? pill('Approved by ' + nm(d.approvedBy), 'ok') : pill('Panel decision', 'muted')}</span></div>
      <div class="small muted">${m ? `Meeting <a href="#meeting-${esc(m.id)}">${fmtD(m.date)}</a> · ` : ''}recorded ${fmtDT(d.at)} by ${esc(nm(d.by))}</div>${d.reason ? `<div class="sub"><b>Reason not lodged:</b> ${esc(d.reason)}</div>` : ''}${d.clarify ? `<div class="sub"><b>Clarification requested:</b> ${esc(d.clarify)}</div>` : ''}<div class="sub"><b>Rationale:</b> <span class="body">${esc(d.rationale || '—')}</span></div>
      ${d.commission ? `<div class="sub" style="border-top-style:solid"><b>Commission</b> (meeting ${fmtD(d.commission.meetingDate)}${d.commission.ref ? ', ' + esc(d.commission.ref) : ''}): ${d.commission.status === 'approved' ? 'approved the panel decision.' : `did not approve. <b>Reason:</b> ${esc(d.commission.reason)}. <b>Commission's decision:</b> ${esc(outcomeLabel(d.commission.preferred))}${d.commission.clarify ? ` — ${esc(d.commission.clarify)}` : ''}.`} <span class="muted small">Recorded by ${esc(nm(d.commission.by))}, ${fmtDT(d.commission.at)}</span></div>` : ''}
      ${d.needsCommission && !d.commission && can('commission') ? `<div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="commDecide" data-id="${esc(c.id)}" data-d="${esc(d.id)}">Record Commission decision</button></div>` : ''}</div>`; }).join('') || '<div class="card empty">No panel decision recorded yet.</div>'}
    ${appearances.length ? `<p class="small muted">Panel appearances: ${appearances.sort((a, b) => a.date.localeCompare(b.date)).map(m => `<a href="#meeting-${esc(m.id)}">${fmtD(m.date)}</a>`).join(', ')}</p>` : ''}
  </div>
  <div class="stack"><div class="card-head"><h2>Panel tasks</h2>${(can('supervise') || can('panelManage')) ? `<button class="btn sm" data-act="newAction" data-id="${esc(c.id)}">Add action</button>` : ''}</div>
    ${as.map(a => { const od = a.status !== 'done' && a.due && a.due < td; return `<div class="entry" style="${od ? 'border-color:var(--bad)' : ''}"><div class="meta"><span><b>${a.owner ? esc(nm(a.owner)) : esc(a.ownerDept || '—')}</b>${a.decisionId ? ' · from panel decision' : ''}</span><span>${a.status === 'done' ? pill('Completed ' + fmtD(a.completedAt), 'ok') : od ? pill('Overdue ' + fmtD(a.due), 'bad') : pill('Due ' + fmtD(a.due), 'warn')}</span></div>
      <div class="body">${esc(a.text)}</div>${a.note ? `<div class="sub small"><b>Completion note:</b> ${esc(a.note)}</div>` : ''}
      ${a.status !== 'done' && (a.owner === S.me.id || can('supervise') || can('panelManage')) ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="completeAction" data-cid="${esc(c.id)}" data-id="${esc(a.id)}">Mark complete</button></div>` : ''}</div>`; }).join('') || '<div class="card empty">No panel tasks.</div>'}
  </div></div>${caseRecsHTML(c)}`;
};
ACT.approveDecision = el => { const c = S.complaints[el.dataset.id]; const d = el.dataset.d; confirmBox('Approve panel decision', `Approve the recorded decision "${outcomeLabel(c.decisions[d].outcome)}" for ${c.regNo}?`, 'Approve', async () => updC(c.id, { decisions: { [d]: { status: 'approved', approvedBy: S.me.id, approvedAt: nowISO() } } }, { note: 'Panel decision approved', action: 'decision.approve' })); };
ACT.newAction = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Add follow-up action — ' + c.regNo, body: actionFields(c), onSubmit: async o => { const a = buildAction(o, c); await updC(c.id, { actions: { [nid('ac')]: a } }, { note: `Action created: ${o.text}`, action: 'action.create' }); notify([a.owner], `New action on ${c.regNo}: ${o.text}`, c.id); } });
};
function actionFields(c, prefix = '', optional = false) {
  return `<div class="form">${fld('Action to be completed', txt(prefix + 'text', '', optional ? {} : { req: 'the action' }), { req: !optional, full: true, id: 'f_' + prefix + 'text' })}
    ${fld('Responsible officer', `<select id="f_${prefix}owner" name="${prefix}owner"><option value="">— Department instead —</option>${staffIds().map(id => `<option value="${esc(id)}" ${id === c.assignedTo ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select>`, { id: 'f_' + prefix + 'owner' })}
    ${fld('…or responsible department', inp(prefix + 'ownerDept', '', { ph: 'e.g. Investigation Department' }), { id: 'f_' + prefix + 'ownerDept' })}
    ${fld('Due date', inp(prefix + 'due', addDays(today(), cfg().sla.actionDays), { type: 'date' }), { id: 'f_' + prefix + 'due' })}</div>`;
}
function buildAction(o, c, p = '', extra = {}) { return { text: o[p + 'text'], owner: o[p + 'owner'] || null, ownerDept: o[p + 'owner'] ? '' : (o[p + 'ownerDept'] || ''), due: o[p + 'due'] || null, status: 'open', at: nowISO(), by: S.me.id, ...extra }; }
ACT.completeAction = el => {
  const c = S.complaints[el.dataset.cid]; const aid = el.dataset.id; const a = c.actions[aid];
  modal({ title: 'Complete action', body: `<p>${esc(a.text)}</p><div class="form">${fld('Completion note', txt('note', ''), { full: true, id: 'f_note' })}</div>`, submit: 'Mark complete', onSubmit: async o => {
    const patch = { actions: { [aid]: { status: 'done', completedAt: nowISO(), completedBy: S.me.id, note: o.note || '' } } };
    const remaining = openActions(c).filter(x => x.id !== aid).length;
    if (!remaining && c.stage === 'further_work') { patch.nextAction = 'Complete review and resubmit to the panel'; patch.nextActionDue = addDays(today(), 7); }
    await updC(c.id, patch, { note: `Action completed: ${a.text}`, action: 'action.complete' });
    notify(supervisors(), `Action completed on ${c.regNo}: ${a.text}`, c.id);
  } });
};

/* ----- Investigation referrals ----- */
CASE_TAB_VIEWS.referrals = c => {
  const list = entries(c.referrals).sort(byAt);
  return `<div class="card-head"><h2>Investigation Department referrals</h2>${can('referralManage') ? `<button class="btn sm" data-act="newReferral" data-id="${esc(c.id)}">New referral</button>` : ''}</div>
  <div class="stack">${list.map(r => referralCard(c, r)).join('') || '<div class="card empty">This complaint has not been referred.</div>'}</div>`;
};
function referralCard(c, r, limited = false) {
  const st = REF_STATUS[r.status] || [r.status, '']; const mat = (r.materials || []).map(id => c.docs?.[id]).filter(Boolean);
  const btn = [];
  if (r.status === 'draft' && can('referralManage')) btn.push(`<button class="btn sm primary" data-act="refSend" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Send referral</button>`);
  if (r.status === 'sent' && (can('investigation') || can('referralManage'))) btn.push(`<button class="btn sm" data-act="refStatus" data-s="acknowledged" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Record acknowledgement</button>`);
  if (r.status === 'acknowledged' && (can('investigation') || can('referralManage'))) btn.push(`<button class="btn sm" data-act="refStatus" data-s="in_progress" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Mark in progress</button>`);
  if (['sent', 'acknowledged', 'in_progress'].includes(r.status) && (can('investigation') || can('referralManage'))) btn.push(`<button class="btn sm" data-act="refRespond" data-id="${esc(c.id)}" data-r="${esc(r.id)}">Record response</button>`);
  return `<div class="entry"><div class="meta"><span>${limited ? `<b class="mono">${esc(c.regNo)}</b> · ` : ''}To <b>${esc(r.dept || 'Investigation Department')}</b>${r.recipient ? ' · ' + esc(nm(r.recipient)) : ''}</span><span>${pill(st[0], st[1])}</span></div>
    <div><b>Issues requiring investigation:</b> <span class="body">${esc(r.issues)}</span></div>
    ${mat.length ? `<div class="sub small"><b>Supporting material shared:</b> ${mat.map(d => `<a href="${esc(d.url)}" target="_blank" rel="noopener" data-act="docView" data-id="${esc(c.id)}" data-title="${esc(d.title)}">${esc(d.title)}</a>`).join(', ')}</div>` : ''}
    <div class="sub small muted">Created ${fmtD(r.at)} by ${esc(nm(r.by))}${r.sentAt ? ` · sent ${fmtD(r.sentAt)}` : ''}${r.ackAt ? ` · acknowledged ${fmtD(r.ackAt)}` : ''}${r.respondedAt ? ` · responded ${fmtD(r.respondedAt)}` : ''}</div>
    ${r.response ? `<div class="sub"><b>Response / returned information:</b> <span class="body">${esc(r.response)}</span></div>` : ''}
    ${btn.length ? `<div class="row" style="margin-top:8px">${btn.join('')}</div>` : ''}</div>`;
}
function referralFields(c, issues = '') {
  const docs = entries(c.docs).filter(d => !d.superseded);
  return `<div class="form">${fld('Issues requiring investigation', txt('issues', issues, { req: 'the issues', rows: 4 }), { req: true, full: true, id: 'f_issues' })}
    ${fld('Receiving department', inp('dept', 'Investigation Department'), { id: 'f_dept' })}
    ${fld('Authorized recipient', `<select id="f_recipient" name="recipient"><option value="">Department (no named recipient)</option>${staffIds('investigation').map(id => `<option value="${esc(id)}">${esc(nm(id))}</option>`).join('')}</select>`, { id: 'f_recipient' })}
    <div class="f full"><label>Supporting material to share with the Investigation Department</label>${docs.length ? `<div class="checks">${docs.map(d => `<label><input type="checkbox" data-multi="1" name="materials" value="${esc(d.id)}"> ${esc(d.title)} <span class="muted small">(${esc(d.type)})</span></label>`).join('')}</div>` : '<span class="muted small">No documents attached to the complaint.</span>'}<span class="muted small">Only the referral and the material you tick are shown to Investigation Department users.</span></div></div>`;
}
ACT.newReferral = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Refer to Investigation Department — ' + c.regNo, wide: true, body: referralFields(c), submit: 'Create referral', onSubmit: async o => {
    const decision = entries(c.decisions).sort(byAt)[0];
    await updC(c.id, { referrals: { [nid('rf')]: { decisionId: decision?.id || null, issues: o.issues, dept: o.dept, recipient: o.recipient || null, materials: o.materials || [], status: 'draft', by: S.me.id, at: nowISO() } } }, { note: 'Investigation referral drafted', action: 'referral.create' });
  } });
};
ACT.refSend = el => {
  const c = S.complaints[el.dataset.id]; const rid = el.dataset.r; const r = c.referrals[rid];
  modal({ title: 'Send referral', body: `<div class="form">${fld('Date sent', inp('sentAt', today(), { type: 'date', req: 'the date' }), { req: true, id: 'f_sentAt' })}</div>`, submit: 'Record as sent', onSubmit: async o => {
    await updC(c.id, { referrals: { [rid]: { status: 'sent', sentAt: o.sentAt } }, stage: 'referred', nextAction: 'Await acknowledgement from the Investigation Department', nextActionDue: addDays(o.sentAt, 7) }, { stage: c.stage !== 'referred' ? 'referred' : null, note: `Referral sent to ${r.dept}`, action: 'referral.send' });
    notify(r.recipient ? [r.recipient] : staffIds('investigation'), `New investigation referral: ${c.regNo}`, c.id);
  } });
};
ACT.refStatus = async el => {
  const c = S.complaints[el.dataset.id]; const rid = el.dataset.r; const s = el.dataset.s;
  try {
    await updC(c.id, { referrals: { [rid]: { status: s, ...(s === 'acknowledged' ? { ackAt: today(), ackBy: S.me.id } : {}) } }, ...(s === 'acknowledged' ? { nextAction: 'Investigation Department working on referral', nextActionDue: null } : {}) }, { note: `Referral ${REF_STATUS[s][0].toLowerCase()}`, action: 'referral.' + s });
    notify([c.assignedTo, c.referrals[rid].by], `Referral for ${c.regNo}: ${REF_STATUS[s][0]}`, c.id);
  } catch (e) { toast(errText(e), 'error'); }
};
ACT.refRespond = el => {
  const c = S.complaints[el.dataset.id]; const rid = el.dataset.r;
  modal({ title: 'Record referral response', body: `<div class="form">${fld('Response or returned information', txt('response', '', { req: 'the response', rows: 5 }), { req: true, full: true, id: 'f_response' })}</div>`, onSubmit: async o => {
    await updC(c.id, { referrals: { [rid]: { status: 'responded', response: o.response, respondedAt: today(), respondedBy: S.me.id } }, nextAction: 'Review the Investigation Department response', nextActionDue: addDays(today(), 7) }, { note: 'Investigation Department responded to referral', action: 'referral.respond' });
    notify([c.assignedTo, c.referrals[rid].by, ...supervisors()], `Investigation Department responded on ${c.regNo}`, c.id);
  } });
};

/* ----- Documents ----- */
CASE_TAB_VIEWS.documents = c => {
  const all = entries(c.docs).sort(byAt); const visible = all.filter(d => !d.restricted || canSeeRestricted(c)); const hidden = all.length - visible.length;
  return `<div class="card-head"><h2>${esc(t('documents'))}</h2>${can('docs') ? `<button class="btn primary sm" data-act="uploadDoc" data-id="${esc(c.id)}">Upload document</button>` : ''}</div>
  ${visible.length ? `<div class="tbl-wrap"><table><thead><tr><th>Title</th><th>Type</th><th>Version</th><th>Date</th><th>Source</th><th>Uploaded by</th><th>Access</th><th></th></tr></thead><tbody>${visible.map(d => `<tr style="${d.superseded ? 'opacity:.6' : ''}"><td><a href="${esc(d.url)}" target="_blank" rel="noopener" data-act="docView" data-id="${esc(c.id)}" data-title="${esc(d.title)}">${esc(d.title)}</a><div class="muted small">${esc(d.contentType || '')} · ${fmtN((d.size || 0) / 1024)} KB</div></td><td>${esc(d.type)}</td><td>v${d.version || 1}${d.superseded ? ' ' + pill('Superseded', 'muted') : ''}</td><td>${fmtD(d.date)}</td><td>${esc(d.source || '—')}</td><td>${esc(nm(d.author))}<div class="muted small">${fmtDT(d.at)}</div></td><td>${d.restricted ? pill('Restricted', 'bad') : pill('Case staff', 'muted')}</td><td class="r">${can('docs') && !d.superseded ? `<button class="btn sm" data-act="uploadDoc" data-id="${esc(c.id)}" data-prev="${esc(d.id)}">New version</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">No documents attached.</div>'}
  ${hidden ? `<p class="small muted">${hidden} restricted document(s) are hidden for your role.</p>` : ''}
  <p class="small muted">Opening a document is recorded in the audit trail. Supported formats: PDF, images and text files; scan Word documents to PDF before uploading.</p>`;
};
ACT.docView = el => { logA('document.view', el.dataset.id, el.dataset.title); return 'default'; };
ACT.uploadDoc = el => {
  const c = S.complaints[el.dataset.id]; const prev = el.dataset.prev ? c.docs[el.dataset.prev] : null;
  modal({ title: prev ? `New version of "${prev.title}"` : 'Upload document — ' + c.regNo, body: `<div class="form">
    ${fld('File', fileInp('files', !prev), { req: true, full: true, id: 'f_files' })}
    ${fld('Document type', sel('type', DOC_TYPES, prev?.type || 'Supporting evidence', { blank: false }), { id: 'f_type' })}
    ${fld('Title', inp('title', prev?.title || '', { ph: 'Defaults to the file name' }), { id: 'f_title' })}
    ${fld('Source / author', inp('source', prev?.source || '', { ph: 'e.g. Complainant, Police, HRCM' }), { id: 'f_source' })}
    ${fld('Document date', inp('date', today(), { type: 'date' }), { id: 'f_date' })}
    <div class="f full"><label class="na"><input type="checkbox" name="restricted" id="f_restricted" ${prev?.restricted ? 'checked' : ''}> Restricted: visible only to the assigned officer, Director General, Director and panel</label></div></div>`,
    submit: 'Upload', onSubmit: async (o, form) => {
      const fs = form.querySelector('#f_files').files; if (!fs.length) throw new Error('Choose a file to upload.');
      const up = await uploadFiles(fs); const docs = {};
      up.forEach((f, i) => { docs[nid('d')] = { ...f, title: (up.length === 1 && o.title) ? o.title : f.title, type: o.type, version: prev ? (prev.version || 1) + 1 : 1, prevId: prev ? el.dataset.prev : null, author: S.me.id, source: o.source, date: o.date, restricted: !!o.restricted, at: nowISO() }; });
      if (prev) docs[el.dataset.prev] = { superseded: true };
      await updC(c.id, { docs }, { note: prev ? `New version of "${prev.title}" uploaded` : `${up.length} document(s) uploaded`, action: 'document.upload' });
    } });
};

/* ----- Correspondence ----- */
CASE_TAB_VIEWS.corr = c => {
  const list = entries(c.corr).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<div class="card-head"><h2>Correspondence</h2>${can('docs') || can('infoReq') ? `<button class="btn primary sm" data-act="newCorr" data-id="${esc(c.id)}">Log correspondence</button>` : ''}</div>
  ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Direction</th><th>Party</th><th>Method</th><th>Subject</th><th>Logged by</th></tr></thead><tbody>${list.map(x => `<tr><td>${fmtD(x.date)}</td><td>${x.dir === 'in' ? pill('Incoming', 'info') : pill('Outgoing', '')}</td><td>${esc(x.party)}</td><td>${esc(x.method)}</td><td><b>${esc(x.subject)}</b>${x.notes ? `<div class="muted small">${esc(x.notes)}</div>` : ''}</td><td>${esc(nm(x.by))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">No correspondence logged.</div>'}`;
};
ACT.newCorr = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Log correspondence — ' + c.regNo, body: `<div class="form">${fld('Direction', sel('dir', [['out', 'Outgoing'], ['in', 'Incoming']], 'out', { blank: false }), { id: 'f_dir' })}${fld('Date', inp('date', today(), { type: 'date' }), { id: 'f_date' })}
    ${fld('Party', inp('party', '', { req: 'the party' }), { req: true, id: 'f_party' })}${fld('Method', sel('method', ['Letter', 'Email', 'Phone call', 'Meeting', 'Viber / WhatsApp', 'Other'], 'Letter', { blank: false }), { id: 'f_method' })}
    ${fld('Subject', inp('subject', '', { req: 'a subject' }), { req: true, full: true, id: 'f_subject' })}${fld('Notes', txt('notes'), { full: true, id: 'f_notes' })}</div>`,
    onSubmit: async o => updC(c.id, { corr: { [nid('co')]: { ...o, by: S.me.id, at: nowISO() } } }, { note: `${o.dir === 'in' ? 'Incoming' : 'Outgoing'} correspondence: ${o.subject}`, action: 'correspondence.log' }) });
};

/* ----- Activity ----- */
CASE_TAB_VIEWS.activity = c => {
  const h = entries(c.history).sort(byAt);
  return `<h2 style="margin-bottom:10px">Activity history</h2><ul class="timeline">${h.map(x => `<li><span class="muted small">${fmtDT(x.at)}</span><span>${x.stage ? stagePill(x.stage) + ' ' : ''}${esc(x.note)} <span class="muted small">— ${esc(nm(x.by))}</span></span></li>`).join('')}</ul>
  <p class="small muted">Each person's actions are also written to a protected audit trail that only they can add to; System Administrators review it under Administration.</p>`;
};

/* ----- Case summary PDF ----- */
ACT.casePdf = el => { const c = S.complaints[el.dataset.id]; const doc = pdfDoc(`Complaint ${c.regNo}`, `${stageLabel(c.stage)} · received ${fmtD(c.dateReceived)}`); if (!doc) return; casePdfBody(doc, c); pdfSave(doc, `FREMYS-${c.regNo}.pdf`); logA('case.pdf', c.id, c.regNo); };
function casePdfBody(doc, c, packMode = false) {
  const showId = !c.confidential || canSeeRestricted(c);
  pdfTable(doc, 'Complaint details', ['Field', 'Value'], [['Registration no.', c.regNo], ['CMS reference', c.cmsRef || '—'], ['Date received', fmtD(c.dateReceived)], ['Complainant', showId ? (cpOf(c).name || '—') : 'Confidential'], ['Victims', c.victimSame && !victimsOf(c).length ? 'Same as complainant' : (showId ? victimsOf(c).map(v => v.name + (v.rel ? ` (${v.rel})` : '')).join('; ') || '—' : 'Confidential')], ['Respondent', c.respondent?.name || '—'], ...(detOf(c) ? [['Detention / institutional setting', `${detName(detOf(c))} (${detTypeLabel(detType(detOf(c)))}) — ${DET_STATUS[detOf(c).status] || ''}`]] : []), ['Classification', clsPath(clsOf(c)).join(' > ') || c.category || '—'], ['Location', [c.island, ATOLL[c.atoll]].filter(Boolean).join(', ') || '—'], ['Assigned officer', c.assignedTo ? nm(c.assignedTo) : '—'], ['Stage', stageLabel(c.stage)], ['Next action', (c.nextAction || '—') + (c.nextActionDue ? ` (due ${fmtD(c.nextActionDue)})` : '')]]);
  pdfText(doc, 'Summary', c.summary);
  if (c.panelRequest) pdfText(doc, 'Requested action for the panel', `${c.panelRequest.requested}\nUnresolved issues: ${c.panelRequest.issues || '—'}`);
  const sup = supersededIds(c);
  pdfTable(doc, 'Director General / Director comments', ['Date', 'By', 'Comment', 'Actions required'], entries(c.reviews).filter(r => r.kind === 'mgmt' && !sup.has(r.id)).sort(byAt).map(r => [fmtD(r.at), nm(r.by), r.text, r.requiredActions || '']));
  pdfTable(doc, "Officer's preliminary review", ['Date', 'By', 'Assessment', 'Outstanding questions'], entries(c.reviews).filter(r => r.kind === 'officer' && !sup.has(r.id)).sort(byAt).map(r => [fmtD(r.at), nm(r.by), r.text, r.questions || '']));
  pdfTable(doc, 'Additional information', ['Requested from', 'Due', 'Status', 'Responses'], entries(c.requests).map(r => [r.to, fmtD(r.due), REQ_STATUS[r.status]?.[0], vals(r.responses).map(x => x.note).join(' | ')]));
  pdfTable(doc, 'Legal and procedural references', ['Provision', 'Issue', 'Assessment'], entries(c.legal).map(l => [`${l.lawTitle} ${l.provision || ''}`, l.issue || '', l.assessment]));
  pdfTable(doc, 'Previous panel decisions and actions', ['Date', 'Outcome / action', 'Status'], [...entries(c.decisions).map(d => [fmtD(d.at), outcomeLabel(d.outcome) + (d.rationale ? ': ' + d.rationale : ''), d.status]), ...entries(c.actions).map(a => [fmtD(a.at), a.text, a.status === 'done' ? 'Completed' : 'Open'])]);
  pdfTable(doc, 'Documents', ['Title', 'Type', 'Date', 'Access'], entries(c.docs).filter(d => !d.superseded).map(d => [d.restricted && !canSeeRestricted(c) ? 'Restricted document' : d.title, d.type, fmtD(d.date), d.restricted ? 'Restricted' : 'Case staff']));
}

/* ----- Victim links ----- */
ACT.addVictim = el => {
  const c = S.complaints[el.dataset.id]; const linked = new Set(Object.keys(c.victimLinks || {}).filter(k => c.victimLinks[k]));
  const existing = Object.entries(S.victims).filter(([id]) => !linked.has(id)).sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)));
  modal({ title: 'Add victim — ' + c.regNo, wide: true, body: `<div class="form">${fld('Link an existing victim record', sel('existing', existing.map(([id, p]) => [id, `${p.name}${p.nid ? ' (' + p.nid + ')' : ''}`]), '', { blank: '— Create a new record below —' }), { full: true, id: 'f_existing' })}${fld('Relationship to complainant', inp('rel', '', { ph: 'e.g. son, employee, detainee' }), { full: true, id: 'f_rel' })}</div>
    <h3 style="margin:14px 0 8px">New victim record</h3>${personFields('victims', {}).replace(/data-required="[^"]*"/g, '')}`, submit: 'Add victim', onSubmit: async o => {
    let vid = o.existing;
    if (!vid) { if (!o.name) throw new Error('Choose an existing record or enter the new victim\'s name.'); vid = await createPerson('victims', Object.fromEntries(PERSON_KEYS.map(k => [k, o[k] ?? (k === 'vulnerable' ? [] : '')]))); }
    const name = S.victims[vid]?.name || o.name;
    await updC(c.id, { victimSame: false, victimLinks: { [vid]: { rel: o.rel || '', addedAt: nowISO(), addedBy: S.me.id } } }, { note: `Victim linked: ${name}${o.rel ? ' (' + o.rel + ')' : ''}`, action: 'victim.link' });
  } });
};
ACT.unlinkVictim = el => { const c = S.complaints[el.dataset.id]; const vid = el.dataset.v; const name = S.victims[vid]?.name || 'victim'; confirmBox('Remove victim from this complaint', `Unlink ${name} from ${c.regNo}? The victim's record stays in the victims table.`, 'Remove', async () => updC(c.id, { victimLinks: { [vid]: null } }, { note: `Victim unlinked: ${name}`, action: 'victim.unlink' }), true); };
