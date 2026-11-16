'use strict';
/* Statistics dashboard. Three distinct measures are kept apart: received in the period, open now, completed in the period. */

function defaultStatsFilter() { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return { from: localDate(d), to: today() }; }
const inP = (iso, f) => !!iso && String(iso).slice(0, 10) >= (f.from || '0000') && String(iso).slice(0, 10) <= (f.to || '9999');

function computeStats(f) {
  const td = today();
  const all = vals(S.complaints).filter(c => !f.stage || c.stage === f.stage).filter(c => !f.officer || c.assignedTo === f.officer).filter(c => !f.category || c.category === f.category).filter(c => !f.atoll || c.atoll === f.atoll).filter(c => !f.det || (f.det === 'any' ? !!detOf(c) : f.det === 'none' ? !detOf(c) : detType(detOf(c)) === f.det))
    .filter(c => !f.meeting || c.panelMeetingId === f.meeting || vals(c.decisions).some(d => d.meetingId === f.meeting))
    .filter(c => !f.dec || (f.dec === 'lodged' ? isLodged(c) : f.dec === 'not_lodged' ? isNotLodged(c) : f.dec === 'returned' ? returnCount(c) > 0 : !finalDecision(c)))
    .filter(c => !f.ref || (f.ref === 'none' ? !Object.keys(c.referrals || {}).length : vals(c.referrals).some(r => r.status === f.ref)));
  const received = all.filter(c => inP(c.dateReceived, f));
  const openNow = all.filter(c => !isDone(c));
  const completed = all.filter(c => inP(completedAt(c), f));
  const overdue = openNow.filter(isOverdue);
  // months
  const months = []; { let d = new Date((f.from || td).slice(0, 7) + '-01T12:00:00'); const end = (f.to || td).slice(0, 7); let guard = 0; while (localDate(d).slice(0, 7) <= end && guard++ < 36) { months.push(localDate(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); } }
  const monthly = months.map(m => ({ m, ids: received.filter(c => String(c.dateReceived).startsWith(m)).map(c => c.id) }));
  const stages = STAGES.map(s => ({ k: s.k, label: stageLabel(s.k), ids: received.filter(c => c.stage === s.k).map(c => c.id) }));
  // processing times (for complaints received in period)
  const span = (fnA, fnB) => received.map(c => { const a = fnA(c), b = fnB(c); return a && b ? Math.max(0, dayDiff(a, b)) : null; }).filter(x => x != null);
  const firstAssign = c => entries(c.assignments).map(a => a.at).sort()[0] || null;
  const proc = [
    ['Receipt → registration', span(c => c.dateReceived, c => c.createdAt)],
    ['Registration → assignment', span(c => c.createdAt, firstAssign)],
    ['Assignment → ready for panel', span(firstAssign, c => c.readyAt || stageEnteredAt(c, ['ready_panel']))],
    ['Receipt → first panel consideration', span(c => c.dateReceived, firstDecisionAt)],
    ['Receipt → workflow completed', span(c => c.dateReceived, completedAt)],
  ].map(([label, arr]) => ({ label, n: arr.length, avg: mean(arr), med: median(arr) }));
  const ageB = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['Over 90 days', 91, 1e9]].map(([label, lo, hi]) => ({ label, ids: openNow.filter(c => { const a = dayDiff(c.dateReceived, td); return a >= lo && a <= hi; }).map(c => c.id) }));
  const officers = staffIds('reg_officer', false).map(id => { const mine = all.filter(c => c.assignedTo === id); const open = mine.filter(c => !isDone(c)); const tasksOver = open.reduce((s, c) => s + overdueItems(c).length, 0); const doneRev = mine.filter(c => inP(c.readyAt, f)); const times = mine.map(c => { const a = firstAssign(c), b = c.readyAt; return a && b ? dayDiff(a, b) : null; }).filter(x => x != null); return { id, open: open.map(c => c.id), done: doneRev.map(c => c.id), overdueCases: open.filter(isOverdue).map(c => c.id), tasksOver, avg: mean(times) }; });
  const decisions = all.flatMap(c => entries(c.decisions).map(d => ({ ...d, cid: c.id }))).filter(d => inP(d.at, f));
  const meetings = vals(S.meetings).filter(m => inP(m.date, f));
  const panel = { held: meetings.filter(m => m.status === 'held').length, planned: meetings.filter(m => m.status === 'planned').length, postponed: meetings.filter(m => m.status === 'postponed' || m.status === 'cancelled').length, considered: [...new Set(decisions.map(d => d.cid))], deferred: decisions.filter(d => d.outcome === 'deferred').map(d => d.cid), actionsOpen: all.filter(c => vals(c.actions).some(a => a.decisionId && a.status !== 'done')).map(c => c.id) };
  const reqs = all.flatMap(c => entries(c.requests).map(r => ({ ...r, cid: c.id })));
  const info = { sent: reqs.filter(r => inP(r.requestedAt, f)), received: reqs.filter(r => vals(r.responses).some(x => inP(x.at, f))), pending: reqs.filter(r => ['pending', 'partial'].includes(r.status)), overdue: reqs.filter(r => ['pending', 'partial'].includes(r.status) && r.due && r.due < td) };
  const refs = all.flatMap(c => entries(c.referrals).map(r => ({ ...r, cid: c.id }))).filter(r => r.status !== 'draft');
  const ref = { referred: refs.filter(r => inP(r.sentAt, f)), acknowledged: refs.filter(r => ['acknowledged', 'in_progress'].includes(r.status)), awaiting: refs.filter(r => r.status !== 'responded'), responded: refs.filter(r => inP(r.respondedAt, f)) };
  const group = (key, labelFn) => { const m = {}; received.forEach(c => { const k = c[key] || ''; (m[k] = m[k] || []).push(c.id); }); return Object.entries(m).map(([k, ids]) => ({ k, label: labelFn(k), ids })).sort((a, b) => b.ids.length - a.ids.length); };
  const byCat = group('category', k => k || 'Not classified');
  const X = catIndex(); const tally = (fn) => { const m = {}; received.forEach(c => fn(c).forEach(k => { if (k) (m[k] = m[k] || []).push(c.id); })); return Object.entries(m).map(([k, ids]) => ({ k, ids })).sort((a, b) => b.ids.length - a.ids.length); };
  const byDomain = tally(c => [X.catMap[clsOf(c).catId]?.domain || 'Not classified']).map(x => ({ ...x, label: x.k }));
  const byIssue = tally(c => [clsOf(c).issueId]).slice(0, 12).map(x => ({ ...x, label: X.byIssue[x.k]?.in || x.k }));
  const byGroup = tally(c => [...new Set((clsOf(c).groups || []).map(g => X.groupBy[g]?.g).filter(Boolean))]).map(x => ({ ...x, label: x.k }));
  const byTopic = tally(c => clsOf(c).topics || []).map(x => ({ ...x, label: X.topicBy[x.k]?.t || x.k })); const byAtoll = group('atoll', k => ATOLL[k] || 'Not recorded');
  const outc = {}; decisions.forEach(d => { (outc[d.outcome] = outc[d.outcome] || []).push(d.cid); });
  const outcomes = Object.entries(outc).map(([k, ids]) => ({ k, label: outcomeLabel(k), ids })).sort((a, b) => b.ids.length - a.ids.length);
  const dq = [
    ['Required details missing', all.filter(c => !c.summary || !c.category || !c.dateReceived || !cpOf(c).name).map(c => c.id)],
    ['Details marked "not yet available"', all.filter(c => (c.missing || []).length).map(c => c.id)],
    ['No documents attached', all.filter(c => !Object.keys(c.docs || {}).length).map(c => c.id)],
    ['Complaint form not received', all.filter(c => (c.missing || []).includes('form')).map(c => c.id)],
    ['Not classified with the catalogue', all.filter(c => !isCatalogued(c)).map(c => c.id)],
    ['Potential duplicates flagged', all.filter(c => (c.dupWarnings || []).length).map(c => c.id)],
    ['Open with no assigned officer (past registration)', openNow.filter(c => !c.assignedTo && c.stage !== 'registered').map(c => c.id)],
  ];
  const fin = all.map(c => ({ c, d: finalDecision(c) })).filter(x => x.d && inP(x.d.at, f));
  const lodgedP = fin.filter(x => x.d.outcome !== 'not_lodge').map(x => x.c); const notLodgedP = fin.filter(x => x.d.outcome === 'not_lodge').map(x => x.c);
  const returnedP = all.filter(c => vals(c.decisions).some(d => d.outcome === 'return_officer' && inP(d.at, f)));
  const lodge = { lodged: lodgedP, notLodged: notLodgedP, returned: returnedP, rate: pctOf(lodgedP.length, lodgedP.length + notLodgedP.length),
    monthly: months.map(mo => ({ m: mo, lo: lodgedP.filter(c => finalDecision(c).at.startsWith(mo)).map(c => c.id), nl: notLodgedP.filter(c => finalDecision(c).at.startsWith(mo)).map(c => c.id) })),
    reasons: Object.entries(notLodgedP.reduce((m, c) => { const r = finalDecision(c).reason || 'Reason not recorded'; (m[r] = m[r] || []).push(c.id); return m; }, {})).map(([label, ids]) => ({ label, ids })).sort((a, b) => b.ids.length - a.ids.length),
    byCat: Object.values([...lodgedP, ...notLodgedP].reduce((m, c) => { const k = c.category || 'Not classified'; const e = m[k] = m[k] || { label: k, lo: [], nl: [] }; (isLodged(c) ? e.lo : e.nl).push(c.id); return m; }, {})).sort((a, b) => (b.lo.length + b.nl.length) - (a.lo.length + a.nl.length)),
    rounds: [0, 1, 2].map(n => ({ label: n === 2 ? 'Returned twice or more' : n === 1 ? 'Returned once' : 'Decided first time', ids: [...lodgedP, ...notLodgedP].filter(c => n === 2 ? returnCount(c) >= 2 : returnCount(c) === n).map(c => c.id) })),
    days: [...lodgedP, ...notLodgedP].map(c => dayDiff(c.dateReceived, finalDecision(c).at)) };
  return { lodge, all, received, openNow, completed, overdue, monthly, stages, proc, ageB, officers, panel, info, ref, byCat, byDomain, byIssue, byGroup, byTopic, byAtoll, outcomes, dq, decisions };
}

