'use strict';
/* Staff performance: workload radar, distribution, timeliness, activity trends and a full metrics table. */

const PERF_COLORS = ['#0369a1', '#c2410c', '#047857', '#7c3aed', '#be123c', '#0f766e'];
const PERF_AXES = [
  ['openCases', 'Open caseload'], ['assigned', 'New assignments'], ['reviews', 'Reviews completed'], ['requests', 'Requests, follow-ups & letters'],
  ['decisions', 'Comments & decisions'], ['registrations', 'Registrations'], ['duty', '1424 duty hours'], ['overdue', 'Overdue items'],
];
const STAGE_COLORS = { registered: '#6366f1', prelim_review: '#0284c7', further_work: '#d97706', ready_panel: '#059669', on_agenda: '#0d9488', commission: '#0891b2', further_investigation: '#b45309', referred: '#4f46e5', next_step: '#16a34a', closed: '#64748b' };

function perfDefault() { return { from: addDays(today(), -89), to: today(), sel: null }; }
function perfMetrics(f) {
  const td = today(); const inP2 = iso => !!iso && String(iso).slice(0, 10) >= f.from && String(iso).slice(0, 10) <= f.to;
  const cs = vals(S.complaints); const ids = Object.keys(S.staff).filter(id => { const r = S.staff[id].roles || []; return S.staff[id].active !== false && !r.includes('sysadmin') && r.some(x => x !== 'management'); });
  const M = {}; ids.forEach(id => { M[id] = { id, openCases: 0, openIds: [], assigned: 0, reviews: 0, ready: 0, onTime: 0, daysToReady: [], requests: 0, responses: 0, actionsDone: 0, actionsOpen: 0, mgmt: 0, decisions: 0, approvals: 0, referrals: 0, interim: 0, lodged: 0, notLodged: 0, returned: 0, registrations: 0, duty: 0, dutyDays: 0, dutyCalls: 0, dutyUnlogged: 0, overdue: 0, overdueIds: [], activity: 0, byStage: {}, age: [0, 0, 0, 0], weeks: {} }; });
  const wk = iso => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDate(d); };
  const sla = cfg().sla.reviewDays;
  cs.forEach(c => {
    const a = M[c.assignedTo];
    if (a && !isDone(c)) { a.openCases++; a.openIds.push(c.id); a.byStage[c.stage] = (a.byStage[c.stage] || 0) + 1; const ag = workDays(c.dateReceived, td); a.age[ag <= 30 ? 0 : ag <= 60 ? 1 : ag <= 90 ? 2 : 3]++; if (isOverdue(c)) { a.overdue += overdueItems(c).filter(x => x.kind !== 'action').length; a.overdueIds.push(c.id); } }
    if (M[c.createdBy] && inP2(c.createdAt)) M[c.createdBy].registrations++;
    if (c.interim && c.interim.status === 'sent' && M[c.interim.by] && inP2(c.interim.sentAt)) M[c.interim.by].interim++;
    if (a) { const fd = finalDecision(c); if (fd && inP2(fd.at)) { if (fd.outcome === 'not_lodge') a.notLodged++; else a.lodged++; } vals(c.decisions).forEach(d => { if (d.outcome === 'return_officer' && inP2(d.at)) a.returned++; }); }
    vals(c.assignments).forEach(x => { if (M[x.to] && inP2(x.at)) M[x.to].assigned++; });
    vals(c.reviews).forEach(r => { const m = M[r.by]; if (!m || !inP2(r.at)) return; if (r.kind === 'officer') m.reviews++; else m.mgmt++; });
    if (c.panelRequest && M[c.panelRequest.by] && inP2(c.panelRequest.at)) { const m = M[c.panelRequest.by]; m.ready++; const first = vals(c.assignments).filter(x => x.to === c.panelRequest.by).map(x => x.at).sort()[0]; if (first) { const dd = workDays(first, c.panelRequest.at); m.daysToReady.push(dd); if (dd <= sla) m.onTime++; } }
    vals(c.requests).forEach(r => { if (M[r.by] && inP2(r.at || r.requestedAt)) M[r.by].requests++; vals(r.responses).forEach(x => { if (M[x.by] && inP2(x.at)) M[x.by].responses++; }); });
    vals(c.actions).forEach(x => { if (x.status === 'done' && M[x.completedBy] && inP2(x.completedAt)) M[x.completedBy].actionsDone++; if (x.status !== 'done' && M[x.owner]) { M[x.owner].actionsOpen++; if (x.due && x.due < td) { M[x.owner].overdue++; if (!M[x.owner].overdueIds.includes(c.id)) M[x.owner].overdueIds.push(c.id); } } });
    vals(c.decisions).forEach(d => { if (M[d.by] && inP2(d.at)) M[d.by].decisions++; if (M[d.approvedBy] && inP2(d.approvedAt)) M[d.approvedBy].approvals++; if (d.commission && M[d.commission.by] && inP2(d.commission.at)) M[d.commission.by].approvals++; });
    vals(c.referrals).forEach(r => { if (M[r.by] && r.sentAt && inP2(r.sentAt)) M[r.by].referrals++; });
    vals(c.history).forEach(h => { const m = M[h.by]; if (m && inP2(h.at)) { m.activity++; const w = wk(h.at); m.weeks[w] = (m.weeks[w] || 0) + 1; } });
  });
  Object.entries(S.duty || {}).forEach(([d, x]) => { const m = M[x.officer]; if (!m || d < f.from || d > f.to) return; m.dutyDays++; m.duty += dutyHours(d, x)[2]; m.dutyCalls += dutyCalls(x); if (d <= td && !vals(x.logs).length) m.dutyUnlogged++; });
  Object.values(M).forEach(m => { m.requests_total = m.requests + m.actionsDone + m.responses + m.interim; m.decisions_total = m.mgmt + m.decisions + m.approvals; m.avgDays = mean(m.daysToReady); m.onTimePct = m.ready ? m.onTime / m.ready * 100 : null; });
  const axisVal = (m, k) => k === 'requests' ? m.requests_total : k === 'decisions' ? m.decisions_total : k === 'reviews' ? m.reviews + m.ready : m[k];
  const max = Object.fromEntries(PERF_AXES.map(([k]) => [k, Math.max(1, ...Object.values(M).map(m => axisVal(m, k)))]));
  const weeks = []; { let d = wk(f.from); while (d <= f.to && weeks.length < 60) { weeks.push(d); d = addDays(d, 7); } }
  return { M, ids, axisVal, max, weeks };
}

