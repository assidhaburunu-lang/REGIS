'use strict';
/* Views: dashboard, register, new registration, assignment, information requests, actions, notifications. */
const VIEWS = {};
const ACT = {};
const ON = {};

/* ---------- Register presets (used by dashboard tiles and statistics drill-downs) ---------- */
const PRESETS = {
  unclassified: { label: 'Not classified with the catalogue', fn: c => !isCatalogued(c) },
  all: { label: 'All complaints', fn: () => true },
  detention: { label: 'Detention and institutional settings', fn: c => !!detOf(c) },
  open: { label: 'Open complaints', fn: c => !isDone(c) },
  awaiting_assign: { label: 'Awaiting assignment', fn: c => c.stage === 'registered' },
  in_review: { label: 'In preliminary review', fn: c => c.stage === 'prelim_review' || c.stage === 'further_work' },
  with_mgmt: { label: 'With Director General / Director comments', fn: c => hasMgmt(c) },
  info_required: { label: 'Additional information required', fn: c => openReqs(c).length > 0 },
  ready_panel: { label: 'Ready for panel', fn: c => c.stage === 'ready_panel' },
  on_agenda: { label: 'On a panel agenda', fn: c => c.stage === 'on_agenda' },
  lodged: { label: 'Lodged — forwarded to Investigation', fn: c => isLodged(c) },
  not_lodged: { label: 'Not lodged', fn: c => isNotLodged(c) },
  interim_pending: { label: 'Interim letter to send', fn: c => interimPending(c) },
  awaiting_commission: { label: 'Awaiting Commission decision', fn: c => pendingCommission(c).length > 0 },
  returned: { label: 'Returned for clarification', fn: c => c.stage === 'further_work' },
  awaiting_decision: { label: 'Awaiting a panel decision', fn: c => c.stage === 'ready_panel' || c.stage === 'on_agenda' },
  referrals_followup: { label: 'Investigation referrals awaiting follow-up', fn: c => vals(c.referrals).some(r => r.status !== 'responded') },
  overdue: { label: 'Overdue', fn: c => isOverdue(c) },
  inactive: { label: 'Inactive', fn: c => isInactive(c) },
  mine: { label: 'Assigned to me', fn: c => c.assignedTo === S.me.id && !isDone(c) },
  dq_missing: { label: 'Information not yet available', fn: c => (c.missing || []).length > 0 },
  dq_nodocs: { label: 'No documents attached', fn: c => !Object.keys(c.docs || {}).length },
  dq_dup: { label: 'Potential duplicates', fn: c => (c.dupWarnings || []).length > 0 },
};
function drill(preset, extra = {}) { S.filter = { preset, ...extra }; S.regLimit = 100; go('register'); }
ACT.drill = el => { if (el.dataset.ids) { S.filter = { ids: el.dataset.ids.split(','), idsLabel: el.dataset.label || 'Selected records' }; S.regLimit = 100; go('register'); } else drill(el.dataset.f); };
ACT.openCase = el => go('case-' + el.dataset.id);

function caseLink(c) { return `<a href="#case-${esc(c.id)}" class="mono">${esc(c.regNo)}</a>${c.demo ? '<span class="demo-tag">DEMO</span>' : ''}`; }

