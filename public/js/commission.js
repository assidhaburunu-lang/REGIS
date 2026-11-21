'use strict';
/* Commission review: panel decisions to lodge / not lodge are presented to the Commission, which approves them or changes them.
   The Director General or Director records the Commission's decision with the reason and the Commission's preferred decision. */

const COMM_CHOICES = [['lodge', 'Lodge — forward to the Investigation Department'], ['not_lodge', 'Do not lodge'], ['return_officer', 'Return to the Registration Officer for clarification']];

async function applyCommission(c, did, o) {
  const d = c.decisions[did]; const at = nowISO(); const approved = o.status === 'approved';
  const eff = approved ? d.outcome : o.preferred;
  const commission = { status: o.status, reason: o.reason || '', preferred: approved ? d.outcome : o.preferred, clarify: o.clarify || '', meetingDate: o.meetingDate || today(), ref: o.ref || '', by: S.me.id, at };
  const patch = { decisions: { [did]: { commission, status: approved ? 'approved' : 'changed' } } };
  const ref = entries(c.referrals).find(r => r.decisionId === did && r.status === 'pending_commission');
  let stage; const notes = [`Commission ${approved ? 'approved' : 'did not approve'} the panel decision “${outcomeLabel(d.outcome)}”`];
  if (!approved) notes.push(`reason: ${o.reason}`, `Commission decision: ${outcomeLabel(eff)}`);
  if (eff === 'lodge') {
    stage = 'referred'; patch.lodgedAt = at; patch.nextAction = 'Await acknowledgement from the Investigation Department'; patch.nextActionDue = addDays(today(), 7);
    if (ref) patch.referrals = { [ref.id]: { status: 'sent', sentAt: today() } };
    else patch.referrals = { [nid('rf')]: { decisionId: did, issues: o.issues || c.panelRequest?.issues || c.subcategory || d.rationale, dept: 'Investigation Department', recipient: null, materials: [], status: 'sent', sentAt: today(), by: S.me.id, at } };
    notes.push('forwarded to the Investigation Department');
  } else {
    if (ref) patch.referrals = { [ref.id]: { status: 'withdrawn', withdrawnAt: at } };
    if (eff === 'not_lodge') { stage = 'closed'; patch.nextAction = 'Inform the complainant that the complaint was not lodged'; patch.nextActionDue = addDays(today(), 7); }
    else {
      stage = 'further_work'; const q = o.clarify || 'Clarification requested by the Commission';
      patch.actions = { [nid('ac')]: { text: 'Clarify for the panel: ' + q, owner: c.assignedTo, ownerDept: '', due: addWorkDays(today(), cfg().sla.actionDays), status: 'open', at, by: S.me.id, decisionId: did, meetingId: d.meetingId } };
      patch.clarification = { text: q, due: addWorkDays(today(), cfg().sla.actionDays), meetingId: d.meetingId, at, byCommission: true }; patch.nextAction = 'Clarify and resubmit to the panel'; patch.nextActionDue = addWorkDays(today(), cfg().sla.actionDays);
    }
  }
  if (eff === 'lodge' || eff === 'not_lodge') { patch.interim = startInterim(eff, o.meetingDate); patch.nextAction = 'Send the response letter to the complainant'; patch.nextActionDue = patch.interim.due; notes.push('interim letter to be sent by the Registration Officer'); }
  patch.stage = stage;
  await updC(c.id, patch, { stage, note: notes.join('; '), action: approved ? 'commission.approve' : 'commission.change' });
  notify([c.assignedTo, d.by, ...supervisors()], `Commission ${approved ? 'approved' : 'changed'} the panel decision on ${c.regNo}: ${outcomeLabel(eff)}`, c.id);
  if (eff === 'lodge') notify(staffIds('investigation'), `New lodged complaint forwarded: ${c.regNo}`, c.id);
  if (eff !== 'return_officer') notify([c.assignedTo], `Send the response letter for ${c.regNo} (${outcomeLabel(eff)})`, c.id);
}

