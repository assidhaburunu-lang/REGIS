'use strict';
/* Work → Case Assignation: each Registration Officer's open cases and due dates side by side, a workload score,
   and the new cases waiting for an officer, with a suggested officer (the lightest workload) for each. */

// Workload points per open case, by how much officer work the stage still needs.
const LOAD_W = { registered: 0, prelim_review: 3, further_work: 3, ready_panel: 1, on_agenda: 1, commission: 0.5, further_investigation: 1, next_step: 0, referred: 0, closed: 0 };
function officerItems(id) {
  // Things with a due date the officer is responsible for: the next action on each open case, and pending interim letters.
  const out = [];
  vals(S.complaints).filter(c => c.assignedTo === id).forEach(c => {
    if (!isDone(c)) out.push({ c, kind: 'case', due: c.nextActionDue || null, text: c.nextAction || stageLabel(c.stage) });
    if (interimPending(c)) out.push({ c, kind: 'interim', due: c.interim.due || null, text: `Interim letter (${c.interim.outcome === 'lodge' ? 'lodged' : 'not lodged'})` });
  });
  return out.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
}
function officerLoad(id) {
  const td = today(); const items = officerItems(id); const soonEnd = addWorkDays(td, 5);
  const open = vals(S.complaints).filter(c => c.assignedTo === id && !isDone(c));
  const overdue = items.filter(x => x.due && x.due < td); const dueToday = items.filter(x => x.due === td); const soon = items.filter(x => x.due && x.due > td && x.due <= soonEnd);
  const interim = items.filter(x => x.kind === 'interim');
  const pts = open.reduce((s, c) => s + (LOAD_W[c.stage] ?? 1), 0) + interim.length + overdue.length * 2;
  const recent = vals(S.complaints).filter(c => c.assignedTo === id && c.assignedAt && workDays(c.assignedAt, td) <= 5).length;
  const duty = (S.duty || {})[td]?.officer === id ? 'today' : (S.duty || {})[addWorkDays(td, 1)]?.officer === id ? 'next' : '';
  const away = onLeave(id, td); const leaveNext = away ? null : leaveSoon(id, 5);
  return { id, items, open, overdue, dueToday, soon, interim, pts: Math.round(pts * 10) / 10, recent, duty, away, leaveNext, prelim: open.filter(c => ['prelim_review', 'further_work'].includes(c.stage)).length };
}
function rankedOfficers() {
  // Lightest first; officers on leave today go last. Being on 1424 duty today adds 3 points, leave starting within 5 working days adds 6.
  return staffIds('reg_officer').filter(id => (S.staff[id]?.roles || []).includes('reg_officer')).map(officerLoad).sort((a, b) => (!!a.away - !!b.away) || (asgScore(a) - asgScore(b)) || a.overdue.length - b.overdue.length || a.recent - b.recent);
}
function asgScore(o) { return o.pts + (o.duty === 'today' ? 3 : 0) + (o.leaveNext ? 6 : 0); }
function leaveTag(o) { return o.away ? `on leave until ${fmtD(o.away.to)}` : o.leaveNext ? `leave from ${fmtD(o.leaveNext.from)}` : ''; }

