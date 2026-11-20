'use strict';
/* People tables: users (staff), complainants, victims. Separate pages plus a SQLite database export. */

const SEXES = ['Female', 'Male', 'Not stated'];
const VULN = ['Child (under 18)', 'Person with disability', 'Migrant worker', 'Older person', 'Person in detention', 'Woman at risk of violence', 'Other'];
const PTYPE = {
  complainants: { one: 'complainant', label: 'Complainant', route: 'complainant', cases: id => vals(S.complaints).filter(c => c.complainantId === id) },
  victims: { one: 'victim', label: 'Victim / affected person', route: 'victim', cases: id => vals(S.complaints).filter(c => c.victimLinks && c.victimLinks[id]) },
};
function cpOf(c) { return (c.complainantId && S.complainants[c.complainantId]) || c.complainant || {}; }
function victimsOf(c) {
  const out = [];
  Object.entries(c.victimLinks || {}).forEach(([vid, l]) => { if (l && S.victims[vid]) out.push({ ...S.victims[vid], id: vid, rel: l.rel || '' }); });
  if (!out.length && c.victim && c.victim.name) out.push({ ...c.victim, id: null, rel: c.victim.relationship || '' });
  return out;
}
function personMasked(cases) { if (!cases.some(c => c.confidential)) return false; return !(can('restrictedDocs') || can('editCore') || cases.some(c => c.assignedTo === S.me.id)); }
function visiblePeople(type) {
  const all = Object.entries(type === 'complainants' ? S.complainants : S.victims).map(([id, p]) => ({ id, ...p, cases: PTYPE[type].cases(id) }));
  return can('viewAll') ? all : all.filter(p => p.cases.some(canSeeCase));
}
async function createPerson(type, data) {
  const id = (type === 'complainants' ? 'p' : 'v') + nid(); const at = nowISO();
  await setDoc(`${type}/${id}`, { ...data, createdAt: at, createdBy: S.me.id, updatedAt: at, updatedBy: S.me.id, history: { [nid('h')]: { at, by: S.me.id, note: 'Record created' } } });
  logA(PTYPE[type].one + '.create', null, data.name); return id;
}
const ageOf = p => p.dob ? Math.floor(dayDiff(p.dob, today()) / 365.25) : (p.age ? Number(p.age) : null);

/* Move person details that older complaints kept inside the complaint record into the complainants / victims tables. */
async function migratePeople() {
  if (S._migrating || !S.db || S.readOnly) return;
  const todo = vals(S.complaints).filter(c => !c.complainantId && c.complainant && c.complainant.name);
  if (!todo.length) return;
  S._migrating = true;
  try {
    const idx = {}; const key = p => (p.nid ? 'id:' + String(p.nid).toUpperCase().replace(/\s/g, '') : 'nm:' + normName(p.name) + '|' + digits(p.phone));
    Object.entries(S.complainants).forEach(([id, p]) => { idx[key(p)] = id; });
    for (const c of todo) {
      const cp = c.complainant; let cpId = idx[key(cp)];
      if (!cpId) { cpId = await createPerson('complainants', { name: cp.name, nid: cp.nid || '', phone: cp.phone || '', email: cp.email || '', address: cp.address || '', sex: '', dob: '', nationality: '', demo: !!c.demo }); idx[key(cp)] = cpId; }
      const links = {};
      if (!c.victimSame && c.victim && c.victim.name) { const vid = await createPerson('victims', { name: c.victim.name, nid: c.victim.nid || '', phone: c.victim.phone || '', sex: '', dob: '', nationality: '', vulnerable: [], demo: !!c.demo }); links[vid] = { rel: c.victim.relationship || '', addedAt: nowISO(), addedBy: S.me.id }; }
      await updDoc('complaints/' + c.id, { complainantId: cpId, victimLinks: links, complainant: null, victim: null });
    }
    logA('people.migrate', null, `${todo.length} complaints`);
  } catch (e) { console.warn('migration', e); toast('Moving person details into their tables stopped: ' + errText(e), 'error'); }
  finally { S._migrating = false; }
}

function maybeMigrate() {
  if (S._migDone || !(S.loaded.complainants && S.loaded.victims && S.loaded.complaints && S.loaded.staff)) return;
  if (!(can('admin') || hasRole('admin_officer'))) return;
  S._migDone = true; migratePeople();
}

