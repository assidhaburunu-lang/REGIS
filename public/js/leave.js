'use strict';
/* Reference → Staff leave calendar. Staff record their planned leave; the Case Assignation page and the 1424 duty rota
   use it so that cases are not assigned to, and duty is not scheduled for, someone who is away. */

const LEAVE_TYPES = { annual: ['Annual leave', '#0284c7'], sick: ['Sick leave', '#dc2626'], family: ['Family responsibility leave', '#7c3aed'], maternity: ['Maternity / paternity leave', '#db2777'], training: ['Training or official travel', '#d97706'], other: ['Other absence', '#64748b'] };
const canManageLeave = () => can('assign') || can('dutySchedule') || can('admin');
function leaveList() { return Object.entries(S.leave || {}).map(([id, l]) => ({ id, ...l })).filter(l => l.status !== 'cancelled' && S.staff[l.staffId]); }
// The leave record covering this person on this date, or null.
function onLeave(staffId, d) { d = String(d).slice(0, 10); return leaveList().find(l => l.staffId === staffId && l.from <= d && l.to >= d) || null; }
// The next leave that starts within n working days (or is running now).
function leaveSoon(staffId, n = 5) { const td = today(); const end = addWorkDays(td, n); return leaveList().filter(l => l.staffId === staffId && l.to >= td && l.from <= end).sort((a, b) => a.from.localeCompare(b.from))[0] || null; }
const leaveWorkDays = l => { let n = 0; for (let d = l.from; d <= l.to; d = addDays(d, 1)) if (isWorkDay(d)) n++; return n; };
const leaveText = l => `${LEAVE_TYPES[l.type]?.[0] || 'Leave'} ${fmtD(l.from)}${l.to !== l.from ? ' – ' + fmtD(l.to) : ''}`;

