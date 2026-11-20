'use strict';
const partIds = m => Object.keys(m.participants || {}).filter(k => m.participants[k]);
/* Registration Panel: meetings, agenda preparation, case packs, outcomes; Investigation referrals page; legal library page. */

VIEWS.panel = () => {
  const ms = vals(S.meetings).sort((a, b) => b.date.localeCompare(a.date)); const td = today();
  const upcoming = ms.filter(m => m.date >= td && m.status !== 'cancelled').reverse(); const past = ms.filter(m => m.date < td || m.status === 'cancelled');
  const ready = visibleCases().filter(c => c.stage === 'ready_panel').sort((a, b) => String(a.readyAt).localeCompare(String(b.readyAt)));
  const row = m => `<tr class="click" data-act="goHref" data-href="#meeting-${esc(m.id)}"><td><b>${fmtD(m.date)}</b> ${esc(m.time || '')}${m.demo ? '<span class="demo-tag">DEMO</span>' : ''}</td><td>${pill(MEET_STATUS[m.status]?.[0], MEET_STATUS[m.status]?.[1])}</td><td class="r">${(m.agenda || []).length}</td><td>${m.agendaStatus === 'approved' ? pill('Approved', 'ok') : pill('Draft', 'warn')}</td><td class="r">${(m.agenda || []).filter(cid => vals(S.complaints[cid]?.decisions).some(d => d.meetingId === m.id)).length}</td><td>${esc(partIds(m).map(nm).join(', ') || '—')}</td></tr>`;
  const head = `<thead><tr><th>Date</th><th>Status</th><th class="r">Cases</th><th>Agenda</th><th class="r">Outcomes</th><th>Participants</th></tr></thead>`;
  return `<div class="page-head"><div><h1>${esc(t('panel'))}</h1><p>The Registration Panel meets every ${cfg().panelIntervalDays} days with the Director General, Director, an officer and an administrative/support officer.</p></div>
    ${can('panelManage') ? `<button class="btn primary" data-act="newMeeting">Schedule next meeting</button>` : ''}</div>
  <div class="card"><div class="card-head"><h2>Upcoming meetings</h2></div>${upcoming.length ? `<div class="tbl-wrap"><table>${head}<tbody>${upcoming.map(row).join('')}</tbody></table></div>` : '<div class="empty">No upcoming meeting is scheduled.</div>'}</div>
  <div class="card section"><div class="card-head"><h2>Cases ready for panel, not yet on an agenda</h2>${pill(ready.length, ready.length ? 'ok' : 'muted')}</div>
    ${ready.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('complainant'))}</th><th>Ready since</th><th>${esc(t('officer'))}</th><th>Requested action</th></tr></thead><tbody>${ready.map(c => `<tr class="click" data-act="openCase" data-id="${esc(c.id)}"><td style="white-space:nowrap">${caseLink(c)}</td><td>${esc(displayName(c))}${c.detention?.facility ? `<div class="muted small">${esc(detName(c.detention))}</div>` : ''}</td><td>${fmtD(c.readyAt)}</td><td>${esc(nm(c.assignedTo))}</td><td><div class="clip">${esc(c.panelRequest?.requested || '—')}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No cases are waiting.</div>'}</div>
  <div class="card section"><h2>Past and cancelled meetings</h2>${past.length ? `<div class="tbl-wrap"><table>${head}<tbody>${past.map(row).join('')}</tbody></table></div>` : '<div class="empty">None yet.</div>'}</div>`;
};
function suggestNextMeetingDate() {
  const last = vals(S.meetings).filter(m => m.status !== 'cancelled').map(m => m.date).sort().pop();
  let d = last ? addDays(last, cfg().panelIntervalDays) : addDays(today(), 7);
  while (d < today()) d = addDays(d, cfg().panelIntervalDays);
  const wd = new Date(d + 'T12:00:00').getDay(); if (wd === 5) d = addDays(d, 2); if (wd === 6) d = addDays(d, 1); // Maldivian weekend is Friday–Saturday
  return d;
}
ACT.newMeeting = () => {
  const def = [...staffIds('dg'), ...staffIds('director'), ...staffIds('support')];
  modal({ title: 'Schedule a Registration Panel meeting', body: `<div class="form">
    ${fld('Date', inp('date', suggestNextMeetingDate(), { type: 'date', req: 'a date' }), { req: true, id: 'f_date', hint: `Suggested from the ${cfg().panelIntervalDays}-day schedule; adjust if needed.` })}
    ${fld('Time', inp('time', '10:00', { type: 'time' }), { id: 'f_time' })}${fld('Venue', inp('venue', '', { ph: 'e.g. Meeting room 2' }), { id: 'f_venue' })}
    <div class="f full"><label>Participants</label><div class="checks">${staffIds().map(id => `<label><input type="checkbox" data-multi="1" name="participants" value="${esc(id)}" ${def.includes(id) ? 'checked' : ''}> ${esc(nm(id))} <span class="muted small">${esc((S.staff[id].roles || []).map(r => ROLES[r]).join(', '))}</span></label>`).join('')}</div></div></div>`,
    submit: 'Schedule', onSubmit: async o => {
      const id = 'm' + nid(); const participants = Object.fromEntries((o.participants || []).map(p => [p, true]));
      await setDoc('meetings/' + id, { date: o.date, time: o.time, venue: o.venue, participants, status: 'planned', agenda: [], agendaNotes: {}, agendaStatus: 'draft', createdBy: S.me.id, createdAt: nowISO() });
      logA('meeting.create', null, o.date); notify(o.participants || [], `Registration Panel scheduled for ${fmtD(o.date)}`, null); go('meeting-' + id);
    } });
};

VIEWS.meeting = (mid) => {
  const m = S.meetings[mid]; if (!m) return S.loaded.meetings ? '<div class="card gate"><h2>Meeting not found</h2><a class="btn" href="#panel">Back to meetings</a></div>' : '<div class="loading">Loading…</div>';
  const mg = can('panelManage'); const locked = m.agendaStatus === 'approved';
  const items = (m.agenda || []).map(cid => S.complaints[cid]).filter(Boolean);
  const ready = vals(S.complaints).filter(c => c.stage === 'ready_panel' && !(m.agenda || []).includes(c.id));
  const decFor = c => entries(c.decisions).find(d => d.meetingId === mid);
  return `<div class="row small muted" style="margin-bottom:8px"><a href="#panel">← ${esc(t('panel'))}</a></div>
  <div class="page-head"><div><h1>Registration Panel — ${fmtD(m.date)}</h1><p>${esc(m.time || '')}${m.venue ? ' · ' + esc(m.venue) : ''} · ${pill(MEET_STATUS[m.status]?.[0], MEET_STATUS[m.status]?.[1])} · Agenda ${locked ? pill('Approved by ' + nm(m.agendaApprovedBy), 'ok') : pill('Draft', 'warn')}</p></div>
    <div class="row">${mg ? `<button class="btn" data-act="meetEdit" data-id="${esc(mid)}">Edit meeting</button>` : ''}
      ${can('approveAgenda') && !locked && items.length ? `<button class="btn primary" data-act="agendaApprove" data-id="${esc(mid)}">Approve agenda</button>` : ''}
      ${can('approveAgenda') && locked ? `<button class="btn" data-act="agendaReopen" data-id="${esc(mid)}">Reopen agenda</button>` : ''}
      <button class="btn" data-act="agendaPdf" data-id="${esc(mid)}">Agenda PDF</button><button class="btn" data-act="packOpen" data-id="${esc(mid)}">Case pack (Word / PDF)</button></div></div>
  <div class="split">
    <div class="card"><div class="card-head"><h2>Agenda</h2><span class="muted small">${items.length} case(s)</span></div>
      ${m.status === 'cancelled' ? '<div class="note warn" style="margin-bottom:10px">This meeting is cancelled, so decisions cannot be recorded here.</div>' : ''}
      ${items.length ? `<div class="stack">${items.map((c, i) => { const d = decFor(c); const note = m.agendaNotes?.[c.id] || {}; return `<div class="entry agenda-item"><div class="ord">${i + 1}</div>
        <div><div class="row">${caseLink(c)} ${stagePill(c.stage)} ${c.panelRequest?.resubmission ? pill('Resubmitted after clarification', 'warn') : ''} ${d ? pill('Panel: ' + outcomeLabel(d.outcome), d.outcome === 'not_lodge' ? 'muted' : 'ok') : ''} ${d && d.needsCommission ? (d.commission ? pill(d.commission.status === 'approved' ? 'Commission approved' : 'Commission changed to ' + outcomeLabel(d.commission.preferred), d.commission.status === 'approved' ? 'ok' : 'bad') : pill('Awaiting Commission', 'info')) : ''}</div>
          <div class="small" style="margin-top:4px">${esc(c.summary).slice(0, 260)}${c.summary.length > 260 ? '…' : ''}</div>
          <div class="sub small"><b>Requested action:</b> ${esc(note.requested || c.panelRequest?.requested || '—')}<br><b>Outstanding issues:</b> ${esc(note.issues || c.panelRequest?.issues || '—')}${openReqs(c).length ? ` · ${openReqs(c).length} open information request(s)` : ''}${c.panelRequest?.clarification ? `<br><b>Clarification provided:</b> ${esc(c.panelRequest.clarification)}` : ''}<br><b>Officer:</b> ${esc(nm(c.assignedTo))}</div></div>
        <div class="stack" style="gap:4px">
          ${mg && !locked ? `<div class="row" style="gap:4px"><button class="btn sm" data-act="agendaMove" data-id="${esc(mid)}" data-c="${esc(c.id)}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="btn sm" data-act="agendaMove" data-id="${esc(mid)}" data-c="${esc(c.id)}" data-d="1" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button class="btn sm" data-act="agendaNote" data-id="${esc(mid)}" data-c="${esc(c.id)}">Edit item</button><button class="btn sm danger" data-act="agendaRemove" data-id="${esc(mid)}" data-c="${esc(c.id)}">Remove</button></div>` : ''}
          ${!d && m.status !== 'cancelled' ? (can('decide') ? `<button class="btn sm primary" data-act="recordOutcome" data-id="${esc(mid)}" data-c="${esc(c.id)}">Record decision</button>` : `<span class="muted small" style="max-width:160px">Decision is recorded by a panel member, the Director General, the Director or the support officer</span>`) : ''}
        </div></div>`; }).join('')}</div>` : `<div class="empty">No cases on this agenda yet. ${mg && !locked ? 'Add cases that are ready for panel from the list on the right; each agenda item then gets a <b>Record decision</b> button.' : 'Cases appear here once the support officer adds them to the agenda.'}</div>`}
      ${m.status === 'held' && items.some(c => !decFor(c)) ? `<div class="note warn" style="margin-top:12px">${items.filter(c => !decFor(c)).length} agenda item(s) have no recorded outcome.</div>` : ''}
    </div>
    <div class="stack">
      <div class="card"><h3>Participants</h3><ul class="small" style="padding-inline-start:18px;margin:6px 0 0">${partIds(m).map(id => `<li>${esc(nm(id))} <span class="muted">${esc((S.staff[id]?.roles || []).filter(r => ['dg', 'director', 'support', 'reg_officer', 'panel'].includes(r)).map(r => ROLES[r]).join(', '))}</span></li>`).join('') || '<li class="muted">None recorded</li>'}</ul></div>
      ${mg && !locked ? `<div class="card"><h3>Add cases ready for panel</h3>${ready.length ? `<div class="stack" style="gap:6px;margin-top:8px">${ready.map(c => `<div class="row" style="justify-content:space-between"><span>${caseLink(c)} <span class="muted small">${esc(nm(c.assignedTo))}</span></span><button class="btn sm" data-act="agendaAdd" data-id="${esc(mid)}" data-c="${esc(c.id)}">Add</button></div>`).join('')}</div>` : '<div class="empty">No cases are marked ready.</div>'}</div>` : ''}
      ${m.notes ? `<div class="card"><h3>Meeting notes</h3><p class="small" style="white-space:pre-wrap">${esc(m.notes)}</p></div>` : ''}
    </div>
  </div>`;
};
async function setAgenda(mid, agenda, extra = {}) { await updDoc('meetings/' + mid, { agenda, ...extra }); }
ACT.agendaAdd = async el => {
  const m = S.meetings[el.dataset.id]; const c = S.complaints[el.dataset.c];
  try {
    await setAgenda(m.id, [...(m.agenda || []), c.id], { agendaNotes: { [c.id]: { requested: c.panelRequest?.requested || '', issues: c.panelRequest?.issues || '' } } });
    await updC(c.id, { stage: 'on_agenda', panelMeetingId: m.id, nextAction: `Registration Panel on ${fmtD(m.date)}`, nextActionDue: m.date }, { stage: 'on_agenda', note: `Added to panel agenda for ${fmtD(m.date)}`, action: 'agenda.add' });
  } catch (e) { toast(errText(e), 'error'); }
};
ACT.agendaRemove = async el => {
  const m = S.meetings[el.dataset.id]; const c = S.complaints[el.dataset.c];
  try {
    await setAgenda(m.id, (m.agenda || []).filter(x => x !== c.id));
    if (c.stage === 'on_agenda') await updC(c.id, { stage: 'ready_panel', panelMeetingId: null, nextAction: 'Await scheduling on a Registration Panel agenda', nextActionDue: null }, { stage: 'ready_panel', note: `Removed from panel agenda for ${fmtD(m.date)}`, action: 'agenda.remove' });
  } catch (e) { toast(errText(e), 'error'); }
};
ACT.agendaMove = async el => { const m = S.meetings[el.dataset.id]; const a = [...(m.agenda || [])]; const i = a.indexOf(el.dataset.c); const j = i + Number(el.dataset.d); if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; try { await setAgenda(m.id, a); } catch (e) { toast(errText(e), 'error'); } };
ACT.agendaNote = el => { const m = S.meetings[el.dataset.id]; const c = S.complaints[el.dataset.c]; const n = m.agendaNotes?.[c.id] || {};
  modal({ title: 'Agenda item — ' + c.regNo, body: `<div class="form">${fld('Requested action', txt('requested', n.requested || c.panelRequest?.requested), { full: true, id: 'f_requested' })}${fld('Outstanding issues', txt('issues', n.issues || c.panelRequest?.issues), { full: true, id: 'f_issues' })}</div>`, onSubmit: async o => updDoc('meetings/' + m.id, { agendaNotes: { [c.id]: o } }) }); };
ACT.agendaApprove = el => { const m = S.meetings[el.dataset.id]; confirmBox('Approve agenda', `Approve the ${(m.agenda || []).length}-item agenda for ${fmtD(m.date)}? Participants will be notified and items can no longer be reordered unless the agenda is reopened.`, 'Approve agenda', async () => { await updDoc('meetings/' + m.id, { agendaStatus: 'approved', agendaApprovedBy: S.me.id, agendaApprovedAt: nowISO() }); logA('agenda.approve', null, m.date); notify(partIds(m), `Panel agenda for ${fmtD(m.date)} approved — case pack available`, null); }); };
ACT.agendaReopen = async el => { try { await updDoc('meetings/' + el.dataset.id, { agendaStatus: 'draft' }); logA('agenda.reopen', null, S.meetings[el.dataset.id].date); } catch (e) { toast(errText(e), 'error'); } };
ACT.meetEdit = el => {
  const m = S.meetings[el.dataset.id];
  modal({ title: 'Edit meeting', body: `<div class="form">${fld('Date', inp('date', m.date, { type: 'date', req: 'a date' }), { req: true, id: 'f_date' })}${fld('Time', inp('time', m.time, { type: 'time' }), { id: 'f_time' })}${fld('Venue', inp('venue', m.venue), { id: 'f_venue' })}
    ${fld('Status', sel('status', Object.entries(MEET_STATUS).map(([k, v]) => [k, v[0]]), m.status, { blank: false }), { id: 'f_status' })}
    <div class="f full"><label>Participants (attendance)</label><div class="checks">${staffIds().map(id => `<label><input type="checkbox" data-multi="1" name="participants" value="${esc(id)}" ${m.participants?.[id] ? 'checked' : ''}> ${esc(nm(id))}</label>`).join('')}</div></div>
    ${fld('Meeting notes', txt('notes', m.notes, { rows: 4 }), { full: true, id: 'f_notes' })}</div>`, onSubmit: async o => {
    const participants = Object.fromEntries(staffIds().map(id => [id, (o.participants || []).includes(id)]));
    // participants map is merged; write explicit false for removed people, then filter on read
    await updDoc('meetings/' + m.id, { date: o.date, time: o.time, venue: o.venue, status: o.status, notes: o.notes, participants });
    logA('meeting.update', null, `${o.date} ${o.status}`);
    if (o.status !== m.status && o.status === 'cancelled') {
      for (const cid of (m.agenda || [])) { const c = S.complaints[cid]; if (c && c.stage === 'on_agenda' && !vals(c.decisions).some(d => d.meetingId === m.id)) await updC(cid, { stage: 'ready_panel', panelMeetingId: null, nextAction: 'Await scheduling on a Registration Panel agenda', nextActionDue: null }, { stage: 'ready_panel', note: `Panel meeting of ${fmtD(m.date)} cancelled; returned to the ready list`, action: 'agenda.return' }); }
      await updDoc('meetings/' + m.id, { agenda: [] });
    } else if (o.date !== m.date) {
      for (const cid of (m.agenda || [])) { const c = S.complaints[cid]; if (c && c.stage === 'on_agenda') await updC(cid, { nextAction: `Registration Panel on ${fmtD(o.date)}`, nextActionDue: o.date }); }
    }
    if (o.date !== m.date) notify(Object.keys(participants).filter(k => participants[k]), `Registration Panel moved to ${fmtD(o.date)}`, null);
  } });
};

/* Outcome recording: the panel enters the official decision; FREMYS turns it into tracked follow-up. */
ACT.recordOutcome = el => {
  const m = S.meetings[el.dataset.id]; const c = S.complaints[el.dataset.c]; const outs = cfg().outcomes;
  const n = vals(S.complaints).reduce((s2, x) => s2 + vals(x.decisions).filter(d => d.meetingId === m.id).length, 0) + 1;
  const prevReturns = entries(c.decisions).filter(d => d.outcome === 'return_officer').length;
  const docs = entries(c.docs).filter(d => !d.superseded);
  modal({ title: `Panel decision — ${c.regNo}`, wide: true, body: `
    ${prevReturns ? `<div class="note warn" style="margin-bottom:12px">This complaint has been returned for clarification ${prevReturns} time${prevReturns > 1 ? 's' : ''} before.</div>` : ''}
    <div class="form"><div class="f full"><label class="req">Decision</label><div class="checks" style="flex-direction:column;gap:8px">${outs.map(o => `<label><input type="radio" name="outcome" value="${o.k}" data-on="change:outcomeShow"> <span><b>${esc(o.short)}</b><br><span class="muted small">${esc(o.label)}</span></span></label>`).join('')}</div></div>
    ${fld('Decision reference', inp('ref', `PNL-${m.date.replace(/-/g, '')}-${String(n).padStart(2, '0')}`), { id: 'f_ref' })}</div>
    <fieldset class="oc oc-lodge hidden" style="margin-top:12px"><legend>Forward to the Investigation Department</legend>
      ${fld('Issues for investigation', txt('ref_issues', c.panelRequest?.issues || c.subcategory || '', { rows: 3 }), { full: true, id: 'f_ref_issues' })}
      ${fld('Authorized recipient', `<select id="f_recipient" name="recipient"><option value="">Investigation Department (no named recipient)</option>${staffIds('investigation').map(id => `<option value="${esc(id)}">${esc(nm(id))}</option>`).join('')}</select>`, { id: 'f_recipient' })}
      <div class="f full"><label>Supporting material to share</label>${docs.length ? `<div class="checks">${docs.filter(d => !d.restricted).map(d => `<label><input type="checkbox" data-multi="1" name="materials" value="${esc(d.id)}" checked> ${esc(d.title)}</label>`).join('')}</div>` : '<span class="muted small">No documents attached.</span>'}</div>
      <div class="f full"><span class="muted small">The decision goes to the Commission. The complaint is forwarded to the Investigation Department once the Commission approves lodging.</span></div></fieldset>
    <fieldset class="oc oc-not_lodge hidden" style="margin-top:12px"><legend>Not lodged</legend>${fld('Reason', sel('nl_reason', NOT_LODGED_REASONS, ''), { full: true, id: 'f_nl_reason' })}
      <div class="f full"><span class="muted small">The decision goes to the Commission; the complaint is closed as not lodged once the Commission approves.</span></div></fieldset>
    <fieldset class="oc oc-return_officer hidden" style="margin-top:12px"><legend>Return for clarification</legend>
      ${fld('What needs to be clarified', txt('clarify', '', { rows: 3, ph: 'Questions the officer must answer before the case comes back to the panel' }), { full: true, id: 'f_clarify' })}
      ${fld('Return to', `<select id="f_owner" name="owner">${staffIds('reg_officer').map(id => `<option value="${esc(id)}" ${id === c.assignedTo ? 'selected' : ''}>${esc(nm(id))}</option>`).join('') || `<option value="${esc(c.assignedTo || '')}">${esc(nm(c.assignedTo))}</option>`}</select>`, { id: 'f_owner' })}
      ${fld('Clarification due', inp('due', addWorkDays(today(), cfg().sla.actionDays), { type: 'date' }), { id: 'f_due' })}
      <div class="f full"><span class="muted small">When the officer marks the case ready again, it returns to the "ready for panel" list for the next agenda.</span></div></fieldset>
    <div class="form" style="margin-top:12px">${fld('Rationale', txt('rationale', '', { req: 'the rationale', rows: 3 }), { req: true, full: true, id: 'f_rationale' })}</div>`,
    submit: 'Record decision', onSubmit: async o => {
      const oc = outs.find(x => x.k === o.outcome); if (!oc) throw new Error('Choose the panel decision.');
      if (oc.k === 'return_officer' && !o.clarify) throw new Error('Say what needs to be clarified.');
      if (oc.k === 'not_lodge' && !o.nl_reason) throw new Error('Choose the reason for not lodging.');
      const did = nid('dc'); const at = nowISO(); const stage = oc.stage;
      const patch = { decisions: { [did]: { meetingId: m.id, ref: o.ref, outcome: oc.k, rationale: o.rationale, reason: o.nl_reason || '', clarify: o.clarify || '', by: S.me.id, at, status: 'recorded', needsCommission: !!oc.commission } }, stage, panelMeetingId: oc.k === 'deferred' ? null : m.id };
      let note = `Panel decision: ${oc.short}`; const notifyIds = [c.assignedTo, ...supervisors()];
      if (oc.k === 'lodge') {
        patch.referrals = { [nid('rf')]: { decisionId: did, issues: o.ref_issues || o.rationale, dept: 'Investigation Department', recipient: o.recipient || null, materials: o.materials || [], status: 'pending_commission', by: S.me.id, at } };
        patch.nextAction = 'Await the Commission decision on lodging'; patch.nextActionDue = null; note += ' — awaiting Commission decision';
      } else if (oc.k === 'not_lodge') { patch.nextAction = 'Await the Commission decision'; patch.nextActionDue = null; note += ` (${o.nl_reason}) — awaiting Commission decision`; }
      else if (oc.k === 'return_officer') {
        const owner = o.owner || c.assignedTo; patch.actions = { [nid('ac')]: { text: 'Clarify for the panel: ' + o.clarify, owner, ownerDept: '', due: o.due || null, status: 'open', at, by: S.me.id, decisionId: did, meetingId: m.id } };
        if (owner && owner !== c.assignedTo) patch.assignedTo = owner;
        patch.clarification = { text: o.clarify, due: o.due || null, meetingId: m.id, at }; patch.nextAction = 'Clarify and resubmit to the panel'; patch.nextActionDue = o.due || null;
        notifyIds.push(owner); note += `: ${o.clarify}`;
      } else { patch.nextAction = 'Await the next Registration Panel'; patch.nextActionDue = null; }
      await updC(c.id, patch, { stage: stage !== c.stage ? stage : null, note, action: 'decision.record' });
      notify(notifyIds, `Panel decision for ${c.regNo}: ${oc.short}${oc.commission ? ' — for the Commission' : ''}`, c.id);
    } });
};
ON.outcomeShow = el => { $$('#dlgForm .oc').forEach(f => f.classList.toggle('hidden', !f.classList.contains('oc-' + el.value))); };

/* PDFs */
ACT.agendaPdf = el => {
  const m = S.meetings[el.dataset.id]; const doc = pdfDoc(`Registration Panel agenda — ${fmtD(m.date)}`, `${m.time || ''} ${m.venue || ''} · Agenda ${m.agendaStatus === 'approved' ? 'approved by ' + nm(m.agendaApprovedBy) : 'DRAFT'}`); if (!doc) return;
  pdfTable(doc, 'Participants', ['Name', 'Role'], partIds(m).map(id => [nm(id), (S.staff[id]?.roles || []).map(r => ROLES[r]).join(', ')]));
  pdfTable(doc, 'Agenda items', ['#', 'Reg. no.', 'Summary', 'Outstanding issues', 'Requested action'], (m.agenda || []).map((cid, i) => { const c = S.complaints[cid]; if (!c) return [i + 1, '—', 'Record unavailable', '', '']; const n = m.agendaNotes?.[cid] || {}; return [i + 1, c.regNo, c.summary.slice(0, 300), n.issues || c.panelRequest?.issues || '', n.requested || c.panelRequest?.requested || '']; }));
  pdfSave(doc, `FREMYS-panel-agenda-${m.date}.pdf`); logA('agenda.pdf', null, m.date);
};
ACT.packPdf = el => {
  const m = S.meetings[el.dataset.id]; const doc = pdfDoc(`Panel case pack — ${fmtD(m.date)}`, `${(m.agenda || []).length} case(s) · CONFIDENTIAL — for authorized panel members`); if (!doc) return;
  (m.agenda || []).forEach((cid, i) => { const c = S.complaints[cid]; if (!c) return; if (i) { doc.addPage(); doc._y = 48; } doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(`Item ${i + 1}: ${c.regNo}`, 40, doc._y); doc._y += 20; casePdfBody(doc, c, true); });
  pdfSave(doc, `FREMYS-case-pack-${m.date}.pdf`); logA('casepack.pdf', null, m.date);
};

/* ---------- Investigation referrals page ---------- */
VIEWS.referrals = () => {
  const inv = hasRole('investigation') && !can('viewAll');
  const all = vals(S.complaints).flatMap(c => entries(c.referrals).map(r => ({ r, c }))).filter(x => inv ? (!REF_PENDING.includes(x.r.status) && (!x.r.recipient || x.r.recipient === S.me.id)) : canSeeCase(x.c));
  const f = S.refFilter || 'active'; const list = all.filter(x => f === 'all' ? true : f === 'responded' ? x.r.status === 'responded' : x.r.status !== 'responded').sort((a, b) => String(b.r.sentAt || b.r.at).localeCompare(String(a.r.sentAt || a.r.at)));
  if (!inv && !can('viewAll') && !can('referralManage')) return noAccess();
  return `<div class="page-head"><div><h1>${esc(t('referrals'))}</h1><p>${inv ? 'Referrals sent to the Investigation Department. You see the referral and the material shared with it, not the full complaint file.' : 'Controlled handoff of issues to the Investigation Department, tracked through acknowledgement and response.'}</p></div>
  <div class="row">${[['active', 'Active'], ['responded', 'Responded'], ['all', 'All']].map(([k, l]) => `<button class="btn ${f === k ? 'primary' : ''}" data-act="refFilter" data-f="${k}">${l}</button>`).join('')}</div></div>
  <div class="tiles">${Object.entries(REF_STATUS).filter(([k]) => !(inv && REF_PENDING.includes(k)) && k !== 'draft').map(([k, v]) => `<div class="tile ${v[1]}" style="cursor:default"><div class="k">${esc(v[0])}</div><div class="v num">${all.filter(x => x.r.status === k).length}</div></div>`).join('')}</div>
  <div class="stack">${list.map(x => `<div>${referralCard(x.c, { id: x.r.id, ...x.r }, true)}${!inv ? `<div class="small" style="margin-top:4px"><a href="#case-${esc(x.c.id)}">Open complaint</a></div>` : ''}</div>`).join('') || '<div class="card empty">No referrals in this view.</div>'}</div>`;
};
ACT.refFilter = el => { S.refFilter = el.dataset.f; render(); };

/* ---------- Legal library (read view) ---------- */
VIEWS.laws = () => {
  const laws = cfg().laws; const use = id => vals(S.complaints).filter(c => vals(c.legal).some(l => l.lawId === id)).length;
  return `<div class="page-head"><div><h1>${esc(t('laws'))}</h1><p>Laws, regulations and internal procedures officers can link to a complaint. ${can('admin') ? 'Edit the library under <a href="#admin">Administration</a>.' : 'The System Administrator maintains this list.'}</p></div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Title</th><th>Reference</th><th>Type</th><th>Version / date</th><th class="r">Linked complaints</th></tr></thead><tbody>${laws.map(l => `<tr><td><b>${esc(l.title)}</b></td><td>${esc(l.ref)}</td><td>${esc(l.type || '')}</td><td>${esc([l.version, l.date && fmtD(l.date)].filter(Boolean).join(' · ') || '—')}</td><td class="r">${use(l.id)}</td></tr>`).join('')}</tbody></table></div>
  <p class="small muted">Default entries are a starting list; confirm titles, numbers and amendments against the current official gazette.</p>`;
};
