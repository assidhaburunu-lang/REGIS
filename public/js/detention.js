'use strict';
/* Detention and institutional settings: places where people are held or cared for by the State (prisons, police custody,
   immigration detention, juvenile centres, drug treatment and remand centres, State care homes, mental health care).
   A complaint can record the facility, the person's status there and the issues raised; statistics are reported separately. */

const DET_TYPES = {
  prison: ['Prison (Maldives Correctional Service)', '#4338ca'],
  police: ['Police custody', '#0369a1'],
  immigration: ['Immigration detention', '#b45309'],
  juvenile: ['Juvenile detention / correctional', '#be123c'],
  drug: ['Drug treatment and remand (NDA)', '#047857'],
  care: ['State care home', '#7c3aed'],
  health: ['Mental health / hospital ward', '#0f766e'],
  other: ['Other place of deprivation of liberty', '#64748b'],
};
// [id, name, type, operator, place]. Edit here when facilities open, close or are renamed.
const FACILITIES_DEFAULT = [
  ['mcs_maafushi', 'Maafushi Prison', 'prison', 'Maldives Correctional Service', 'K. Maafushi'],
  ['mcs_asseyri', 'Asseyri Prison', 'prison', 'Maldives Correctional Service', 'K. Himmafushi'],
  ['mcs_male', "Malé Prison", 'prison', 'Maldives Correctional Service', "Malé"],
  ['mcs_hulhumale', "Hulhumalé Prison", 'prison', 'Maldives Correctional Service', "Hulhumalé"],
  ['mcs_ahuluveri', 'Ahuluveri Marukazu (pre-release / parole centre)', 'prison', 'Maldives Correctional Service', ''],
  ['mps_dhoonidhoo', 'Dhoonidhoo Custodial (pre-trial detention)', 'police', 'Maldives Police Service', 'K. Dhoonidhoo'],
  ['mps_male', "Malé Custodial Centre (Atholhuvehi)", 'police', 'Maldives Police Service', "Malé"],
  ['mps_station', 'Police station lock-up (state the island)', 'police', 'Maldives Police Service', ''],
  ['mps_vehicle', 'Police vehicle / during arrest or transfer', 'police', 'Maldives Police Service', ''],
  ['imm_hulhumale', "Hulhumalé Immigration Detention Centre", 'immigration', 'Maldives Immigration / Correctional Service', "Hulhumalé"],
  ['imm_other', 'Other immigration holding place (state where)', 'immigration', 'Maldives Immigration', ''],
  ['juv_asseyri', 'Juvenile Detention Centre, Asseyri Prison', 'juvenile', 'Maldives Correctional Service', 'K. Himmafushi'],
  ['juv_longterm', 'Juvenile Long-Term Secure Facility, Asseyri', 'juvenile', 'Maldives Correctional Service', 'K. Himmafushi'],
  ['juv_hoarafushi', 'Juvenile Residential Treatment Centre', 'juvenile', 'Juvenile justice authority', 'HA. Hoarafushi'],
  ['nda_himmafushi', 'Drug Treatment and Rehabilitation Centre, Himmafushi', 'drug', 'National Drug Agency', 'K. Himmafushi'],
  ['nda_remand', 'Drug Offenders Remand Centre, Himmafushi', 'drug', 'National Drug Agency / Police', 'K. Himmafushi'],
  ['nda_halfway', "Halfway House, Hulhumalé (men / women)", 'drug', 'National Drug Agency', "Hulhumalé"],
  ['nda_hithadhoo', 'Drug Treatment and Detoxification Centre, Hithadhoo', 'drug', 'National Drug Agency', 'S. Hithadhoo'],
  ['nda_fuvahmulah', 'Drug Detoxification and Community Rehabilitation Centre, Fuvahmulah', 'drug', 'National Drug Agency', 'Fuvahmulah City'],
  ['nda_thinadhoo', 'Drug Detoxification and Community Rehabilitation Centre, Thinadhoo', 'drug', 'National Drug Agency', 'GDh. Thinadhoo'],
  ['nda_other', 'Other NDA treatment centre (state where)', 'drug', 'National Drug Agency', ''],
  ['care_hiyaa', "Kudakudhinge Hiyaa (children's home)", 'care', 'Ministry responsible for social and family services', "Villimalé"],
  ['care_fiyavathi', "Fiyavathi (children's home)", 'care', 'Ministry responsible for social and family services', "Hulhumalé"],
  ['care_aman', "Amaan Hiyaa / safe home at a Family and Children's Service Centre", 'care', 'Ministry responsible for social and family services', ''],
  ['care_hpsn', 'Home for People with Special Needs (HPSN)', 'care', 'Ministry responsible for social and family services', 'K. Guraidhoo'],
  ['health_psych', 'Psychiatric ward / mental health unit of a hospital', 'health', 'Health service provider', ''],
  ['other_mndf', 'MNDF facility', 'other', 'Maldives National Defence Force', ''],
  ['other', 'Other place (state the name)', 'other', '', ''],
];
const DET_STATUS = { current: 'Currently held / in care', past: 'Previously held / in care', released_recent: 'Released in the last 30 days', relative: 'Complaint by family about a person held', visitor: 'Visitor or staff member' };
const DET_ISSUES = [['force', 'Ill-treatment or use of force'], ['conditions', 'Living conditions (space, water, sanitation, food)'], ['health', 'Health care and medication'], ['contact', 'Contact with family or lawyer'], ['duration', 'Length or legality of detention'], ['discipline', 'Discipline, isolation or restraint'], ['safety', 'Violence between detainees / residents'], ['procedure', 'Complaints, information or due process'], ['other', 'Other']];