/* ---------- Dashboard ---------- */
VIEWS.dashboard = () => {
  const cs = visibleCases(); const cnt = k => cs.filter(PRESETS[k].fn).length;
  const tiles = [
    ['all', t('total'), cs.length, '', `${cnt('open')} open`],
    ['awaiting_assign', 'Awaiting assignment', cnt('awaiting_assign'), 'info', 'New registrations'],
    ['in_review', 'In preliminary review', cnt('in_review'), 'info', 'With Registration Officers'],
    ['info_required', 'Additional information required', cnt('info_required'), 'warn', 'Open information requests'],
    ['awaiting_decision', 'Awaiting panel decision', cnt('awaiting_decision'), 'ok', `${cnt('on_agenda')} on an agenda`],
    ['returned', 'Returned for clarification', cnt('returned'), 'warn', 'To be resubmitted'],
    ['lodged', 'Lodged', cnt('lodged'), 'ok', 'Forwarded to Investigation'],
    ['not_lodged', 'Not lodged', cnt('not_lodged'), '', 'Closed by the panel'],
    ['awaiting_commission', 'Awaiting Commission', cnt('awaiting_commission'), 'info', 'Panel decisions to approve'],
    ['overdue', t('overdue'), cnt('overdue'), 'bad', `${cnt('inactive')} inactive > ${cfg().sla.inactiveDays} days`],
  ];
  const byStage = STAGES.map(s => ({ s, n: cs.filter(c => c.stage === s.k).length }));
  const maxS = Math.max(1, ...byStage.map(x => x.n));
  const tasks = myTasks(cs);
  const meet = nextMeeting();
  const recent = cs.flatMap(c => entries(c.history).map(h => ({ ...h, c }))).sort(byAt).slice(0, 12);
  const onboarding = can('admin') && Object.keys(S.staff).length <= 1;
  return `
  <div class="page-head"><div><h1>${esc(t('dashboard'))}</h1><p>Welcome${S.me.name ? ', ' + esc(S.me.name.split(' ')[0]) : ''}. Here is what needs attention in the registration workflow today.</p></div>
  <div class="row">${can('register') ? `<a class="btn primary" href="#new">+ ${esc(t('new'))}</a>` : ''}<a class="btn" href="#register">${esc(t('register'))}</a></div></div>
  ${hasRole('reg_officer') ? myCasesHTML() : ''}
  ${onboarding ? `<div class="note" style="margin-bottom:16px">You are the System Administrator. Add colleagues and give them roles under <a href="#admin">Administration</a>. To explore the workflow first, use <b>Load demo data</b> on the Data tools tab; demo records are marked and can be removed in one step.</div>` : ''}
  <div class="tiles tiles5">${tiles.map(([f, k, v, tone, s]) => `<button class="tile ${tone}" data-act="drill" data-f="${f}"><div class="k">${esc(k)}</div><div class="v num">${fmtN(v)}</div><div class="s">${esc(s)}</div></button>`).join('')}</div>
  <div class="grid2">
    <div class="card"><div class="card-head"><h2>${esc(t('my_tasks'))}</h2><span class="muted small">${tasks.length} item${tasks.length === 1 ? '' : 's'}</span></div>
      ${tasks.length ? `<div class="tbl-wrap"><table><tbody>${tasks.slice(0, 14).map(tk => `<tr class="click ${tk.overdue ? 'overdue' : ''}" data-act="${tk.href ? 'goHref' : 'openCase'}" data-id="${esc(tk.cid || '')}" data-href="${esc(tk.href || '')}"><td><b>${esc(tk.text)}</b><div class="muted small">${tk.sub || ''}</div></td><td class="r">${tk.due ? `<span class="pill ${tk.overdue ? 'bad' : tk.soon ? 'warn' : 'muted'}">${tk.overdue ? 'Overdue' : 'Due'} ${fmtD(tk.due)}</span>` : (tk.tag ? pill(tk.tag, 'info') : '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing is waiting for you.</div>'}
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><h2>Next Registration Panel</h2>${can('panelManage') ? '<a class="btn sm" href="#panel">Manage meetings</a>' : ''}</div>
        ${meet ? `<div class="kv"><dt>Date</dt><dd><a href="#meeting-${esc(meet.id)}"><b>${fmtD(meet.date)}</b></a> ${esc(meet.time || '')} ${pill(MEET_STATUS[meet.status]?.[0] || meet.status, MEET_STATUS[meet.status]?.[1])}</dd>
          <dt>Agenda</dt><dd>${(meet.agenda || []).length} case(s) · ${meet.agendaStatus === 'approved' ? pill('Approved', 'ok') : pill('Draft', 'warn')}</dd>
          <dt>Cases ready, not yet scheduled</dt><dd>${cnt('ready_panel')}</dd></div>`
        : `<div class="empty">No panel meeting is scheduled.${can('panelManage') ? ' <a href="#panel">Schedule the next meeting</a>.' : ''}</div>`}
      </div>
      ${decisionSummaryHTML(cs)}
      <div class="card"><h2>Complaints by workflow stage</h2>
        <div class="bars">${byStage.map(x => `<button class="bar-row" data-act="drillStage" data-stage="${x.s.k}"><span>${esc(stageLabel(x.s.k))}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${(x.n / maxS) * 100}%"></span></span><span class="n num">${x.n}</span></button>`).join('')}</div>
      </div>
    </div>
  </div>
  <div class="card section"><h2>${esc(t('recent'))}</h2>
    ${recent.length ? `<ul class="timeline">${recent.map(h => `<li><span class="muted small">${fmtDT(h.at)}</span><span>${caseLink(h.c)} · ${esc(h.note || stageLabel(h.stage))} <span class="muted small">— ${esc(nm(h.by))}</span></span></li>`).join('')}</ul>` : '<div class="empty">No activity yet.</div>'}
  </div>`;
};
ACT.drillStage = el => { S.filter = { stage: el.dataset.stage }; go('register'); };
ACT.goHref = el => { location.hash = el.dataset.href; };

function decisionSummaryHTML(cs) {
  const td = today(); const ms = td.slice(0, 8) + '01'; const y0 = addDays(td, -364);
  const fin = cs.map(c => ({ c, d: finalDecision(c) })).filter(x => x.d);
  const win = (from) => { const L = fin.filter(x => x.d.at.slice(0, 10) >= from); const lo = L.filter(x => x.d.outcome !== 'not_lodge'); const nl = L.filter(x => x.d.outcome === 'not_lodge'); const rt = cs.filter(c => vals(c.decisions).some(d => d.outcome === 'return_officer' && d.at.slice(0, 10) >= from)); return { lo, nl, rt, rate: pctOf(lo.length, lo.length + nl.length) }; };
  const m = win(ms), y = win(y0); const ids = a => a.map(x => (x.c || x).id).join(',');
  const cell = (list, label, tone) => `<button class="tile ${tone}" data-act="drill" data-ids="${ids(list)}" data-label="${esc(label)}" ${list.length ? '' : 'disabled'} style="padding:8px 10px"><div class="k">${esc(label.split(' — ')[0])}</div><div class="v num" style="font-size:22px">${list.length}</div></button>`;
  const bar = (w) => { const tot = w.lo.length + w.nl.length; return tot ? `<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:6px" title="${w.lo.length} lodged, ${w.nl.length} not lodged"><span style="width:${w.lo.length / tot * 100}%;background:#059669"></span><span style="width:${w.nl.length / tot * 100}%;background:#64748b"></span></div>` : ''; };
  return `<div class="card"><div class="card-head"><h2>Panel decisions</h2><a class="btn sm" href="#stats">Statistics</a></div>
    <div class="small muted" style="margin-bottom:6px"><b>This month</b> · lodgement rate ${m.rate == null ? '—' : m.rate + '%'}</div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr);margin-bottom:4px">${cell(m.lo, 'Lodged — this month', 'ok')}${cell(m.nl, 'Not lodged — this month', '')}${cell(m.rt, 'Returned — this month', 'warn')}</div>${bar(m)}
    <div class="small muted" style="margin:12px 0 6px"><b>Last 12 months</b> · lodgement rate ${y.rate == null ? '—' : y.rate + '%'}</div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr);margin-bottom:4px">${cell(y.lo, 'Lodged — last 12 months', 'ok')}${cell(y.nl, 'Not lodged — last 12 months', '')}${cell(y.rt, 'Returned — last 12 months', 'warn')}</div>${bar(y)}
    <div class="row small" style="gap:12px;margin-top:8px"><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:#059669"></span>Lodged</span><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:#64748b"></span>Not lodged</span><span class="muted">Lodgement rate = lodged ÷ (lodged + not lodged)</span></div></div>`;
}
function myCasesHTML() {
  const me = S.me.id; const td = today(); const wk = addDays(td, 7); const mine = vals(S.complaints).filter(c => c.assignedTo === me);
  const open = mine.filter(c => !isDone(c)); const ids = a => a.map(c => c.id).join(',');
  const monthStart = td.slice(0, 8) + '01';
  const doneMonth = mine.filter(c => { const r = c.panelRequest; return r && r.by === me && r.at >= monthStart; });
  const tiles = [
    ['Open cases', open, '', `${mine.length} assigned in total`],
    ['In preliminary review', open.filter(c => c.stage === 'prelim_review'), 'info', 'Review and prepare for the panel'],
    ['Returned for clarification', open.filter(c => ['further_work', 'further_investigation'].includes(c.stage)), 'warn', 'Clarify, then resubmit to the panel'],
    ['Waiting for information', open.filter(c => openReqs(c).length), 'warn', 'Open information requests'],
    ['With panel / Commission', open.filter(c => ['ready_panel', 'on_agenda', 'commission'].includes(c.stage)), 'ok', 'Awaiting a decision'],
    ['Due in 7 days', open.filter(c => c.nextActionDue && c.nextActionDue >= td && c.nextActionDue <= wk), 'warn', 'Next action deadline'],
    ['Overdue', open.filter(isOverdue), 'bad', 'Missed deadlines'],
    ['Interim letters to send', mine.filter(interimPending), 'warn', 'Commission has decided'],
  ];
  const byStage = STAGES.map(st => ({ st, n: open.filter(c => c.stage === st.k).length })).filter(x => x.n); const maxS = Math.max(1, ...byStage.map(x => x.n));
  const ageB = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['Over 90 days', 91, 1e9]].map(([l, a, b]) => ({ l, list: open.filter(c => { const d = workDays(c.dateReceived, td); return d >= a && d <= b; }) }));
  const maxA = Math.max(1, ...ageB.map(x => x.list.length));
  const upcoming = open.filter(c => c.nextActionDue).sort((a, b) => a.nextActionDue.localeCompare(b.nextActionDue)).slice(0, 6);
  return `<div class="card" style="margin-bottom:18px;border-top:5px solid var(--info-fill)"><div class="card-head"><h2>My assigned cases</h2><a class="btn sm" href="#register" data-act="drill" data-f="mine">Open my cases</a></div>
    <div class="tiles tiles4" style="margin-bottom:12px">${tiles.map(([k, list, tone, sub]) => `<button class="tile ${tone}" data-act="drill" data-ids="${ids(list)}" data-label="My cases: ${esc(k)}" ${list.length ? '' : 'disabled'}><div class="k">${esc(k)}</div><div class="v num">${list.length}</div><div class="s">${esc(sub)}</div></button>`).join('')}</div>
    ${open.length ? `<div class="grid3">
      <div><h3 style="margin-bottom:8px">By stage</h3><div class="bars">${byStage.map(x => `<button class="bar-row" data-act="drill" data-ids="${ids(open.filter(c => c.stage === x.st.k))}" data-label="My cases: ${esc(stageLabel(x.st.k))}"><span>${esc(stageLabel(x.st.k))}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${x.n / maxS * 100}%"></span></span><span class="n num">${x.n}</span></button>`).join('')}</div></div>
      <div><h3 style="margin-bottom:8px">Age since received <span class="muted small">(working days)</span></h3><div class="bars">${ageB.map(x => `<button class="bar-row" data-act="drill" data-ids="${ids(x.list)}" data-label="My cases: ${esc(x.l)}" ${x.list.length ? '' : 'disabled'}><span>${esc(x.l)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${x.list.length / maxA * 100}%;${x.l === 'Over 90 days' ? 'background:#dc2626' : ''}"></span></span><span class="n num">${x.list.length}</span></button>`).join('')}</div></div>
      <div><h3 style="margin-bottom:8px">Next deadlines</h3>${upcoming.length ? `<ul class="timeline">${upcoming.map(c => `<li style="grid-template-columns:96px 1fr"><span class="small" style="${c.nextActionDue < td ? 'color:#b91c1c;font-weight:700' : ''}">${fmtD(c.nextActionDue)}</span><span class="small"><a href="#case-${esc(c.id)}">${esc(c.regNo)}</a> · ${esc(c.nextAction || '')}</span></li>`).join('')}</ul>` : '<div class="empty">No deadlines set.</div>'}</div>
    </div>` : '<div class="empty">You have no open cases assigned.</div>'}</div>`;
}
function myTasks(cs) {
  const me = S.me.id; const td = today(); const soon = addDays(td, 3); const out = [];
  const mk = (o) => { if (o.due) { o.overdue = o.due < td; o.soon = !o.overdue && o.due <= soon; } out.push(o); };
  cs.forEach(c => {
    if (c.assignedTo === me && !isDone(c) && !openActions(c).some(a => a.owner === me && a.text === c.nextAction)) mk({ cid: c.id, text: c.nextAction || 'Preliminary review', sub: `${esc(c.regNo)} · ${esc(stageLabel(c.stage))}`, due: c.nextActionDue });
    if (c.assignedTo !== me) openActions(c).filter(a => a.owner === me).forEach(a => mk({ cid: c.id, text: a.text, sub: `${esc(c.regNo)} · Panel task`, due: a.due }));
    if (c.assignedTo === me) openReqs(c).forEach(r => mk({ cid: c.id, text: `Information awaited from ${r.to}`, sub: esc(c.regNo), due: r.due }));
    if (can('commission')) pendingCommission(c).forEach(d => mk({ href: '#commission', text: 'Record the Commission decision on the panel decision', sub: `${esc(c.regNo)} · Panel: ${esc(outcomeLabel(d.outcome))}`, tag: 'Commission' }));
    if (interimPending(c) && c.assignedTo === me) mk({ cid: c.id, text: `Send the interim letter (${c.interim.outcome === 'lodge' ? 'lodged' : 'not lodged'})`, sub: esc(c.regNo) + ' · Interim phase', due: c.interim.due });
    if (hasRole('investigation')) entries(c.referrals).filter(r => r.status === 'sent').forEach(r => mk({ href: '#referrals', text: 'Acknowledge investigation referral', sub: esc(c.regNo), tag: 'Referral' }));
    if (can('referralManage')) entries(c.referrals).filter(r => r.status === 'draft').forEach(r => mk({ cid: c.id, text: 'Send investigation referral', sub: esc(c.regNo), tag: 'Referral' }));
  });
  recsList().filter(r => r.owner === me && recOpen(r) && r.due && r.due <= soon).forEach(r => mk({ href: '#actions', text: `Follow up recommendation ${r.ref} with ${r.institution}`, sub: REC_TYPES[r.type]?.[0] || '', due: r.due }));
  { const x = (S.duty || {})[td]; if (x && x.officer === me) mk({ href: '#duty', text: vals(x.logs).length ? `1424 duty today — ${dutyCalls(x)} calls logged so far` : '1424 duty today — log the calls you receive', sub: `On duty ${dutyHours(td, x).slice(0, 2).join('–')}`, tag: '1424' }); const tm = addDays(td, 1); const y = (S.duty || {})[tm]; if (y && y.officer === me && !(x && x.officer === me)) mk({ href: '#duty', text: 'You are on 1424 duty tomorrow', sub: dutyHours(tm, y).slice(0, 2).join('–'), tag: '1424' }); }
  if (can('assign')) { const n = cs.filter(c => c.stage === 'registered').length; if (n) mk({ href: '#assign', text: `${n} complaint${n > 1 ? 's' : ''} awaiting assignment`, sub: 'Assignment queue', tag: 'Assign' }); }
  if (can('panelManage')) { const n = cs.filter(c => c.stage === 'ready_panel').length; if (n) mk({ href: '#panel', text: `${n} case${n > 1 ? 's' : ''} ready for the panel agenda`, sub: 'Panel preparation', tag: 'Agenda' }); }
  return out.sort((a, b) => (b.overdue - a.overdue) || String(a.due || '9999').localeCompare(String(b.due || '9999')));
}
function nextMeeting() { const td = today(); return vals(S.meetings).filter(m => (m.status === 'planned' || m.status === 'postponed') && m.date >= td).sort((a, b) => a.date.localeCompare(b.date))[0] || null; }
function outcomeLabel(k) { return cfg().outcomes.find(o => o.k === k)?.short || LEGACY_OUTCOMES[k] || k || '—'; }

/* ---------- Complaint register ---------- */
function filtered() {
  const f = S.filter || {}; const qq = normName(f.q);
  let list = visibleCases();
  if (f.ids) { const set = new Set(f.ids); list = list.filter(c => set.has(c.id)); }
  if (f.preset && PRESETS[f.preset]) list = list.filter(PRESETS[f.preset].fn);
  if (qq) list = list.filter(c => [c.regNo, c.cmsRef, c.confidential ? '' : cpOf(c).name, c.summary, c.subcategory, c.respondent?.name, detName(detOf(c)), cpOf(c).nid, ...victimsOf(c).map(v => v.name)].some(v => normName(v).includes(qq)));
  if (f.from) list = list.filter(c => (c.dateReceived || '') >= f.from);
  if (f.to) list = list.filter(c => (c.dateReceived || '') <= f.to);
  if (f.stage) list = list.filter(c => c.stage === f.stage);
  if (f.officer) list = list.filter(c => f.officer === '_none' ? !c.assignedTo : c.assignedTo === f.officer);
  if (f.category) list = list.filter(c => c.category === f.category);
  if (f.atoll) list = list.filter(c => c.atoll === f.atoll);
  if (f.meeting) list = list.filter(c => c.panelMeetingId === f.meeting || vals(c.decisions).some(d => d.meetingId === f.meeting));
  if (f.ref) list = list.filter(c => { const rs = vals(c.referrals); return f.ref === 'none' ? !rs.length : rs.some(r => r.status === f.ref); });
  if (f.flag === 'overdue') list = list.filter(isOverdue);
  if (f.flag === 'inactive') list = list.filter(isInactive);
  const sort = f.sort || 'received_desc';
  const cmp = { received_desc: (a, b) => String(b.dateReceived).localeCompare(String(a.dateReceived)) || String(b.regNo).localeCompare(String(a.regNo)), received_asc: (a, b) => String(a.dateReceived).localeCompare(String(b.dateReceived)), reg: (a, b) => String(a.regNo).localeCompare(String(b.regNo)), last_action: (a, b) => String(b.lastActionAt).localeCompare(String(a.lastActionAt)), due: (a, b) => String(a.nextActionDue || '9999').localeCompare(String(b.nextActionDue || '9999')) }[sort];
  return list.sort(cmp);
}
VIEWS.register = () => {
  const f = S.filter || {}; const c = cfg();
  const meetings = vals(S.meetings).sort((a, b) => b.date.localeCompare(a.date));
  const saved = Object.keys(S.prefs.filters || {});
  const scope = f.ids ? f.idsLabel : f.preset ? PRESETS[f.preset]?.label : '';
  return `<div class="page-head"><div><h1>${esc(t('register'))}</h1><p>${can('viewAll') ? 'Every registered complaint you are authorized to see.' : 'Complaints assigned to you, or with follow-up actions you own.'}</p></div>
    <div class="row">
      ${saved.length ? `<select id="savedF" data-on="change:loadSaved" aria-label="Saved filters"><option value="">Saved filters…</option>${saved.map(n => `<option>${esc(n)}</option>`).join('')}</select>` : ''}
      <button class="btn" data-act="saveFilter">Save filter</button>
      <button class="btn" data-act="exportReg" data-fmt="csv">${esc(t('export'))} CSV</button>
      <button class="btn" data-act="exportReg" data-fmt="xlsx">${esc(t('export'))} Excel</button>
    </div></div>
  ${scope ? `<div class="note row" style="margin-bottom:12px;justify-content:space-between"><span>Showing: <b>${esc(scope)}</b></span><button class="btn sm" data-act="clearScope">Show all</button></div>` : ''}
  <form class="filters" id="regFilters" data-on="submit:noop">
    <div class="f wide"><label for="r_q">${esc(t('search'))}</label><input id="r_q" name="q" type="search" value="${esc(f.q || '')}" placeholder="Reg. no., CMS ref, name, ID no. or summary" data-on="input:regFilter"></div>
    <div class="f"><label for="r_from">${esc(t('date_received'))} ${esc(t('from'))}</label><input id="r_from" name="from" type="date" value="${esc(f.from || '')}" data-on="change:regFilter"></div>
    <div class="f"><label for="r_to">${esc(t('to'))}</label><input id="r_to" name="to" type="date" value="${esc(f.to || '')}" data-on="change:regFilter"></div>
    <div class="f"><label for="r_stage">${esc(t('stage'))}</label>${selRaw('r_stage', 'stage', STAGES.map(s => [s.k, stageLabel(s.k)]), f.stage, t('all'))}</div>
    ${can('viewAll') ? `<div class="f"><label for="r_officer">${esc(t('officer'))}</label><select id="r_officer" name="officer" data-on="change:regFilter"><option value="">${esc(t('all'))}</option><option value="_none" ${f.officer === '_none' ? 'selected' : ''}>Unassigned</option>${staffIds('reg_officer', false).map(id => `<option value="${esc(id)}" ${f.officer === id ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select></div>` : ''}
    <div class="f"><label for="r_category">${esc(t('category'))}</label>${selRaw('r_category', 'category', c.categories, f.category, t('all'))}</div>
    <div class="f"><label for="r_atoll">${esc(t('atoll'))}</label>${selRaw('r_atoll', 'atoll', ATOLLS, f.atoll, t('all'))}</div>
    <div class="f"><label for="r_meeting">${esc(t('meeting'))}</label>${selRaw('r_meeting', 'meeting', meetings.map(m => [m.id, fmtD(m.date)]), f.meeting, t('all'))}</div>
    <div class="f"><label for="r_ref">Referral</label>${selRaw('r_ref', 'ref', [['none', 'No referral'], ...Object.entries(REF_STATUS).map(([k, v]) => [k, v[0]])], f.ref, t('all'))}</div>
    <div class="f"><label for="r_flag">Flags</label>${selRaw('r_flag', 'flag', [['overdue', 'Overdue'], ['inactive', `Inactive > ${c.sla.inactiveDays} days`]], f.flag, 'None')}</div>
    <div class="f"><label for="r_sort">Sort by</label>${selRaw('r_sort', 'sort', [['received_desc', 'Newest received'], ['received_asc', 'Oldest received'], ['reg', 'Registration no.'], ['last_action', 'Last action'], ['due', 'Next deadline']], f.sort || 'received_desc', '', false)}</div>
  </form>
  <div id="regTable">${registerTable()}</div>`;
};
function selRaw(id, name, options, val, blank = 'Select…', withBlank = true) { const opts = options.map(x => Array.isArray(x) ? x : [x, x]); return `<select id="${id}" name="${name}" data-on="change:regFilter">${withBlank ? `<option value="">${esc(blank)}</option>` : ''}${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
function registerTable() {
  const list = filtered(); const lim = S.regLimit || 100;
  if (!list.length) return `<div class="card empty">No complaints match these filters.${can('register') && !vals(S.complaints).length ? ' <a href="#new">Register the first complaint</a>.' : ''}</div>`;
  return `<div class="muted small" style="margin-bottom:6px">${list.length} complaint${list.length === 1 ? '' : 's'}</div>
  <div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('date_received'))}</th><th>${esc(t('complainant'))}</th><th>${esc(t('category'))}</th><th>${esc(t('officer'))}</th><th>${esc(t('stage'))}</th><th>${esc(t('last_action'))}</th><th>${esc(t('next_action'))}</th><th>${esc(t('meeting'))}</th></tr></thead><tbody>
  ${list.slice(0, lim).map(c => { const od = isOverdue(c); const m = c.panelMeetingId && S.meetings[c.panelMeetingId]; return `<tr class="click ${od ? 'overdue' : ''}" data-act="openCase" data-id="${esc(c.id)}">
    <td>${caseLink(c)}${c.cmsRef ? `<div class="muted small">${esc(c.cmsRef)}</div>` : ''}</td><td>${fmtD(c.dateReceived)}</td>
    <td>${esc(displayName(c))}</td><td>${esc(c.category || '—')}${c.subcategory ? `<div class="muted small">${esc(c.subcategory)}</div>` : ''}${c.category && !isCatalogued(c) ? ' ' + pill('Reclassify', 'warn') : ''}</td><td>${c.assignedTo ? esc(nm(c.assignedTo)) : '<span class="muted">Unassigned</span>'}</td>
    <td>${stagePill(c.stage)}${openReqs(c).length ? ` ${pill('Info awaited', 'warn')}` : ''}</td><td>${fmtD(c.lastActionAt)}</td>
    <td><div class="clip">${esc(c.nextAction || '—')}</div>${c.nextActionDue ? `<span class="small ${od ? '' : 'muted'}" style="${od ? 'color:var(--bad);font-weight:600' : ''}">${fmtD(c.nextActionDue)}</span>` : ''}</td>
    <td>${m ? fmtD(m.date) : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>
  ${list.length > lim ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-act="moreReg">Show ${Math.min(100, list.length - lim)} more</button></div>` : ''}`;
}
ON.regFilter = el => {
  S.filter = { ...S.filter, [el.name]: el.value || undefined };
  if (el.name === 'q') { clearTimeout(ON._qt); ON._qt = setTimeout(() => { $('#regTable').innerHTML = registerTable(); }, 160); }
  else $('#regTable').innerHTML = registerTable();
};
ON.noop = () => {};
ACT.moreReg = () => { S.regLimit = (S.regLimit || 100) + 100; $('#regTable').innerHTML = registerTable(); };
ACT.clearScope = () => { const f = { ...S.filter }; delete f.ids; delete f.idsLabel; delete f.preset; S.filter = f; render(); };
ACT.saveFilter = () => modal({ title: 'Save this filter', body: `<div class="form">${fld('Filter name', inp('name', '', { req: 'a name' }), { full: true, id: 'f_name' })}</div>`, onSubmit: async o => {
  const filters = { ...(S.prefs.filters || {}), [o.name]: { ...S.filter } };
  await savePrefs({ filters }); toast('Filter saved');
} });
ON.loadSaved = el => { const f = S.prefs.filters?.[el.value]; if (f) { S.filter = { ...f }; render(); } };
async function savePrefs(patch) { S.prefs = { ...S.prefs, ...patch }; if (!S.db || !S.me.cid) return; await q('prefs', () => S.db.doc(`data/users/${S.me.cid}/prefs`).set(S.prefs)); }
ACT.exportReg = el => {
  const list = filtered();
  const rows = [['Registration no.', 'CMS reference', 'Date received', 'Complainant', 'Main category', 'Subcategory', 'Issue ID', 'Atoll', 'Island', 'Respondent', 'Detention / institutional setting', 'Assigned officer', 'Stage', 'Last action', 'Next action', 'Next action due', 'Panel meeting', 'Open information requests', 'Referral status']];
  list.forEach(c => rows.push([c.regNo, c.cmsRef || '', c.dateReceived || '', displayName(c), c.category || '', c.subcategory || '', c.classification?.issueId || '', ATOLL[c.atoll] || '', c.island || '', c.respondent?.name || '', detOf(c) ? detName(detOf(c)) : '', c.assignedTo ? nm(c.assignedTo) : '', stageLabel(c.stage), (c.lastActionAt || '').slice(0, 10), c.nextAction || '', c.nextActionDue || '', c.panelMeetingId && S.meetings[c.panelMeetingId] ? S.meetings[c.panelMeetingId].date : '', openReqs(c).length, vals(c.referrals).map(r => REF_STATUS[r.status]?.[0]).join('; ')]));
  const fn = `FREMYS-register-${today()}`;
  if (el.dataset.fmt === 'xlsx') exportXLSX(fn + '.xlsx', [{ name: 'Complaint register', rows }]); else exportCSV(fn + '.csv', rows);
};

/* ---------- New complaint registration ---------- */
const NA_FIELDS = { nid: 'Complainant ID / passport no.', phone: 'Complainant contact number', address: 'Complainant address', victim: 'Victim details', respondent: 'Respondent / relevant party', location: 'Island / location', form: 'Completed complaint form' };
function naBox(k) { return `<label class="na"><input type="checkbox" name="na_${k}" id="na_${k}"> Not yet available</label>`; }
VIEWS.new = () => {
  if (!can('register')) return noAccess('Only Administrative Officers and System Administrators can register complaints.');
  const c = cfg(); startCls({}, () => $('#f_summary')?.value || '', null);
  return `<div class="page-head"><div><h1>${esc(t('new'))}</h1><p>Enter the details from the completed complaint form. Fields marked * are required. Tick <i>Not yet available</i> when the form does not contain a detail, rather than entering a placeholder.</p></div></div>
  <form class="card" id="newForm" data-on="submit:submitNew" novalidate>
    <div class="form">
      <fieldset><legend>Registration</legend>
        ${fld(t('reg_no'), `<input value="Assigned automatically on save (${esc(c.regPrefix)}-${new Date().getFullYear()}-NNNN)" disabled>`)}
        ${fld('Complaint reference (CMS or paper)', inp('cmsRef', '', { ph: 'e.g. existing CMS number' }), { id: 'f_cmsRef' })}
        ${fld(t('date_received'), inp('dateReceived', today(), { type: 'date', req: 'the date received', attrs: `max="${today()}"` }), { req: true, id: 'f_dateReceived' })}
        ${fld('Received via', sel('channel', c.channels, 'Walk-in'), { id: 'f_channel' })}
        ${fld('Received by', `<select id="f_receivedBy" name="receivedBy">${staffIds().map(id => `<option value="${esc(id)}" ${id === S.me.id ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select>`, { id: 'f_receivedBy' })}
      </fieldset>
      <fieldset><legend>${esc(t('complainant'))}</legend>
        <div class="f full"><label for="cp_q">Find an existing complainant record</label><div class="typeahead"><input id="cp_q" type="search" placeholder="Name, ID number or phone" data-on="input:personSearch" data-type="complainants" data-box="cpHits" autocomplete="off"><div id="cpHits" class="ta-list hidden"></div></div><input type="hidden" name="cp_id" id="cp_id"><div id="cpLinked" class="small"></div></div>
        ${fld('Full name', inp('c_name', '', { req: "the complainant's name" }), { req: true, id: 'f_c_name' })}
        ${fld('National ID / passport no.', inp('c_nid', '', { ph: 'A123456' }) + naBox('nid'), { id: 'f_c_nid' })}
        ${fld('Sex', sel('c_sex', SEXES), { id: 'f_c_sex' })}
        ${fld('Date of birth', inp('c_dob', '', { type: 'date', attrs: `max="${today()}"` }), { id: 'f_c_dob' })}
        ${fld('Nationality', inp('c_nat', 'Maldivian'), { id: 'f_c_nat' })}
        ${fld('Contact number', inp('c_phone', '', { type: 'tel', ph: '7XXXXXX' }) + naBox('phone'), { id: 'f_c_phone' })}
        ${fld('Email', inp('c_email', '', { type: 'email' }), { id: 'f_c_email' })}
        ${fld('Address', inp('c_address') + naBox('address'), { id: 'f_c_address' })}
        <div class="f full"><label class="na"><input type="checkbox" name="confidential" id="f_confidential"> Keep the complainant's identity confidential in lists, exports and statistics</label></div>
      </fieldset>
      <fieldset><legend>${esc(t('victim'))}</legend>
        <div class="f full"><label class="na"><input type="checkbox" name="victimSame" id="f_victimSame" checked data-on="change:toggleVictim"> The victim is the complainant</label></div>
        <div id="victimFields" class="hidden" style="display:contents">
          <div class="f full"><label for="v_q">Find an existing victim record</label><div class="typeahead"><input id="v_q" type="search" placeholder="Name, ID number or phone" data-on="input:personSearch" data-type="victims" data-box="vHits" autocomplete="off"><div id="vHits" class="ta-list hidden"></div></div><input type="hidden" name="v_id" id="v_id"><div id="vLinked" class="small"></div></div>
          ${fld('Victim name', inp('v_name') + naBox('victim'), { id: 'f_v_name' })}
          ${fld('National ID / passport no.', inp('v_nid'), { id: 'f_v_nid' })}
          ${fld('Sex', sel('v_sex', SEXES), { id: 'f_v_sex' })}
          ${fld('Date of birth', inp('v_dob', '', { type: 'date', attrs: `max="${today()}"` }), { id: 'f_v_dob' })}
          ${fld('Age (if date of birth unknown)', inp('v_age', '', { type: 'number', attrs: 'min="0" max="120"' }), { id: 'f_v_age' })}
          ${fld('Nationality', inp('v_nat', 'Maldivian'), { id: 'f_v_nat' })}
          ${fld('Contact number', inp('v_phone', '', { type: 'tel' }), { id: 'f_v_phone' })}
          ${fld('Relationship to complainant', inp('v_rel', '', { ph: 'e.g. son, employee, detainee' }), { id: 'f_v_rel' })}
          <div class="f full"><label>Groups</label><div class="checks">${VULN.map(g => `<label><input type="checkbox" data-multi="1" name="v_vuln" value="${esc(g)}"> ${esc(g)}</label>`).join('')}</div></div>
        </div>
      </fieldset>
      <fieldset><legend>Complaint</legend>
        ${fld(t('summary'), txt('summary', '', { req: 'a summary', rows: 4, ph: 'Brief description of what happened, when and who was involved' }), { req: true, full: true, id: 'f_summary' })}
        ${fld('Date of incident', inp('incidentDate', '', { type: 'date' }), { id: 'f_incidentDate' })}
        ${fld(t('atoll'), sel('atoll', ATOLLS) + naBox('location'), { id: 'f_atoll' })}
        ${fld(t('island'), inp('island', '', { ph: 'e.g. Hulhumalé, Thinadhoo' }), { id: 'f_island' })}
        ${fld(t('respondent'), inp('r_name', '', { ph: 'Person or organization involved' }) + naBox('respondent'), { id: 'f_r_name' })}
        ${fld('Respondent type', sel('r_type', ['Government institution', 'State-owned enterprise', 'Private company', 'Individual', 'Other']), { id: 'f_r_type' })}
      </fieldset>
      <fieldset><legend>Detention and institutional settings</legend>${detFieldsHTML(null)}</fieldset>
      <fieldset><legend>Classification (HRCM classification catalogue)</legend><div class="f full" id="clsBox">${clsEditorHTML()}</div></fieldset>
      <fieldset><legend>${esc(t('documents'))}</legend>
        <div class="f full checks"><label><input type="checkbox" name="formReceived" id="f_formReceived" checked> Completed complaint form received</label>${naBox('form')}</div>
        ${fld('Attach the complaint form and supporting evidence', fileInp('files'), { full: true, id: 'f_files', hint: 'PDF, image or text files up to 20 MB each.' })}
      </fieldset>
    </div>
    <div id="dupBox"></div>
    <div class="form-actions"><a class="btn" href="#dashboard">${esc(t('cancel'))}</a><button type="button" class="btn" data-act="checkDup">Check for duplicates</button><button type="submit" class="btn primary" id="newSave">Register complaint</button></div>
  </form>`;
};
ON.toggleVictim = el => { $('#victimFields').classList.toggle('hidden', el.checked); };
const PICK = { complainants: { box: 'cpHits', hid: 'cp_id', info: 'cpLinked', map: { name: 'c_name', nid: 'c_nid', sex: 'c_sex', dob: 'c_dob', nationality: 'c_nat', phone: 'c_phone', email: 'c_email', address: 'c_address' } },
  victims: { box: 'vHits', hid: 'v_id', info: 'vLinked', map: { name: 'v_name', nid: 'v_nid', sex: 'v_sex', dob: 'v_dob', age: 'v_age', nationality: 'v_nat', phone: 'v_phone' } } };
ON.personSearch = el => {
  const type = el.dataset.type; const box = $('#' + el.dataset.box); const hits = personMatches(type, el.value);
  if (!el.value.trim()) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = hits.length ? hits.map(p => { const n = PTYPE[type].cases(p.id).length; return `<button type="button" data-act="pickPerson" data-type="${type}" data-id="${esc(p.id)}"><span><b>${esc(p.name)}</b> <span class="muted small">${esc([p.nid, p.phone].filter(Boolean).join(' · '))} · ${n} complaint${n === 1 ? '' : 's'}</span></span></button>`; }).join('') : '<div class="empty" style="padding:10px">No existing record. Fill in the fields below to create one.</div>';
};
ACT.pickPerson = el => {
  const type = el.dataset.type; const P = PICK[type]; const p = (type === 'complainants' ? S.complainants : S.victims)[el.dataset.id];
  $('#' + P.box).classList.add('hidden'); $('#' + P.hid).value = el.dataset.id;
  Object.entries(P.map).forEach(([k, f]) => { const inpEl = $('#f_' + f); if (inpEl) { inpEl.value = p[k] ?? ''; inpEl.disabled = true; } });
  $('#' + P.info).innerHTML = `<span class="pill ok">Linked to existing record</span> <button type="button" class="btn link small" data-act="unpickPerson" data-type="${type}">Use a new record instead</button>`;
  if (type === 'victims') $$('input[name=v_vuln]').forEach(cb => { cb.checked = (p.vulnerable || []).includes(cb.value); cb.disabled = true; });
};
ACT.unpickPerson = el => { const P = PICK[el.dataset.type]; $('#' + P.hid).value = ''; $('#' + P.info).innerHTML = ''; Object.values(P.map).forEach(f => { const e = $('#f_' + f); if (e) { e.disabled = false; e.value = ''; } }); if (el.dataset.type === 'victims') $$('input[name=v_vuln]').forEach(cb => { cb.disabled = false; cb.checked = false; }); };
function newFormData(form) { const o = formObj(form); return o; }
/* A complainant can bring several different complaints. The same person (record, ID, phone or a very similar name) is only a
   potential duplicate when the complaint also looks the same: same respondent, same classification or a similar summary,
   and the earlier complaint is still open or was received within 180 days. Other earlier complaints are listed as information. */
function findDuplicates(o, excludeId, withInfo) {
  const r = cfg().dupRules; const name = normName(o.c_name); const ph = digits(o.c_phone); const nidv = String(o.c_nid || '').toUpperCase().replace(/\s/g, ''); const resp = normName(o.r_name);
  const draft = S.cls?.draft || {}; const words = x => new Set(normName(x).split(' ').filter(w => w.length > 3));
  const sw = words(o.summary); const simSummary = c => { if (sw.size < 4) return false; const cw = words(c.summary); let n = 0; sw.forEach(w => { if (cw.has(w)) n++; }); return n / Math.min(sw.size, cw.size || 1) >= 0.5; };
  const out = [], info = [];
  vals(S.complaints).forEach(c => {
    if (c.id === excludeId) return;
    const cp = cpOf(c); const cn = normName(cp.name); const age = Math.abs(dayDiff(c.dateReceived || today(), o.dateReceived || today()));
    const person = [];
    if (o.cp_id && c.complainantId === o.cp_id) person.push('same complainant');
    else if (r.nid && nidv && String(cp.nid || '').toUpperCase().replace(/\s/g, '') === nidv) person.push('same ID number');
    else if (r.phone && ph.length >= 7 && digits(cp.phone) === ph) person.push('same contact number');
    else if (r.fuzzyName && name.length > 5 && cn && lev(cn, name) <= 2 && age <= 90) person.push(cn === name ? 'same complainant name' : 'similar complainant name');
    const subject = [];
    if (resp && normName(c.respondent?.name) === resp) subject.push('same respondent');
    if (draft.issueId && c.classification?.issueId === draft.issueId) subject.push('same specific issue');
    else if (draft.catId && !draft.issueId && c.classification?.catId === draft.catId) subject.push('same main category');
    if (simSummary(c)) subject.push('similar summary');
    const why = [];
    if (r.cmsRef && o.cmsRef && String(c.cmsRef || '').trim().toLowerCase() === o.cmsRef.trim().toLowerCase()) why.push('same CMS reference');
    const recent = !isDone(c) || age <= 180;
    if (person.length && subject.length && recent && (r.nameRespondent || !subject.every(x => x === 'same respondent'))) why.push(...person, ...subject);
    if (why.length) out.push({ c, why: [...new Set(why)] });
    else if (person.length && (o.cp_id ? c.complainantId === o.cp_id : true)) info.push({ c, why: person });
  });
  return withInfo ? { dups: out, info } : out;
}
function prevHTML(info) {
  if (!info || !info.length) return '';
  return `<div class="note" style="margin-top:14px"><b>This complainant has ${info.length} other complaint${info.length > 1 ? 's' : ''}</b> on a different matter. This is for information only.
  <ul>${info.sort((a, b) => String(b.c.dateReceived).localeCompare(String(a.c.dateReceived))).slice(0, 6).map(x => `<li>${esc(x.c.regNo)} (${fmtD(x.c.dateReceived)}, ${esc(stageLabel(x.c.stage))}) — ${esc(x.c.subcategory || x.c.category || '')}${x.c.respondent?.name ? ' · ' + esc(x.c.respondent.name) : ''}${canSeeCase(x.c) ? ` · <a href="#case-${esc(x.c.id)}" target="_blank">open</a>` : ''}</li>`).join('')}</ul></div>`;
}
function dupHTML(d, info) {
  if (!d.length) return '<div class="note" style="margin-top:14px">No potential duplicates found with the configured matching rules.</div>' + prevHTML(info);
  return `<div class="note warn" style="margin-top:14px"><b>${d.length} potential duplicate${d.length > 1 ? 's' : ''} found.</b> FREMYS does not reject or merge records; check these before registering.
  <ul>${d.slice(0, 8).map(x => `<li>${esc(x.c.regNo)} (${fmtD(x.c.dateReceived)}, ${esc(stageLabel(x.c.stage))}) — ${esc(x.why.join(', '))}${canSeeCase(x.c) ? ` · <a href="#case-${esc(x.c.id)}" target="_blank">open</a>` : ''}</li>`).join('')}</ul>
  <label class="na"><input type="checkbox" id="dupAck" name="dupAck"> I have checked these and this is a separate complaint</label></div>${prevHTML(info)}`;
}
ACT.checkDup = () => { const f = $('#newForm'); const r = findDuplicates(newFormData(f), null, true); $('#dupBox').innerHTML = dupHTML(r.dups, r.info); };
ON.submitNew = async (form, e) => {
  e.preventDefault();
  const o = newFormData(form);
  const missing = $$('[data-required]', form).find(el => !String(el.value || '').trim());
  if (missing) { toast('Fill in ' + missing.dataset.required + '.', 'error'); missing.focus(); return; }
  if (!S.cls?.draft?.catId) { toast('Choose at least the main category under Classification.', 'error'); $('#cls_cat')?.focus(); return; }
  const dups = findDuplicates(o);
  if (dups.length && !($('#dupAck') && $('#dupAck').checked)) { $('#dupBox').innerHTML = dupHTML(dups, findDuplicates(o, null, true).info); toast('Review the potential duplicates, then confirm to continue.', 'error'); $('#dupBox').scrollIntoView({ behavior: 'smooth' }); return; }
  const btn = $('#newSave'); btn.disabled = true; btn.textContent = 'Registering…';
  try {
    const files = await uploadFiles(form.querySelector('#f_files').files);
    const regNo = await nextRegNo();
    const cid = 'c' + nid(); const at = nowISO();
    const cpId = o.cp_id || await createPerson('complainants', { name: o.c_name, nid: o.c_nid, sex: o.c_sex || '', dob: o.c_dob || '', nationality: o.c_nat || '', phone: o.c_phone, email: o.c_email, address: o.c_address, atoll: '', island: '', notes: '' });
    const victimLinks = {};
    if (!o.victimSame) { const vid = o.v_id || (o.v_name ? await createPerson('victims', { name: o.v_name, nid: o.v_nid, sex: o.v_sex || '', dob: o.v_dob || '', age: o.v_age || '', nationality: o.v_nat || '', phone: o.v_phone, email: '', address: '', atoll: '', island: '', vulnerable: o.v_vuln || [], notes: '' }) : null); if (vid) victimLinks[vid] = { rel: o.v_rel || '', addedAt: at, addedBy: S.me.id }; }
    const det = parseDet(o); if (det && !det.who) det.who = o.victimSame ? 'complainant' : 'victim';
    const miss = Object.keys(NA_FIELDS).filter(k => o['na_' + k]);
    if (!o.formReceived && !miss.includes('form')) miss.push('form');
    const docs = {}; files.forEach(f => { docs[nid('d')] = { ...f, type: /form/i.test(f.title) ? 'Original complaint form' : 'Supporting evidence', version: 1, author: S.me.id, source: 'Complainant', date: o.dateReceived, restricted: false, at }; });
    const h1 = nid('h'), h2 = nid('h');
    const c = {
      regNo, cmsRef: o.cmsRef || '', dateReceived: o.dateReceived, channel: o.channel || '', receivedBy: o.receivedBy || S.me.id, createdAt: at, createdBy: S.me.id,
      complainantId: cpId, confidential: !!o.confidential, victimSame: !!o.victimSame, victimLinks,
      summary: o.summary, classification: cleanCls(S.cls.draft), ...clsFields(S.cls.draft), incidentDate: o.incidentDate || '', atoll: o.atoll || '', island: o.island || '',
      respondent: { name: o.r_name || '', type: o.r_type || '' }, detention: det, missing: miss, dupWarnings: dups.map(d => d.c.id),
      stage: 'registered', assignedTo: null, nextAction: 'Assign to a Registration Officer', nextActionDue: addWorkDays(today(), cfg().sla.assignDays),
      lastActionAt: at, lastActionBy: S.me.id, docs,
      history: { [h1]: { at, by: S.me.id, stage: null, note: `Complaint received (${o.channel || 'form'}) on ${o.dateReceived}` }, [h2]: { at, by: S.me.id, stage: 'registered', note: `Registered as ${regNo}${dups.length ? ` — ${dups.length} potential duplicate(s) noted` : ''}` } },
    };
    await setDoc('complaints/' + cid, c);
    logA('complaint.register', cid, regNo);
    notify(staffIds('dg').concat(staffIds('director')), `New complaint ${regNo} is awaiting assignment`, cid);
    S.formLock = false; toast(`Registered ${regNo}`); go('case-' + cid);
  } catch (ex) { console.error(ex); toast(errText(ex), 'error'); btn.disabled = false; btn.textContent = 'Register complaint'; }
};

/* ---------- Assignment & workload ---------- */
VIEWS.assign = () => {
  // Registration Officers see only their own assignments, even if another role (panel member, support officer…) lets them see all complaints. Only people who can assign see everyone's.
  if (!can('assign')) return (hasRole('reg_officer') || can('viewAssigned')) ? myAssignView() : can('viewAll') ? myAssignView(true) : noAccess();
  const cs = visibleCases(); const queue = cs.filter(c => c.stage === 'registered').sort((a, b) => String(a.dateReceived).localeCompare(String(b.dateReceived)));
  const officers = staffIds('reg_officer'); const td = today();
  const load = officers.map(id => { const mine = cs.filter(c => c.assignedTo === id); const open = mine.filter(c => !isDone(c)); return { id, open: open.length, review: open.filter(c => ['prelim_review', 'further_work'].includes(c.stage)).length, ready: open.filter(c => ['ready_panel', 'on_agenda'].includes(c.stage)).length, overdue: open.filter(isOverdue).length, done: mine.filter(isDone).length }; });
  const asg = cs.flatMap(c => entries(c.assignments).map(a => ({ ...a, c }))).sort(byAt);
  const state = a => { if (a.c.assignedTo !== a.to) return ['Reassigned', 'muted']; if (['prelim_review', 'further_work'].includes(a.c.stage)) return a.c.nextActionDue && a.c.nextActionDue < td ? ['Overdue', 'bad'] : ['Pending', 'warn']; return ['Completed', 'ok']; };
  return `<div class="page-head"><div><h1>${esc(t('assign'))}</h1><p>Every registered complaint stays in this queue until a supervisor assigns it to a Registration Officer for preliminary review.</p></div></div>
  <div class="card"><div class="card-head"><h2>Awaiting assignment</h2>${pill(queue.length + ' in queue', queue.length ? 'warn' : 'ok')}</div>
    ${queue.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('date_received'))}</th><th>Waiting (working days)</th><th>${esc(t('category'))}</th><th>${esc(t('summary'))}</th><th></th></tr></thead><tbody>${queue.map(c => { const w = workDays(c.createdAt || c.dateReceived, td); return `<tr><td>${caseLink(c)}</td><td>${fmtD(c.dateReceived)}</td><td>${w > cfg().sla.assignDays ? pill(fmtN(w) + ' days', 'bad') : fmtN(w) + ' days'}</td><td>${esc(c.category)}</td><td><div class="clip">${esc(c.summary)}</div></td><td class="r">${can('assign') ? `<button class="btn sm primary" data-act="assignCase" data-id="${esc(c.id)}">Assign</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No complaints are waiting for assignment.</div>'}
  </div>
  <div class="card section"><h2>Registration Officer caseload</h2>
    ${officers.length ? `<div class="tbl-wrap"><table><thead><tr><th>Officer</th><th class="r">Open</th><th class="r">In review</th><th class="r">Ready / on agenda</th><th class="r">Overdue</th><th class="r">Completed</th></tr></thead><tbody>${load.map(l => `<tr class="click" data-act="drillOfficer" data-id="${esc(l.id)}"><td>${esc(nm(l.id))}</td><td class="r">${l.open}</td><td class="r">${l.review}</td><td class="r">${l.ready}</td><td class="r">${l.overdue ? pill(l.overdue, 'bad') : 0}</td><td class="r">${l.done}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No staff have the Registration Officer role yet. Add it under Administration.</div>'}
  </div>
  <div class="card section"><h2>Assignment history</h2>
    ${asg.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Complaint</th><th>Assigned to</th><th>By</th><th>Instructions / reason</th><th>Status</th></tr></thead><tbody>${asg.slice(0, 80).map(a => { const s = state(a); return `<tr><td>${fmtD(a.at)}</td><td style="white-space:nowrap">${caseLink(a.c)}</td><td>${esc(nm(a.to))}${a.prev ? `<div class="muted small">from ${esc(nm(a.prev))}</div>` : ''}</td><td>${esc(nm(a.by))}</td><td><div class="clip">${esc(a.reason ? 'Reassigned: ' + a.reason : a.instructions || '—')}</div></td><td>${pill(s[0], s[1])}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No assignments recorded yet.</div>'}
  </div>`;
};
function victimCell(c) {
  const show = !c.confidential || canSeeRestricted(c); const vs = victimsOf(c);
  if (!show) return '<span class="muted">Confidential</span>';
  const lock = c.confidential ? ' <span class="pill bad" style="font-size:10px;padding:0 5px">Confidential</span>' : '';
  if (!vs.length) return c.victimSame ? `${esc(cpOf(c).name || '—')}<div class="muted small">Complainant</div>${lock}` : '<span class="muted">Not recorded</span>';
  return vs.slice(0, 2).map(v => `${esc(v.name || '—')}${v.rel ? ` <span class="muted small">(${esc(v.rel)})</span>` : ''}`).join('<br>') + (vs.length > 2 ? `<div class="muted small">+${vs.length - 2} more</div>` : '') + lock;
}
function myPanelCasesHTML(mine) {
  const td = today(); const tab = S.myPanelTab || 'panel';
  const withPanel = mine.filter(c => ['ready_panel', 'on_agenda', 'commission'].includes(c.stage)).sort((a, b) => String(a.readyAt || '').localeCompare(String(b.readyAt || '')));
  const decided = mine.filter(c => finalDecision(c)).sort((a, b) => String(finalDecision(b).at).localeCompare(String(finalDecision(a).at)));
  const lastDec = c => entries(c.decisions).sort(byAt)[0];
  const commPill = d => !d ? '—' : !d.needsCommission ? pill(outcomeLabel(d.outcome), 'muted') : !d.commission ? pill('Awaiting Commission', 'info') : d.commission.status === 'approved' ? pill('Commission approved', 'ok') : pill('Commission changed to ' + outcomeLabel(d.commission.preferred), 'bad');
  const panelRows = withPanel.map(c => { const m = c.panelMeetingId && S.meetings[c.panelMeetingId]; const d = c.stage === 'commission' ? lastDec(c) : null; return `<tr class="click" data-act="openCase" data-id="${esc(c.id)}"><td>${caseLink(c)}<div class="muted small">${esc(c.subcategory || c.category || '')}</div></td><td>${victimCell(c)}</td><td>${stagePill(c.stage)}${c.panelRequest?.resubmission ? ' ' + pill('Resubmitted', 'warn') : ''}</td><td>${fmtD(c.readyAt)}</td><td>${m ? fmtD(m.date) : '<span class="muted">Not yet scheduled</span>'}</td><td>${d ? pill('Panel: ' + outcomeLabel(d.outcome), d.outcome === 'lodge' ? 'ok' : 'muted') : '—'}</td><td>${d ? commPill(d) : '—'}</td></tr>`; }).join('');
  const decRows = decided.map(c => { const f = finalDecision(c); const d = c.decisions[f.id]; return `<tr class="click" data-act="openCase" data-id="${esc(c.id)}"><td>${caseLink(c)}<div class="muted small">${esc(c.subcategory || c.category || '')}</div></td><td>${victimCell(c)}</td><td>${pill('Panel: ' + outcomeLabel(d.outcome), d.outcome === 'lodge' ? 'ok' : 'muted')}</td><td>${commPill(d)}</td><td>${f.outcome === 'not_lodge' ? pill('Not lodged', 'muted') : pill('Lodged', 'ok')}</td><td>${fmtD(f.at)}</td><td>${interimPending(c) ? (c.interim.due < td ? pill('Letter overdue', 'bad') : pill('Letter to send', 'warn')) : interimSent(c) ? pill('Letter sent ' + fmtD(c.interim.sentAt), 'ok') : '—'}</td></tr>`; }).join('');
  const approved = decided.filter(c => { const d = c.decisions[finalDecision(c).id]; return !d.needsCommission || (d.commission && d.commission.status === 'approved'); }).length;
  return `<div class="card section"><div class="card-head"><h2>My panel cases</h2><span class="muted small">${withPanel.length} with the panel or Commission · ${decided.length} decided${decided.length ? ` · ${approved} panel decision${approved === 1 ? '' : 's'} approved as made` : ''}</span></div>
    <div class="tabs" style="margin-bottom:10px"><button class="${tab === 'panel' ? 'on' : ''}" data-act="myPanelTab" data-tab="panel">With the panel / Commission<span class="cnt">${withPanel.length}</span></button><button class="${tab === 'decided' ? 'on' : ''}" data-act="myPanelTab" data-tab="decided">Decided by the Commission<span class="cnt">${decided.length}</span></button></div>
    ${tab === 'panel'
      ? (withPanel.length ? `<div class="tbl-wrap"><table><thead><tr><th>Complaint</th><th>${esc(t('victim'))}</th><th>${esc(t('stage'))}</th><th>Ready since</th><th>Panel meeting</th><th>Panel decision</th><th>Commission</th></tr></thead><tbody>${panelRows}</tbody></table></div>` : '<div class="empty">None of your complaints are with the panel or the Commission right now.</div>')
      : (decided.length ? `<div class="tbl-wrap"><table><thead><tr><th>Complaint</th><th>${esc(t('victim'))}</th><th>Panel decision</th><th>Commission</th><th>Final decision</th><th>Decided</th><th>Interim letter</th></tr></thead><tbody>${decRows}</tbody></table></div>` : '<div class="empty">No final decisions yet on your complaints.</div>')}
  </div>`;
}
ACT.myPanelTab = el => { S.myPanelTab = el.dataset.tab; render(); };
function myAssignView(noCases) {
  const me = S.me.id; const td = today(); const mine = vals(S.complaints).filter(c => c.assignedTo === me);
  const open = mine.filter(c => !isDone(c)).sort((a, b) => String(a.nextActionDue || '9999').localeCompare(String(b.nextActionDue || '9999')));
  const asg = mine.flatMap(c => entries(c.assignments).filter(a => a.to === me).map(a => ({ ...a, c }))).sort(byAt);
  const rows = [['Open', open.length, ''], ['In review', open.filter(c => ['prelim_review', 'further_work'].includes(c.stage)).length, 'info'], ['With panel / Commission', open.filter(c => ['ready_panel', 'on_agenda', 'commission'].includes(c.stage)).length, 'ok'], ['Overdue', open.filter(isOverdue).length, 'bad'], ['Completed', mine.filter(isDone).length, 'ok']];
  if (noCases && !mine.length) return `<div class="page-head"><div><h1>${esc(t('assign'))}</h1><p>Assignments are managed by the Director General, the Director and System Administrators.</p></div></div><div class="card empty">No complaints are assigned to you.</div>`;
  return `<div class="page-head"><div><h1>${esc(t('assign'))}</h1><p>Complaints assigned to you. Supervisors assign and reassign complaints; contact them if your workload needs adjusting.</p></div></div>
  <div class="tiles">${rows.map(([k, v, tone]) => `<div class="tile ${tone}" style="cursor:default"><div class="k">${esc(k)}</div><div class="v num">${v}</div></div>`).join('')}</div>
  <div class="card"><div class="card-head"><h2>My open complaints</h2>${pill(open.length + ' open', open.length ? 'info' : 'ok')}</div>
    ${open.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('victim'))}</th><th>${esc(t('date_received'))}</th><th>Assigned</th><th>${esc(t('category'))}</th><th>${esc(t('stage'))}</th><th>${esc(t('next_action'))}</th><th>${esc(t('due'))}</th></tr></thead><tbody>${open.map(c => { const od = isOverdue(c); return `<tr class="click ${od ? 'overdue' : ''}" data-act="openCase" data-id="${esc(c.id)}"><td style="white-space:nowrap">${caseLink(c)}</td><td>${victimCell(c)}</td><td>${fmtD(c.dateReceived)}</td><td>${fmtD(c.assignedAt)}</td><td>${esc(c.category || '—')}${c.subcategory ? `<div class="muted small">${esc(c.subcategory)}</div>` : ''}</td><td>${stagePill(c.stage)}</td><td><div class="clip">${esc(c.nextAction || '—')}</div>${c.stage === 'further_work' && c.clarification ? `<div class="small" style="color:#92400e;margin-top:3px"><b>Panel asked:</b> ${esc(c.clarification.text)}</div>` : ''}</td><td>${c.nextActionDue ? (c.nextActionDue < td ? pill(fmtD(c.nextActionDue), 'bad') : fmtD(c.nextActionDue)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">You have no open complaints assigned.</div>'}
  </div>
  ${myPanelCasesHTML(mine)}
  <div class="card section"><h2>My assignment history</h2>
    ${asg.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Complaint</th><th>${esc(t('victim'))}</th><th>Assigned by</th><th>Instructions / reason</th><th>${esc(t('stage'))}</th></tr></thead><tbody>${asg.slice(0, 100).map(a => `<tr class="click" data-act="openCase" data-id="${esc(a.c.id)}"><td>${fmtD(a.at)}</td><td>${caseLink(a.c)}</td><td>${victimCell(a.c)}</td><td>${esc(nm(a.by))}${a.prev ? `<div class="muted small">from ${esc(nm(a.prev))}</div>` : ''}</td><td><div class="clip">${esc(a.reason ? 'Reassigned: ' + a.reason : a.instructions || '—')}</div></td><td>${stagePill(a.c.stage)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No assignments yet.</div>'}
  </div>`;
}
ACT.drillOfficer = el => { S.filter = { officer: el.dataset.id, preset: 'open' }; go('register'); };
ACT.assignCase = el => openAssign(el.dataset.id);
function openAssign(cid) {
  const c = S.complaints[cid]; if (!c) return; const re = !!c.assignedTo; const cs = vals(S.complaints);
  const opts = staffIds('reg_officer').map(id => { const n = cs.filter(x => x.assignedTo === id && !isDone(x)).length; return [id, `${nm(id)} — ${n} open case${n === 1 ? '' : 's'}`]; });
  if (!opts.length) { toast('No active Registration Officers. Add the role to staff under Administration.', 'error'); return; }
  modal({ title: `${re ? 'Reassign' : 'Assign'} ${c.regNo}`, body: `<div class="form">
    ${fld('Registration Officer', sel('to', opts, '', { req: 'an officer' }), { req: true, full: true, id: 'f_to' })}
    ${re ? fld('Reason for reassignment', txt('reason', '', { req: 'the reason for reassignment' }), { req: true, full: true, id: 'f_reason' }) : ''}
    ${fld('Instructions', txt('instructions', '', { ph: 'Anything the officer should know or do first' }), { full: true, id: 'f_instructions' })}
    ${fld('Preliminary review due', inp('due', addWorkDays(today(), cfg().sla.reviewDays), { type: 'date' }), { id: 'f_due' })}
  </div>`, submit: re ? 'Reassign' : 'Assign', onSubmit: async o => {
    if (o.to === c.assignedTo) throw new Error('This complaint is already assigned to that officer.');
    const aid = nid('as'); const stage = c.stage === 'registered' ? 'prelim_review' : c.stage;
    await updC(cid, { assignedTo: o.to, assignedAt: nowISO(), stage, nextAction: 'Preliminary review and preparation for the panel', nextActionDue: o.due || null,
      assignments: { [aid]: { to: o.to, by: S.me.id, at: nowISO(), instructions: o.instructions || '', reason: o.reason || '', prev: c.assignedTo || null } } },
      { stage: stage !== c.stage ? stage : null, note: `${re ? 'Reassigned' : 'Assigned'} to ${nm(o.to)}${o.reason ? ' — ' + o.reason : ''}`, action: re ? 'case.reassign' : 'case.assign' });
    notify(o.to, `${c.regNo} has been assigned to you for preliminary review`, cid);
    if (re && c.assignedTo) notify(c.assignedTo, `${c.regNo} has been reassigned to ${nm(o.to)}`, cid);
    toast(`${c.regNo} assigned to ${nm(o.to)}`);
  } });
}

/* ---------- Information requests (all cases) ---------- */
VIEWS.requests = () => {
  const td = today(); const f = S.reqFilter || 'open';
  const rows = visibleCases().flatMap(c => entries(c.requests).map(r => ({ ...r, c }))).filter(r => f === 'all' ? true : f === 'overdue' ? (['pending', 'partial'].includes(r.status) && r.due && r.due < td) : ['pending', 'partial'].includes(r.status)).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
  return `<div class="page-head"><div><h1>${esc(t('requests'))}</h1><p>Requests for additional information across all complaints you can see. Overdue requests are escalated to the Director General and Director.</p></div>
  <div class="row">${[['open', 'Open'], ['overdue', 'Overdue'], ['all', 'All']].map(([k, l]) => `<button class="btn ${f === k ? 'primary' : ''}" data-act="reqFilter" data-f="${k}">${l}</button>`).join('')}</div></div>
  ${rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Complaint</th><th>Requested from</th><th>Details</th><th>Requested</th><th>${esc(t('due'))}</th><th>Attempts</th><th>${esc(t('status'))}</th><th>Officer</th></tr></thead><tbody>${rows.map(r => { const od = ['pending', 'partial'].includes(r.status) && r.due && r.due < td; return `<tr class="click ${od ? 'overdue' : ''}" data-act="openCaseTab" data-id="${esc(r.c.id)}" data-tab="requests"><td>${caseLink(r.c)}</td><td>${esc(r.to)}<div class="muted small">${esc(r.toType || '')}</div></td><td><div class="clip">${esc(r.details)}</div></td><td>${fmtD(r.requestedAt)}</td><td>${od ? pill(fmtD(r.due), 'bad') : fmtD(r.due)}</td><td class="r">${Object.keys(r.attempts || {}).length}</td><td>${pill(REQ_STATUS[r.status]?.[0], REQ_STATUS[r.status]?.[1])}</td><td>${esc(nm(r.c.assignedTo))}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card empty">No information requests in this view.</div>'}`;
};
ACT.reqFilter = el => { S.reqFilter = el.dataset.f; render(); };

/* ---------- Notifications ---------- */
VIEWS.notifications = () => {
  const items = entries(S.notif.items).sort(byAt);
  return `<div class="page-head"><div><h1>${esc(t('notifications'))}</h1><p>Assignments, comments, information received, decisions and referrals that involve you.</p></div>${items.some(i => !i.read) ? '<button class="btn" data-act="readAll">Mark all as read</button>' : ''}</div>
  ${items.length ? `<div class="tbl-wrap"><table><tbody>${items.map(i => `<tr class="click" data-act="openNotif" data-id="${esc(i.id)}" data-cid="${esc(i.cid || '')}"><td style="width:12px">${i.read ? '' : '<span class="pill bad">New</span>'}</td><td>${esc(i.text)}<div class="muted small">${fmtDT(i.at)} · from ${esc(nm(i.by))}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">You have no notifications.</div>'}`;
};
ACT.readAll = async () => { const items = {}; entries(S.notif.items).forEach(i => { if (!i.read) items[i.id] = { read: true }; }); if (Object.keys(items).length) await updDoc('notif/' + S.me.id, { items }).catch(e => toast(errText(e), 'error')); };
ACT.openNotif = async el => { const id = el.dataset.id; if (!S.notif.items?.[id]?.read) updDoc('notif/' + S.me.id, { items: { [id]: { read: true } } }).catch(() => {}); if (el.dataset.cid && S.complaints[el.dataset.cid]) go('case-' + el.dataset.cid); };

function noAccess(msg) { return `<div class="card gate"><h2>Not available for your role</h2><p class="muted">${esc(msg || 'Your role does not include access to this page. Ask the System Administrator if you need it.')}</p><a class="btn" href="#dashboard">Back to overview</a></div>`; }