let DRILL = {};
function drillKey(ids, label) { const k = 'k' + Object.keys(DRILL).length; DRILL[k] = { ids: [...new Set(ids)], label }; return k; }
ACT.statDrill = el => { const d = DRILL[el.dataset.k]; if (!d || !can('viewAll') && !can('viewAssigned')) return; S.filter = { ids: d.ids, idsLabel: d.label }; S.regLimit = 100; go('register'); };
const drillable = () => can('viewAll') || can('viewAssigned');

function statTile(label, ids, sub, tone = '', dlabel) { const k = drillKey(ids, dlabel || label); return `<button class="tile ${tone}" data-act="statDrill" data-k="${k}" ${drillable() ? '' : 'disabled'}><div class="k">${esc(label)}</div><div class="v num">${fmtN(ids.length)}</div><div class="s">${esc(sub)}</div></button>`; }
function barList(rows, total) {
  const max = Math.max(1, ...rows.map(r => r.ids.length));
  if (!rows.length) return '<div class="empty">No records for this selection.</div>';
  return `<div class="bars">${rows.map(r => `<button class="bar-row" data-act="statDrill" data-k="${drillKey(r.ids, r.label)}" ${drillable() ? '' : 'disabled'}><span>${esc(r.label)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${(r.ids.length / max) * 100}%"></span></span><span class="n num">${r.ids.length}${total ? ` <span class="muted" style="font-weight:400">${fmtN(r.ids.length / total * 100)}%</span>` : ''}</span></button>`).join('')}</div>`;
}
function colChart(monthly) {
  const W = 720, H = 230, L = 34, R = 10, Tp = 18, B = 34; const n = monthly.length || 1;
  const max = Math.max(...monthly.map(m => m.ids.length), 1); const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }; const step = max <= 4 ? 1 : nice(max / 4); const top = Math.ceil(max / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - v / top); const bw = (W - L - R) / n;
  let g = ''; for (let v = 0; v <= top; v += step) g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  const cols = monthly.map((m, i) => { const x = L + i * bw + bw * 0.18; const w = bw * 0.64; const v = m.ids.length; const [yy, mm] = m.m.split('-'); return `<g><rect class="col ${i === n - 1 ? 'last' : ''}" x="${x}" y="${y(v)}" width="${w}" height="${Math.max(0, y(0) - y(v))}" rx="2" data-act="statDrill" data-k="${drillKey(m.ids, 'Received ' + MONTHS[+mm - 1] + ' ' + yy)}" style="cursor:pointer"><title>${MONTHS[+mm - 1]} ${yy}: ${v}</title></rect>${v ? `<text x="${x + w / 2}" y="${y(v) - 4}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${v}</text>` : ''}<text x="${x + w / 2}" y="${H - B + 15}" text-anchor="middle">${MONTHS[+mm - 1]}</text>${(i === 0 || mm === '01') ? `<text x="${x + w / 2}" y="${H - B + 28}" text-anchor="middle">${yy}</text>` : ''}</g>`; }).join('');
  return `<div class="colchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Complaints received per month">${g}${cols}</svg></div>`;
}

VIEWS.stats = () => {
  if (!can('stats')) return noAccess();
  DRILL = {};
  const f = S.sf || (S.sf = defaultStatsFilter()); const k = cfg(); const st = computeStats(f); const rc = st.received.length;
  const meetings = vals(S.meetings).sort((a, b) => b.date.localeCompare(a.date));
  const sel2 = (id, name, opts, v, blank) => `<select id="${id}" name="${name}" data-on="change:statFilter"><option value="">${esc(blank)}</option>${opts.map(x => Array.isArray(x) ? x : [x, x]).map(([a, b]) => `<option value="${esc(a)}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const med = st.proc[3];
  return `<div class="page-head"><div><h1>${esc(t('stats'))}</h1><p>Figures update as records change. Click any indicator to open the complaints behind it${drillable() ? '' : ' (record access is not part of your role)'}.</p></div>
    <div class="row"><button class="btn" data-act="statExport" data-fmt="xlsx">Excel</button><button class="btn" data-act="statExport" data-fmt="pdf">PDF</button><button class="btn" data-act="statExport" data-fmt="csv">CSV</button></div></div>
  <form class="filters" data-on="submit:noop">
    <div class="f"><label for="s_from">${esc(t('from'))}</label><input id="s_from" type="date" name="from" value="${esc(f.from || '')}" data-on="change:statFilter"></div>
    <div class="f"><label for="s_to">${esc(t('to'))}</label><input id="s_to" type="date" name="to" value="${esc(f.to || '')}" data-on="change:statFilter"></div>
    <div class="f"><label for="s_stage">${esc(t('stage'))}</label>${sel2('s_stage', 'stage', STAGES.map(s => [s.k, stageLabel(s.k)]), f.stage, t('all'))}</div>
    <div class="f"><label for="s_officer">${esc(t('officer'))}</label>${sel2('s_officer', 'officer', staffIds('reg_officer', false).map(id => [id, nm(id)]), f.officer, t('all'))}</div>
    <div class="f"><label for="s_category">${esc(t('category'))}</label>${sel2('s_category', 'category', k.categories, f.category, t('all'))}</div>
    <div class="f"><label for="s_atoll">${esc(t('atoll'))}</label>${sel2('s_atoll', 'atoll', ATOLLS, f.atoll, t('all'))}</div>
    <div class="f"><label for="s_det">Setting</label>${sel2('s_det', 'det', [['any', 'Any detention / institutional setting'], ['none', 'Not a detention setting'], ...Object.entries(DET_TYPES).map(([a, b]) => [a, b[0]])], f.det, t('all'))}</div>
    <div class="f"><label for="s_meeting">${esc(t('meeting'))}</label>${sel2('s_meeting', 'meeting', meetings.map(m => [m.id, fmtD(m.date)]), f.meeting, t('all'))}</div>
    <div class="f"><label for="s_dec">Panel decision</label>${sel2('s_dec', 'dec', [['lodged', 'Lodged'], ['not_lodged', 'Not lodged'], ['returned', 'Returned at least once'], ['pending', 'No final decision yet']], f.dec, t('all'))}</div>
    <div class="f"><label for="s_ref">Referral status</label>${sel2('s_ref', 'ref', [['none', 'No referral'], ...Object.entries(REF_STATUS).map(([a, b]) => [a, b[0]])], f.ref, t('all'))}</div>
  </form>
  <div class="tiles">
    ${statTile('Received in period', st.received.map(c => c.id), `${fmtD(f.from)} – ${fmtD(f.to)}`)}
    ${statTile('Completed in period', st.completed.map(c => c.id), 'Lodged or not lodged by the panel', 'ok')}
    ${statTile('Open now', st.openNow.map(c => c.id), 'All received dates', 'info')}
    ${statTile('Overdue now', st.overdue.map(c => c.id), 'Open with a missed deadline', 'bad')}
    <div class="tile warn" style="cursor:default"><div class="k">Median days to panel</div><div class="v num">${fmtN(med.med, 1)}</div><div class="s">Receipt → first decision · n=${med.n}</div></div>
  </div>
  <div class="note small" style="margin-bottom:16px">These three measures overlap and must not be added together: a complaint received in December may still be open in January. It counts in December's <i>received</i> total and in the current <i>open</i> workload.</div>
  ${lodgeSectionHTML(st, f)}
  ${detStatsSection(st, f)}
  ${recStatsHTML(f)}
  ${dutyStatsSection(f)}
  ${statSearchHTML(st, f)}
  <div class="card section"><div class="card-head"><h2>Complaints received per month</h2><span class="muted small">${rc} in period</span></div>${colChart(st.monthly)}</div>
  <div class="grid2 section">
    <div class="card"><h2>Current stage of complaints received in period</h2>${barList(st.stages.filter(s => s.ids.length), rc)}</div>
    <div class="card"><h2>Processing time (days)</h2><div class="tbl-wrap"><table><thead><tr><th>Interval</th><th class="r">Average</th><th class="r">Median</th><th class="r">Cases</th></tr></thead><tbody>${st.proc.map(p => `<tr><td>${esc(p.label)}</td><td class="r">${fmtN(p.avg, 1)}</td><td class="r"><b>${fmtN(p.med, 1)}</b></td><td class="r">${p.n}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Complaints received in the period that have reached both points.</p></div>
    <div class="card"><h2>Pending workload by age</h2>${barList(st.ageB, st.openNow.length)}<p class="small muted">Open complaints by days since receipt.</p></div>
    <div class="card"><h2>Panel performance</h2><dl class="kv"><dt>Meetings held</dt><dd>${st.panel.held} <span class="muted small">(${st.panel.planned} planned, ${st.panel.postponed} postponed/cancelled)</span></dd>
      <dt>Cases considered</dt><dd>${drillLink(st.panel.considered, 'Cases considered by the panel')}</dd><dt>Cases deferred</dt><dd>${drillLink(st.panel.deferred, 'Cases deferred')}</dd><dt>With outstanding panel actions</dt><dd>${drillLink(st.panel.actionsOpen, 'Cases with outstanding panel actions')}</dd></dl></div>
    <div class="card"><h2>Information requests</h2><dl class="kv"><dt>Sent in period</dt><dd>${drillLink(st.info.sent.map(r => r.cid), 'Information requests sent', st.info.sent.length)}</dd><dt>Responses received in period</dt><dd>${drillLink(st.info.received.map(r => r.cid), 'Responses received', st.info.received.length)}</dd><dt>Pending now</dt><dd>${drillLink(st.info.pending.map(r => r.cid), 'Pending information requests', st.info.pending.length)}</dd><dt>Overdue now</dt><dd>${drillLink(st.info.overdue.map(r => r.cid), 'Overdue information requests', st.info.overdue.length)}</dd></dl></div>
    <div class="card"><h2>Investigation referrals</h2><dl class="kv"><dt>Referred in period</dt><dd>${drillLink(st.ref.referred.map(r => r.cid), 'Referred', st.ref.referred.length)}</dd><dt>Acknowledged, in progress</dt><dd>${drillLink(st.ref.acknowledged.map(r => r.cid), 'Acknowledged referrals', st.ref.acknowledged.length)}</dd><dt>Awaiting response</dt><dd>${drillLink(st.ref.awaiting.map(r => r.cid), 'Awaiting response', st.ref.awaiting.length)}</dd><dt>Responded in period</dt><dd>${drillLink(st.ref.responded.map(r => r.cid), 'Responded', st.ref.responded.length)}</dd></dl></div>
  </div>
  <div class="card section"><h2>Registration Officer performance</h2>${st.officers.length ? `<div class="tbl-wrap"><table><thead><tr><th>Officer</th><th class="r">Open caseload</th><th class="r">Reviews completed in period</th><th class="r">Overdue cases</th><th class="r">Overdue tasks</th><th class="r">Avg days assignment → ready</th></tr></thead><tbody>${st.officers.map(o => `<tr><td>${esc(nm(o.id))}</td><td class="r">${drillLink(o.open, 'Open: ' + nm(o.id))}</td><td class="r">${drillLink(o.done, 'Completed reviews: ' + nm(o.id))}</td><td class="r">${drillLink(o.overdueCases, 'Overdue: ' + nm(o.id))}</td><td class="r">${o.tasksOver}</td><td class="r">${fmtN(o.avg, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No Registration Officers.</div>'}</div>
  <div class="grid2 section">
    <div class="card"><h2>By main category</h2>${barList(st.byCat, rc)}</div>
    <div class="card"><h2>By rights domain</h2>${barList(st.byDomain, rc)}</div>
    <div class="card"><h2>Most frequent specific issues</h2>${barList(st.byIssue, rc)}</div>
    <div class="card"><h2>Affected groups</h2>${barList(st.byGroup, rc)}<p class="small muted">A complaint can involve several groups.</p></div>
    <div class="card"><h2>Cross-cutting topics</h2>${barList(st.byTopic, rc)}</div>
    <div class="card"><h2>By atoll</h2>${barList(st.byAtoll, rc)}</div>
    <div class="card"><h2>Recorded panel outcomes</h2>${barList(st.outcomes, st.decisions.length)}<p class="small muted">Decisions recorded in the period.</p></div>
    <div class="card"><h2>Data quality</h2>${barList(st.dq.map(([label, ids]) => ({ label, ids })), 0)}<p class="small muted">All complaints matching the filters, regardless of date.</p></div>
  </div>`;
};
function drillLink(ids, label, count) { const n = count ?? new Set(ids).size; if (!n || !drillable()) return `<span class="num">${n}</span>`; return `<button class="btn link num" data-act="statDrill" data-k="${drillKey(ids, label)}">${n}</button>`; }
ON.statFilter = el => { S.sf = { ...S.sf, [el.name]: el.value || undefined }; render(); };

ACT.statExport = el => {
  const f = S.sf || defaultStatsFilter(); const st = computeStats(f); const fmt = el.dataset.fmt;
  const filt = [['Period', `${f.from || ''} to ${f.to || ''}`], ['Stage', f.stage ? stageLabel(f.stage) : 'All'], ['Setting', f.det ? (f.det === 'any' ? 'Any detention setting' : f.det === 'none' ? 'Not a detention setting' : detTypeLabel(f.det)) : 'All'], ['Officer', f.officer ? nm(f.officer) : 'All'], ['Category', f.category || 'All'], ['Atoll', f.atoll ? ATOLL[f.atoll] : 'All'], ['Meeting', f.meeting ? S.meetings[f.meeting]?.date : 'All'], ['Referral', f.ref || 'All'], ['Panel decision', f.dec || 'All']];
  const summary = [['Indicator', 'Value', 'Definition'], ['Received in period', st.received.length, 'Date received within the period'], ['Completed in period', st.completed.length, 'Reached ready-for-next-step, referred or closed within the period'], ['Open now', st.openNow.length, 'Not completed, any received date'], ['Overdue now', st.overdue.length, 'Open with a missed deadline'], ['Lodged in period', st.lodge.lodged.length, 'Final panel decision: lodged'], ['Not lodged in period', st.lodge.notLodged.length, 'Final panel decision: not lodged'], ['Lodgement rate %', st.lodge.rate ?? '', 'Lodged / (lodged + not lodged)'],
    ['Meetings held', st.panel.held, ''], ['Cases considered by panel', st.panel.considered.length, 'Decisions recorded in period'], ['Cases deferred', st.panel.deferred.length, ''], ['Information requests sent', st.info.sent.length, ''], ['Information requests pending now', st.info.pending.length, ''], ['Information requests overdue now', st.info.overdue.length, ''], ['Referrals sent in period', st.ref.referred.length, ''], ['Referrals awaiting response', st.ref.awaiting.length, '']];
  const sheets = [
    { name: 'Summary', rows: [['FREMYS statistics', `Generated ${fmtDT(nowISO())}`], [], ...filt, [], ...summary] },
    ...(dutyRange(f).length ? [{ name: '1424 calls per day', rows: [['Date', 'Day', 'Officer', 'Hours', 'Calls', ...CALL_TYPES.map(([, l]) => l), 'Logged'], ...dutyRange(f).map(([d, x]) => [d, WD[dow(d)], nm(x.officer), dutyHours(d, x)[2], dutyCalls(x), ...CALL_TYPES.map(([k]) => vals(x.logs).reduce((s2, g) => s2 + (Number(g.types?.[k]) || 0), 0)), vals(x.logs).length ? 'Yes' : 'No'])] }] : []),
    ...(st.received.some(detOf) ? [{ name: 'Detention settings', rows: detExportRows(st) }] : []),
    { name: 'Monthly received', rows: [['Month', 'Received'], ...st.monthly.map(m => [m.m, m.ids.length])] },
    { name: 'Stages', rows: [['Current stage (received in period)', 'Count', '%'], ...st.stages.map(s => [s.label, s.ids.length, st.received.length ? +(s.ids.length / st.received.length * 100).toFixed(1) : 0])] },
    { name: 'Processing time', rows: [['Interval', 'Average days', 'Median days', 'Cases'], ...st.proc.map(p => [p.label, p.avg == null ? '' : +p.avg.toFixed(1), p.med == null ? '' : +p.med.toFixed(1), p.n])] },
    { name: 'Workload age', rows: [['Age of open complaints', 'Count'], ...st.ageB.map(a => [a.label, a.ids.length])] },
    { name: 'Officers', rows: [['Officer', 'Open caseload', 'Reviews completed in period', 'Overdue cases', 'Overdue tasks', 'Avg days assignment to ready'], ...st.officers.map(o => [nm(o.id), o.open.length, o.done.length, o.overdueCases.length, o.tasksOver, o.avg == null ? '' : +o.avg.toFixed(1)])] },
    { name: 'Category', rows: [['Main category', 'Received in period'], ...st.byCat.map(x => [x.label, x.ids.length])] },
    { name: 'Rights domain', rows: [['Rights domain', 'Received in period'], ...st.byDomain.map(x => [x.label, x.ids.length])] },
    { name: 'Specific issues', rows: [['Specific issue (top 12)', 'Received in period'], ...st.byIssue.map(x => [x.label, x.ids.length])] },
    { name: 'Affected groups', rows: [['Group', 'Complaints'], ...st.byGroup.map(x => [x.label, x.ids.length])] },
    { name: 'Cross-cutting', rows: [['Topic', 'Complaints'], ...st.byTopic.map(x => [x.label, x.ids.length])] },
    { name: 'Atoll', rows: [['Atoll', 'Received in period'], ...st.byAtoll.map(x => [x.label, x.ids.length])] },
    { name: 'Lodgement', rows: [['Measure', 'Value'], ['Lodged in period', st.lodge.lodged.length], ['Not lodged in period', st.lodge.notLodged.length], ['Lodgement rate %', st.lodge.rate ?? ''], ['Returned for clarification', st.lodge.returned.length], [], ['Month', 'Lodged', 'Not lodged'], ...st.lodge.monthly.map(r => [r.m, r.lo.length, r.nl.length]), [], ['Reason not lodged', 'Cases'], ...st.lodge.reasons.map(r => [r.label, r.ids.length]), [], ['Main category', 'Lodged', 'Not lodged', 'Rate %'], ...st.lodge.byCat.map(r => [r.label, r.lo.length, r.nl.length, pctOf(r.lo.length, r.lo.length + r.nl.length)])] },
    { name: 'Outcomes', rows: [['Panel outcome', 'Decisions in period'], ...st.outcomes.map(x => [x.label, x.ids.length])] },
    { name: 'Data quality', rows: [['Check', 'Complaints'], ...st.dq.map(([l, ids]) => [l, ids.length])] },
  ];
  if (S.sterm) { const m = termMatcher(S.sterm); const any = st.received.filter(m.any); const lbl = S.sterm.type === 'word' ? `"${S.sterm.q}"` : S.sterm.label; sheets.splice(1, 0, { name: 'Search result', rows: [['Search', lbl], ['Cases received in period', any.length], ['Share of all received', st.received.length ? +(any.length / st.received.length * 100).toFixed(1) + '%' : ''], ['Open now', any.filter(c => !isDone(c)).length], ['Overdue', any.filter(isOverdue).length], [], ['Registration no.', 'Date received', 'Category', 'Subcategory', 'Stage'], ...any.map(c => [c.regNo, c.dateReceived, c.category || '', c.subcategory || '', stageLabel(c.stage)])] }); }
  const fn = `FREMYS-statistics-${f.from || 'start'}-to-${f.to || today()}`;
  if (fmt === 'xlsx') exportXLSX(fn + '.xlsx', sheets);
  else if (fmt === 'csv') exportCSV(fn + '.csv', sheets.flatMap(s => [[s.name], ...s.rows, []]));
  else { const doc = pdfDoc('Registration statistics', `${fmtD(f.from)} – ${fmtD(f.to)}`); if (!doc) return; pdfTable(doc, 'Filters', ['Filter', 'Value'], filt); sheets.slice(1).forEach(s => pdfTable(doc, s.name, s.rows[0], s.rows.slice(1))); pdfTable(doc, 'Summary', summary[0], summary.slice(1)); pdfSave(doc, fn + '.pdf'); }
};

/* ---------- Search statistics: a category, subcategory, group, topic or any word ---------- */
function termMatcher(term) {
  const X = catIndex();
  const allIssues = c => { const cl = clsOf(c); return [cl.issueId, ...(cl.secondary || [])].filter(Boolean); };
  switch (term.type) {
    case 'cat': return { main: c => clsOf(c).catId === term.id || (!clsOf(c).catId && normName(c.category) === normName(term.label)), any: c => clsOf(c).catId === term.id || allIssues(c).some(i => X.byIssue[i]?.c === term.id) };
    case 'sub': return { main: c => clsOf(c).subId === term.id, any: c => clsOf(c).subId === term.id || allIssues(c).some(i => X.byIssue[i]?.s === term.id) };
    case 'issue': return { main: c => clsOf(c).issueId === term.id, any: c => allIssues(c).includes(term.id) };
    case 'gid': return { any: c => (clsOf(c).groups || []).some(g => X.groupBy[g]?.gid === term.id) };
    case 'group': return { any: c => (clsOf(c).groups || []).includes(term.id) };
    case 'topic': return { any: c => (clsOf(c).topics || []).includes(term.id) };
    default: { // a word: complaint text, respondent, classification names and catalogue keywords
      const w = normName(term.q); const hit = s => normName(s).includes(w);
      return { any: c => { const cl = clsOf(c); return hit(c.summary) || hit(c.respondent?.name) || hit(c.category) || hit(c.subcategory) || allIssues(c).some(i => { const x = X.byIssue[i]; return x && (hit(x.in) || hit(x.sn) || hit(x.k)); }) || (cl.groups || []).some(g => hit(X.groupBy[g]?.p) || hit(X.groupBy[g]?.g)) || (cl.topics || []).some(t => hit(X.topicBy[t]?.t)); } };
    }
  }
}
function termSuggestions(q) {
  const X = catIndex(); const out = []; const qq = normName(q); if (qq.length < 2) return out;
  X.cats.forEach(c => { if (scoreText(q, c.name + ' ' + c.domain) > 0) out.push({ type: 'cat', id: c.id, label: c.name, kind: 'Main category', s: scoreText(q, c.name) + 1 }); });
  Object.values(X.subs).forEach(s => { const iss = s.issues.map(i => `${i.in} ${i.k}`).join(' '); const sc = scoreText(q, `${s.name} ${iss}`); if (sc > 0) out.push({ type: s.issues.length === 1 ? 'issue' : 'sub', id: s.issues.length === 1 ? s.issues[0].i : s.id, label: s.name, kind: 'Subcategory · ' + X.catMap[s.c].name, s: sc }); });
  const gseen = new Set(); catalogue().groups.forEach(g => { if (!gseen.has(g.gid) && scoreText(q, g.g) > 0) { gseen.add(g.gid); out.push({ type: 'gid', id: g.gid, label: g.g, kind: 'Affected group (all profiles)', s: scoreText(q, g.g) + 1 }); } if (scoreText(q, `${g.p} ${g.k}`) > 0) out.push({ type: 'group', id: g.id, label: `${g.g}: ${g.p}`, kind: 'Group profile', s: scoreText(q, g.p) }); });
  catalogue().topics.forEach(t => { const sc = scoreText(q, `${t.t} ${t.h}`); if (sc > 0) out.push({ type: 'topic', id: t.id, label: t.t, kind: 'Cross-cutting topic', s: sc }); });
  return out.sort((a, b) => b.s - a.s).slice(0, 9);
}
function statSearchHTML(st, f) {
  const t = S.sterm; const base = st.received; const rc = base.length;
  const ex = ['passport', 'detention', 'wages', 'Children', 'school', 'eviction', 'Migrant Workers', 'Right to Health'];
  let res = '';
  if (t) {
    const m = termMatcher(t); const any = base.filter(m.any); const main = m.main ? base.filter(m.main) : null; const pct = n => rc ? fmtN(n / rc * 100, 1) + '%' : '—';
    const open = any.filter(c => !isDone(c)); const over = any.filter(isOverdue); const done = any.filter(c => DONE_STAGES.includes(c.stage));
    const months = st.monthly.map(mo => ({ m: mo.m, ids: mo.ids.filter(id => any.some(c => c.id === id)) }));
    const by = (fn, lbl) => { const o = {}; any.forEach(c => { [...new Set([].concat(fn(c)).filter(Boolean))].forEach(k => { (o[k] = o[k] || []).push(c.id); }); }); return Object.entries(o).map(([k, ids]) => ({ label: lbl ? lbl(k) : k, ids })).sort((a, b) => b.ids.length - a.ids.length); };
    const X = catIndex(); const self = t.type === 'issue' ? t.id : null;
    const co = by(c => { const cl = clsOf(c); return [cl.issueId, ...(cl.secondary || [])].filter(i => i && i !== self); }, k => X.byIssue[k]?.in || k).slice(0, 6);
    const days = any.map(c => { const d = firstDecisionAt(c); return d ? dayDiff(c.dateReceived, d) : null; }).filter(x => x != null);
    const label = t.type === 'word' ? `Cases mentioning “${t.q}”` : t.label;
    res = `<div class="row" style="justify-content:space-between;margin:12px 0 6px"><div><b style="font-size:16px">${esc(label)}</b> <span class="muted small">${esc(t.kind || 'Word or phrase')}</span></div><button class="btn sm" data-act="clearSTerm">Clear</button></div>
      <div class="tiles" style="margin-bottom:12px">
        ${statTile('Cases', any.map(c => c.id), `${pct(any.length)} of ${rc} received in period`, '', label)}
        ${main ? statTile('As the main issue', main.map(c => c.id), `${pct(main.length)} · ${any.length - main.length} more as another issue`, 'info', label + ' (main issue)') : ''}
        ${statTile('Open now', open.map(c => c.id), any.length ? fmtN(open.length / any.length * 100, 0) + '% of these cases' : '—', 'warn', label + ' — open')}
        ${statTile('Overdue', over.map(c => c.id), 'Open with a missed deadline', 'bad', label + ' — overdue')}
        ${statTile('Lodged', any.filter(isLodged).map(c => c.id), (() => { const lo = any.filter(isLodged).length, nl = any.filter(isNotLodged).length; return lo + nl ? `Lodgement rate ${pctOf(lo, lo + nl)}%` : 'No final decisions yet'; })(), 'ok', label + ' — lodged')}
        ${statTile('Not lodged', any.filter(isNotLodged).map(c => c.id), 'Closed by the panel', '', label + ' — not lodged')}
        <div class="tile" style="cursor:default"><div class="k">Median days to panel</div><div class="v num">${fmtN(median(days), 1)}</div><div class="s">n=${days.length}</div></div>
      </div>
      ${any.length ? `<div class="grid2"><div class="card" style="box-shadow:none"><h3>Per month</h3>${colChart(months)}</div>
        <div class="card" style="box-shadow:none"><h3>Current stage</h3>${barList(by(c => stageLabel(c.stage)), any.length)}</div>
        <div class="card" style="box-shadow:none"><h3>By atoll</h3>${barList(by(c => ATOLL[c.atoll] || 'Not recorded').slice(0, 8), any.length)}</div>
        <div class="card" style="box-shadow:none"><h3>By respondent type</h3>${barList(by(c => c.respondent?.type || 'Not recorded'), any.length)}</div>
        <div class="card" style="box-shadow:none"><h3>Issues that occur with it</h3>${barList(co, any.length)}</div>
        <div class="card" style="box-shadow:none"><h3>Affected groups</h3>${barList(by(c => (clsOf(c).groups || []).map(g => X.groupBy[g]?.g)).slice(0, 6), any.length)}</div></div>` : '<div class="empty">No complaints received in this period match. Widen the dates or clear other filters.</div>'}`;
  }
  return `<div class="card"><div class="card-head"><h2>Search statistics</h2><span class="muted small">Counts use the period and filters above</span></div>
    <div class="typeahead" style="max-width:560px"><input id="s_term" type="search" placeholder="Category, subcategory, group, topic or any word, e.g. passport" data-on="input:sTermInput" autocomplete="off" value="${esc(t?.type === 'word' ? t.q : '')}"><div id="s_sug" class="ta-list hidden"></div></div>
    ${!t ? `<div class="row" style="margin-top:8px"><span class="muted small">Try:</span>${ex.map(e => `<button class="btn sm" data-act="sTermQuick" data-q="${esc(e)}">${esc(e)}</button>`).join('')}</div>` : ''}
    ${res}</div>`;
}
ON.sTermInput = el => {
  const box = $('#s_sug'); const q = el.value.trim(); if (!q) { box.classList.add('hidden'); return; }
  const sug = termSuggestions(q); S._sug = sug; box.classList.remove('hidden');
  box.innerHTML = `<button type="button" data-act="pickSTerm" data-i="-1"><span><b>Any case mentioning “${esc(q)}”</b> <span class="muted small">word search in summaries, respondents and classifications</span></span></button>` + sug.map((s, i) => `<button type="button" data-act="pickSTerm" data-i="${i}"><span><b>${esc(s.label)}</b> <span class="muted small">${esc(s.kind)}</span></span></button>`).join('');
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 's_term' && e.target.value.trim()) { e.preventDefault(); S.sterm = { type: 'word', q: e.target.value.trim() }; render(); } });
ACT.pickSTerm = el => { const i = +el.dataset.i; const q = $('#s_term').value.trim(); S.sterm = i < 0 ? { type: 'word', q } : S._sug[i]; render(); };
ACT.sTermQuick = el => { const q = el.dataset.q; const sug = termSuggestions(q); const exact = sug.find(s => normName(s.label) === normName(q)); S.sterm = exact || { type: 'word', q }; render(); };
ACT.clearSTerm = () => { S.sterm = null; render(); };

/* ---------- Lodged / not lodged ---------- */
function decisionColChart(rows) {
  const W = 720, H = 230, L = 34, R = 10, Tp = 18, B = 34; const n = rows.length || 1;
  const max = Math.max(1, ...rows.map(r => Math.max(r.lo.length, r.nl.length))); const nice = x => { const p = 10 ** Math.floor(Math.log10(x)); const q = x / p; return (q <= 1 ? 1 : q <= 2 ? 2 : q <= 5 ? 5 : 10) * p; }; const step = max <= 4 ? 1 : nice(max / 4); const top = Math.ceil(max / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - v / top); const bw = (W - L - R) / n;
  let g = ''; for (let v = 0; v <= top; v += step) g += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  rows.forEach((r, i) => { const [yy, mm] = r.m.split('-'); const x0 = L + i * bw + bw * 0.14; const w = bw * 0.34;
    [[r.lo, '#059669', 'Lodged'], [r.nl, '#64748b', 'Not lodged']].forEach(([ids, col, lab], j) => { const x = x0 + j * w; const v = ids.length; g += `<rect x="${x}" y="${y(v)}" width="${w - 1}" height="${Math.max(0, y(0) - y(v))}" fill="${col}" rx="1.5" data-act="statDrill" data-k="${drillKey(ids, lab + ' ' + MONTHS[+mm - 1] + ' ' + yy)}" style="cursor:pointer"><title>${lab}, ${MONTHS[+mm - 1]} ${yy}: ${v}</title></rect>${v ? `<text x="${x + (w - 1) / 2}" y="${y(v) - 3}" text-anchor="middle" style="fill:#0f172a;font-weight:600;font-size:10px">${v}</text>` : ''}`; });
    g += `<text x="${x0 + w}" y="${H - B + 15}" text-anchor="middle">${MONTHS[+mm - 1]}</text>${(i === 0 || mm === '01') ? `<text x="${x0 + w}" y="${H - B + 28}" text-anchor="middle">${yy}</text>` : ''}`; });
  return `<div class="colchart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lodged and not lodged per month">${g}</svg></div>`;
}
function lodgeSectionHTML(st, f) {
  const L = st.lodge; const tot = L.lodged.length + L.notLodged.length; const ids = a => a.map(c => c.id);
  return `<div class="card section" style="border-top:5px solid #059669"><div class="card-head"><h2>Panel decisions: lodged and not lodged</h2><span class="muted small">Final decisions (after the Commission) dated ${fmtD(f.from)} – ${fmtD(f.to)}</span></div>
    <div class="tiles" style="margin-bottom:12px">
      ${statTile('Lodged', ids(L.lodged), 'Forwarded to Investigation', 'ok', 'Lodged in period')}
      ${statTile('Not lodged', ids(L.notLodged), 'Closed by the panel', '', 'Not lodged in period')}
      <div class="tile ${L.rate == null ? '' : L.rate >= 50 ? 'ok' : 'warn'}" style="cursor:default"><div class="k">Lodgement rate</div><div class="v num">${L.rate == null ? '—' : L.rate + '%'}</div><div class="s">Lodged ÷ ${tot} final decisions</div></div>
      ${statTile('Returned for clarification', ids(L.returned), 'Cases returned in the period', 'warn', 'Returned in period')}
      ${statTile('Awaiting Commission', st.all.filter(c => pendingCommission(c).length).map(c => c.id), 'Panel decided; not yet final', 'info', 'Awaiting Commission decision')}
      ${statTile('Changed by the Commission', st.all.filter(c => vals(c.decisions).some(d => d.commission && d.commission.status === 'rejected' && inP(d.commission.at, f))).map(c => c.id), (() => { const ds = st.all.flatMap(c => vals(c.decisions).filter(d => d.commission && inP(d.commission.at, f))); return ds.length ? `Commission agreed with ${pctOf(ds.filter(d => d.commission.status === 'approved').length, ds.length)}% of ${ds.length}` : 'No Commission decisions in period'; })(), 'bad', 'Panel decision changed by the Commission')}
      ${statTile('Interim letters to send', st.all.filter(interimPending).map(c => c.id), `${st.all.filter(c => interimPending(c) && c.interim.due < today()).length} overdue · ${st.all.filter(c => interimSent(c) && inP(c.interim.sentAt, f)).length} sent in period`, 'warn', 'Interim letter to send')}
      <div class="tile" style="cursor:default"><div class="k">Median days to final decision</div><div class="v num">${fmtN(median(L.days), 1)}</div><div class="s">From receipt · n=${L.days.length}</div></div>
    </div>
    ${tot ? `<div class="grid2">
      <div><h3 style="margin-bottom:6px">Per month</h3>${decisionColChart(L.monthly)}<div class="row small" style="gap:12px;justify-content:center"><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:#059669"></span>Lodged</span><span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:#64748b"></span>Not lodged</span></div></div>
      <div><h3 style="margin-bottom:6px">Reasons for not lodging</h3>${barList(L.reasons, L.notLodged.length)}
        <h3 style="margin:14px 0 6px">Rounds before the final decision</h3>${barList(L.rounds, tot)}</div>
    </div>
    <h3 style="margin:16px 0 6px">Lodgement by main category</h3>
    <div class="tbl-wrap"><table><thead><tr><th>Main category</th><th class="r">Lodged</th><th class="r">Not lodged</th><th class="r">Lodgement rate</th><th style="width:30%"></th></tr></thead><tbody>${L.byCat.map(r => { const t2 = r.lo.length + r.nl.length; const rt = pctOf(r.lo.length, t2); return `<tr><td>${esc(r.label)}</td><td class="r">${drillLink(r.lo, 'Lodged: ' + r.label)}</td><td class="r">${drillLink(r.nl, 'Not lodged: ' + r.label)}</td><td class="r"><b>${rt}%</b></td><td><div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:#7f8fa7"><span style="width:${rt}%;background:#059669"></span></div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No final decisions in this period.</div>'}
  </div>`;
}
