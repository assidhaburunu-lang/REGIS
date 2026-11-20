'use strict';
/* 1424 duty: Registration Officers staff the 1424 line on a rota. Weekdays 08:00–24:00; Friday, Saturday and public holidays 14:00–24:00.
   Each officer covers a block of consecutive days (default 3), then the next officer takes over. Directors schedule; officers log calls. */

const DUTY_COLORS = ['#0369a1', '#c2410c', '#047857', '#7c3aed', '#be123c', '#0f766e', '#a16207', '#4338ca', '#9d174d', '#15803d'];
const CALL_TYPES = [['complaint', 'New complaint'], ['enquiry', 'Enquiry / advice'], ['followup', 'Follow-up on a case'], ['referral', 'Referred elsewhere'], ['other', 'Other']];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = d => new Date(d + 'T12:00:00').getDay();
function dutyHours(d, day) { const weekend = dow(d) === 5 || dow(d) === 6 || (day && day.holiday) || !!holidayOf(d); return weekend ? ['14:00', '24:00', 10] : ['08:00', '24:00', 16]; }
function dutyDay(d) { return (S.duty || {})[d] || null; }
const dutyCalls = day => vals(day && day.logs).reduce((s, l) => s + (Number(l.count) || 0), 0);
function dutyColor(id) { const ids = staffIds('reg_officer', false).sort(); const i = ids.indexOf(id); return DUTY_COLORS[(i < 0 ? Math.abs([...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0)) : i) % DUTY_COLORS.length]; }
const canSchedule = () => can('dutySchedule');
const canLogDuty = (d, day) => !!day && (day.officer === S.me.id || can('supervise') || can('admin')) && d <= today();
function weekStart(d) { return addDays(d, -dow(d)); }