VIEWS.assignation = () => {
  if (!can('assign')) return noAccess();
  const td = today(); const offs = rankedOfficers(); const maxPts = Math.max(1, ...offs.map(o => o.pts));
  const queue = visibleCases().filter(c => c.stage === 'registered' && !c.assignedTo).sort((a, b) => String(a.dateReceived).localeCompare(String(b.dateReceived)));
  const days = []; for (let d = td, i = 0; i < 10; i++) { d = i ? addWorkDays(d, 1) : (isWorkDay(td) ? td : addWorkDays(td, 1)); days.push(d); }
  const best = offs.find(o => !o.away);
  // Spread suggestions: each new case is given to the officer who would then have the fewest points (a new case adds 3).
  const sim = Object.fromEntries(offs.filter(o => !o.away).map(o => [o.id, asgScore(o)])); const suggest = {};
  queue.forEach(c => { const id = Object.keys(sim).sort((a, b) => sim[a] - sim[b])[0]; if (id) { suggest[c.id] = id; sim[id] += 3; } }); S._asgSuggest = suggest;
  const dueCell = (o, d) => { const n = o.items.filter(x => x.due === d).length; return `<td class="r" style="${n ? `background:rgba(2,132,199,${Math.min(0.85, 0.18 + n * 0.17)});color:${n > 2 ? '#fff' : 'inherit'};font-weight:700` : ''}">${n || ''}</td>`; };
  const tone = x => (!x.due ? '' : x.due < td ? 'bad' : x.due === td ? 'warn' : x.due <= addWorkDays(td, 3) ? 'warn' : '');
  return `<div class="page-head"><div><h1>${esc(t('assignation'))}</h1><p>See every Registration Officer's open cases and due dates side by side, then assign new complaints to the officer with the lightest workload. Due dates count working days only.</p></div>
    <div class="row"><a class="btn" href="#assign">Assignment & workload</a></div></div>

  <div class="card"><div class="card-head"><h2>New complaints waiting for an officer <span class="badge">${queue.length}</span></h2>${best && queue.length ? `<div class="row"><span class="small">Lightest workload now: <b>${esc(nm(best.id))}</b> (${best.pts} points)</span>${queue.length > 1 ? `<button class="btn sm" data-act="asgAll">Assign all as suggested</button>` : ''}</div>` : ''}</div>
    ${queue.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>Received</th><th>Waiting</th><th>${esc(t('complainant'))}</th><th>${esc(t('category'))}</th><th style="min-width:290px">Assign to</th></tr></thead><tbody>${queue.map(c => {
      const w = workDays(c.dateReceived, td); const det = typeof detOf === 'function' && detOf(c);
      return `<tr><td style="white-space:nowrap">${caseLink(c)}${c.confidential ? ' ' + pill('Confidential', 'bad') : ''}</td><td>${fmtD(c.dateReceived)}</td><td class="${w > cfg().sla.assignDays ? 'bad-text' : ''}" style="${w > cfg().sla.assignDays ? 'color:#b91c1c;font-weight:700' : ''}">${w} working day${w === 1 ? '' : 's'}</td>
        <td dir="auto">${esc(displayName(c))}</td><td class="small">${esc(c.category || '—')}${det ? `<div class="muted">${esc(detName(det))}</div>` : ''}</td>
        <td><div class="row" style="gap:6px;flex-wrap:nowrap"><select aria-label="Officer for ${esc(c.regNo)}" id="asg_${esc(c.id)}" style="min-width:190px">${offs.map((o, i) => `<option value="${esc(o.id)}" ${suggest[c.id] === o.id ? 'selected' : ''}>${esc(nm(o.id))} · ${o.pts} pts${o.duty === 'today' ? ' · 1424 today' : ''}${leaveTag(o) ? ' · ' + leaveTag(o) : ''}${suggest[c.id] === o.id ? ' (suggested)' : ''}</option>`).join('')}</select><button class="btn sm primary" data-act="asgGo" data-id="${esc(c.id)}">Assign…</button></div></td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty">No new complaints are waiting for an officer.</div>'}
  </div>

  <div class="card section"><div class="card-head"><h2>Due dates in the next 10 working days</h2><span class="muted small">Number of case actions and interim letters due per officer per day</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Officer</th><th class="r">Overdue</th>${days.map(d => `<th class="r" style="white-space:nowrap">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wday(d)]}<br>${fmtD(d).slice(0, 6)}</th>`).join('')}<th class="r">No date</th></tr></thead><tbody>
      ${offs.map(o => `<tr><td style="white-space:nowrap"><a href="#user-${esc(o.id)}">${esc(nm(o.id))}</a></td><td class="r" style="${o.overdue.length ? 'color:#b91c1c;font-weight:700' : ''}">${o.overdue.length || ''}</td>${days.map(d => dueCell(o, d)).join('')}<td class="r muted">${o.items.filter(x => !x.due).length || ''}</td></tr>`).join('')}
    </tbody></table></div></div>

  <div class="asg-grid section">${offs.map((o, i) => `<div class="card asg-card">
      <div class="card-head" style="align-items:flex-start"><div><h2 style="margin:0">${esc(nm(o.id))}</h2><div class="small muted">${o.open.length} open case${o.open.length === 1 ? '' : 's'} · ${o.recent} assigned in the last 5 working days${o.duty === 'today' ? ' · <b style="color:#9a3412">on 1424 duty today</b>' : o.duty === 'next' ? ' · on 1424 duty next working day' : ''}</div></div>
        ${o.away ? pill('On leave until ' + fmtD(o.away.to), 'bad') : o.leaveNext ? pill('Leave from ' + fmtD(o.leaveNext.from), 'warn') : i === 0 && queue.length ? pill('Lightest workload', 'ok') : ''}</div>
      <div class="asg-load"><div class="bar-track"><span class="bar-fill" style="display:block;width:${o.pts / maxPts * 100}%;background:${o.pts / maxPts > 0.75 ? '#dc2626' : o.pts / maxPts > 0.45 ? '#d97706' : '#16a34a'}"></span></div><b>${o.pts}</b><span class="small muted">pts</span></div>
      <div class="asg-stats"><span><b>${o.prelim}</b> in review</span><span style="${o.overdue.length ? 'color:#b91c1c' : ''}"><b>${o.overdue.length}</b> overdue</span><span><b>${o.dueToday.length}</b> due today</span><span><b>${o.soon.length}</b> due in 5 days</span><span><b>${o.interim.length}</b> interim letters</span></div>
      ${o.items.length ? `<div class="tbl-wrap asg-list"><table><thead><tr><th>Case</th><th>Due</th><th>Next action</th></tr></thead><tbody>${o.items.slice(0, 12).map(x => `<tr class="click" data-act="openCase" data-id="${esc(x.c.id)}"><td style="white-space:nowrap">${caseLink(x.c)}<div>${stagePill(x.c.stage)}</div></td><td style="white-space:nowrap">${x.due ? pill(fmtD(x.due), tone(x)) : '<span class="muted">—</span>'}${x.due && x.due < td ? `<div class="small" style="color:#b91c1c">${workDays(x.due, td)} working day${workDays(x.due, td) === 1 ? '' : 's'} late</div>` : ''}</td><td class="small">${esc(x.text)}</td></tr>`).join('')}</tbody></table></div>${o.items.length > 12 ? `<p class="small muted" style="margin:6px 0 0">and ${o.items.length - 12} more · <a href="#user-${esc(o.id)}">see all</a></p>` : ''}`
        : '<div class="empty small">No open cases.</div>'}
    </div>`).join('') || '<div class="card"><div class="empty">No active Registration Officers. Give staff the Registration Officer role under Administration.</div></div>'}</div>
  <p class="small muted">Workload points: 3 for each case in preliminary review or returned for clarification, 1 for each case ready for or on a panel agenda, 0.5 for each awaiting the Commission, 1 for each interim letter to send, and 2 more for each overdue item. The suggested officer has the fewest points; being on 1424 duty today adds 3 and leave starting within 5 working days adds 6. Officers on leave today (Staff leave calendar) are never suggested.</p>`;
};
ACT.asgGo = el => { const id = el.dataset.id; const to = $('#asg_' + id)?.value; openAssign(id, to); };
ACT.asgAll = () => {
  const plan = visibleCases().filter(c => c.stage === 'registered' && !c.assignedTo).map(c => [c, $('#asg_' + c.id)?.value || (S._asgSuggest || {})[c.id]]).filter(x => x[1]);
  if (!plan.length) return;
  const by = {}; plan.forEach(([, to]) => { by[to] = (by[to] || 0) + 1; });
  confirmBox('Assign all as suggested', `Assign ${plan.length} complaints as shown in the list: ${Object.entries(by).map(([id, n]) => `${nm(id)} ${n}`).join(', ')}. Each officer is notified and the preliminary review is due in ${cfg().sla.reviewDays} working days.`, 'Assign all', async () => {
    let n = 0; for (const [c, to] of plan) { await assignComplaint(c, to); n++; }
    toast(`${n} complaint${n === 1 ? '' : 's'} assigned`);
  });
};