function commissionFields(d, multi = false) {
  return `<div class="form">
    ${fld('Commission meeting date', inp('meetingDate', today(), { type: 'date', req: 'the Commission meeting date' }), { req: true, id: 'f_meetingDate' })}
    ${fld('Commission decision reference', inp('ref', '', { ph: 'e.g. HRCM/COM/2026/41' }), { id: 'f_ref' })}
    ${multi ? '' : `<div class="f full"><label class="req">Commission decision</label><div class="checks" style="flex-direction:column;gap:8px">
      <label><input type="radio" name="status" value="approved" data-on="change:commShow" checked> <span><b>Approved</b> — the panel decision “${esc(outcomeLabel(d.outcome))}” stands</span></label>
      <label><input type="radio" name="status" value="rejected" data-on="change:commShow"> <span><b>Not approved</b> — the Commission decided differently</span></label></div></div>
    <fieldset id="commRej" class="hidden"><legend>Commission's decision</legend>
      ${fld('Reason the panel decision was not approved', txt('reason', '', { rows: 3 }), { full: true, id: 'f_reason' })}
      <div class="f full"><label>Decision preferred by the Commission</label><div class="checks" style="flex-direction:column;gap:6px">${COMM_CHOICES.filter(([k]) => k !== d.outcome).map(([k, l], i) => `<label><input type="radio" name="preferred" value="${k}" ${i === 0 ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
      ${fld('If returned: what needs clarification', txt('clarify', '', { rows: 2 }), { full: true, id: 'f_clarify' })}
    </fieldset>`}
  </div>`;
}
ON.commShow = el => { $('#commRej').classList.toggle('hidden', el.value !== 'rejected'); };
ACT.commDecide = el => {
  const c = S.complaints[el.dataset.id]; const did = el.dataset.d; const d = c.decisions[did];
  modal({ title: `Commission decision — ${c.regNo}`, wide: true, body: `<div class="note small" style="margin-bottom:12px"><b>Panel decision:</b> ${esc(outcomeLabel(d.outcome))}${d.reason ? ` (${esc(d.reason)})` : ''} · ${esc(d.ref || '')}<br><b>Rationale:</b> ${esc(d.rationale || '—')}</div>${commissionFields(d)}`,
    submit: 'Record Commission decision', onSubmit: async o => {
      if (o.status === 'rejected') { if (!o.reason) throw new Error('Give the reason the Commission did not approve the panel decision.'); if (!o.preferred) throw new Error('Choose the decision preferred by the Commission.'); if (o.preferred === 'return_officer' && !o.clarify) throw new Error('Say what needs clarification.'); }
      await applyCommission(c, did, o);
    } });
};
ACT.commApproveSelected = () => {
  const picks = $$('input[name=commPick]:checked').map(x => x.value.split('|'));
  if (!picks.length) { toast('Tick the decisions the Commission approved.', 'error'); return; }
  modal({ title: `Record Commission approval for ${picks.length} decision${picks.length > 1 ? 's' : ''}`, body: `<p class="small">Each selected panel decision is recorded as approved by the Commission and takes effect: lodged complaints are forwarded to the Investigation Department; not-lodged complaints are closed.</p>${commissionFields(null, true)}`,
    submit: 'Approve selected', onSubmit: async o => {
      for (const [cid, did] of picks) { const c = S.complaints[cid]; if (c && c.decisions?.[did] && !c.decisions[did].commission) await applyCommission(c, did, { ...o, status: 'approved' }); }
      toast(`${picks.length} decision(s) recorded as approved`);
    } });
};

VIEWS.commission = () => {
  if (!can('viewAll')) return noAccess();
  const all = visibleCases().flatMap(c => entries(c.decisions).filter(d => d.needsCommission).map(d => ({ c, d })));
  const pending = all.filter(x => !x.d.commission).sort((a, b) => String(a.d.at).localeCompare(String(b.d.at)));
  const done = all.filter(x => x.d.commission).sort((a, b) => String(b.d.commission.at).localeCompare(String(a.d.commission.at)));
  const approved = done.filter(x => x.d.commission.status === 'approved'); const changed = done.filter(x => x.d.commission.status === 'rejected');
  const groups = {}; pending.forEach(x => { (groups[x.d.meetingId] = groups[x.d.meetingId] || []).push(x); });
  const mayDecide = can('commission'); const ids = l => l.map(x => x.c.id).join(',');
  return `<div class="page-head"><div><h1>${esc(t('commission'))}</h1><p>Panel decisions to lodge or not lodge are presented to the Commission. The Director General or Director records whether the Commission approved each decision or changed it, with the reason and the Commission's preferred decision.</p></div>
    ${pending.length ? `<div class="row"><button class="btn" data-act="commPdf">Submission list PDF</button>${mayDecide ? '<button class="btn primary" data-act="commApproveSelected">Approve selected</button>' : ''}</div>` : ''}</div>
  <div class="tiles">
    <button class="tile info" data-act="drill" data-ids="${ids(pending)}" data-label="Awaiting Commission decision" ${pending.length ? '' : 'disabled'}><div class="k">Awaiting Commission</div><div class="v num">${pending.length}</div><div class="s">Panel decisions not yet decided</div></button>
    <button class="tile ok" data-act="drill" data-ids="${ids(approved)}" data-label="Approved by the Commission" ${approved.length ? '' : 'disabled'}><div class="k">Approved</div><div class="v num">${approved.length}</div><div class="s">Panel decision stands</div></button>
    <button class="tile bad" data-act="drill" data-ids="${ids(changed)}" data-label="Changed by the Commission" ${changed.length ? '' : 'disabled'}><div class="k">Not approved / changed</div><div class="v num">${changed.length}</div><div class="s">Commission decided differently</div></button>
    <div class="tile" style="cursor:default"><div class="k">Agreement with the panel</div><div class="v num">${done.length ? pctOf(approved.length, done.length) + '%' : '—'}</div><div class="s">${done.length} Commission decisions</div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Awaiting the Commission</h2>${mayDecide ? '' : '<span class="muted small">Recorded by the Director General or Director</span>'}</div>
    ${pending.length ? Object.entries(groups).map(([mid, list]) => { const m = S.meetings[mid]; return `<h3 style="margin:10px 0 6px">Panel of ${m ? fmtD(m.date) : 'unknown date'} <span class="muted small">· ${list.length} decision${list.length > 1 ? 's' : ''}</span></h3>
      <div class="tbl-wrap"><table><thead><tr>${mayDecide ? `<th style="width:28px"><input type="checkbox" data-on="change:commAll" data-m="${esc(mid)}" aria-label="Select all"></th>` : ''}<th>${esc(t('reg_no'))}</th><th>Complaint</th><th>Panel decision</th><th>Rationale</th><th>Waiting</th><th></th></tr></thead><tbody>${list.map(({ c, d }) => `<tr>${mayDecide ? `<td><input type="checkbox" name="commPick" value="${esc(c.id)}|${esc(d.id)}" data-m="${esc(mid)}"></td>` : ''}<td>${caseLink(c)}</td><td><div class="clip">${esc(c.subcategory || c.category || '')}</div><div class="muted small clip">${esc(c.summary)}</div></td><td>${pill(outcomeLabel(d.outcome), d.outcome === 'lodge' ? 'ok' : 'muted')}${d.reason ? `<div class="muted small">${esc(d.reason)}</div>` : ''}</td><td><div class="clip small">${esc(d.rationale || '')}</div></td><td class="num">${fmtN(workDays(d.at, today()))} working days</td><td class="r">${mayDecide ? `<button class="btn sm primary" data-act="commDecide" data-id="${esc(c.id)}" data-d="${esc(d.id)}">Record decision</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }).join('') : '<div class="empty">No panel decisions are waiting for the Commission.</div>'}
  </div>
  <div class="card section"><h2>Commission decisions</h2>
    ${done.length ? `<div class="tbl-wrap"><table><thead><tr><th>Commission meeting</th><th>${esc(t('reg_no'))}</th><th>Panel decision</th><th>Commission</th><th>Reason</th><th>Recorded by</th></tr></thead><tbody>${done.slice(0, 150).map(({ c, d }) => { const k = d.commission; return `<tr class="click" data-act="openCase" data-id="${esc(c.id)}"><td>${fmtD(k.meetingDate)}${k.ref ? `<div class="muted small">${esc(k.ref)}</div>` : ''}</td><td>${caseLink(c)}</td><td>${esc(outcomeLabel(d.outcome))}</td><td>${k.status === 'approved' ? pill('Approved', 'ok') : pill('Changed to: ' + outcomeLabel(k.preferred), 'bad')}</td><td class="small">${esc(k.reason || '—')}</td><td>${esc(nm(k.by))}<div class="muted small">${fmtD(k.at)}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No Commission decisions recorded yet.</div>'}
  </div>`;
};
ON.commAll = el => { $$(`input[name=commPick][data-m="${el.dataset.m}"]`).forEach(x => { x.checked = el.checked; }); };
ACT.commPdf = () => {
  const list = visibleCases().flatMap(c => entries(c.decisions).filter(d => d.needsCommission && !d.commission).map(d => ({ c, d }))).sort((a, b) => String(a.d.at).localeCompare(String(b.d.at)));
  const doc = pdfDoc('Panel decisions for the Commission', `${list.length} decision(s) awaiting the Commission · CONFIDENTIAL`, true); if (!doc) return;
  pdfTable(doc, null, ['#', 'Reg. no.', 'Panel date', 'Category', 'Summary', 'Panel decision', 'Rationale'], list.map(({ c, d }, i) => [i + 1, c.regNo, S.meetings[d.meetingId]?.date || '', c.subcategory || c.category || '', c.summary.slice(0, 260), outcomeLabel(d.outcome) + (d.reason ? ` (${d.reason})` : ''), d.rationale || '']));
  pdfSave(doc, `FREMYS-commission-submission-${today()}.pdf`); logA('commission.pdf', null, `${list.length} decisions`);
};