VIEWS.duty = () => {
  if (!can('viewAll') && !can('viewAssigned')) return noAccess();
  const v = S.dutyView || (S.dutyView = { mode: 'month', anchor: today() });
  const td = today(); const me = S.me.id; const mine = Object.entries(S.duty || {}).filter(([d, x]) => x.officer === me).map(([d]) => d).sort();
  const next = mine.find(d => d >= td); const todayDay = dutyDay(td);
  const title = v.mode === 'month' ? `${MONTHS[+v.anchor.slice(5, 7) - 1]} ${v.anchor.slice(0, 4)}` : `Week of ${fmtD(weekStart(v.anchor))}`;
  return `<div class="page-head"><div><h1>${esc(t('duty'))}</h1><p>Registration Officers staff the 1424 line in rotation: weekdays 08:00–24:00, Friday, Saturday and public holidays 14:00–24:00. Each officer covers a block of days, then the next officer takes over.</p></div>
    <div class="row">${canSchedule() ? '<button class="btn primary" data-act="dutyRotate">Generate rotation</button>' : ''}<button class="btn" data-act="dutyExport">Export month</button></div></div>
  <div class="tiles">
    <div class="tile ${todayDay ? 'info' : 'warn'}" style="cursor:default"><div class="k">On duty today</div><div class="v" style="font-size:20px;margin-top:6px">${todayDay ? esc(nm(todayDay.officer)) : 'Not scheduled'}</div><div class="s">${todayDay ? dutyHours(td, todayDay).slice(0, 2).join('–') : canSchedule() ? 'Assign an officer' : 'Ask the Director to schedule'}</div></div>
    ${hasRole('reg_officer') ? `<div class="tile" style="cursor:default"><div class="k">My next duty</div><div class="v" style="font-size:20px;margin-top:6px">${next ? fmtD(next) : '—'}</div><div class="s">${next ? WD[dow(next)] + ' · ' + dutyHours(next, dutyDay(next)).slice(0, 2).join('–') : 'Nothing scheduled'}</div></div>` : ''}
    ${dutyMonthTiles(v.anchor.slice(0, 7))}
  </div>
  ${todayDay && todayDay.officer === me ? `<div class="note" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>You are on 1424 duty today, ${dutyHours(td, todayDay).slice(0, 2).join('–')}. Calls logged so far: <b>${dutyCalls(todayDay)}</b>.</span><button class="btn primary" data-act="dutyLog" data-d="${td}">Log calls</button></div>` : ''}
  <div class="card"><div class="card-head"><div class="row"><button class="btn sm" data-act="dutyNav" data-n="-1" aria-label="Previous">‹</button><h2 style="min-width:190px;text-align:center">${esc(title)}</h2><button class="btn sm" data-act="dutyNav" data-n="1" aria-label="Next">›</button><button class="btn sm" data-act="dutyToday">Today</button></div>
    <div class="row"><button class="btn sm ${v.mode === 'week' ? 'primary' : ''}" data-act="dutyMode" data-m="week">Week</button><button class="btn sm ${v.mode === 'month' ? 'primary' : ''}" data-act="dutyMode" data-m="month">Month</button></div></div>
    ${v.mode === 'month' ? dutyMonthHTML(v.anchor) : dutyWeekHTML(v.anchor)}
    <div class="row small" style="gap:12px;margin-top:10px">${staffIds('reg_officer').map(id => `<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:${dutyColor(id)}"></span>${esc(nm(id))}</span>`).join('')}<span class="muted">${canSchedule() ? 'Click a day to assign or change the officer.' : 'Click a day for details.'}</span></div>
  </div>
  ${dutyStatsHTML(v.anchor.slice(0, 7))}`;
};
function dutyMonthTiles(ym) {
  const days = Object.entries(S.duty || {}).filter(([d]) => d.startsWith(ym)); const calls = days.reduce((s, [, x]) => s + dutyCalls(x), 0);
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); const logged = days.filter(([d, x]) => d <= today() && vals(x.logs).length).length; const past = days.filter(([d]) => d <= today()).length;
  return `<div class="tile ok" style="cursor:default"><div class="k">Calls this month</div><div class="v num">${calls}</div><div class="s">${logged ? fmtN(calls / logged, 1) + ' per logged day' : 'None logged yet'}</div></div>
    <div class="tile ${days.length < dim ? 'warn' : ''}" style="cursor:default"><div class="k">Days scheduled</div><div class="v num">${days.length}/${dim}</div><div class="s">${dim - days.length ? dim - days.length + ' without an officer' : 'Whole month covered'}</div></div>
    <div class="tile ${past - logged > 0 ? 'bad' : ''}" style="cursor:default"><div class="k">Days not logged</div><div class="v num">${Math.max(0, past - logged)}</div><div class="s">Past duty days with no calls logged</div></div>`;
}
function dutyCell(d, compact) {
  const day = dutyDay(d); const td = today(); const [a, b] = dutyHours(d, day); const col = day ? dutyColor(day.officer) : null; const calls = dutyCalls(day);
  return `<button class="duty-cell ${d === td ? 'today' : ''} ${d < td ? 'past' : ''}" data-act="dutyDayOpen" data-d="${d}" style="${col ? `--dc:${col}` : ''}">
    <span class="dn">${+d.slice(8)}${day && day.holiday ? ' <span class="pill warn" style="font-size:10px;padding:0 5px">Holiday</span>' : ''}</span>
    ${day ? `<span class="who" style="background:${col}">${esc(nm(day.officer))}</span>${onLeave(day.officer, d) ? '<span class="small" style="color:#b91c1c;font-weight:700">On leave — reassign</span>' : ''}` : `<span class="muted small">${canSchedule() ? '+ Assign' : 'Unassigned'}</span>`}
    <span class="small muted">${a}–${b}</span>
    ${day && (d <= td) ? `<span class="small" style="font-weight:700;color:${vals(day.logs).length ? '#065f46' : '#b91c1c'}">${vals(day.logs).length ? calls + ' call' + (calls === 1 ? '' : 's') : 'Not logged'}</span>` : ''}
  </button>`;
}
function dutyMonthHTML(anchor) {
  const first = anchor.slice(0, 8) + '01'; const start = weekStart(first); const ym = anchor.slice(0, 7); let cells = '';
  for (let i = 0; i < 42; i++) { const d = addDays(start, i); if (i >= 35 && !d.startsWith(ym) && d > first) break; cells += d.startsWith(ym) ? dutyCell(d) : '<div class="duty-cell out"></div>'; }
  return `<div class="duty-grid">${WD.map((w, i) => `<div class="duty-head ${i >= 5 ? 'we' : ''}">${w}</div>`).join('')}${cells}</div>`;
}
function dutyWeekHTML(anchor) {
  const s0 = weekStart(anchor); const days = [...Array(7)].map((_, i) => addDays(s0, i));
  const hours = [...Array(17)].map((_, i) => 8 + i);
  return `<div class="duty-week">
    <div class="dw-hours"><div class="dw-h0"></div>${hours.slice(0, 16).map(h => `<div class="dw-h">${pad2(h)}:00</div>`).join('')}</div>
    ${days.map(d => { const day = dutyDay(d); const [a, , len] = dutyHours(d, day); const top = (parseInt(a) - 8) / 16 * 100; const col = day ? dutyColor(day.officer) : null; const calls = dutyCalls(day);
      return `<div class="dw-col ${d === today() ? 'today' : ''}"><div class="dw-day">${WD[dow(d)]}<br><b>${fmtD(d).slice(0, 6)}</b></div><div class="dw-body" data-act="dutyDayOpen" data-d="${d}">
        ${day ? `<div class="dw-block" style="top:${top}%;height:${len / 16 * 100}%;background:${col}"><b>${esc(nm(day.officer))}</b><span>${dutyHours(d, day).slice(0, 2).join('–')}</span>${d <= today() ? `<span>${vals(day.logs).length ? calls + ' calls' : 'Not logged'}</span>` : ''}${day.holiday ? '<span>Public holiday</span>' : ''}</div>` : `<div class="dw-empty" style="top:${top}%;height:${len / 16 * 100}%">${canSchedule() ? '+ Assign' : 'Unassigned'}</div>`}
      </div></div>`; }).join('')}
  </div>`;
}
ACT.dutyNav = el => { const v = S.dutyView; const n = +el.dataset.n; if (v.mode === 'month') { const d = new Date(v.anchor.slice(0, 8) + '15T12:00:00'); d.setMonth(d.getMonth() + n); v.anchor = localDate(d); } else v.anchor = addDays(v.anchor, 7 * n); render(); };
ACT.dutyToday = () => { S.dutyView.anchor = today(); render(); };
ACT.dutyMode = el => { S.dutyView.mode = el.dataset.m; render(); };

ACT.dutyDayOpen = el => {
  const d = el.dataset.d; const day = dutyDay(d); const [a, b] = dutyHours(d, day); const logs = entries(day && day.logs).sort((x, y) => String(x.at).localeCompare(String(y.at)));
  const byType = CALL_TYPES.map(([k, l]) => [l, logs.reduce((s, x) => s + (Number(x.types?.[k]) || 0), 0)]).filter(x => x[1]);
  const editable = canSchedule();
  modal({ title: `1424 duty — ${WD[dow(d)]} ${fmtD(d)}`, wide: true, body: `
    <dl class="kv"><dt>Hours</dt><dd>${a}–${b}${day && day.holiday ? ' (public holiday)' : dow(d) >= 5 ? ' (weekend)' : ''}</dd><dt>Officer on duty</dt><dd>${day ? `<b>${esc(nm(day.officer))}</b>${day.note ? ` <span class="muted small">— ${esc(day.note)}</span>` : ''}` : 'Not scheduled'}</dd>
      ${day ? `<dt>Calls logged</dt><dd><b>${dutyCalls(day)}</b>${byType.length ? ' · ' + byType.map(([l, n]) => `${esc(l)}: ${n}`).join(' · ') : ''}</dd>` : ''}</dl>
    ${logs.length ? `<h3 style="margin:12px 0 6px">Call log</h3><ul class="timeline">${logs.map(l => `<li><span class="small">${fmtDT(l.at)}</span><span><b>${l.count} call${l.count == 1 ? '' : 's'}</b>${l.note ? ' — ' + esc(l.note) : ''} <span class="muted small">— ${esc(nm(l.by))}</span></span></li>`).join('')}</ul>` : ''}
    ${editable ? `<h3 style="margin:16px 0 8px">Change the schedule for this day</h3><div class="form">
      ${fld('Officer on duty', `<select id="f_officer" name="officer"><option value="">— No one —</option>${staffIds('reg_officer').map(id => `<option value="${esc(id)}" ${day && day.officer === id ? 'selected' : ''}>${esc(nm(id))}${onLeave(id, d) ? ' — ON LEAVE' : ''}</option>`).join('')}</select>`, { id: 'f_officer' })}
      <div class="f"><label>&nbsp;</label><label class="na"><input type="checkbox" name="holiday" ${day && day.holiday ? 'checked' : ''}> Public holiday (14:00–24:00)</label></div>
      ${fld('Note (e.g. swap agreed)', inp('note', day?.note || ''), { full: true, id: 'f_note' })}</div>` : ''}`,
    submit: editable ? 'Save schedule' : null, onSubmit: editable ? async o => {
      if (!o.officer) { if (day) { await delDoc('duty/' + d); logA('duty.clear', null, d); } return; }
      { const lv = onLeave(o.officer, d); if (lv && !confirm(`${nm(o.officer)} is on leave on this day (${leaveText(lv)}). Schedule anyway?`)) return false; }
      await setDoc('duty/' + d, { ...(day || {}), date: d, officer: o.officer, holiday: !!o.holiday, note: o.note || '', logs: day?.logs || {}, by: S.me.id, at: nowISO() });
      logA('duty.assign', null, `${d}: ${nm(o.officer)}`); if (!day || day.officer !== o.officer) notify(o.officer, `You are on 1424 duty on ${fmtD(d)} (${dutyHours(d, { holiday: o.holiday }).slice(0, 2).join('–')})`, null);
    } : null,
    foot: canLogDuty(d, day) ? `<button type="button" class="btn primary" data-act="dutyLog" data-d="${d}">Log calls</button>` : '' });
};
ACT.dutyLog = el => {
  const d = el.dataset.d; const day = dutyDay(d); if (!day) return;
  modal({ title: `Log 1424 calls — ${fmtD(d)}`, body: `<p class="small muted" style="margin-top:0">Add the calls you received${dutyCalls(day) ? ` since your last entry (${dutyCalls(day)} logged so far today)` : ''}. You can log several times during your duty.</p><div class="form">
    ${fld('Number of calls', inp('count', '', { type: 'number', req: 'the number of calls', attrs: 'min="0" max="500"' }), { req: true, id: 'f_count' })}
    <div class="f full"><label>Of which (optional)</label><div class="form" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${CALL_TYPES.map(([k, l]) => `<div class="f"><label for="f_t_${k}" style="font-weight:400">${esc(l)}</label><input id="f_t_${k}" name="t_${k}" type="number" min="0" max="500"></div>`).join('')}</div></div>
    ${fld('Note', txt('note', '', { rows: 2, ph: 'e.g. two callers asked about the status of their complaint' }), { full: true, id: 'f_note' })}</div>`,
    submit: 'Save', onSubmit: async o => {
      const count = parseInt(o.count, 10); if (isNaN(count) || count < 0) throw new Error('Enter the number of calls (0 or more).');
      const types = Object.fromEntries(CALL_TYPES.map(([k]) => [k, parseInt(o['t_' + k], 10) || 0]).filter(([, n]) => n));
      if (Object.values(types).reduce((s, n) => s + n, 0) > count) throw new Error('The breakdown adds up to more than the number of calls.');
      await updDoc('duty/' + d, { logs: { [nid('l')]: { at: nowISO(), by: S.me.id, count, types, note: o.note || '' } } });
      logA('duty.calls', null, `${d}: ${count}`); toast(`${count} call${count === 1 ? '' : 's'} logged`);
    } });
};

ACT.dutyRotate = () => {
  const offs = staffIds('reg_officer');
  if (!offs.length) { toast('No active Registration Officers. Give officers the role under Administration.', 'error'); return; }
  const last = Object.keys(S.duty || {}).sort().pop(); const start = last && last >= today() ? addDays(last, 1) : today();
  modal({ title: 'Generate a duty rotation', wide: true, body: `<p class="small" style="margin-top:0">Officers take turns in the order below, each covering a block of consecutive days. Days that already have an officer are kept unless you choose to replace them.</p><div class="form">
    ${fld('Start date', inp('from', start, { type: 'date', req: 'a start date' }), { req: true, id: 'f_from' })}${fld('End date', inp('to', addDays(start, 55), { type: 'date', req: 'an end date' }), { req: true, id: 'f_to' })}
    ${fld('Days per officer', inp('block', '3', { type: 'number', attrs: 'min="1" max="14"' }), { id: 'f_block' })}
    <div class="f"><label>&nbsp;</label><label class="na"><input type="checkbox" name="overwrite"> Replace days that are already scheduled</label></div>
    <div class="f full"><label>Officers in rotation order</label><div id="rotList" class="stack" style="gap:4px">${offs.map((id, i) => `<div class="row rot-row" data-id="${esc(id)}" style="gap:6px"><input type="checkbox" checked aria-label="Include ${esc(nm(id))}"><span style="width:10px;height:10px;border-radius:2px;background:${dutyColor(id)}"></span><span style="flex:1">${esc(nm(id))}</span><button type="button" class="btn sm" data-act="rotMove" data-d="-1" aria-label="Move up">↑</button><button type="button" class="btn sm" data-act="rotMove" data-d="1" aria-label="Move down">↓</button></div>`).join('')}</div></div>
    <div class="f full"><span class="muted small">The rotation continues from whoever was on duty the day before the start date. On days an officer is on leave (Staff leave calendar), the next officer in the order covers that day.</span></div></div>`,
    submit: 'Create rotation', onSubmit: async (o, form) => {
      const order = $$('.rot-row', form).filter(r => r.querySelector('input').checked).map(r => r.dataset.id);
      if (!order.length) throw new Error('Include at least one officer.'); if (o.to < o.from) throw new Error('The end date is before the start date.');
      const block = Math.max(1, Math.min(14, parseInt(o.block, 10) || 3)); const span = dayDiff(o.from, o.to) + 1; if (span > 370) throw new Error('Choose a period of at most a year.');
      // continue from the previous officer's block
      let idx = 0, used = 0; const prev = dutyDay(addDays(o.from, -1));
      if (prev && order.includes(prev.officer)) { let k = 1; while (k < block && dutyDay(addDays(o.from, -1 - k))?.officer === prev.officer) k++; if (k >= block) idx = (order.indexOf(prev.officer) + 1) % order.length; else { idx = order.indexOf(prev.officer); used = k; } }
      let n = 0, covered = 0; const uncovered = [];
      for (let i = 0; i < span; i++) {
        const d = addDays(o.from, i); const cur = dutyDay(d); let officer = order[idx]; if (onLeave(officer, d)) { const alt = [...order.slice(idx + 1), ...order.slice(0, idx)].find(x => !onLeave(x, d)); if (alt) { officer = alt; covered++; } else uncovered.push(d); }
        if (!cur || o.overwrite) { await setDoc('duty/' + d, { ...(cur || {}), date: d, officer, holiday: cur?.holiday || false, note: cur?.note || '', logs: cur?.logs || {}, by: S.me.id, at: nowISO() }); n++; }
        used++; if (used >= block) { used = 0; idx = (idx + 1) % order.length; }
      }
      logA('duty.rotate', null, `${o.from}..${o.to}, ${block} days, ${order.length} officers`);
      notify(order, `1424 duty rota published ${fmtD(o.from)} – ${fmtD(o.to)}`, null);
      S.dutyView = { mode: 'month', anchor: o.from }; toast(`${n} duty day${n === 1 ? '' : 's'} scheduled${covered ? `; ${covered} day${covered === 1 ? '' : 's'} given to another officer because of leave` : ''}${uncovered.length ? `; everyone is on leave on ${uncovered.length} day${uncovered.length === 1 ? '' : 's'}` : ''}`);
    } });
};
ACT.rotMove = el => { const row = el.closest('.rot-row'); const d = +el.dataset.d; const sib = d < 0 ? row.previousElementSibling : row.nextElementSibling; if (sib) d < 0 ? sib.before(row) : sib.after(row); };

function dutyStatsHTML(ym) {
  const days = Object.entries(S.duty || {}).filter(([d]) => d.startsWith(ym)); const td = today();
  const by = {}; days.forEach(([d, x]) => { const e = by[x.officer] = by[x.officer] || { id: x.officer, days: 0, past: 0, logged: 0, calls: 0, hours: 0 }; e.days++; e.hours += dutyHours(d, x)[2]; if (d <= td) { e.past++; if (vals(x.logs).length) e.logged++; e.calls += dutyCalls(x); } });
  const rows = Object.values(by).sort((a, b) => b.calls - a.calls); const maxC = Math.max(1, ...rows.map(r => r.calls));
  const daily = days.filter(([d]) => d <= td).sort((a, b) => a[0].localeCompare(b[0])); const maxD = Math.max(1, ...daily.map(([, x]) => dutyCalls(x)));
  const types = CALL_TYPES.map(([k, l]) => ({ l, n: days.reduce((s, [, x]) => s + vals(x.logs).reduce((s2, g) => s2 + (Number(g.types?.[k]) || 0), 0), 0) })).filter(x => x.n); const maxT = Math.max(1, ...types.map(x => x.n));
  if (!days.length) return '';
  return `<div class="grid2 section">
    <div class="card"><h2>Officers this month</h2><div class="tbl-wrap"><table><thead><tr><th>Officer</th><th class="r">Duty days</th><th class="r">Hours</th><th class="r">Calls</th><th class="r">Calls / day</th><th class="r">Not logged</th><th style="width:18%"></th></tr></thead><tbody>${rows.map(r => `<tr><td style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${dutyColor(r.id)};margin-inline-end:6px"></span>${esc(nm(r.id))}</td><td class="r">${r.days}</td><td class="r">${r.hours}</td><td class="r"><b>${r.calls}</b></td><td class="r">${r.logged ? fmtN(r.calls / r.logged, 1) : '—'}</td><td class="r" style="${r.past - r.logged ? 'color:#b91c1c;font-weight:700' : ''}">${r.past - r.logged}</td><td><div class="bar-track"><span class="bar-fill" style="display:block;width:${r.calls / maxC * 100}%;background:${dutyColor(r.id)}"></span></div></td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h2>Calls per day</h2>${daily.length ? `<div class="duty-spark">${daily.map(([d, x]) => `<div title="${fmtD(d)} · ${esc(nm(x.officer))}: ${dutyCalls(x)} calls" style="height:${Math.max(2, dutyCalls(x) / maxD * 100)}%;background:${vals(x.logs).length ? dutyColor(x.officer) : '#dc2626'}"></div>`).join('')}</div><div class="row small muted" style="justify-content:space-between"><span>${fmtD(daily[0][0])}</span><span>Highest: ${maxD} calls</span><span>${fmtD(daily[daily.length - 1][0])}</span></div>` : '<div class="empty">No past duty days this month.</div>'}
      ${types.length ? `<h3 style="margin:14px 0 6px">Type of calls</h3><div class="bars">${types.map(x => `<div class="bar-row" style="cursor:default"><span>${esc(x.l)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${x.n / maxT * 100}%"></span></span><span class="n num">${x.n}</span></div>`).join('')}</div>` : ''}</div>
  </div>`;
}
ACT.dutyExport = () => {
  const ym = (S.dutyView?.anchor || today()).slice(0, 7); const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const rows = [['Date', 'Day', 'Hours', 'Officer', 'Public holiday', 'Calls', ...CALL_TYPES.map(([, l]) => l), 'Notes']];
  for (let i = 1; i <= dim; i++) { const d = `${ym}-${pad2(i)}`; const x = dutyDay(d); const logs = vals(x?.logs); rows.push([d, WD[dow(d)], dutyHours(d, x).slice(0, 2).join('-'), x ? nm(x.officer) : '', x?.holiday ? 'Yes' : '', x ? dutyCalls(x) : '', ...CALL_TYPES.map(([k]) => logs.reduce((s, g) => s + (Number(g.types?.[k]) || 0), 0) || ''), logs.map(g => g.note).filter(Boolean).join(' | ')]); }
  exportXLSX(`FREMYS-1424-duty-${ym}.xlsx`, [{ name: '1424 duty ' + ym, rows }]);
};

/* ---------- 1424 calls on the Statistics page (uses the page's date range; past and today only) ---------- */
function dutyRange(f) { const td = today(); return Object.entries(S.duty || {}).filter(([d]) => d >= (f.from || '0000') && d <= (f.to || '9999') && d <= td).sort((a, b) => a[0].localeCompare(b[0])); }
function dutyDailySVG(days) {
  const W = 720, H = 240, L = 34, R = 10, Tp = 14, B = 30; const n = days.length; const vs = days.map(([, x]) => dutyCalls(x)); const max = Math.max(1, ...vs);
  const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }; const step = max <= 4 ? 1 : nice(max / 4); const top = Math.ceil(max / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - v / top); const bw = (W - L - R) / n;
  let g = ''; for (let v = 0; v <= top; v += step) g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  days.forEach(([d, x], i) => { const v = vs[i]; const lg = vals(x.logs).length; const bx = L + i * bw + (bw > 4 ? bw * 0.12 : 0); const w = Math.max(1, bw > 4 ? bw * 0.76 : bw - 0.3);
    g += `<rect x="${bx}" y="${lg ? y(v) : y(0) - 3}" width="${w}" height="${lg ? Math.max(0, y(0) - y(v)) : 3}" fill="${lg ? dutyColor(x.officer) : '#dc2626'}" rx="1"><title>${fmtD(d)} (${WD[dow(d)]}) · ${esc(nm(x.officer))}: ${lg ? v + ' calls' : 'not logged'}</title></rect>`;
    if (d.endsWith('-01') || (i === 0 && +d.slice(8) <= 24)) g += `<line x1="${L + i * bw}" x2="${L + i * bw}" y1="${y(0)}" y2="${y(0) + 5}" stroke="#475569"/><text x="${L + i * bw + 2}" y="${H - 8}">${MONTHS[+d.slice(5, 7) - 1]}${d.slice(5, 7) === '01' || i === 0 ? ' ' + d.slice(0, 4) : ''}</text>`; });
  // 7-day moving average over logged days
  const avg = days.map((_, i) => { const w = days.slice(Math.max(0, i - 6), i + 1).filter(([, x]) => vals(x.logs).length); return w.length ? w.reduce((s, [, x]) => s + dutyCalls(x), 0) / w.length : null; });
  const pts = avg.map((v, i) => v == null ? null : `${L + i * bw + bw / 2},${y(v)}`).filter(Boolean);
  if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>`;
  return `<div class="colchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="1424 calls per day">${g}</svg></div>`;
}
function dutyStatsSection(f) {
  const days = dutyRange(f); if (!days.length) return '';
  const logged = days.filter(([, x]) => vals(x.logs).length); const total = logged.reduce((s, [, x]) => s + dutyCalls(x), 0);
  const busiest = logged.slice().sort((a, b) => dutyCalls(b[1]) - dutyCalls(a[1]))[0];
  const avgBy = keyFn => { const g = {}; logged.forEach(([d, x]) => { const k = keyFn(d, x); (g[k] = g[k] || []).push(dutyCalls(x)); }); return g; };
  const byWd = avgBy(d => dow(d)); const wdRows = [0, 1, 2, 3, 4, 5, 6].map(i => ({ l: WD[i] + (i >= 5 ? ' (14–24)' : ''), v: byWd[i] ? byWd[i].reduce((a, b) => a + b, 0) / byWd[i].length : 0, n: byWd[i]?.length || 0 })); const maxW = Math.max(1, ...wdRows.map(r => r.v));
  const types = CALL_TYPES.map(([k, l]) => ({ l, n: logged.reduce((s, [, x]) => s + vals(x.logs).reduce((s2, g) => s2 + (Number(g.types?.[k]) || 0), 0), 0) })); const typed = types.reduce((s, x) => s + x.n, 0); const maxT = Math.max(1, ...types.map(x => x.n));
  const months = {}; days.forEach(([d, x]) => { const m = months[d.slice(0, 7)] = months[d.slice(0, 7)] || { days: 0, logged: 0, calls: 0 }; m.days++; if (vals(x.logs).length) { m.logged++; m.calls += dutyCalls(x); } });
  return `<div class="card section" style="border-top:5px solid #0284c7"><div class="card-head"><h2>1424 duty line: calls per day</h2><span class="muted small">Duty days in the period up to today · <a href="#duty">Open the duty rota</a></span></div>
    <div class="tiles" style="margin-bottom:10px">
      <div class="tile info" style="cursor:default"><div class="k">Calls logged</div><div class="v num">${fmtN(total)}</div><div class="s">${logged.length} logged duty day${logged.length === 1 ? '' : 's'}</div></div>
      <div class="tile" style="cursor:default"><div class="k">Average per day</div><div class="v num">${logged.length ? fmtN(total / logged.length, 1) : '—'}</div><div class="s">Logged duty days only</div></div>
      <div class="tile ok" style="cursor:default"><div class="k">Busiest day</div><div class="v num">${busiest ? dutyCalls(busiest[1]) : '—'}</div><div class="s">${busiest ? fmtD(busiest[0]) + ' · ' + esc(nm(busiest[1].officer)) : ''}</div></div>
      <div class="tile ${days.length - logged.length ? 'bad' : ''}" style="cursor:default"><div class="k">Days not logged</div><div class="v num">${days.length - logged.length}</div><div class="s">Of ${days.length} duty days</div></div>
    </div>
    ${dutyDailySVG(days)}
    <div class="row small muted" style="gap:14px;margin-bottom:12px"><span>Bars: calls each day, coloured by officer on duty</span><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:16px;height:2px;background:#0f172a"></span>7-day average</span><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:#dc2626"></span>Not logged</span></div>
    <div class="grid3">
      <div><h3 style="margin:0 0 6px">Average calls by day of week</h3><div class="bars">${wdRows.map(r => `<div class="bar-row" style="cursor:default"><span>${esc(r.l)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${r.v / maxW * 100}%"></span></span><span class="n num">${r.n ? fmtN(r.v, 1) : '—'}</span></div>`).join('')}</div></div>
      <div><h3 style="margin:0 0 6px">Type of calls</h3>${typed ? `<div class="bars">${types.map(x => `<div class="bar-row" style="cursor:default"><span>${esc(x.l)} <span class="muted small">${fmtN(x.n / typed * 100, 0)}%</span></span><span class="bar-track"><span class="bar-fill" style="display:block;width:${x.n / maxT * 100}%"></span></span><span class="n num">${x.n}</span></div>`).join('')}</div><p class="small muted">${typed < total ? `${total - typed} calls were logged without a type.` : ''}</p>` : '<div class="empty">No call types recorded.</div>'}</div>
      <div><h3 style="margin:0 0 6px">By month</h3><div class="tbl-wrap"><table><thead><tr><th>Month</th><th class="r">Calls</th><th class="r">Per day</th><th class="r">Not logged</th></tr></thead><tbody>${Object.entries(months).map(([m, x]) => `<tr><td>${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</td><td class="r"><b>${x.calls}</b></td><td class="r">${x.logged ? fmtN(x.calls / x.logged, 1) : '—'}</td><td class="r">${x.days - x.logged}</td></tr>`).join('')}</tbody></table></div></div>
    </div></div>`;
}