/* ---------- Users page ---------- */
VIEWS.users = () => {
  if (!can('admin') && !can('supervise')) return noAccess('The users page is available to System Administrators, the Director General and the Director.');
  const cs = vals(S.complaints); const lastAct = {};
  cs.forEach(c => entries(c.history).forEach(h => { if (h.by && (!lastAct[h.by] || h.at > lastAct[h.by])) lastAct[h.by] = h.at; }));
  const ids = Object.keys(S.staff).sort((a, b) => nm(a).localeCompare(nm(b))); const q = normName(S.userQ);
  const rows = ids.filter(id => !q || normName(nm(id) + ' ' + (S.staff[id].title || '') + ' ' + (S.staff[id].department || '')).includes(q));
  return `<div class="page-head"><div><h1>${esc(t('users'))}</h1><p>Everyone with access to FREMYS, their roles and current workload.</p></div>
    <div class="row">${can('admin') ? '<a class="btn primary" href="#admin">Manage staff &amp; roles</a>' : ''}<button class="btn" data-act="exportUsers">Export CSV</button>${can('admin') || can('supervise') ? '<button class="btn" data-act="exportSqlite">Download SQLite database</button>' : ''}</div></div>
  <div class="tiles">
    <div class="tile" style="cursor:default"><div class="k">Users</div><div class="v num">${ids.length}</div><div class="s">${ids.filter(id => S.staff[id].active !== false).length} active</div></div>
    <div class="tile warn" style="cursor:default"><div class="k">Suspended</div><div class="v num">${ids.filter(id => S.staff[id].active === false).length}</div><div class="s">Cannot sign in</div></div>
    <div class="tile ok" style="cursor:default"><div class="k">Registration Officers</div><div class="v num">${staffIds('reg_officer').length}</div><div class="s">Active</div></div>
  </div>
  <div class="filters"><div class="f wide"><label for="u_q">${esc(t('search'))}</label><input id="u_q" type="search" value="${esc(S.userQ || '')}" data-on="input:userQ" placeholder="Name, title or department"></div></div>
  <div id="userTable">${usersTable(rows, cs, lastAct)}</div>`;
};
function usersTable(rows, cs, lastAct) {
  return rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Title / department</th><th>Contact</th><th>Roles</th><th>Status</th><th class="r">Open cases</th><th>Last activity</th></tr></thead><tbody>${rows.map(id => { const s = S.staff[id]; const open = cs.filter(c => c.assignedTo === id && !isDone(c)).length; return `<tr class="click" data-act="goHref" data-href="#user-${esc(id)}"><td><b>${esc(nm(id))}</b>${id === S.me.id ? ' <span class="muted small">(you)</span>' : ''}</td><td class="mono">${esc(s.username || '—')}</td><td>${esc(s.title || '—')}<div class="muted small">${esc(s.department || '')}</div></td><td class="small">${esc([s.email, s.phone].filter(Boolean).join(' · ') || '—')}</td><td>${(s.roles || []).map(r => pill(ROLES[r] || r, r === 'sysadmin' ? 'bad' : '')).join(' ')}</td><td>${s.active === false ? pill('Suspended', 'bad') : pill('Active', 'ok')}</td><td class="r">${open}</td><td>${fmtD(lastAct[id])}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card empty">No users match.</div>';
}
ON.userQ = el => { S.userQ = el.value; const cs = vals(S.complaints); const lastAct = {}; cs.forEach(c => entries(c.history).forEach(h => { if (h.by && (!lastAct[h.by] || h.at > lastAct[h.by])) lastAct[h.by] = h.at; })); const q = normName(el.value); $('#userTable').innerHTML = usersTable(Object.keys(S.staff).sort((a, b) => nm(a).localeCompare(nm(b))).filter(id => !q || normName(nm(id) + ' ' + (S.staff[id].title || '') + ' ' + (S.staff[id].department || '')).includes(q)), cs, lastAct); };
ACT.exportUsers = () => exportCSV(`FREMYS-users-${today()}.csv`, [['Name', 'Title', 'Department', 'Work email', 'Phone', 'Roles', 'Status', 'Added'], ...Object.entries(S.staff).map(([id, s]) => [nm(id), s.title || '', s.department || '', s.email || '', s.phone || '', (s.roles || []).map(r => ROLES[r]).join('; '), s.active === false ? 'Suspended' : 'Active', (s.addedAt || '').slice(0, 10)])]);

VIEWS.user = (id) => {
  if (!can('admin') && !can('supervise') && !hasRole('management') && id !== S.me.id) return noAccess();
  const s = S.staff[id]; if (!s) return '<div class="card gate"><h2>User not found</h2><a class="btn" href="#users">Back to users</a></div>';
  const cs = vals(S.complaints); const assigned = cs.filter(c => c.assignedTo === id).sort((a, b) => String(b.dateReceived).localeCompare(String(a.dateReceived)));
  const acts = cs.flatMap(c => entries(c.actions).filter(a => a.owner === id && a.status !== 'done').map(a => ({ ...a, c })));
  const hist = cs.flatMap(c => entries(c.history).filter(h => h.by === id).map(h => ({ ...h, c }))).sort(byAt).slice(0, 25);
  return `<div class="row small muted" style="margin-bottom:8px"><a href="#users">← ${esc(t('users'))}</a></div>
  <div class="page-head"><div><h1>${esc(nm(id))}</h1><p>${esc([s.title, s.department].filter(Boolean).join(' · ') || 'Staff member')} · ${s.active === false ? 'Suspended' : 'Active'}</p></div>${can('admin') ? `<div class="row"><button class="btn" data-act="editStaff" data-id="${esc(id)}">Edit user</button>${s.username && id !== S.me.id ? `<button class="btn" data-act="resetPw" data-id="${esc(id)}">Reset password</button>` : ''}</div>` : ''}</div>
  <div class="grid2">
    <div class="card"><h2>Profile</h2><dl class="kv"><dt>Username</dt><dd class="mono">${esc(s.username || '—')}</dd><dt>Roles</dt><dd>${(s.roles || []).map(r => pill(ROLES[r] || r)).join(' ') || '—'}</dd><dt>Work email</dt><dd>${esc(s.email || '—')}</dd><dt>Phone</dt><dd>${esc(s.phone || '—')}</dd><dt>Employee no.</dt><dd>${esc(s.employeeNo || '—')}</dd><dt>Added</dt><dd>${fmtD(s.addedAt)} by ${esc(nm(s.addedBy))}</dd><dt>Last updated</dt><dd>${fmtDT(s.updatedAt)}</dd></dl></div>
    <div class="card"><h2>Workload</h2><dl class="kv"><dt>Open assigned complaints</dt><dd>${assigned.filter(c => !isDone(c)).length}</dd><dt>Overdue</dt><dd>${assigned.filter(c => !isDone(c) && isOverdue(c)).length}</dd><dt>Completed</dt><dd>${assigned.filter(isDone).length}</dd><dt>Open follow-up actions</dt><dd>${acts.length}</dd></dl></div>
  </div>
  <div class="card section"><h2>Assigned complaints</h2>${assigned.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('date_received'))}</th><th>${esc(t('category'))}</th><th>${esc(t('stage'))}</th><th>${esc(t('next_action'))}</th></tr></thead><tbody>${assigned.map(c => `<tr class="click ${isOverdue(c) ? 'overdue' : ''}" data-act="openCase" data-id="${esc(c.id)}"><td>${caseLink(c)}</td><td>${fmtD(c.dateReceived)}</td><td>${esc(c.category)}</td><td>${stagePill(c.stage)}</td><td><div class="clip">${esc(c.nextAction || '—')}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No complaints assigned.</div>'}</div>
  <div class="card section"><h2>Recent activity</h2>${hist.length ? `<ul class="timeline">${hist.map(h => `<li><span class="muted small">${fmtDT(h.at)}</span><span>${caseLink(h.c)} · ${esc(h.note)}</span></li>`).join('')}</ul>` : '<div class="empty">No recorded activity.</div>'}</div>`;
};

/* ---------- Complainants & victims page ---------- */
VIEWS.people = () => {
  if (!can('viewAll') && !can('viewAssigned')) return noAccess();
  const type = S.peopleTab || 'complainants';
  const nC = visiblePeople('complainants').length, nV = visiblePeople('victims').length;
  return `<div class="page-head"><div><h1>${esc(t('people'))}</h1><p>One record per person, linked to every complaint they made or were affected by. Edit a person once and every linked complaint shows the update.</p></div>
    <div class="row">${can('register') || can('editCore') ? `<button class="btn primary" data-act="newPerson" data-type="${type}">+ Add ${PTYPE[type].one}</button>` : ''}<button class="btn" data-act="exportPeople" data-type="${type}">Export CSV</button>${can('admin') || can('supervise') ? '<button class="btn" data-act="exportSqlite">Download SQLite database</button>' : ''}</div></div>
  <div class="tabs"><button class="${type === 'complainants' ? 'on' : ''}" data-act="peopleTab" data-tab="complainants">Complainants<span class="cnt">${nC}</span></button><button class="${type === 'victims' ? 'on' : ''}" data-act="peopleTab" data-tab="victims">Victims / affected persons<span class="cnt">${nV}</span></button></div>
  <div class="filters"><div class="f wide"><label for="p_q">${esc(t('search'))}</label><input id="p_q" type="search" value="${esc(S.peopleQ || '')}" data-on="input:peopleQ" placeholder="Name, ID number or phone"></div>
    <div class="f"><label for="p_sex">Sex</label><select id="p_sex" data-on="change:peopleSex"><option value="">${esc(t('all'))}</option>${SEXES.map(x => `<option ${S.peopleSex === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    ${type === 'victims' ? `<div class="f"><label for="p_vuln">Group</label><select id="p_vuln" data-on="change:peopleVuln"><option value="">${esc(t('all'))}</option>${VULN.map(x => `<option ${S.peopleVuln === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}</div>
  <div id="peopleTable">${peopleTable(type)}</div>`;
};
function peopleRows(type) {
  const q = normName(S.peopleQ); const qd = digits(S.peopleQ);
  return visiblePeople(type).filter(p => !q || normName(p.name).includes(q) || normName(p.nid).includes(q) || (qd.length >= 3 && digits(p.phone).includes(qd)))
    .filter(p => !S.peopleSex || p.sex === S.peopleSex).filter(p => type !== 'victims' || !S.peopleVuln || (p.vulnerable || []).includes(S.peopleVuln))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function peopleTable(type) {
  const rows = peopleRows(type);
  if (!rows.length) return `<div class="card empty">No ${type} match.${!Object.keys(type === 'complainants' ? S.complainants : S.victims).length ? ' Records are created when complaints are registered.' : ''}</div>`;
  return `<div class="muted small" style="margin-bottom:6px">${rows.length} record${rows.length === 1 ? '' : 's'}</div><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>ID / passport</th><th>Sex</th><th>Age</th><th>Nationality</th><th>Contact</th>${type === 'victims' ? '<th>Groups</th>' : ''}<th>Detention</th><th>Complaints</th><th>Latest</th></tr></thead><tbody>${rows.map(p => {
    const mask = personMasked(p.cases); const vis = p.cases.filter(canSeeCase).sort((a, b) => String(b.dateReceived).localeCompare(String(a.dateReceived)));
    return `<tr class="click" data-act="goHref" data-href="#${PTYPE[type].route}-${esc(p.id)}"><td><b>${mask ? 'Confidential' : esc(p.name)}</b>${p.demo ? '<span class="demo-tag">DEMO</span>' : ''}</td><td class="mono">${mask ? '••••' : esc(p.nid || '—')}</td><td>${esc(p.sex || '—')}</td><td class="num">${ageOf(p) ?? '—'}</td><td>${esc(p.nationality || '—')}</td><td class="small">${mask ? '••••' : esc([p.phone, p.email].filter(Boolean).join(' · ') || '—')}</td>${type === 'victims' ? `<td>${(p.vulnerable || []).map(g => pill(g, 'info')).join(' ') || '—'}</td>` : ''}<td class="small">${(() => { const dl = personDetentions(type, p.id, vis); const cur = personDetCurrent(dl); return cur ? `<span style="color:#b91c1c;font-weight:700">${esc(detName(cur.d))}</span>${cur.d.since ? `<div class="muted">${esc(fmtDur(detDays(cur.d)))} so far</div>` : ''}` : dl.length ? `<span class="muted">Previously: ${esc(detName(dl[0].d))}</span>` : '—'; })()}</td><td><b>${p.cases.length}</b> <span class="muted small">${vis.slice(0, 3).map(c => esc(c.regNo)).join(', ')}${vis.length > 3 ? '…' : ''}</span></td><td>${fmtD(vis[0]?.dateReceived)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
ACT.peopleTab = el => { S.peopleTab = el.dataset.tab; render(); };
ON.peopleQ = el => { S.peopleQ = el.value; clearTimeout(ON._pt); ON._pt = setTimeout(() => { $('#peopleTable').innerHTML = peopleTable(S.peopleTab || 'complainants'); }, 150); };
ON.peopleSex = el => { S.peopleSex = el.value; $('#peopleTable').innerHTML = peopleTable(S.peopleTab || 'complainants'); };
ON.peopleVuln = el => { S.peopleVuln = el.value; $('#peopleTable').innerHTML = peopleTable('victims'); };
ACT.exportPeople = el => {
  const type = el.dataset.type; const rows = peopleRows(type);
  const head = ['Name', 'ID / passport', 'Sex', 'Date of birth', 'Age', 'Nationality', 'Phone', 'Email', 'Address', ...(type === 'victims' ? ['Groups'] : []), 'Complaints (reg. nos.)'];
  exportCSV(`FREMYS-${type}-${today()}.csv`, [head, ...rows.map(p => { const m = personMasked(p.cases); return [m ? 'Confidential' : p.name, m ? '' : p.nid || '', p.sex || '', m ? '' : p.dob || '', ageOf(p) ?? '', p.nationality || '', m ? '' : p.phone || '', m ? '' : p.email || '', m ? '' : p.address || '', ...(type === 'victims' ? [(p.vulnerable || []).join('; ')] : []), p.cases.filter(canSeeCase).map(c => c.regNo).join('; ')]; })]);
};

function personView(type, id) {
  const T2 = PTYPE[type]; const p = (type === 'complainants' ? S.complainants : S.victims)[id];
  if (!p) return `<div class="card gate"><h2>${T2.label} not found</h2><a class="btn" href="#people">Back to complainants &amp; victims</a></div>`;
  const cases = T2.cases(id); if (!can('viewAll') && !cases.some(canSeeCase)) return noAccess();
  const mask = personMasked(cases); const vis = cases.filter(canSeeCase).sort((a, b) => String(b.dateReceived).localeCompare(String(a.dateReceived)));
  const canEditP = (can('editCore') || can('register')) && !mask;
  const hist = entries(p.history).sort(byAt);
  return `<div class="row small muted" style="margin-bottom:8px"><a href="#people" data-act="peopleTab" data-tab="${type}">← ${esc(t('people'))}</a></div>
  <div class="page-head"><div><h1>${mask ? 'Confidential ' + T2.one : esc(p.name)}${p.demo ? '<span class="demo-tag">DEMO</span>' : ''}</h1><p>${esc(T2.label)} · ${cases.length} linked complaint${cases.length === 1 ? '' : 's'}</p></div>${canEditP ? `<button class="btn primary" data-act="editPerson" data-type="${type}" data-id="${esc(id)}">Edit details</button>` : ''}</div>
  ${mask ? '<div class="note" style="margin-bottom:14px">Identity details are hidden because a linked complaint is confidential. They are visible to the assigned officer, the Director General, the Director, the panel and Administrative Officers.</div>' : ''}
  <div class="grid2">
    <div class="card"><h2>Personal details</h2><dl class="kv">
      <dt>Full name</dt><dd>${mask ? '••••' : esc(p.name)}</dd><dt>ID / passport</dt><dd class="mono">${mask ? '••••' : esc(p.nid || '—')}</dd>
      <dt>Sex</dt><dd>${esc(p.sex || '—')}</dd><dt>Date of birth</dt><dd>${mask ? '••••' : fmtD(p.dob)}${ageOf(p) != null ? ` <span class="muted small">(age ${ageOf(p)})</span>` : ''}</dd><dt>Nationality</dt><dd>${esc(p.nationality || '—')}</dd>
      ${type === 'victims' ? `<dt>Groups</dt><dd>${(p.vulnerable || []).map(g => pill(g, 'info')).join(' ') || '—'}</dd>` : ''}
    </dl></div>
    <div class="card"><h2>Contact</h2><dl class="kv"><dt>Phone</dt><dd>${mask ? '••••' : esc(p.phone || '—')}</dd><dt>Email</dt><dd>${mask ? '••••' : esc(p.email || '—')}</dd><dt>Address</dt><dd>${mask ? '••••' : esc(p.address || '—')}</dd><dt>Location</dt><dd>${esc([p.island, ATOLL[p.atoll]].filter(Boolean).join(', ') || '—')}</dd><dt>Notes</dt><dd style="white-space:pre-wrap">${mask ? '••••' : esc(p.notes || '—')}</dd></dl></div>
  </div>
  ${personDetentionHTML(type, id, vis)}
  <div class="card section"><h2>Linked complaints</h2>${vis.length ? `<div class="tbl-wrap"><table><thead><tr><th>${esc(t('reg_no'))}</th><th>${esc(t('date_received'))}</th><th>${esc(t('category'))}</th><th style="min-width:260px">Complaint summary</th>${type === 'victims' ? '<th>Relationship to complainant</th>' : '<th>Victims</th>'}<th>${esc(t('officer'))}</th><th>${esc(t('stage'))}</th></tr></thead><tbody>${vis.map(c => `<tr class="click" data-act="openCase" data-id="${esc(c.id)}"><td style="white-space:nowrap">${caseLink(c)}</td><td>${fmtD(c.dateReceived)}</td><td>${esc(c.category)}</td><td class="small" title="${esc(c.summary || '')}">${esc(String(c.summary || '—').length > 220 ? String(c.summary).slice(0, 217).trimEnd() + '…' : (c.summary || '—'))}</td><td>${type === 'victims' ? esc(c.victimLinks[id]?.rel || '—') : (c.victimSame ? 'Complainant is the victim' : esc(victimsOf(c).map(v => v.name).join(', ') || '—'))}</td><td>${esc(nm(c.assignedTo))}</td><td>${stagePill(c.stage)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No linked complaints you can open.</div>'}${cases.length > vis.length ? `<p class="small muted">${cases.length - vis.length} more linked complaint(s) are not assigned to you.</p>` : ''}</div>
  <div class="card section"><h2>Record history</h2><ul class="timeline">${hist.map(h => `<li><span class="muted small">${fmtDT(h.at)}</span><span>${esc(h.note)} <span class="muted small">— ${esc(nm(h.by))}</span></span></li>`).join('') || '<li>—</li>'}</ul></div>`;
}
VIEWS.complainant = id => personView('complainants', id);
VIEWS.victim = id => personView('victims', id);

function personFields(type, p = {}) {
  return `<div class="form">
    ${fld('Full name', inp('name', p.name, { req: 'the name' }), { req: true, id: 'f_name' })}${fld('National ID / passport no.', inp('nid', p.nid, { ph: 'A123456' }), { id: 'f_nid' })}
    ${fld('Sex', sel('sex', SEXES, p.sex || ''), { id: 'f_sex' })}${fld('Date of birth', inp('dob', p.dob, { type: 'date', attrs: `max="${today()}"` }), { id: 'f_dob' })}
    ${type === 'victims' ? fld('Age (if date of birth unknown)', inp('age', p.age, { type: 'number', attrs: 'min="0" max="120"' }), { id: 'f_age' }) : ''}
    ${fld('Nationality', inp('nationality', p.nationality ?? 'Maldivian'), { id: 'f_nationality' })}${fld('Phone', inp('phone', p.phone, { type: 'tel' }), { id: 'f_phone' })}${fld('Email', inp('email', p.email, { type: 'email' }), { id: 'f_email' })}
    ${fld('Address', inp('address', p.address), { id: 'f_address' })}${fld(t('atoll'), sel('atoll', ATOLLS, p.atoll || ''), { id: 'f_atoll' })}${fld(t('island'), inp('island', p.island), { id: 'f_island' })}
    ${type === 'victims' ? `<div class="f full"><label>Groups (for statistics and safeguarding)</label><div class="checks">${VULN.map(g => `<label><input type="checkbox" data-multi="1" name="vulnerable" value="${esc(g)}" ${(p.vulnerable || []).includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}</div></div>` : ''}
    ${fld('Notes', txt('notes', p.notes), { full: true, id: 'f_notes' })}</div>`;
}
const PERSON_KEYS = ['name', 'nid', 'sex', 'dob', 'age', 'nationality', 'phone', 'email', 'address', 'atoll', 'island', 'vulnerable', 'notes'];
ACT.editPerson = el => {
  const type = el.dataset.type; const id = el.dataset.id; const p = (type === 'complainants' ? S.complainants : S.victims)[id];
  modal({ title: `Edit ${PTYPE[type].one} — ${p.name}`, wide: true, body: personFields(type, p) + `<div class="form" style="margin-top:12px">${fld('Reason for the change', inp('reason', '', { req: 'the reason' }), { req: true, full: true, id: 'f_reason' })}</div>`, onSubmit: async o => {
    const patch = {}; const changed = [];
    PERSON_KEYS.forEach(k => { if (!(k in o)) return; const nv = o[k] ?? ''; const ov = p[k] ?? (k === 'vulnerable' ? [] : ''); if (JSON.stringify(nv) !== JSON.stringify(ov)) { patch[k] = nv; changed.push(k); } });
    if (!changed.length) throw new Error('Nothing was changed.');
    await updDoc(`${type}/${id}`, { ...patch, updatedAt: nowISO(), updatedBy: S.me.id, history: { [nid('h')]: { at: nowISO(), by: S.me.id, note: `Edited ${changed.join(', ')}: ${o.reason}` } } });
    logA(PTYPE[type].one + '.edit', null, `${p.name}: ${changed.join(', ')}`);
  } });
};
ACT.newPerson = el => {
  const type = el.dataset.type;
  modal({ title: `Add ${PTYPE[type].one}`, wide: true, body: personFields(type, {}) + '<p class="small muted">Usually people are added while registering a complaint. Add one here when you need the record before the complaint is registered.</p>', onSubmit: async o => {
    const id = await createPerson(type, Object.fromEntries(PERSON_KEYS.map(k => [k, o[k] ?? (k === 'vulnerable' ? [] : '')]))); go(PTYPE[type].route + '-' + id);
  } });
};

/* Find-or-create pickers used on the registration form and the case page */
function personMatches(type, q) {
  const qq = normName(q); const qd = digits(q); if (qq.length < 2 && qd.length < 3) return [];
  return Object.entries(type === 'complainants' ? S.complainants : S.victims).map(([id, p]) => ({ id, ...p }))
    .filter(p => normName(p.name).includes(qq) || (p.nid && normName(p.nid).includes(qq)) || (qd.length >= 3 && digits(p.phone).includes(qd))).slice(0, 6);
}

/* ---------- SQLite database export ---------- */
let sqlPromise = null;
function loadSqlJs() {
  if (!sqlPromise) sqlPromise = new Promise((res, rej) => { if (window.initSqlJs) return res(); const s = document.createElement('script'); s.src = 'js/vendor/sql-asm.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the SQLite engine.')); document.head.appendChild(s); }).then(() => window.initSqlJs());
  return sqlPromise;
}
const SQL_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, title TEXT, department TEXT, employee_no TEXT, email TEXT, phone TEXT, roles TEXT, active INTEGER, added_at TEXT, added_by TEXT REFERENCES users(id));
CREATE TABLE complainants (id TEXT PRIMARY KEY, name TEXT NOT NULL, nid TEXT, sex TEXT, dob TEXT, nationality TEXT, phone TEXT, email TEXT, address TEXT, atoll TEXT, island TEXT, notes TEXT, created_at TEXT, created_by TEXT REFERENCES users(id), updated_at TEXT);
CREATE TABLE victims (id TEXT PRIMARY KEY, name TEXT NOT NULL, nid TEXT, sex TEXT, dob TEXT, age INTEGER, nationality TEXT, phone TEXT, email TEXT, address TEXT, atoll TEXT, island TEXT, vulnerable_groups TEXT, notes TEXT, created_at TEXT, created_by TEXT REFERENCES users(id), updated_at TEXT);
CREATE TABLE complaints (id TEXT PRIMARY KEY, reg_no TEXT UNIQUE, cms_ref TEXT, date_received TEXT, complainant_id TEXT REFERENCES complainants(id), victim_is_complainant INTEGER, confidential INTEGER, category TEXT, atoll TEXT, island TEXT, respondent TEXT, summary TEXT, stage TEXT, assigned_to TEXT REFERENCES users(id), created_at TEXT, created_by TEXT REFERENCES users(id));
CREATE TABLE complaint_victims (complaint_id TEXT REFERENCES complaints(id), victim_id TEXT REFERENCES victims(id), relationship TEXT, PRIMARY KEY (complaint_id, victim_id));
CREATE INDEX idx_complainants_nid ON complainants(nid);
CREATE INDEX idx_victims_nid ON victims(nid);
CREATE INDEX idx_complaints_complainant ON complaints(complainant_id);
`;
async function buildSqlite() {
  const SQL = await loadSqlJs(); const db = new SQL.Database(); db.exec('PRAGMA foreign_keys = OFF;' + SQL_SCHEMA.replace('PRAGMA foreign_keys = ON;', ''));
  const ins = (table, cols, rows) => { const st = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`); rows.forEach(r => st.run(r.map(v => v === undefined ? null : v))); st.free(); };
  const userIds = new Set(Object.keys(S.staff));
  const uref = id => (id && userIds.has(id) ? id : null);
  ins('users', ['id', 'name', 'title', 'department', 'employee_no', 'email', 'phone', 'roles', 'active', 'added_at', 'added_by'], Object.entries(S.staff).map(([id, s]) => [id, nm(id), s.title || '', s.department || '', s.employeeNo || '', s.email || '', s.phone || '', (s.roles || []).join(','), s.active === false ? 0 : 1, s.addedAt || null, uref(s.addedBy)]));
  ins('complainants', ['id', 'name', 'nid', 'sex', 'dob', 'nationality', 'phone', 'email', 'address', 'atoll', 'island', 'notes', 'created_at', 'created_by', 'updated_at'], Object.entries(S.complainants).map(([id, p]) => [id, p.name, p.nid || null, p.sex || null, p.dob || null, p.nationality || null, p.phone || null, p.email || null, p.address || null, p.atoll || null, p.island || null, p.notes || null, p.createdAt || null, uref(p.createdBy), p.updatedAt || null]));
  ins('victims', ['id', 'name', 'nid', 'sex', 'dob', 'age', 'nationality', 'phone', 'email', 'address', 'atoll', 'island', 'vulnerable_groups', 'notes', 'created_at', 'created_by', 'updated_at'], Object.entries(S.victims).map(([id, p]) => [id, p.name, p.nid || null, p.sex || null, p.dob || null, p.age ? Number(p.age) : null, p.nationality || null, p.phone || null, p.email || null, p.address || null, p.atoll || null, p.island || null, (p.vulnerable || []).join('; ') || null, p.notes || null, p.createdAt || null, uref(p.createdBy), p.updatedAt || null]));
  ins('complaints', ['id', 'reg_no', 'cms_ref', 'date_received', 'complainant_id', 'victim_is_complainant', 'confidential', 'category', 'atoll', 'island', 'respondent', 'summary', 'stage', 'assigned_to', 'created_at', 'created_by'], vals(S.complaints).map(c => [c.id, c.regNo, c.cmsRef || null, c.dateReceived || null, c.complainantId && S.complainants[c.complainantId] ? c.complainantId : null, c.victimSame ? 1 : 0, c.confidential ? 1 : 0, c.category || null, c.atoll || null, c.island || null, c.respondent?.name || null, c.summary || null, c.stage, uref(c.assignedTo), c.createdAt || null, uref(c.createdBy)]));
  ins('complaint_victims', ['complaint_id', 'victim_id', 'relationship'], vals(S.complaints).flatMap(c => Object.entries(c.victimLinks || {}).filter(([vid, l]) => l && S.victims[vid]).map(([vid, l]) => [c.id, vid, l.rel || null])));
  const bytes = db.export(); db.close(); return bytes;
}
ACT.exportSqlite = async el => {
  if (!can('admin') && !can('supervise')) return;
  const btn = el; const old = btn.textContent; btn.disabled = true; btn.textContent = 'Building database…';
  try {
    const bytes = await buildSqlite();
    const readme = `FREMYS SQLite database\nExported ${fmtDT(nowISO())} by ${S.me.name || 'staff'}\n\nTables: users, complainants, victims, complaints, complaint_victims.\nOpen regis.sqlite with DB Browser for SQLite, the sqlite3 command-line tool, or any SQLite library.\n\nCONFIDENTIAL: contains personal data of complainants and victims. Store only in an encrypted, organization-approved location.\n\nSchema:\n${SQL_SCHEMA}`;
    const zip = makeZip([{ name: 'regis.sqlite', data: bytes }, { name: 'README.txt', data: new TextEncoder().encode(readme) }]);
    logA('export.sqlite', null, `${Object.keys(S.complainants).length} complainants, ${Object.keys(S.victims).length} victims`);
    await saveFile(`FREMYS-database-${today()}.zip`, zip);
  } catch (e) { console.error(e); toast(errText(e), 'error'); }
  finally { btn.disabled = false; btn.textContent = old; }
};

/* Minimal ZIP writer (stored entries) so the .sqlite file can be downloaded. */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  files = files.map(f => /\.(xml|rels)$/.test(f.name) && f.data instanceof Uint8Array ? { ...f, data: new TextEncoder().encode(stripBidi(new TextDecoder().decode(f.data))) } : f);
  const enc = new TextEncoder(); const d = new Date(); const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF; const dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const data = f.data; const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let p = 0; all.forEach(a => { out.set(a, p); p += a.length; }); return out;
}
