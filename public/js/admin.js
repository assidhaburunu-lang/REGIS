'use strict';
/* Administration: staff & roles, access requests, settings, legal library, data tools, audit trail. */

const ADMIN_TABS = [['staff', 'Staff & roles'], ['catalogue', 'Classification catalogue'], ['settings', 'Settings'], ['holidays', 'Public holidays'], ['laws', 'Legal library'], ['data', 'Data tools'], ['audit', 'Audit trail']];
VIEWS.admin = () => {
  if (!can('admin')) return noAccess('Administration is available to System Administrators.');
  const tab = S.adminTab && ADMIN_VIEWS[S.adminTab] ? S.adminTab : 'staff'; const nReq = 0;
  return `<div class="page-head"><div><h1>${esc(t('admin'))}</h1><p>Accounts, roles, configuration and the audit trail.</p></div></div>
  ${!S.me.canEdit ? '<div class="note warn" style="margin-bottom:12px">Your sharing level on this app is below Editor, so staff, roles and settings are read-only for you. Ask the owner to make you an Editor in the share menu.</div>' : ''}
  <div class="tabs">${ADMIN_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="adminTab" data-tab="${k}">${esc(l)}${k === 'requests' && nReq ? `<span class="cnt">${nReq}</span>` : ''}</button>`).join('')}</div>
  ${ADMIN_VIEWS[tab]()}`;
};
ACT.adminTab = el => { S.adminTab = el.dataset.tab; render(); };
const ADMIN_VIEWS = {};
ADMIN_VIEWS.catalogue = () => adminCatalogueView();

/* ----- Staff ----- */
ADMIN_VIEWS.staff = () => {
  const ids = Object.keys(S.staff).sort((a, b) => nm(a).localeCompare(nm(b)));
  const noLogin = ids.filter(id => !S.staff[id].username || !S.staff[id].passwordSet);
  return `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Staff accounts</h2><button class="btn primary" data-act="addStaff">+ Add staff member</button></div>
      <ol class="small" style="padding-inline-start:18px;margin:0;display:flex;flex-direction:column;gap:4px">
        <li>Click <b>Add staff member</b>: enter their name, a username and a temporary password, and tick their roles.</li>
        <li>Share the FREMYS link with them from the app's <b>Share</b> button (Contributor access; Editor for anyone who will manage staff).</li>
        <li>Give them the username and temporary password privately. At first sign-in FREMYS asks them to choose their own password.</li></ol>
      ${noLogin.length ? `<div class="note warn" style="margin-top:10px">${noLogin.length} staff record(s) have no username or password yet and cannot sign in: ${noLogin.map(id => esc(nm(id))).join(', ')}. Use <b>Edit</b> to set one.</div>` : ''}</div>
  <div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Roles</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>${ids.map(id => { const s = S.staff[id]; return `<tr><td><b>${esc(nm(id))}</b>${id === S.me.id ? ' <span class="muted small">(you)</span>' : ''}${s.title ? `<div class="muted small">${esc(s.title)}</div>` : ''}</td><td class="mono">${s.username ? esc(s.username) : '<span class="muted">not set</span>'}</td><td>${(s.roles || []).map(r => pill(ROLES[r] || r, r === 'sysadmin' ? 'bad' : '')).join(' ') || '<span class="muted">No roles</span>'}</td><td>${s.active === false ? pill('Suspended', 'bad') : s.passwordSet ? pill('Active', 'ok') : pill('No password', 'warn')}</td><td>${fmtD(s.addedAt)}</td><td class="r"><div class="row" style="justify-content:flex-end;gap:4px"><button class="btn sm" data-act="editStaff" data-id="${esc(id)}">Edit roles</button>${s.username && id !== S.me.id ? `<button class="btn sm" data-act="resetPw" data-id="${esc(id)}">Reset password</button>` : ''}</div></td></tr>`; }).join('')}</tbody></table></div>
  <div class="card section"><h3>What each role can do</h3><div class="tbl-wrap" style="margin-top:8px"><table><tbody>${Object.entries(ROLE_HELP).map(([r, h]) => `<tr><td style="white-space:nowrap"><b>${esc(ROLES[r])}</b></td><td>${esc(h)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">A person may hold several roles. Confirm the division of approval authority with management.</p></div>`;
};
const ROLE_HELP = {
  admin_officer: 'Registers complaints, assigns registration numbers, enters complaint details, assigns complaints to Registration Officers, manages incoming records and documents.',
  reg_officer: 'Sees assigned complaints; records preliminary review, information requests, legal checks; prepares cases for the panel.',
  director: 'Reviews and comments on complaints, assigns officers, monitors cases, approves agendas and panel decisions.',
  dg: 'Reviews and comments on complaints, oversees the workflow, approves agendas and panel decisions.',
  panel: 'Opens panel cases and case packs; records panel outcomes.',
  support: 'Schedules panel meetings, prepares agendas and case packs, records attendance and panel decisions, sends investigation referrals.',
  investigation: 'Sees only referrals sent to the Investigation Department and the material shared with them; acknowledges and responds.',
  sysadmin: 'Manages accounts, roles, settings, the legal library, data tools and the audit trail.',
  management: 'Sees statistics and reports without opening complaint records.',
};
ACT.addStaff = () => staffModal(null);
ACT.editStaff = el => staffModal(el.dataset.id);
function staffModal(id) {
  const isNew = !id; const s = isNew ? { roles: [], active: true } : S.staff[id]; const needsPw = isNew || !s.passwordSet;
  modal({ title: isNew ? 'Add a staff member' : 'Edit — ' + nm(id), wide: true, body: `<div class="form">
    ${fld('Full name', inp('fullName', s.fullName || s.label || (S.names[id] || ''), { req: 'the full name' }), { req: true, id: 'f_fullName' })}
    ${fld('Username', inp('username', s.username || '', { req: 'a username', ph: 'e.g. aishath.r', attrs: 'autocapitalize="off" autocomplete="off"' }), { req: true, id: 'f_username', hint: '3–30 lowercase letters, numbers, dots, dashes or underscores. Used to sign in.' })}
    ${needsPw ? fld('Temporary password', `<div class="row" style="flex-wrap:nowrap"><input id="f_newpw" name="pw" type="text" value="${esc(genPassword())}" data-required="a temporary password" autocomplete="off" style="flex:1"><button type="button" class="btn" data-act="genPw">Generate</button></div>`, { req: true, id: 'f_newpw', hint: 'They must change it the first time they sign in.' }) : `<div class="f"><label>Password</label><div class="row"><span class="pill ok">Set</span><button type="button" class="btn sm" data-act="resetPw" data-id="${esc(id)}">Reset password</button></div></div>`}
    ${fld('Job title', inp('title', s.title || ''), { id: 'f_title' })}${fld('Department', inp('department', s.department || '', { ph: 'e.g. Registration Department' }), { id: 'f_department' })}
    ${fld('Work email', inp('email', s.email || '', { type: 'email' }), { id: 'f_email' })}${fld('Phone', inp('phone', s.phone || '', { type: 'tel' }), { id: 'f_phone' })}${fld('Employee no.', inp('employeeNo', s.employeeNo || ''), { id: 'f_employeeNo' })}
    <div class="f full"><label class="req">Roles</label><div class="checks" style="flex-direction:column">${Object.entries(ROLES).map(([k, l]) => `<label><input type="checkbox" data-multi="1" name="roles" value="${k}" ${(s.roles || []).includes(k) ? 'checked' : ''}> <span><b>${esc(l)}</b><br><span class="muted small">${esc(ROLE_HELP[k])}</span></span></label>`).join('')}</div></div>
    ${!isNew ? `<div class="f full"><label class="na"><input type="checkbox" name="active" id="f_active" ${s.active !== false ? 'checked' : ''}> Account active (untick to suspend; they are signed out and cannot sign in)</label></div>` : ''}
  </div>`, submit: isNew ? 'Create account' : 'Save', foot: !isNew && id !== S.me.id ? `<button type="button" class="btn danger" data-act="removeStaff" data-id="${esc(id)}">Remove from staff</button>` : '', onSubmit: async o => {
    const roles = o.roles || []; if (!roles.length) throw new Error('Tick at least one role.');
    const u = normUser(o.username); if (!userOk(u)) throw new Error('The username must be 3–30 lowercase letters, numbers, dots, dashes or underscores.');
    const clash = staffByUsername(u); if (clash && clash !== id) throw new Error(`The username "${u}" is already used by ${nm(clash)}.`);
    if (needsPw) { const bad = pwProblem(o.pw); if (bad) throw new Error('Temporary password: ' + bad); }
    const sid = id || 's' + nid(); const active = isNew ? true : !!o.active;
    if (sid === S.me.id && (!roles.includes('sysadmin') || !active) && staffIds('sysadmin').filter(x => x !== sid).length === 0) throw new Error('You are the only System Administrator. Give the role to someone else first.');
    await setDoc('staff/' + sid, { ...s, fullName: o.fullName, username: u, roles, active, title: o.title || '', department: o.department || '', email: o.email || '', phone: o.phone || '', employeeNo: o.employeeNo || '', passwordSet: true, addedAt: s.addedAt || nowISO(), addedBy: s.addedBy || S.me.id, updatedAt: nowISO(), updatedBy: S.me.id });
    if (needsPw) await setPassword(sid, o.pw, true);
    logA(isNew ? 'staff.add' : 'staff.update', null, `${o.fullName} (${u}): ${roles.join(', ')}${active ? '' : ' (suspended)'}`);
    if (!isNew) notify(sid, 'Your FREMYS account was updated', null);
    if (needsPw) { showTempPassword(o.fullName, u, o.pw); return false; }
    toast('Saved');
  } });
}
ACT.removeStaff = el => {
  const id = el.dataset.id; const who = nm(id);
  confirmBox('Remove from staff', `Remove ${who} from FREMYS staff? They can no longer sign in. Their past actions stay in the records and audit trail.`, 'Remove', async () => {
    if ((S.staff[id]?.roles || []).includes('sysadmin') && staffIds('sysadmin').filter(x => x !== id).length === 0) throw new Error('This is the only System Administrator.');
    await delDoc('staff/' + id); await delDoc('creds/' + id).catch(() => {}); logA('staff.remove', null, who); toast(`${who} removed`);
  }, true);
};

/* ----- Settings ----- */
async function saveCfg(patch) { const next = { ...(S.cfg || {}), ...patch, updatedAt: nowISO(), updatedBy: S.me.id }; await setDoc('config/settings', next); logA('settings.update', null, Object.keys(patch).join(', ')); }
ADMIN_VIEWS.settings = () => {
  const c = cfg();
  return `<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn primary" data-act="editSettings">Edit settings</button></div>
  <div class="grid2">
    <div class="card"><h3>Registration</h3><dl class="kv"><dt>Number format</dt><dd class="mono">${esc(c.regPrefix)}-YYYY-NNNN</dd><dt>Categories</dt><dd>${c.categories.length}</dd><dt>Channels</dt><dd>${esc(c.channels.join(', '))}</dd></dl><p class="small muted">Agree the numbering format with the existing CMS convention before going live.</p></div>
    <div class="card"><h3>Deadlines (working days)</h3><dl class="kv"><dt>Assign after registration</dt><dd>${c.sla.assignDays}</dd><dt>Preliminary review</dt><dd>${c.sla.reviewDays}</dd><dt>Information request</dt><dd>${c.sla.requestDays}</dd><dt>Panel follow-up action</dt><dd>${c.sla.actionDays}</dd><dt>Response letter</dt><dd>${c.sla.interimDays}</dd><dt>Inactive after</dt><dd>${c.sla.inactiveDays}</dd><dt>Panel interval (calendar days)</dt><dd>${c.panelIntervalDays}</dd><dt>Session lock after idle</dt><dd>${c.idleMinutes} min</dd></dl></div>
    <div class="card"><h3>Panel readiness requirements</h3><ul class="checklist"><li class="done">Registration Officer assigned</li>${[['officerReview', "Officer's preliminary review"], ['noOpenRequests', 'No outstanding information requests']].map(([k, l]) => `<li class="${c.readiness[k] ? 'done' : ''}">${esc(l)}${c.readiness[k] ? '' : ' (not required)'}</li>`).join('')}</ul></div>
    <div class="card"><h3>Duplicate matching rules</h3><ul class="checklist">${DUP_LABELS.map(([k, l]) => `<li class="${c.dupRules[k] ? 'done' : ''}">${esc(l)}</li>`).join('')}</ul><p class="small muted">Matches produce a warning; records are never rejected or merged automatically.</p></div>
    <div class="card"><h3>Panel outcomes</h3><div class="tbl-wrap"><table><thead><tr><th>Outcome</th><th>Moves case to</th></tr></thead><tbody>${c.outcomes.map(o => `<tr><td>${esc(o.label)}${o.referral ? ' ' + pill('forwards to Investigation', 'info') : ''}</td><td>${o.stage ? esc(stageLabel(o.stage)) : '<span class="muted">Unchanged</span>'}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Complaint categories</h3><p class="small">Categories come from the HRCM classification catalogue (${c.categories.length} main categories). Manage it on the <b>Classification catalogue</b> tab.</p></div>
  </div>`;
};
const DUP_LABELS = [['nid', 'Same national ID / passport number'], ['phone', 'Same contact number'], ['cmsRef', 'Same CMS reference'], ['nameRespondent', 'Same complainant and same respondent (on its own)'], ['fuzzyName', 'Similar complainant name within 90 days']];
ACT.editSettings = () => {
  const c = cfg();
  modal({ title: 'Edit settings', wide: true, body: `<div class="form">
    ${fld('Registration number prefix', inp('regPrefix', c.regPrefix, { req: 'a prefix' }), { req: true, id: 'f_regPrefix', hint: 'Letters, numbers and hyphens. Applies to new registrations.' })}
    ${fld('Panel meeting interval (days)', inp('panelIntervalDays', c.panelIntervalDays, { type: 'number', attrs: 'min="1" max="90"' }), { id: 'f_panelIntervalDays' })}
    ${fld('Session lock after idle (minutes)', inp('idleMinutes', c.idleMinutes, { type: 'number', attrs: 'min="5" max="240"' }), { id: 'f_idleMinutes' })}
    <fieldset><legend>Deadlines (working days: Friday, Saturday and public holidays are not counted)</legend>${[['assignDays', 'Assign after registration'], ['reviewDays', 'Preliminary review'], ['requestDays', 'Information request'], ['actionDays', 'Panel follow-up action'], ['interimDays', 'Response letter after the Commission'], ['inactiveDays', 'Inactive after']].map(([k, l]) => fld(l, inp('sla_' + k, c.sla[k], { type: 'number', attrs: 'min="1" max="365"' }), { id: 'f_sla_' + k })).join('')}</fieldset>
    <fieldset><legend>Panel readiness requirements</legend><div class="f full checks">${[['officerReview', "Officer's preliminary review recorded"], ['noOpenRequests', 'No outstanding information requests']].map(([k, l]) => `<label><input type="checkbox" name="rd_${k}" ${c.readiness[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>
    <fieldset><legend>Duplicate matching rules</legend><div class="f full checks">${DUP_LABELS.map(([k, l]) => `<label><input type="checkbox" name="dup_${k}" ${c.dupRules[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></fieldset>
    ${fld('Channels (one per line)', txt('channels', c.channels.join('\n'), { rows: 5 }), { full: true, id: 'f_channels' })}

  </div>`, onSubmit: async o => {
    const num = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
    const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
    await saveCfg({ regPrefix: o.regPrefix.replace(/[^A-Za-z0-9-]/g, '') || 'REG', panelIntervalDays: num(o.panelIntervalDays, 14), idleMinutes: num(o.idleMinutes, 20),
      sla: Object.fromEntries(Object.keys(DEFAULT_CFG.sla).map(k => [k, num(o['sla_' + k], DEFAULT_CFG.sla[k])])),
      readiness: Object.fromEntries(Object.keys(DEFAULT_CFG.readiness).map(k => [k, !!o['rd_' + k]])), dupRules: Object.fromEntries(DUP_LABELS.map(([k]) => [k, !!o['dup_' + k]])),
      channels: lines(o.channels).length ? lines(o.channels) : DEFAULT_CFG.channels });
    toast('Settings saved');
  } });
};

/* ----- Legal library ----- */
ADMIN_VIEWS.laws = () => {
  const laws = cfg().laws;
  return `<div class="row" style="justify-content:space-between;margin-bottom:12px"><p class="small muted" style="margin:0">Record the version or amendment date so a linked provision shows which text the officer relied on.</p><button class="btn primary" data-act="editLaw">Add entry</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>Title</th><th>Reference</th><th>Type</th><th>Version</th><th>Date</th><th></th></tr></thead><tbody>${laws.map(l => `<tr><td><b>${esc(l.title)}</b></td><td>${esc(l.ref)}</td><td>${esc(l.type || '')}</td><td>${esc(l.version || '—')}</td><td>${fmtD(l.date)}</td><td class="r"><button class="btn sm" data-act="editLaw" data-id="${esc(l.id)}">Edit</button> <button class="btn sm danger" data-act="delLaw" data-id="${esc(l.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`;
};
ACT.editLaw = el => {
  const laws = cfg().laws; const id = el.dataset.id; const l = laws.find(x => x.id === id) || {};
  modal({ title: id ? 'Edit legal reference' : 'Add legal reference', body: `<div class="form">${fld('Title', inp('title', l.title, { req: 'a title' }), { req: true, full: true, id: 'f_title' })}${fld('Reference / number', inp('ref', l.ref, { ph: 'e.g. Law No. 6/2006' }), { id: 'f_ref' })}${fld('Type', sel('type', ['Law', 'Regulation', 'International instrument', 'Internal procedure', 'Guideline'], l.type || 'Law', { blank: false }), { id: 'f_type' })}${fld('Version / amendment', inp('version', l.version), { id: 'f_version' })}${fld('Version date', inp('date', l.date, { type: 'date' }), { id: 'f_date' })}</div>`,
    onSubmit: async o => { const entry = { id: id || 'law' + nid(), ...o }; await saveCfg({ laws: id ? laws.map(x => x.id === id ? entry : x) : [...laws, entry] }); } });
};
ACT.delLaw = el => { const laws = cfg().laws; const l = laws.find(x => x.id === el.dataset.id); confirmBox('Remove legal reference', `Remove "${l.title}" from the library? Complaints already linked keep their recorded reference.`, 'Remove', async () => saveCfg({ laws: laws.filter(x => x.id !== l.id) }), true); };

/* ----- Data tools ----- */
ADMIN_VIEWS.data = () => {
  const demo = vals(S.complaints).filter(c => c.demo).length; const n = Object.keys(S.complaints).length;
  return `<div class="grid2">
    <div class="card"><h3>Demo data</h3><p class="small">Creates 100 fictional, classified complaints spread over the last 12 months at every workflow stage, with complainants, victims, a year of panel meetings, decisions, information requests and referrals, so staff can try the system. Demo records carry a DEMO tag and use DEMO- registration numbers.</p>
      <div class="row">${demo ? `<button class="btn danger" data-act="clearDemo">Delete ${demo} demo complaints</button>` : '<button class="btn primary" data-act="loadDemo">Load 100 demo cases</button>'}</div></div>
    <div class="card"><h3>Import complaints from CSV</h3><p class="small">For migrating records from the existing CMS or a spreadsheet. The first row must contain column names: <span class="mono">date_received, complainant_name, summary, category</span> (required; category should be a main category from the catalogue) and optionally <span class="mono">cms_ref, complainant_phone, complainant_nid, atoll, island, respondent</span>. Each row receives a new registration number.</p>
      <button class="btn" data-act="importCsv">Import CSV…</button></div>
    <div class="card"><h3>Backup</h3><p class="small">Download all ${n} complaint records, meetings, staff roles and settings as one JSON file. Store it in an encrypted, organization-approved location.</p><div class="row"><button class="btn" data-act="backup">Download backup</button><button class="btn" data-act="restore">Restore from backup…</button></div><p class="small muted" style="margin-bottom:0">Restore adds the records from a FREMYS backup file, for example to move data between the hosted and the local version.</p></div>
    <div class="card"><h3>Storage</h3><dl class="kv"><dt>Complaint records</dt><dd>${n}</dd><dt>Panel meetings</dt><dd>${Object.keys(S.meetings).length}</dd><dt>Staff</dt><dd>${Object.keys(S.staff).length}</dd></dl><p class="small muted">The database holds up to 25,000 records; each complaint, with its reviews, requests and decisions, is one record.</p></div>
  </div>`;
};
ACT.backup = () => { const data = { exportedAt: nowISO(), exportedBy: S.me.id, complaints: S.complaints, complainants: S.complainants, victims: S.victims, recommendations: S.recs, duty: S.duty, leave: S.leave || {}, holidays: S.holidays || {}, meetings: S.meetings, staff: S.staff, settings: S.cfg }; saveFile(`FREMYS-backup-${today()}.json`, JSON.stringify(data, null, 1)); };
ACT.restore = () => {
  modal({ title: 'Restore from a FREMYS backup', wide: true, body: `<p class="small" style="margin-top:0">Choose a backup file downloaded from FREMYS (<span class="mono">FREMYS-backup-YYYY-MM-DD.json</span>). Records that are not here yet are added. Staff accounts are restored without passwords: reset each person's password under Staff before they sign in.</p>
    <div class="form"><div class="f full"><label for="f_bk">Backup file</label><input id="f_bk" name="file" type="file" accept=".json,application/json"></div>
    <div class="f full"><label class="na"><input type="checkbox" name="overwrite"> Replace records that already exist here with the version in the backup</label></div>
    <div class="f full"><label class="na"><input type="checkbox" name="settings"> Also restore the settings and public holidays (registration prefix, deadlines, matching rules)</label></div></div>`,
    submit: 'Restore', onSubmit: async (o, form) => {
      const f = form.querySelector('#f_bk').files[0]; if (!f) throw new Error('Choose the backup file.');
      let b; try { b = JSON.parse(await f.text()); } catch { throw new Error('This file is not a FREMYS backup (it is not valid JSON).'); }
      if (!b || typeof b !== 'object' || !b.complaints) throw new Error('This file is not a FREMYS backup.');
      const sets = [['complaints', b.complaints, S.complaints], ['complainants', b.complainants, S.complainants], ['victims', b.victims, S.victims], ['recs', b.recommendations, S.recs], ['duty', b.duty, S.duty], ['leave', b.leave, S.leave], ['meetings', b.meetings, S.meetings], ['staff', b.staff, S.staff]];
      let added = 0, replaced = 0, skipped = 0; const btn = $('#dlgOk');
      const total = sets.reduce((n, [, src]) => n + Object.keys(src || {}).length, 0); let done = 0;
      for (const [col, src, here] of sets) for (const [id, rec] of Object.entries(src || {})) {
        done++; if (btn && done % 20 === 0) btn.textContent = `Restoring… ${done}/${total}`;
        if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id) || !rec || typeof rec !== 'object') { skipped++; continue; }
        if (col === 'staff' && id === S.me.id) { skipped++; continue; }
        const exists = !!(here || {})[id]; if (exists && !o.overwrite) { skipped++; continue; }
        const { id: _drop, ...data } = rec; await setDoc(`${col}/${id}`, data); exists ? replaced++ : added++;
      }
      if (o.settings && b.settings) await setDoc('config/settings', b.settings);
      if (o.settings && b.holidays && Object.keys(b.holidays).length) await setDoc('config/holidays', { days: { ...(S.holidays || {}), ...b.holidays }, updatedAt: nowISO(), updatedBy: S.me.id });
      logA('data.restore', null, `${f.name}: ${added} added, ${replaced} replaced, ${skipped} skipped`);
      toast(`Restore finished: ${added} added, ${replaced} replaced, ${skipped} already here or skipped.`);
    } });
};
function parseCSV(text) {
  const rows = []; let row = [], cell = '', qd = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (qd) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else qd = false; } else cell += ch; }
    else if (ch === '"') qd = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
ACT.importCsv = () => {
  modal({ title: 'Import complaints from CSV', body: `<div class="form">${fld('CSV file', '<input type="file" id="f_csv" accept=".csv,text/csv">', { full: true, id: 'f_csv' })}<div class="f full" id="csvPreview"></div></div>`, submit: 'Import', onSubmit: async (o, form) => {
    const file = form.querySelector('#f_csv').files[0]; if (!file) throw new Error('Choose a CSV file.');
    const rows = parseCSV((await file.text()).replace(/^﻿/, '')); if (rows.length < 2) throw new Error('The file has no data rows.');
    const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_')); const ix = k => head.indexOf(k);
    for (const k of ['date_received', 'complainant_name', 'summary', 'category']) if (ix(k) < 0) throw new Error(`Missing column "${k}".`);
    const atollKey = v => { const s = String(v || '').trim().toLowerCase(); const hit = ATOLLS.find(([k, n]) => k.toLowerCase() === s || n.toLowerCase() === s); return hit ? hit[0] : ''; };
    let ok = 0, bad = 0; const errs = [];
    for (const r of rows.slice(1)) {
      const g = k => ix(k) >= 0 ? String(r[ix(k)] || '').trim() : '';
      const d = g('date_received'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !g('complainant_name') || !g('summary')) { bad++; if (errs.length < 5) errs.push(`Row ${ok + bad + 1}: needs a YYYY-MM-DD date, a name and a summary`); continue; }
      const regNo = await nextRegNo(); const cid = 'c' + nid(); const at = nowISO();
      await setDoc('complaints/' + cid, { regNo, cmsRef: g('cms_ref'), dateReceived: d, channel: 'Imported', receivedBy: S.me.id, createdAt: at, createdBy: S.me.id, complainant: { name: g('complainant_name'), phone: g('complainant_phone'), nid: g('complainant_nid') }, victimSame: true, victim: {}, summary: g('summary'), ...(() => { const m = catIndex().catByName[normName(g('category'))]; return m ? { category: m.name, classification: { catId: m.id, secondary: [], groups: [], topics: [], source: 'import', by: S.me.id, at } } : { category: g('category') }; })(), atoll: atollKey(g('atoll')), island: g('island'), respondent: { name: g('respondent') }, missing: [], dupWarnings: [], stage: 'registered', assignedTo: null, nextAction: 'Assign to a Registration Officer', nextActionDue: addDays(today(), cfg().sla.assignDays), lastActionAt: at, lastActionBy: S.me.id, docs: {}, history: { [nid('h')]: { at, by: S.me.id, stage: 'registered', note: `Imported from CSV as ${regNo}${g('cms_ref') ? ' (CMS ' + g('cms_ref') + ')' : ''}` } } });
      ok++; $('#csvPreview').textContent = `Imported ${ok}…`;
    }
    logA('import.csv', null, `${ok} imported, ${bad} skipped`); await new Promise(r => setTimeout(r, 800)); await migratePeople();
    toast(`Imported ${ok} complaint(s)${bad ? `, skipped ${bad}` : ''}`); if (errs.length) toast(errs.join('; '), 'error');
  } });
};

/* ----- Audit trail ----- */
ADMIN_VIEWS.audit = () => {
  const months = []; const d = new Date(); for (let i = 0; i < 12; i++) { months.push(localDate(d).slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  const a = S.audit || {}; const rows = (a.rows || []).filter(r => !a.who || r.uid === a.who).filter(r => !a.q || (r.action + ' ' + (r.reg || '') + ' ' + r.detail).toLowerCase().includes(a.q.toLowerCase()));
  return `<div class="filters"><div class="f"><label for="au_m">Month</label><select id="au_m" data-on="change:auditMonth">${months.map(m => `<option ${m === a.month ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div class="f"><label for="au_w">Person</label><select id="au_w" data-on="change:auditWho"><option value="">Everyone</option>${Object.keys(S.staff).map(id => `<option value="${esc(id)}" ${a.who === id ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select></div>
    <div class="f wide"><label for="au_q">Search</label><input id="au_q" type="search" value="${esc(a.q || '')}" data-on="change:auditQ" placeholder="Action, registration no. or detail"></div>
    <div class="f" style="justify-content:flex-end"><button class="btn primary" data-act="loadAudit">${a.rows ? 'Reload' : 'Load audit trail'}</button></div></div>
  ${a.loading ? '<div class="loading">Loading audit entries…</div>' : a.rows ? `<div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="muted small">${rows.length} entries${a.denied ? ' · other people\'s entries need Editor access to read' : ''}</span><button class="btn sm" data-act="exportAudit">Export CSV</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Person</th><th>Action</th><th>Complaint</th><th>Detail</th></tr></thead><tbody>${rows.slice(0, 500).map(r => `<tr><td class="small">${fmtDT(r.at)}</td><td>${esc(nm(r.uid))}</td><td class="mono">${esc(r.action)}</td><td>${r.cid && S.complaints[r.cid] ? `<a href="#case-${esc(r.cid)}">${esc(r.reg || S.complaints[r.cid].regNo)}</a>` : esc(r.reg || '—')}</td><td class="small">${esc(r.detail)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Choose a month and load the audit trail. Each person can only add to their own audit log; nobody, including administrators, can edit another person\'s entries.</div>'}`;
};
ON.auditMonth = el => { S.audit = { ...(S.audit || {}), month: el.value, rows: null }; render(); };
ON.auditWho = el => { S.audit = { ...(S.audit || {}), who: el.value }; render(); };
ON.auditQ = el => { S.audit = { ...(S.audit || {}), q: el.value }; render(); };
ACT.loadAudit = async () => {
  const month = S.audit?.month || today().slice(0, 7); S.audit = { ...(S.audit || {}), month, loading: true }; render();
  const cids = new Set([S.me.cid, ...Object.keys(S.staff)]);
  await Promise.all(Object.keys(S.staff).map(async id => { try { const c = await S.db.doc('creds/' + id).get(); if (c.exists) Object.keys(c.data().claudeIds || {}).forEach(x => cids.add(x)); } catch (e) {} }));
  const rows = []; let denied = 0;
  await Promise.all([...cids].map(async cid => { try { const snap = await S.db.doc(`audit/${cid}/log/${month}`).get(); if (snap.exists) entries(snap.data().entries).forEach(e => rows.push({ ...e, uid: e.acct || cid })); } catch (e) { denied++; } }));
  if (!S.me.canEdit) denied = 1;
  rows.sort(byAt); S.audit = { ...S.audit, rows, denied, loading: false }; logA('audit.view', null, month); render();
};
ACT.exportAudit = () => { const a = S.audit || {}; exportCSV(`FREMYS-audit-${a.month}.csv`, [['Time', 'Person', 'Action', 'Registration no.', 'Detail'], ...(a.rows || []).map(r => [r.at, nm(r.uid), r.action, r.reg || '', r.detail])]); };

/* ----- Public holidays: excluded, with Friday and Saturday, from every working-day count (deadlines, ages, processing times) ----- */
// Fixed-date Maldivian public holidays. Islamic holidays move every year: add them from the government's announcement.
const FIXED_HOLIDAYS = [['01-01', "New Year's Day"], ['05-01', 'Labour Day'], ['07-26', 'Independence Day'], ['11-03', 'Victory Day'], ['11-11', 'Republic Day']];
ADMIN_VIEWS.holidays = () => {
  const yr = S.holYear || today().slice(0, 4); const all = Object.entries(S.holidays || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const years = [...new Set([today().slice(0, 4), String(+today().slice(0, 4) + 1), ...all.map(([d]) => d.slice(0, 4))])].sort();
  const list = all.filter(([d]) => d.startsWith(yr)); const edit = can('holidays');
  const onWeekend = list.filter(([d]) => WEEKEND.includes(wday(d))).length;
  return `<div class="note" style="margin-bottom:12px">FREMYS counts <b>working days</b> only: Friday, Saturday and the public holidays listed here are not counted in deadlines, waiting times, case ages and processing times. On these days the 1424 duty runs on weekend hours (14:00–24:00).</div>
  <div class="card"><div class="card-head"><div class="row"><h2 style="margin:0">Public holidays</h2><select aria-label="Year" data-on="change:holYear">${years.map(y => `<option ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    ${edit ? `<div class="row"><button class="btn primary" data-act="holAdd">Add holiday</button><button class="btn" data-act="holBulk">Add several…</button><button class="btn" data-act="holFixed" data-y="${yr}">Add fixed-date holidays for ${yr}</button></div>` : ''}</div>
    ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Day</th><th>Holiday</th><th>Added by</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${list.map(([d, h]) => `<tr><td class="num">${fmtD(d)}</td><td>${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][wday(d)]}${WEEKEND.includes(wday(d)) ? ' <span class="muted small">(weekend anyway)</span>' : ''}</td><td><b>${esc(h.name || '')}</b></td><td class="small muted">${esc(nm(h.by))}${h.at ? ' · ' + fmtD(h.at) : ''}</td>${edit ? `<td class="r"><button class="btn sm" data-act="holEdit" data-d="${d}">Edit</button> <button class="btn sm danger" data-act="holDel" data-d="${d}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="small muted">${list.length} holiday${list.length === 1 ? '' : 's'} in ${yr}${onWeekend ? `, ${onWeekend} of them on a Friday or Saturday` : ''}. ${list.length - onWeekend} extra non-working day${list.length - onWeekend === 1 ? '' : 's'}.</p>`
      : `<div class="empty">No public holidays entered for ${yr}.${edit ? ' Add them from the government’s official list, including Ramazan, Eid and other Islamic holidays, whose dates change every year.' : ''}</div>`}
  </div>`;
};
ON.holYear = el => { S.holYear = el.value; render(); };
async function saveHolidays(days) { await setDoc('config/holidays', { days, updatedAt: nowISO(), updatedBy: S.me.id }); }
ACT.holAdd = () => holForm();
ACT.holEdit = el => holForm(el.dataset.d);
function holForm(d0) {
  if (!can('holidays')) return; const h = d0 ? (S.holidays || {})[d0] : null;
  modal({ title: d0 ? 'Edit public holiday' : 'Add a public holiday', body: `<div class="form">
    ${fld('Date', inp('date', d0 || '', { type: 'date', req: 'the date' }), { req: true, id: 'f_date' })}
    ${fld('Holiday', inp('name', h?.name || '', { req: 'the name', ph: 'e.g. Eid al-Fitr, National Day, Government holiday' }), { req: true, id: 'f_name' })}
    ${fld('Last day (optional, for a holiday of several days)', inp('to', '', { type: 'date' }), { id: 'f_to', hint: 'Every day from the date to this day is added.' })}</div>`,
    submit: 'Save', onSubmit: async o => {
      if (o.to && o.to < o.date) throw new Error('The last day is before the first day.');
      const days = { ...(S.holidays || {}) }; if (d0 && d0 !== o.date) delete days[d0];
      const end = o.to || o.date; if (dayDiff(o.date, end) > 31) throw new Error('A single holiday can be at most 31 days long.');
      for (let d = o.date; d <= end; d = addDays(d, 1)) days[d] = { name: o.name.trim(), by: S.me.id, at: nowISO() };
      await saveHolidays(days); logA('holiday.save', null, `${o.date}${o.to ? '–' + o.to : ''}: ${o.name}`); S.holYear = o.date.slice(0, 4); toast('Public holiday saved');
    } });
}
ACT.holDel = async el => {
  const d = el.dataset.d; const h = (S.holidays || {})[d]; if (!h || !confirm(`Remove ${h.name} (${fmtD(d)})?`)) return;
  const days = { ...(S.holidays || {}) }; delete days[d]; await saveHolidays(days); logA('holiday.remove', null, `${d}: ${h.name}`); toast('Removed');
};
ACT.holFixed = async el => {
  const y = el.dataset.y; const days = { ...(S.holidays || {}) }; let n = 0;
  FIXED_HOLIDAYS.forEach(([md, name]) => { const d = `${y}-${md}`; if (!days[d]) { days[d] = { name, by: S.me.id, at: nowISO() }; n++; } });
  if (!n) { toast(`The fixed-date holidays for ${y} are already in the list.`); return; }
  await saveHolidays(days); logA('holiday.save', null, `${n} fixed-date holidays for ${y}`); toast(`${n} holiday${n === 1 ? '' : 's'} added. Now add the Islamic holidays for ${y}.`);
};
ACT.holBulk = () => {
  modal({ title: 'Add several public holidays', wide: true, body: `<p class="small" style="margin-top:0">One holiday per line: the date, then the name. A range of dates is allowed. For example:</p>
    <pre class="small" style="background:#e2e8f0;padding:8px 10px;border-radius:6px;margin:0 0 10px">2027-03-09 to 2027-03-12  Eid al-Fitr\n2027-05-16  Eid al-Adha\n2027-07-26  Independence Day</pre>
    <div class="form"><div class="f full"><label for="f_lines">Holidays</label><textarea id="f_lines" name="lines" rows="10" placeholder="YYYY-MM-DD  Name"></textarea></div></div>`,
    submit: 'Add', onSubmit: async o => {
      const days = { ...(S.holidays || {}) }; let n = 0; const bad = [];
      String(o.lines || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
        const m = l.match(/^(\d{4}-\d{2}-\d{2})(?:\s*(?:to|–|-)\s*(\d{4}-\d{2}-\d{2}))?\s+(.+)$/i);
        if (!m || isNaN(new Date(m[1] + 'T12:00:00')) || (m[2] && (m[2] < m[1] || dayDiff(m[1], m[2]) > 31))) { bad.push(l); return; }
        for (let d = m[1]; d <= (m[2] || m[1]); d = addDays(d, 1)) { days[d] = { name: m[3].trim().slice(0, 100), by: S.me.id, at: nowISO() }; n++; }
      });
      if (bad.length) throw new Error(`These lines could not be read: ${bad.slice(0, 3).join(' | ')}${bad.length > 3 ? ' …' : ''}`);
      if (!n) throw new Error('Enter at least one holiday.');
      await saveHolidays(days); logA('holiday.save', null, `${n} days added`); toast(`${n} day${n === 1 ? '' : 's'} added`);
    } });
};