function facilities() { return (cfg().facilities && cfg().facilities.length ? cfg().facilities : FACILITIES_DEFAULT); }
function facility(id) { return facilities().find(f => f[0] === id) || null; }
const detOf = c => (c && c.detention && c.detention.facility ? c.detention : null);
function detName(d) { if (!d) return ''; const f = facility(d.facility); const base = f ? f[1] : d.facility; return (d.facility === 'other' || /state the/.test(base)) && d.place ? `${base.replace(/ \((state|State)[^)]*\)/, '')}: ${d.place}` : base; }
function detType(d) { return d ? (facility(d.facility)?.[2] || 'other') : null; }
const detTypeLabel = k => DET_TYPES[k]?.[0] || k;

function facilityOptions(sel) {
  return `<option value="">Select the facility…</option>` + Object.entries(DET_TYPES).map(([k, [l]]) => { const fs = facilities().filter(f => f[2] === k); return fs.length ? `<optgroup label="${esc(l)}">${fs.map(f => `<option value="${esc(f[0])}" ${f[0] === sel ? 'selected' : ''}>${esc(f[1])}${f[4] && !f[1].includes(f[4]) ? ' — ' + esc(f[4]) : ''}</option>`).join('')}</optgroup>` : ''; }).join('');
}
/* Form block used in registration and in the edit modal. Field names start with det_. */
function detFieldsHTML(d) {
  d = d || {}; const on = !!d.facility;
  return `<div class="f full"><label class="na"><input type="checkbox" name="det_on" id="f_det_on" ${on ? 'checked' : ''} data-on="change:detToggle"> The complaint concerns a detention or institutional setting (prison, police custody, immigration detention, juvenile centre, drug treatment or remand centre, State care home)</label></div>
    <div id="detFields" class="${on ? '' : 'hidden'}" style="display:contents">
      ${fld('Facility', `<select id="f_det_facility" name="det_facility" data-on="change:detFacility">${facilityOptions(d.facility)}</select>`, { id: 'f_det_facility', req: true })}
      ${fld('Island / place or other name', inp('det_place', d.place || '', { ph: 'e.g. police station island, or the name of the place' }), { id: 'f_det_place', hint: 'Needed for police station lock-ups and “other” places.' })}
      ${fld('Status of the person concerned', sel('det_status', Object.entries(DET_STATUS), d.status || 'current'), { id: 'f_det_status' })}
      ${fld('Person held / in care', sel('det_who', [['victim', 'The victim / affected person'], ['complainant', 'The complainant']], d.who || '', { blank: 'Work out from the victim details' }), { id: 'f_det_who' })}
      ${fld('Date admitted / detained (if known)', inp('det_since', d.since || '', { type: 'date', attrs: `max="${today()}"` }), { id: 'f_det_since' })}
      ${fld('Date released (if released)', inp('det_until', d.until || '', { type: 'date', attrs: `max="${today()}"` }), { id: 'f_det_until' })}
      <div class="f full"><label>Issues raised about the setting</label><div class="checks">${DET_ISSUES.map(([k, l]) => `<label><input type="checkbox" data-multi="1" name="det_issues" value="${k}" ${(d.issues || []).includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
    </div>`;
}
ON.detToggle = el => { $('#detFields')?.classList.toggle('hidden', !el.checked); };
ON.detFacility = el => {
  const f = facility(el.value); if (!f) return;
  const r = $('#f_r_name'); if (r && !r.value.trim()) r.value = f[3] && f[2] !== 'other' ? `${f[3]} — ${f[1].replace(/ \((state|State)[^)]*\)/, '')}` : '';
  const rt = $('#f_r_type'); if (rt && !rt.value && f[2] !== 'other') rt.value = 'Government institution';
};
function parseDet(o) {
  if (!o.det_on) return null;
  if (!o.det_facility) throw new Error('Choose the detention or institutional facility, or untick the setting box.');
  const f = facility(o.det_facility);
  if (f && (f[0] === 'other' || /state the/.test(f[1])) && !String(o.det_place || '').trim()) throw new Error('Enter the island, place or name for this facility.');
  if (o.det_since && o.det_until && o.det_until < o.det_since) throw new Error('The release date is before the date admitted.');
  const status = o.det_until && o.det_status === 'current' ? 'past' : (o.det_status || 'current');
  return { facility: o.det_facility, type: f ? f[2] : 'other', place: (o.det_place || '').trim(), status, who: o.det_who || '', since: o.det_since || '', until: o.det_until || '', issues: o.det_issues || [] };
}
function detSummaryHTML(c) {
  const d = detOf(c); if (!d) return '';
  const f = facility(d.facility); const col = DET_TYPES[detType(d)]?.[1] || '#64748b';
  return `<dt>Detention / institutional setting</dt><dd><span class="pill" style="background:${col};color:#fff">${esc(detTypeLabel(detType(d)).replace(/ \(.*\)/, ""))}</span> <b>${esc(detName(d))}</b>${f && f[3] ? ` <span class="muted small">(${esc(f[3])})</span>` : ''}
    <div class="small" style="margin-top:3px">${esc(DET_STATUS[d.status] || d.status || '')} · ${esc(detWhoLabel(c))}${detPeriodText(d) ? ' · ' + esc(detPeriodText(d)) : ''}${(d.issues || []).length ? ' · ' + d.issues.map(k => esc(DET_ISSUES.find(x => x[0] === k)?.[1] || k)).join(', ') : ''}</div></dd>`;
}
ACT.editDetention = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: 'Detention / institutional setting — ' + c.regNo, wide: true, body: `<div class="form">${detFieldsHTML(c.detention)}</div>`, onSubmit: async o => {
    const d = parseDet(o);
    await updC(c.id, { detention: d || { facility: '' } }, { note: d ? `Detention setting recorded: ${detName(d)}` : 'Detention setting removed', action: 'case.edit' });
  } });
};

/* ---------- Statistics ---------- */
function detStatsSection(st, f) {
  const all = st.received; const det = all.filter(detOf); if (!all.length) return '';
  const pct = (n, d) => d ? fmtN(n / d * 100, 0) + '%' : '—';
  const held = det.filter(c => detOf(c).status === 'current'); const open = det.filter(c => !isDone(c)); const lodged = det.filter(isLodged); const notL = det.filter(isNotLodged);
  const nonDet = all.filter(c => !detOf(c)); const lodgeRate = arr => { const dec = arr.filter(c => isLodged(c) || isNotLodged(c)); return dec.length ? arr.filter(isLodged).length / dec.length * 100 : null; };
  const lrD = lodgeRate(det), lrN = lodgeRate(nonDet);
  const byType = Object.entries(DET_TYPES).map(([k, [l, col]]) => ({ k, label: l, col, ids: det.filter(c => detType(detOf(c)) === k).map(c => c.id) })).filter(x => x.ids.length).sort((a, b) => b.ids.length - a.ids.length);
  const facRows = {}; det.forEach(c => { const d = detOf(c); const key = d.facility === 'other' || /state the/.test(facility(d.facility)?.[1] || '') ? d.facility + '|' + normName(d.place) : d.facility; const r = facRows[key] = facRows[key] || { name: detName(d), type: detType(d), ids: [], open: 0, held: 0, lodged: 0, notL: 0, issues: {} }; r.ids.push(c.id); if (!isDone(c)) r.open++; if (d.status === 'current') r.held++; if (isLodged(c)) r.lodged++; if (isNotLodged(c)) r.notL++; (d.issues || []).forEach(k => r.issues[k] = (r.issues[k] || 0) + 1); });
  const facs = Object.values(facRows).sort((a, b) => b.ids.length - a.ids.length);
  const issues = DET_ISSUES.map(([k, l]) => ({ label: l, ids: det.filter(c => (detOf(c).issues || []).includes(k)).map(c => c.id) })).filter(x => x.ids.length).sort((a, b) => b.ids.length - a.ids.length);
  const status = Object.entries(DET_STATUS).map(([k, l]) => ({ label: l, ids: det.filter(c => detOf(c).status === k).map(c => c.id) })).filter(x => x.ids.length);
  const cnt = {}; det.forEach(c => { const id = clsOf(c)?.issueId; if (id) cnt[id] = (cnt[id] || []).concat(c.id); }); const X = catIndex();
  const topIssues = Object.entries(cnt).map(([id, ids]) => ({ label: X.byIssue[id]?.in || X.byIssue[id]?.sn || id, ids })).sort((a, b) => b.ids.length - a.ids.length).slice(0, 8);
  // monthly stacked by type
  const months = st.monthly.map(m => m.m); const monthly = months.map(m => ({ m, by: Object.fromEntries(Object.keys(DET_TYPES).map(k => [k, det.filter(c => String(c.dateReceived).startsWith(m) && detType(detOf(c)) === k).length])), all: all.filter(c => String(c.dateReceived).startsWith(m)).length }));
  const maxM = Math.max(1, ...monthly.map(x => x.all));
  const typeLegend = byType.map(x => `<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:${x.col}"></span>${esc(x.label)}</span>`).join('');
  return `<div class="card section" style="border-top:5px solid #4338ca"><div class="card-head"><h2>Detention and institutional settings</h2><span class="muted small">Complaints received in the period that concern a place where people are held or cared for by the State</span></div>
    ${det.length ? `<div class="tiles" style="margin-bottom:12px">
      ${statTile('Detention-related complaints', det.map(c => c.id), `${pct(det.length, all.length)} of ${all.length} received`, 'info')}
      ${statTile('Person currently held', held.map(c => c.id), 'At the time of the complaint')}
      ${statTile('Still open', open.map(c => c.id), 'Not yet lodged or not lodged', 'warn')}
      ${statTile('Lodged', lodged.map(c => c.id), lrD == null ? 'No final decisions yet' : `${fmtN(lrD, 0)}% of decided (others: ${lrN == null ? '—' : fmtN(lrN, 0) + '%'})`, 'ok')}
      ${statTile('Not lodged', notL.map(c => c.id), 'Final decision in the record')}
    </div>
    <div class="grid2">
      <div><h3 style="margin:0 0 6px">By type of setting</h3>${barList(byType.map(x => ({ label: x.label, ids: x.ids })), det.length)}</div>
      <div><h3 style="margin:0 0 6px">Issues raised about the setting</h3>${issues.length ? barList(issues, det.length) : '<div class="empty">No setting issues recorded.</div>'}<p class="small muted">A complaint can raise several issues.</p></div>
    </div>
    <h3 style="margin:16px 0 6px">By facility</h3>
    <div class="tbl-wrap"><table><thead><tr><th>Facility</th><th>Type</th><th class="r">Complaints</th><th class="r">Currently held</th><th class="r">Open</th><th class="r">Lodged</th><th class="r">Not lodged</th><th>Main issues</th></tr></thead><tbody>${facs.map(r => `<tr><td>${esc(r.name)}</td><td><span class="small" style="display:inline-flex;gap:5px;align-items:center;white-space:nowrap"><span style="width:9px;height:9px;border-radius:2px;background:${DET_TYPES[r.type]?.[1]}"></span>${esc((DET_TYPES[r.type]?.[0] || '').replace(/ \(.*\)/, ''))}</span></td><td class="r"><b>${drillLink(r.ids, r.name)}</b></td><td class="r">${r.held}</td><td class="r">${r.open}</td><td class="r">${r.lodged}</td><td class="r">${r.notL}</td><td class="small">${Object.entries(r.issues).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => esc(DET_ISSUES.find(x => x[0] === k)?.[1].replace(/ \(.*\)/, '') || k) + ' (' + n + ')').join(', ') || '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="grid2" style="margin-top:16px">
      <div><h3 style="margin:0 0 6px">Received per month</h3><div class="det-months">${monthly.map(x => `<div class="dm" title="${esc(x.m)}: ${Object.values(x.by).reduce((a, b) => a + b, 0)} of ${x.all} complaints"><div class="dm-bar" style="height:${x.all / maxM * 86}%">${Object.entries(x.by).filter(([, n]) => n).map(([k, n]) => `<span style="flex:${n};background:${DET_TYPES[k][1]}"></span>`).join('')}<span style="flex:${x.all - Object.values(x.by).reduce((a, b) => a + b, 0)};background:rgba(100,116,139,.35)"></span></div><div class="dm-l">${MONTHS[+x.m.slice(5) - 1]}</div></div>`).join('')}</div>
        <div class="row small" style="gap:10px;margin-top:6px">${typeLegend}<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:10px;border-radius:2px;background:rgba(100,116,139,.35)"></span>Other complaints</span></div></div>
      <div><h3 style="margin:0 0 6px">Most frequent classified issues</h3>${topIssues.length ? barList(topIssues, det.length) : '<div class="empty">Not classified yet.</div>'}
        <h3 style="margin:14px 0 6px">Status of the person concerned</h3>${barList(status, det.length)}</div>
    </div>` : '<div class="empty">No complaints received in the period are recorded as concerning a detention or institutional setting.</div>'}
  </div>`;
}
function detExportRows(st) {
  return [['Registration no.', 'Date received', 'Type of setting', 'Facility', 'Operator', 'Status of person', 'Date admitted', 'Issues raised', 'Stage', 'Final decision'],
    ...st.received.filter(detOf).map(c => { const d = detOf(c); const fd = finalDecision(c); return [c.regNo, c.dateReceived, detTypeLabel(detType(d)), detName(d), facility(d.facility)?.[3] || '', DET_STATUS[d.status] || '', d.since || '', (d.issues || []).map(k => DET_ISSUES.find(x => x[0] === k)?.[1] || k).join('; '), stageLabel(c.stage), fd ? outcomeLabel(fd.outcome) : '']; })];
}

/* ---------- The person held, and how long ---------- */
// Who was held: as recorded; otherwise the victim(s) when recorded separately, else the complainant. Visitors/staff: nobody.
function detHeldPeople(c) {
  const d = detOf(c); if (!d || d.status === 'visitor') return { complainant: false, victims: [] };
  const vids = Object.keys(c.victimLinks || {});
  const who = d.who || (vids.length ? 'victim' : 'complainant');
  return who === 'complainant' ? { complainant: true, victims: [] } : { complainant: !vids.length, victims: vids };
}
function detWhoLabel(c) { const h = detHeldPeople(c); return h.victims.length ? (h.victims.length > 1 ? 'Victims held' : 'Victim held') : h.complainant ? 'Complainant held' : 'Not held (visitor / staff)'; }
const detHeldNow = d => (d.status === 'current' || d.status === 'relative') && !d.until;
function detDays(d) { if (!d.since) return null; const end = d.until || (detHeldNow(d) ? today() : null); return end ? Math.max(0, dayDiff(d.since, end)) : null; }
function fmtDur(days) {
  if (days == null) return ''; if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30.44);
  return [y && `${y} year${y > 1 ? 's' : ''}`, m && `${m} month${m > 1 ? 's' : ''}`].filter(Boolean).join(' ') || `${days} days`;
}
function detPeriodText(d) {
  const days = detDays(d); const ongoing = detHeldNow(d);
  if (!d.since) return d.until ? `released ${fmtD(d.until)}` : '';
  return `${fmtD(d.since)} – ${d.until ? fmtD(d.until) : ongoing ? 'now' : 'release date not known'}${days != null ? ` (${fmtDur(days)}${ongoing ? ' so far' : ''})` : ''}`;
}
function personDetentions(type, id, cases) {
  return cases.filter(detOf).filter(c => { const h = detHeldPeople(c); return type === 'complainants' ? h.complainant && c.complainantId === id : h.victims.includes(id); })
    .map(c => ({ c, d: detOf(c) })).sort((a, b) => String(b.d.since || b.c.dateReceived).localeCompare(String(a.d.since || a.c.dateReceived)));
}
function personDetCurrent(list) { return list.find(x => detHeldNow(x.d)) || null; }
function personDetentionHTML(type, id, cases) {
  const list = personDetentions(type, id, cases); if (!list.length) return '';
  const cur = personDetCurrent(list); const known = list.map(x => detDays(x.d)).filter(x => x != null); const total = known.reduce((a, b) => a + b, 0);
  return `<div class="card section" style="border-inline-start:5px solid ${cur ? DET_TYPES[detType(cur.d)]?.[1] : '#64748b'}"><div class="card-head"><h2>Detention and institutional settings</h2>${cur ? pill('Held / in care at last report', 'bad') : pill('Not reported as currently held', 'muted')}</div>
    ${cur ? `<p style="margin:0 0 10px"><b>${esc(detName(cur.d))}</b> <span class="muted small">(${esc(detTypeLabel(detType(cur.d)).replace(/ \(.*\)/, ""))})</span><br>${cur.d.since ? `Held since <b>${fmtD(cur.d.since)}</b> — <b>${fmtDur(detDays(cur.d))}</b> so far` : 'Date admitted not known'}<span class="muted small"> · reported as held in ${esc(cur.c.regNo)} on ${fmtD(cur.c.dateReceived)}</span></p>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th>Place of detention / care</th><th>Type</th><th>From</th><th>To</th><th class="r">Duration</th><th>Complaint</th></tr></thead><tbody>${list.map(({ c, d }) => { const ongoing = detHeldNow(d); return `<tr><td><b>${esc(detName(d))}</b><div class="muted small">${esc(DET_STATUS[d.status] || '')}</div></td><td class="small">${esc(detTypeLabel(detType(d)).replace(/ \(.*\)/, ''))}</td><td>${d.since ? fmtD(d.since) : '<span class="muted">Not known</span>'}</td><td>${d.until ? fmtD(d.until) : ongoing ? pill('Still held', 'bad') : '<span class="muted">Not known</span>'}</td><td class="r">${detDays(d) != null ? esc(fmtDur(detDays(d))) + (ongoing ? ' <span class="muted small">so far</span>' : '') : '—'}</td><td>${canSeeCase(c) ? caseLink(c) : esc(c.regNo)}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="small muted" style="margin-bottom:0">Taken from the detention details recorded on the complaints${known.length > 1 ? ` · ${fmtDur(total)} in total where dates are known` : ''}. Periods may overlap when several complaints describe the same stay. Update the dates on the complaint (Edit detention setting) when the person is released or moved.</p></div>`;
}