VIEWS.leave = () => {
  const v = S.leaveView || (S.leaveView = { anchor: today().slice(0, 8) + '01', who: 'reg' });
  const ym = v.anchor.slice(0, 7); const [y, m] = ym.split('-').map(Number); const dim = new Date(y, m, 0).getDate(); const days = [...Array(dim)].map((_, i) => `${ym}-${pad2(i + 1)}`); const td = today();
  const people = Object.entries(S.staff).filter(([id, s]) => s.active !== false && (v.who === 'all' || (s.roles || []).includes('reg_officer') || id === S.me.id)).sort((a, b) => ((b[1].roles || []).includes('reg_officer') - (a[1].roles || []).includes('reg_officer')) || String(a[1].fullName).localeCompare(String(b[1].fullName))).map(([id]) => id);
  const monthLeave = leaveList().filter(l => l.to >= days[0] && l.from <= days[dim - 1]);
  const upcoming = leaveList().filter(l => l.to >= td).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 30);
  const awayToday = leaveList().filter(l => l.from <= td && l.to >= td);
  const cell = (id, d) => { const l = onLeave(id, d); const we = !isWorkDay(d); const col = l ? LEAVE_TYPES[l.type]?.[1] || '#64748b' : '';
    return `<td class="lv-d ${we ? 'lv-we' : ''} ${d === td ? 'lv-today' : ''}" ${l ? `data-act="leaveOpen" data-id="${esc(l.id)}" title="${esc(nm(id))}: ${esc(leaveText(l))}${l.note ? ' — ' + esc(l.note) : ''}"` : (id === S.me.id || canManageLeave()) && d >= td ? `data-act="leaveAdd" data-s="${esc(id)}" data-d="${d}" title="Add leave for ${esc(nm(id))} on ${fmtD(d)}"` : ''}>${l ? `<span class="lv-bar" style="background:${col}"></span>` : ''}${(S.duty || {})[d]?.officer === id ? `<span class="lv-duty ${l ? 'clash' : ''}" title="1424 duty${l ? ' — clashes with leave' : ''}">D</span>` : ''}</td>`; };
  return `<div class="page-head"><div><h1>${esc(t('leave'))}</h1><p>Planned leave of staff. Case Assignation does not suggest an officer who is on leave, and the 1424 duty rota skips officers on leave. Add your own leave as soon as it is planned.</p></div>
    <div class="row"><button class="btn primary" data-act="leaveAdd" data-s="${esc(S.me.id)}">Add leave</button></div></div>
  <div class="tiles">
    <div class="tile ${awayToday.length ? 'warn' : ''}" style="cursor:default"><div class="k">Away today</div><div class="v num">${awayToday.length}</div><div class="s">${awayToday.map(l => esc(nm(l.staffId))).join(', ') || 'Everyone is in'}</div></div>
    <div class="tile" style="cursor:default"><div class="k">Leave this month</div><div class="v num">${monthLeave.reduce((s, l) => { let n = 0; for (let d = l.from < days[0] ? days[0] : l.from; d <= (l.to > days[dim - 1] ? days[dim - 1] : l.to); d = addDays(d, 1)) if (isWorkDay(d)) n++; return s + n; }, 0)}</div><div class="s">working days, all staff shown below</div></div>
    <div class="tile ${people.some(id => days.some(d => (S.duty || {})[d]?.officer === id && onLeave(id, d))) ? 'bad' : ''}" style="cursor:default"><div class="k">1424 duty clashes</div><div class="v num">${days.filter(d => { const o = (S.duty || {})[d]?.officer; return o && onLeave(o, d); }).length}</div><div class="s">duty days this month on someone's leave</div></div>
  </div>
  <div class="card section">
    <div class="card-head"><div class="row"><button class="btn sm" data-act="leaveNav" data-n="-1" aria-label="Previous month">‹</button><h2 style="min-width:170px;text-align:center">${MONTHS[m - 1]} ${y}</h2><button class="btn sm" data-act="leaveNav" data-n="1" aria-label="Next month">›</button><button class="btn sm" data-act="leaveNav" data-n="0">This month</button></div>
      <div class="row"><select aria-label="Staff shown" data-on="change:leaveWho"><option value="reg" ${v.who === 'reg' ? 'selected' : ''}>Registration Officers</option><option value="all" ${v.who === 'all' ? 'selected' : ''}>All staff</option></select></div></div>
    <div class="tbl-wrap lv-wrap"><table class="lv-tbl"><thead><tr><th class="lv-name">Staff</th>${days.map(d => `<th class="lv-h ${!isWorkDay(d) ? 'lv-we' : ''} ${d === td ? 'lv-today' : ''}" title="${holidayOf(d) ? esc(holidayOf(d).name) : ''}">${['S', 'M', 'T', 'W', 'T', 'F', 'S'][wday(d)]}<br>${+d.slice(8)}</th>`).join('')}<th class="r">Days</th></tr></thead>
      <tbody>${people.map(id => { const n = days.filter(d => onLeave(id, d) && isWorkDay(d)).length; return `<tr><td class="lv-name">${esc(nm(id))}</td>${days.map(d => cell(id, d)).join('')}<td class="r">${n || ''}</td></tr>`; }).join('') || `<tr><td colspan="${dim + 2}" class="empty">No staff to show.</td></tr>`}</tbody></table></div>
    <div class="row small" style="gap:12px;margin-top:8px">${Object.values(LEAVE_TYPES).map(([l, c]) => `<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:14px;height:8px;border-radius:2px;background:${c}"></span>${esc(l)}</span>`).join('')}<span><span class="lv-duty" style="position:static;display:inline-flex">D</span> 1424 duty</span><span><span class="lv-duty clash" style="position:static;display:inline-flex">D</span> duty during leave</span><span class="muted">Shaded columns: Friday, Saturday and public holidays. Click an empty future day to add leave, or a coloured day to change it.</span></div>
  </div>
  <div class="card section"><h2>Upcoming leave</h2>${upcoming.length ? `<div class="tbl-wrap"><table><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th class="r">Working days</th><th>Note</th><th>Effect</th><th></th></tr></thead><tbody>${upcoming.map(l => {
      const clash = Object.entries(S.duty || {}).filter(([d, x]) => x.officer === l.staffId && d >= l.from && d <= l.to).map(([d]) => d);
      const open = vals(S.complaints).filter(c => c.assignedTo === l.staffId && !isDone(c) && c.nextActionDue && c.nextActionDue >= l.from && c.nextActionDue <= l.to).length;
      return `<tr><td>${esc(nm(l.staffId))}</td><td><span class="pill" style="background:${LEAVE_TYPES[l.type]?.[1]};color:#fff">${esc(LEAVE_TYPES[l.type]?.[0] || l.type)}</span></td><td>${fmtD(l.from)}</td><td>${fmtD(l.to)}</td><td class="r">${leaveWorkDays(l)}</td><td class="small">${esc(l.note || '')}</td>
        <td class="small">${clash.length ? `<span style="color:#b91c1c;font-weight:700">${clash.length} 1424 duty day${clash.length === 1 ? '' : 's'} to reassign</span><br>` : ''}${open ? `${open} case deadline${open === 1 ? '' : 's'} fall in this leave` : ''}${!clash.length && !open ? '<span class="muted">—</span>' : ''}</td>
        <td class="r">${l.staffId === S.me.id || canManageLeave() ? `<button class="btn sm" data-act="leaveOpen" data-id="${esc(l.id)}">Edit</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No upcoming leave recorded.</div>'}</div>`;
};
ACT.leaveNav = el => { const v = S.leaveView; const n = +el.dataset.n; if (!n) v.anchor = today().slice(0, 8) + '01'; else { const d = new Date(v.anchor + 'T12:00:00'); d.setMonth(d.getMonth() + n); v.anchor = localDate(d).slice(0, 8) + '01'; } render(); };
ON.leaveWho = el => { S.leaveView.who = el.value; render(); };
ACT.leaveAdd = el => leaveForm(null, el.dataset.s || S.me.id, el.dataset.d);
ACT.leaveOpen = el => { const l = (S.leave || {})[el.dataset.id]; if (l) leaveForm(el.dataset.id, l.staffId); };
function leaveForm(id, staffId, date) {
  const l = id ? S.leave[id] : null; const mine = (l ? l.staffId : staffId) === S.me.id; const edit = mine || canManageLeave();
  if (!edit) { toast(l ? `${nm(l.staffId)}: ${leaveText(l)}` : 'You can only add your own leave.', 'info'); return; }
  const who = canManageLeave() ? `<select id="f_staff" name="staffId">${Object.entries(S.staff).filter(([, s]) => s.active !== false).sort((a, b) => String(a[1].fullName).localeCompare(String(b[1].fullName))).map(([sid]) => `<option value="${esc(sid)}" ${sid === (l?.staffId || staffId) ? 'selected' : ''}>${esc(nm(sid))}</option>`).join('')}</select>` : `<input type="hidden" name="staffId" value="${esc(S.me.id)}"><div>${esc(nm(S.me.id))}</div>`;
  modal({ title: l ? 'Leave' : 'Add leave', body: `<div class="form">
    ${fld('Staff member', who, { id: 'f_staff' })}${fld('Type', sel('type', Object.entries(LEAVE_TYPES).map(([k, [lab]]) => [k, lab]), l?.type || 'annual'), { id: 'f_type' })}
    ${fld('First day', inp('from', l?.from || date || '', { type: 'date', req: 'the first day' }), { req: true, id: 'f_from' })}${fld('Last day', inp('to', l?.to || date || '', { type: 'date', req: 'the last day' }), { req: true, id: 'f_to' })}
    ${fld('Note (optional)', inp('note', l?.note || '', { ph: 'e.g. travelling abroad, cover arranged with …' }), { full: true, id: 'f_note' })}
    <div class="f full small muted">Leave is visible to all staff. Do not write medical or other private details in the note.</div></div>`,
    submit: 'Save', onSubmit: async o => {
      if (o.to < o.from) throw new Error('The last day is before the first day.'); if (dayDiff(o.from, o.to) > 366) throw new Error('Leave can be at most a year long.');
      const sid = canManageLeave() ? o.staffId : S.me.id;
      const overlap = leaveList().find(x => x.id !== id && x.staffId === sid && x.from <= o.to && x.to >= o.from); if (overlap) throw new Error(`This overlaps ${nm(sid)}'s ${leaveText(overlap)}.`);
      const lid = id || nid('lv'); await setDoc('leave/' + lid, { staffId: sid, type: o.type, from: o.from, to: o.to, note: o.note || '', status: 'planned', by: l?.by || S.me.id, at: l?.at || nowISO(), updatedBy: S.me.id, updatedAt: nowISO() });
      logA(id ? 'leave.update' : 'leave.add', null, `${nm(sid)} ${o.from}..${o.to}`);
      const clash = Object.entries(S.duty || {}).filter(([d, x]) => x.officer === sid && d >= o.from && d <= o.to).map(([d]) => d);
      if (clash.length) { const sched = staffIds('dg').concat(staffIds('director')).filter(x => x !== S.me.id); notify(sched, `${nm(sid)} is on leave on ${clash.length} scheduled 1424 duty day${clash.length === 1 ? '' : 's'} (${fmtD(clash[0])}${clash.length > 1 ? ' …' : ''}). Please reassign.`, null); }
      toast(clash.length ? `Leave saved. ${clash.length} 1424 duty day${clash.length === 1 ? '' : 's'} now need another officer.` : 'Leave saved');
    },
    foot: l ? `<button type="button" class="btn danger" data-act="leaveDel" data-id="${esc(id)}">Delete leave</button>` : '' });
}
ACT.leaveDel = async el => { const l = S.leave[el.dataset.id]; if (!l || !confirm(`Delete ${nm(l.staffId)}'s ${leaveText(l)}?`)) return; await delDoc('leave/' + el.dataset.id); logA('leave.delete', null, `${nm(l.staffId)} ${l.from}..${l.to}`); closeModal(); toast('Leave deleted'); };