/* ---------- Charts (hand-drawn SVG, coloured from the page tokens) ---------- */
function wrapLabel(text, max) { const out = []; let cur = ''; String(text).split(' ').forEach(w => { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) out.push(cur); return out; }
function radarSVG(series, P, size = 420, mini = false) {
  const n = PERF_AXES.length; const W = mini ? size : 640, H = mini ? size : 470; const cx = W / 2, cy = mini ? size / 2 : 240; const R = mini ? size / 2 - 8 : 172;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
  let g = '';
  [0.25, 0.5, 0.75, 1].forEach(r => { g += `<polygon points="${PERF_AXES.map((_, i) => pt(i, r).join(',')).join(' ')}" fill="none" stroke="#7f8fa7" stroke-width="${r === 1 ? 1.2 : 0.7}"/>`; });
  PERF_AXES.forEach(([k, l], i) => { const [x, y] = pt(i, 1); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#7f8fa7" stroke-width="0.7"/>`; if (!mini) { const [lx, ly] = pt(i, 1.1); const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'; const lines = wrapLabel(l, 16); const y0 = ly + 4 - (ly < cy - 8 ? (lines.length - 1) * 15 : ly > cy + 8 ? 0 : (lines.length - 1) * 7.5); g += `<text x="${lx}" y="${y0}" text-anchor="${anchor}" class="rl">${lines.map((t2, k) => `<tspan x="${lx}" dy="${k ? 15 : 0}">${esc(t2)}</tspan>`).join('')}</text>`; } });
  if (!mini) [25, 50, 75, 100].forEach(p => { const [x, y] = pt(0, p / 100); g += `<text x="${x + 4}" y="${y + 3}" class="rt">${p}%</text>`; });
  series.forEach((s, si) => {
    const pts = PERF_AXES.map(([k], i) => pt(i, Math.min(1, P.axisVal(s.m, k) / P.max[k])));
    g += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${s.color}" fill-opacity="${mini ? 0.35 : 0.16}" stroke="${s.color}" stroke-width="${mini ? 1.5 : 2.2}"/>`;
    if (!mini) pts.forEach((p, i) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${s.color}"><title>${esc(nm(s.m.id))} — ${esc(PERF_AXES[i][1])}: ${P.axisVal(s.m, PERF_AXES[i][0])} (team highest ${P.max[PERF_AXES[i][0]]})</title></circle>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="radar" role="img" aria-label="Workload radar">${g}</svg>`;
}
function lineSVG(series, weeks) {
  const W = 720, H = 240, L = 34, Rr = 12, T = 14, B = 30; const max = Math.max(1, ...series.flatMap(s => weeks.map(w => s.m.weeks[w] || 0)));
  const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }; const step = max <= 4 ? 1 : nice(max / 4); const top = Math.ceil(max / step) * step;
  const x = i => L + (weeks.length > 1 ? i * (W - L - Rr) / (weeks.length - 1) : (W - L - Rr) / 2); const y = v => T + (H - T - B) * (1 - v / top);
  let g = ''; for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" class="gridl"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  const every = Math.ceil(weeks.length / 9); weeks.forEach((w, i) => { if (i % every === 0) { const [, mm, dd] = w.split('-'); g += `<text x="${x(i)}" y="${H - B + 16}" text-anchor="middle">${+dd} ${MONTHS[+mm - 1]}</text>`; } });
  series.forEach(s => { const pts = weeks.map((w, i) => [x(i), y(s.m.weeks[w] || 0)]); g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`; const last = pts[pts.length - 1]; if (last) g += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}"/>`; });
  return `<div class="colchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly activity">${g}</svg></div>`;
}
function stackRows(rows, keys, colorOf, labelOf) {
  const max = Math.max(1, ...rows.map(r => keys.reduce((s, k) => s + (r.vals[k] || 0), 0)));
  return `<div class="bars">${rows.map(r => { const tot = keys.reduce((s, k) => s + (r.vals[k] || 0), 0); return `<div class="bar-row" style="cursor:default"><span><a href="#user-${esc(r.id)}">${esc(nm(r.id))}</a></span><span class="bar-track" style="display:flex;width:${Math.max(2, tot / max * 100)}%;background:none">${keys.map(k => r.vals[k] ? `<span title="${esc(labelOf(k))}: ${r.vals[k]}" style="display:block;height:100%;width:${r.vals[k] / tot * 100}%;background:${colorOf(k)}"></span>` : '').join('')}</span><span class="n num">${tot}</span></div>`; }).join('')}</div>
  <div class="row small" style="margin-top:8px;gap:12px">${keys.map(k => `<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:${colorOf(k)}"></span>${esc(labelOf(k))}</span>`).join('')}</div>`;
}
function hbars(rows, fmt = v => fmtN(v), unit = '') {
  const max = Math.max(1, ...rows.map(r => r.v || 0));
  return rows.length ? `<div class="bars">${rows.map(r => `<div class="bar-row" style="cursor:default"><span><a href="#user-${esc(r.id)}">${esc(nm(r.id))}</a></span><span class="bar-track"><span class="bar-fill" style="display:block;width:${(r.v || 0) / max * 100}%;${r.color ? 'background:' + r.color : ''}"></span></span><span class="n num">${r.v == null ? '—' : fmt(r.v) + unit}</span></div>`).join('')}</div>` : '<div class="empty">No data.</div>';
}

/* ---------- Page ---------- */
VIEWS.performance = () => {
  const full = can('supervise') || can('admin') || hasRole('management');
  if (!full && !S.staff[S.me.id]) return noAccess();
  const f = S.perf || (S.perf = perfDefault()); const P = perfMetrics(f);
  let ids = full ? P.ids : [S.me.id].filter(id => P.M[id]);
  const rank = [...ids].sort((a, b) => (P.M[b].openCases + P.M[b].activity) - (P.M[a].openCases + P.M[a].activity));
  const sel = (f.sel && f.sel.filter(id => P.M[id]).length ? f.sel.filter(id => P.M[id]) : rank.slice(0, 4)).slice(0, 6);
  const series = sel.map((id, i) => ({ m: P.M[id], color: PERF_COLORS[i] }));
  const officers = ids.filter(id => (S.staff[id].roles || []).includes('reg_officer'));
  const sups = ids.filter(id => (S.staff[id].roles || []).some(r => ['dg', 'director', 'panel'].includes(r)));
  const team = { open: ids.reduce((s, id) => s + P.M[id].openCases, 0), over: ids.reduce((s, id) => s + P.M[id].overdue, 0), done: ids.reduce((s, id) => s + P.M[id].ready, 0), act: ids.reduce((s, id) => s + P.M[id].activity, 0) };
  const onTimeAll = ids.reduce((s, id) => s + P.M[id].onTime, 0);
  const presets = [['30 days', 29], ['90 days', 89], ['6 months', 182], ['12 months', 364]];
  return `<div class="page-head"><div><h1>${esc(t('performance'))}</h1><p>${full ? 'Workload and output of each staff member, compared with the rest of the team.' : 'Your own workload and output.'} Figures count work done between the dates chosen; open caseload and overdue items are as of today. System Administrator accounts are not included.</p></div>
    <div class="row"><button class="btn" data-act="perfExport" data-fmt="xlsx">Excel</button><button class="btn" data-act="perfExport" data-fmt="csv">CSV</button></div></div>
  <div class="filters"><div class="f"><label for="pf_from">${esc(t('from'))}</label><input id="pf_from" type="date" name="from" value="${esc(f.from)}" data-on="change:perfF"></div><div class="f"><label for="pf_to">${esc(t('to'))}</label><input id="pf_to" type="date" name="to" value="${esc(f.to)}" data-on="change:perfF"></div>
    <div class="f wide" style="justify-content:flex-end"><label>Quick range</label><div class="row">${presets.map(([l, d]) => `<button class="btn sm ${f.from === addDays(today(), -d) && f.to === today() ? 'primary' : ''}" data-act="perfRange" data-d="${d}">${l}</button>`).join('')}</div></div></div>
  <div class="tiles">
    <div class="tile" style="cursor:default"><div class="k">Staff included</div><div class="v num">${ids.length}</div><div class="s">${officers.length} Registration Officers</div></div>
    <div class="tile info" style="cursor:default"><div class="k">Open caseload</div><div class="v num">${team.open}</div><div class="s">${officers.length ? fmtN(team.open / officers.length, 1) : '—'} per officer</div></div>
    <div class="tile ok" style="cursor:default"><div class="k">Reviews completed</div><div class="v num">${team.done}</div><div class="s">${team.done ? fmtN(onTimeAll / team.done * 100, 0) + '% within ' + cfg().sla.reviewDays + ' days' : 'In the period'}</div></div>
    <div class="tile bad" style="cursor:default"><div class="k">Overdue items</div><div class="v num">${team.over}</div><div class="s">Cases, requests and actions</div></div>
    <div class="tile" style="cursor:default"><div class="k">Recorded actions</div><div class="v num">${fmtN(team.act)}</div><div class="s">Activity entries in the period</div></div>
  </div>
  <div class="split">
    <div class="card"><div class="card-head"><h2>Workload radar</h2><span class="muted small">Each axis is scaled to the team's highest value (100%)</span></div>
      <div class="radar-wrap">${series.length ? radarSVG(series, P) : '<div class="empty">No staff to show.</div>'}</div>
      <div class="row" style="justify-content:center;gap:14px">${series.map(s => `<span style="display:inline-flex;gap:6px;align-items:center;font-weight:600"><span style="width:12px;height:12px;border-radius:50%;background:${s.color}"></span>${esc(nm(s.m.id))}</span>`).join('')}</div></div>
    <div class="card"><h2>Compare</h2><p class="small muted" style="margin-top:2px">Choose up to six people for the radar and the activity chart.</p>
      <div class="checks" style="flex-direction:column;gap:6px">${rank.map(id => `<label><input type="checkbox" data-on="change:perfSel" value="${esc(id)}" ${sel.includes(id) ? 'checked' : ''} ${!sel.includes(id) && sel.length >= 6 ? 'disabled' : ''}> ${sel.includes(id) ? `<span style="width:10px;height:10px;border-radius:50%;background:${PERF_COLORS[sel.indexOf(id)]}"></span>` : ''}<span>${esc(nm(id))} <span class="muted small">${esc((S.staff[id].roles || []).map(r => ROLES[r]).slice(0, 2).join(', '))}</span></span></label>`).join('')}</div>
      <h3 style="margin-top:14px">What the axes count</h3><ul class="small" style="padding-inline-start:18px;margin:4px 0 0">
        <li><b>Open caseload</b>: complaints assigned to them and not completed (today)</li><li><b>New assignments</b>: complaints assigned to them in the period</li>
        <li><b>Reviews completed</b>: preliminary review notes plus cases marked ready for panel</li><li><b>Info requests &amp; follow-ups</b>: requests sent, responses recorded, actions completed</li>
        <li><b>Comments &amp; decisions</b>: management comments, panel decisions recorded and approved</li><li><b>Registrations</b>: complaints they registered</li><li><b>1424 duty hours</b>: hours on the 1424 duty rota in the period (16 a weekday, 10 a weekend or holiday)</li><li><b>Overdue items</b>: missed deadlines on their cases and actions (today)</li></ul></div>
  </div>
  <div class="card section"><div class="card-head"><h2>Weekly activity</h2><span class="muted small">Recorded actions per week</span></div>${lineSVG(series, P.weeks)}
    <div class="row" style="justify-content:center;gap:14px">${series.map(s => `<span style="display:inline-flex;gap:6px;align-items:center"><span style="width:16px;height:3px;background:${s.color}"></span>${esc(nm(s.m.id))}</span>`).join('')}</div></div>
  <div class="grid2 section">
    <div class="card"><h2>Open caseload by stage</h2>${officers.length ? stackRows(officers.map(id => ({ id, vals: P.M[id].byStage })).sort((a, b) => P.M[b.id].openCases - P.M[a.id].openCases), STAGES.map(s => s.k).filter(k => officers.some(id => P.M[id].byStage[k])), k => STAGE_COLORS[k], stageLabel) : '<div class="empty">No Registration Officers.</div>'}</div>
    <div class="card"><h2>Age of open cases</h2>${officers.length ? stackRows(officers.map(id => ({ id, vals: { a: P.M[id].age[0], b: P.M[id].age[1], c: P.M[id].age[2], d: P.M[id].age[3] } })), ['a', 'b', 'c', 'd'], k => ({ a: '#059669', b: '#0284c7', c: '#d97706', d: '#dc2626' })[k], k => ({ a: '0–30 days', b: '31–60 days', c: '61–90 days', d: 'Over 90 days' })[k]) : '<div class="empty">No Registration Officers.</div>'}<p class="small muted">Days since the complaint was received.</p></div>
    <div class="card"><h2>Average working days from assignment to panel-ready</h2>${hbars(officers.map(id => ({ id, v: P.M[id].avgDays, color: P.M[id].avgDays > cfg().sla.reviewDays ? '#d97706' : '' })).filter(r => r.v != null).sort((a, b) => a.v - b.v), v => fmtN(v, 1))}<p class="small muted">Target: ${cfg().sla.reviewDays} days (amber bars are over target). Cases marked ready in the period.</p></div>
    <div class="card"><h2>Reviews completed on time</h2>${hbars(officers.map(id => ({ id, v: P.M[id].onTimePct, color: P.M[id].onTimePct != null && P.M[id].onTimePct < 70 ? '#d97706' : '#059669' })).filter(r => r.v != null).sort((a, b) => b.v - a.v), v => fmtN(v, 0), '%')}<p class="small muted">Share of cases marked ready within ${cfg().sla.reviewDays} days of assignment.</p></div>
    <div class="card"><h2>Panel decisions on their cases</h2>${officers.length ? stackRows(officers.map(id => ({ id, vals: { l: P.M[id].lodged, n: P.M[id].notLodged, r: P.M[id].returned } })).sort((a, b) => (P.M[b.id].lodged + P.M[b.id].notLodged) - (P.M[a.id].lodged + P.M[a.id].notLodged)), ['l', 'n', 'r'], k => ({ l: '#059669', n: '#64748b', r: '#d97706' })[k], k => ({ l: 'Lodged', n: 'Not lodged', r: 'Returned for clarification' })[k]) : '<div class="empty">No Registration Officers.</div>'}<p class="small muted">Decisions made in the period on cases assigned to each officer. A high return count can show where reviews need more detail.</p></div>
    <div class="card" style="grid-column:1/-1"><h2>1424 duty and calls</h2>${officers.some(id => P.M[id].dutyDays) ? `<div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>Officer</th><th class="r">Days</th><th class="r">Hours</th><th class="r">Calls</th><th class="r">Per day</th><th class="r">Not logged</th></tr></thead><tbody>${officers.filter(id => P.M[id].dutyDays).sort((a, b) => P.M[b].dutyCalls - P.M[a].dutyCalls).map(id => { const m = P.M[id]; return `<tr><td style="white-space:nowrap"><a href="#user-${esc(id)}">${esc(nm(id))}</a></td><td class="r">${m.dutyDays}</td><td class="r">${m.duty}</td><td class="r"><b>${m.dutyCalls}</b></td><td class="r">${m.dutyDays - m.dutyUnlogged ? fmtN(m.dutyCalls / (m.dutyDays - m.dutyUnlogged), 1) : '—'}</td><td class="r" style="${m.dutyUnlogged ? 'color:#b91c1c;font-weight:700' : ''}">${m.dutyUnlogged}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No 1424 duty in the period.</div>'}<p class="small muted">Duty on the 1424 rota in the period. Calls per day counts logged days only; “Not logged” is past duty days with no calls entered.</p></div>
    <div class="card"><h2>Overdue items now</h2>${hbars(ids.map(id => ({ id, v: P.M[id].overdue, color: '#dc2626' })).filter(r => r.v).sort((a, b) => b.v - a.v))}${ids.every(id => !P.M[id].overdue) ? '<div class="empty">Nothing is overdue.</div>' : ''}</div>
    <div class="card"><h2>Management and panel work</h2>${sups.length ? stackRows(sups.map(id => ({ id, vals: { m: P.M[id].mgmt, d: P.M[id].decisions, a: P.M[id].approvals } })), ['m', 'd', 'a'], k => ({ m: '#0284c7', d: '#7c3aed', a: '#059669' })[k], k => ({ m: 'Comments on cases', d: 'Panel decisions recorded', a: 'Commission decisions recorded' })[k]) : '<div class="empty">No Director General, Director or panel members.</div>'}</div>
  </div>
  <div class="card section"><h2>Workload profiles</h2><div class="grid3" style="margin-top:8px">${rank.map(id => { const m = P.M[id]; return `<a class="entry" href="#user-${esc(id)}" style="text-decoration:none;color:inherit;display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;box-shadow:none"><div>${radarSVG([{ m, color: '#0369a1' }], P, 110, true)}</div><div><b>${esc(nm(id))}</b><div class="muted small">${esc((S.staff[id].roles || []).map(r => ROLES[r]).slice(0, 2).join(', '))}</div><div class="small" style="margin-top:4px">${m.openCases} open · ${m.ready} ready · ${m.overdue ? `<span style="color:#b91c1c;font-weight:600">${m.overdue} overdue</span>` : '0 overdue'}<br>${m.activity} actions in period</div></div></a>`; }).join('')}</div></div>
  <div class="card section"><h2>All measures</h2>${perfTable(ids, P)}</div>`;
};
const PERF_COLS = [['Open cases', m => m.openCases], ['Assigned', m => m.assigned], ['Review notes', m => m.reviews], ['Marked ready', m => m.ready], ['On time %', m => m.onTimePct == null ? '' : Math.round(m.onTimePct)], ['Avg days to ready', m => m.avgDays == null ? '' : +m.avgDays.toFixed(1)], ['Requests sent', m => m.requests], ['Responses recorded', m => m.responses], ['Actions done', m => m.actionsDone], ['Actions open', m => m.actionsOpen], ['Mgmt comments', m => m.mgmt], ['Decisions', m => m.decisions], ['Approvals', m => m.approvals], ['Cases lodged', m => m.lodged], ['Cases not lodged', m => m.notLodged], ['Returned for clarification', m => m.returned], ['Response letters sent', m => m.interim], ['Referrals sent', m => m.referrals], ['Registrations', m => m.registrations], ['1424 duty days', m => m.dutyDays], ['1424 duty hours', m => m.duty], ['1424 calls', m => m.dutyCalls], ['1424 days not logged', m => m.dutyUnlogged], ['Overdue now', m => m.overdue], ['Activity', m => m.activity]];
function perfTable(ids, P) {
  return `<div class="tbl-wrap"><table><thead><tr><th>Staff member</th>${PERF_COLS.map(([l]) => `<th class="r">${esc(l)}</th>`).join('')}</tr></thead><tbody>${ids.sort((a, b) => nm(a).localeCompare(nm(b))).map(id => { const m = P.M[id]; return `<tr><td><a href="#user-${esc(id)}"><b>${esc(nm(id))}</b></a></td>${PERF_COLS.map(([l, fn]) => { const v = fn(m); const hot = l === 'Overdue now' && v > 0; return `<td class="r num" style="${hot ? 'color:#b91c1c;font-weight:700' : ''}">${v === '' ? '—' : v}</td>`; }).join('')}</tr>`; }).join('')}</tbody></table></div>`;
}
ON.perfF = el => { S.perf = { ...S.perf, [el.name]: el.value }; render(); };
ACT.perfRange = el => { S.perf = { ...S.perf, from: addDays(today(), -Number(el.dataset.d)), to: today() }; render(); };
ON.perfSel = el => { const f = S.perf; const P = perfMetrics(f); const ids = [...$$('input[data-on="change:perfSel"]')].filter(x => x.checked).map(x => x.value); f.sel = ids.length ? ids.slice(0, 6) : null; render(); };
ACT.perfExport = el => {
  const f = S.perf || perfDefault(); const P = perfMetrics(f); const full = can('supervise') || can('admin') || hasRole('management'); const ids = full ? P.ids : [S.me.id];
  const rows = [['Staff member', 'Roles', ...PERF_COLS.map(([l]) => l)], ...ids.map(id => [nm(id), (S.staff[id].roles || []).map(r => ROLES[r]).join('; '), ...PERF_COLS.map(([, fn]) => fn(P.M[id]))])];
  const weekly = [['Week starting', ...ids.map(nm)], ...P.weeks.map(w => [w, ...ids.map(id => P.M[id].weeks[w] || 0)])];
  const fn = `FREMYS-staff-performance-${f.from}-to-${f.to}`;
  if (el.dataset.fmt === 'xlsx') exportXLSX(fn + '.xlsx', [{ name: 'Measures', rows: [['Period', `${f.from} to ${f.to}`], [], ...rows] }, { name: 'Weekly activity', rows: weekly }]); else exportCSV(fn + '.csv', rows);
  logA('performance.export', null, `${f.from}..${f.to}`);
};
