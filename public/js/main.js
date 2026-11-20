'use strict';
/* Boot, subscriptions, routing, navigation and event delegation. */

function parseRoute() {
  const h = decodeURIComponent((location.hash || '').slice(1));
  const m = h.match(/^(case|meeting|complainant|victim|user)-(.+)$/);
  if (m) return { view: m[1], arg: m[2] };
  return { view: h || defaultView(), arg: null };
}
function defaultView() { if (hasRole('investigation') && !can('viewAll')) return 'referrals'; if (hasRole('management') && !can('viewAll') && !can('viewAssigned')) return 'stats'; return 'dashboard'; }
function go(v) { if (location.hash === '#' + v) { S.route = parseRoute(); render(); } else location.hash = v; }
window.addEventListener('hashchange', () => {
  const prev = S.route; S.route = parseRoute();
  if (S.route.view === 'case' && (prev.view !== 'case' || prev.arg !== S.route.arg)) { S.caseTab = S._pendingTab || 'overview'; }
  S._pendingTab = null;
  S.formLock = S.route.view === 'new';
  closeModal(); $('#side').classList.remove('open'); render(); $('#main').scrollTop = 0;
});
ACT.openCaseTab = el => { S._pendingTab = el.dataset.tab; S.caseTab = el.dataset.tab; go('case-' + el.dataset.id); };

const NAV = [
  ['sec', 'nav_work'],
  ['dashboard', () => can('viewAll') || can('viewAssigned')],
  ['register', () => can('viewAll') || can('viewAssigned')],
  ['new', () => can('register')],
  ['assignation', () => can('assign'), () => visibleCases().filter(c => c.stage === 'registered' && !c.assignedTo).length],
  ['assign', () => can('assign') || can('viewAll') || can('viewAssigned'), () => can('assign') ? vals(S.complaints).filter(c => c.stage === 'registered').length : 0],
  ['requests', () => can('viewAll') || can('viewAssigned'), () => visibleCases().reduce((s, c) => s + openReqs(c).length, 0)],
  ['actions', () => can('viewAll') || can('viewAssigned'), () => recsList().filter(r => r.owner === S.me.id && recOverdue(r)).length],
  ['interim', () => can('viewAll') || can('viewAssigned'), () => vals(S.complaints).filter(c => interimPending(c) && (can('assign') || hasRole('admin_officer') ? true : c.assignedTo === S.me.id)).length],
  ['duty', () => can('viewAll') || can('viewAssigned'), () => { const x = (S.duty || {})[today()]; return x && x.officer === S.me.id && !vals(x.logs).length ? 1 : 0; }],
  ['sec', 'nav_panel'],
  ['panel', () => can('viewAll')],
  ['commission', () => can('viewAll'), () => can('commission') ? vals(S.complaints).reduce((s, c) => s + pendingCommission(c).length, 0) : 0],
  ['referrals', () => can('viewAll') || can('investigation') || can('referralManage'), () => hasRole('investigation') ? vals(S.complaints).reduce((s, c) => s + vals(c.referrals).filter(r => r.status === 'sent').length, 0) : 0],
  ['people', () => can('viewAll') || can('viewAssigned')],
  ['sec', 'nav_ref'],
  ['laws', () => can('viewAll') || can('viewAssigned')],
  ['catalogue', () => can('viewAll') || can('viewAssigned')],
  ['leave', () => true, () => { const td = today(); return leaveList().filter(l => l.staffId === S.me.id && l.from <= td && l.to >= td).length ? 0 : 0; }],
  ['sec', 'nav_reports'],
  ['stats', () => can('stats')],
  ['briefing', () => can('stats')],
  ['panelbrief', () => can('stats')],
  ['performance', () => can('stats') || can('admin')],
  ['sec', 'nav_system'],
  ['users', () => can('admin') || can('supervise')],
  ['admin', () => can('admin')],
];
function renderNav() {
  const v = { case: 'register', meeting: 'panel', complainant: 'people', victim: 'people', user: 'users' }[S.route.view] || S.route.view;
  let html = ''; let pendingSec = null;
  for (const item of NAV) {
    if (item[0] === 'sec') { pendingSec = item[1]; continue; }
    const [key, allow, countFn] = item; if (!allow()) continue;
    if (pendingSec) { html += `<div class="sec">${esc(t(pendingSec))}</div>`; pendingSec = null; }
    const n = countFn ? countFn() : 0;
    html += `<a href="#${key}" class="${v === key ? 'on' : ''}"><span>${esc(t(key))}</span>${n ? `<span class="cnt">${n}</span>` : ''}</a>`;
  }
  $('#nav').innerHTML = html;
  $('#sideFoot').innerHTML = `Human Rights Commission of the Maldives<br>Registration Department${S.lang === 'dv' ? '<br><span class="small">ދިވެހި ތަރުޖަމާ: ޑްރާފްޓް</span>' : ''}`;
}
function renderWho() {
  const r = myRoles();
  $('#who').innerHTML = S.me.id ? `<button class="who-btn" data-act="accountMenu" aria-label="My account"><span class="avatar">${esc((S.me.name || '?').trim().charAt(0).toUpperCase())}</span><div class="meta"><div></div><div class="roles" title="${esc(r.map(x => ROLES[x]).join(', '))}">${esc(r.length > 2 ? `${ROLES[r[0]]} +${r.length - 1} roles` : r.map(x => ROLES[x]).join(', ') || 'No role')}</div></div></button><button class="logout-btn" data-act="logoutAsk" title="Log out of FREMYS" aria-label="Log out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg><span>Log out</span></button>` : '';
  const nameEl = $('#who .meta div'); if (nameEl) nameEl.textContent = S.me.name || 'Signed in';
  $('#quick').classList.toggle('hidden', !S.me.id); $('#bellBtn').classList.toggle('hidden', !S.me.id);
  const unread = vals(S.notif.items).filter(i => !i.read).length; const b = $('#bellCount'); b.textContent = unread; b.classList.toggle('hidden', !unread);
  $('#langBtn').textContent = S.lang === 'dv' ? 'English' : 'ދިވެހި';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $('#quickQ').placeholder = S.lang === 'dv' ? 'ރަޖިސްޓްރީ ނަންބަރު، ސީއެމްއެސް ނުވަތަ ނަމުން ހޯދާ' : 'Search registration no., CMS ref or name';
}

let dirty = false;
function render(fromData = false) {
  const main = $('#main');
  const ae = document.activeElement;
  if (fromData && S.status === 'ready' && main.contains(ae) && ae.matches('input,textarea,select') && ae.type !== 'checkbox' && !ae.closest('[data-live]')) { dirty = true; renderNav(); renderWho(); return; }
  if (fromData && S.formLock && S.route.view === 'new' && $('#newForm')) { dirty = true; renderNav(); renderWho(); return; }
  dirty = false;
  if (S.status !== 'ready') { main.innerHTML = gateView(); renderNav(); renderWho(); return; }
  const { view, arg } = S.route;
  if (!myRoles().length) { main.innerHTML = gateView(); renderNav(); renderWho(); return; }
  const fn = VIEWS[view];
  let html;
  try { html = fn ? fn(arg) : `<div class="card gate"><h2>Page not found</h2><a class="btn" href="#${defaultView()}">Go to the start page</a></div>`; }
  catch (e) { console.error(e); html = `<div class="card gate"><h2>Something went wrong showing this page</h2><p class="mono small">${esc(e.message)}</p><a class="btn" href="#dashboard">Back to overview</a></div>`; }
  main.innerHTML = html;
  document.title = 'FREMYS';
  renderNav(); renderWho();
  resolveNames(Object.keys(S.staff));
}
document.addEventListener('focusout', () => { setTimeout(() => { if (dirty && !$('#main').contains(document.activeElement)) render(); }, 50); });

function gateView() {
  const st = S.status;
  if (st === 'loading' || st === 'auth') return '<div class="loading">Connecting to the FREMYS database…</div>';
  if (st === 'slow') return '<div class="card gate"><h2>Still connecting</h2><p class="muted">The FREMYS database has not answered yet. Check your connection; the page will continue as soon as it responds.</p></div>';
  if (st === 'nodb') return '<div class="card gate"><h2>FREMYS needs its database</h2><p class="muted">Open FREMYS from its claude.ai link while signed in. The shared database is not available in this view.</p></div>';
  if (st === 'signedout') return '<div class="card gate"><h2>Sign in to claude.ai first</h2><p class="muted">FREMYS opens through claude.ai. Sign in there, then reload this page.</p></div>';
  if (st === 'revoked') return '<div class="card gate"><h2>Access changed</h2><p class="muted">Your access to FREMYS changed while the page was open.</p></div>';
  if (S.readOnly && st === 'login') return '<div class="card gate"><h2>View-only access</h2><p class="muted">This copy of FREMYS is shared with you as view-only. Ask the owner to share it with you as a Contributor, then sign in with the username and password the administrator gave you.</p></div>';
  if (['login', 'setup', 'notsetup', 'changepw'].includes(st)) return authView();
  const s = S.staff[S.me.id];
  if (s && s.active === false) return '<div class="card gate"><h2>Account suspended</h2><p class="muted">Your FREMYS account has been suspended. Contact the System Administrator.</p></div>';
  return '<div class="card gate"><h2>No role assigned</h2><p class="muted">Your account has no role yet. Ask the System Administrator to assign one.</p><button class="btn" data-act="signOut">Sign out</button></div>';
}

/* Event delegation */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) { if (!e.target.closest('#side') && !e.target.closest('#navToggle')) $('#side').classList.remove('open'); return; }
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.dataset.act === 'ovClick') { if (e.target === el) closeModal(); return; }
  const inner = e.target.closest('a,button,input,select,label');
  if (inner && inner !== el && el.contains(inner)) return; // a link or control inside a clickable row handles itself
  const isLink = el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#';
  if (!isLink) e.preventDefault();
  Promise.resolve().then(() => fn(el, e)).catch(err => { console.error(err); toast(errText(err), 'error'); });
});
function onEvt(type) { return e => { const el = e.target.closest(`[data-on*="${type}:"]`); if (!el) return; const spec = el.dataset.on.split(/\s+/).find(x => x.startsWith(type + ':')); if (!spec) return; const fn = ON[spec.slice(type.length + 1)]; if (!fn) return; if (type === 'submit') e.preventDefault(); Promise.resolve().then(() => fn(el, e)).catch(err => { console.error(err); toast(errText(err), 'error'); }); }; }
['input', 'change', 'submit', 'toggle'].forEach(tp => document.addEventListener(tp, onEvt(tp), true));
ACT.closeModal = () => closeModal();
ACT.ovClick = () => {};
ACT.go = el => go(el.dataset.to);
ACT.toggleNav = () => $('#side').classList.toggle('open');
ACT.toggleLang = () => { setLang(S.lang === 'dv' ? 'en' : 'dv'); savePrefs({ lang: S.lang }).catch(() => {}); };
ON.quickSearch = form => { const v = form.q.value.trim(); if (!v) return; const hit = visibleCases().find(c => c.regNo.toLowerCase() === v.toLowerCase() || (c.cmsRef || '').toLowerCase() === v.toLowerCase()); form.q.value = ''; if (hit) go('case-' + hit.id); else { S.filter = { q: v }; go('register'); } };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalRoot').innerHTML) closeModal(); });
function setLang(l) { S.lang = l; document.documentElement.lang = l === 'dv' ? 'dv' : 'en'; document.documentElement.dir = l === 'dv' ? 'rtl' : 'ltr'; render(); }

/* Inactivity: sign out after the configured idle time */
let lastActive = Date.now();
['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
setInterval(() => { if (S.me.id && Date.now() - lastActive > cfg().idleMinutes * 60000) signOut(`You were signed out after ${cfg().idleMinutes} minutes without activity.`); else if (S.me.id) saveSession(); }, 30000);

async function boot() {
  S.route = parseRoute(); render();
  if (!window.claude || typeof window.claude.use !== 'function') { S.status = 'nodb'; render(); return; }
  const slow = setTimeout(() => { if (S.status === 'loading') { S.status = 'slow'; render(); } }, 10000);
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  S.user = user;
  if (!db) { clearTimeout(slow); S.status = user ? 'signedout' : 'nodb'; render(); return; }
  S.db = db;
  const me = user ? await user.me() : { id: null };
  if (!me.id) { clearTimeout(slow); S.status = 'signedout'; render(); return; }
  S.me = { id: null, cid: me.id, name: '', claudeName: me.name || '', avatarUrl: me.avatarUrl, isOwner: me.isOwner, canEdit: me.canEdit };
  S.names[me.id] = me.name;
  const cw = user ? await user.can('data.write') : null; S.readOnly = cw === false;
  claude.use('downloads').then(d => { S.dl = d; });
  claude.use('assets').then(a => { S.assets = a; });

  const onErr = what => e => { console.warn(what, e); if (e && e.code === 'revoked') { S.status = 'revoked'; render(); } else toast(`Live updates for ${what} stopped: ${errText(e)} Reload the page to reconnect.`, 'error'); };
  const ready = () => {
    if (S.loaded.staff && S.loaded.complaints && ['loading', 'slow'].includes(S.status)) { clearTimeout(slow); S.status = 'auth'; afterStaffLoaded(); }
    else if (S.loaded.staff && S.status === 'login' && !S.me.id) afterStaffLoaded();
    if (S.me.id && S.staff[S.me.id] && S.staff[S.me.id].active === false) signOut('Your account was suspended by the administrator.');
    scheduleRender();
  };

  db.collection('staff').onSnapshot(snap => {
    S.staff = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    if (!snap.metadata.fromCache) S.loaded.staff = true;
    if (S.me.id) S.me.name = S.staff[S.me.id]?.fullName || S.me.name;
    ready();
  }, onErr('staff'));
  db.collection('complaints').onSnapshot(snap => {
    const o = {}; snap.docs.forEach(d => { o[d.id] = { id: d.id, ...d.data() }; }); S.complaints = o;
    if (!snap.metadata.fromCache) S.loaded.complaints = true; ready();
  }, onErr('complaints'));
  const peopleSub = (col) => db.collection(col).onSnapshot(snap => { S[col] = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); if (!snap.metadata.fromCache) S.loaded[col] = true;
    scheduleRender(); }, onErr(col));
  peopleSub('complainants'); peopleSub('victims');
  db.collection('leave').onSnapshot(snap => { S.leave = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); scheduleRender(); }, onErr('leave'));
  db.collection('duty').onSnapshot(snap => { S.duty = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); scheduleRender(); }, onErr('1424 duty'));
  db.collection('recs').onSnapshot(snap => { S.recs = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); scheduleRender(); }, onErr('recommendations'));
  db.collection('meetings').onSnapshot(snap => { const o = {}; snap.docs.forEach(d => { o[d.id] = { id: d.id, ...d.data() }; }); S.meetings = o; S.loaded.meetings = true; scheduleRender(); }, onErr('meetings'));
  db.doc('config/catalogue').onSnapshot(snap => { S.catalogue = snap.exists ? snap.data() : null; scheduleRender(); }, () => {});
  claude.use('sample').then(sm => { S.sample = sm; });
  db.doc('config/holidays').onSnapshot(snap => { S.holidays = (snap.exists && snap.data().days) || {}; S._catUseRev = (S._catUseRev || 0) + 1; scheduleRender(); }, () => {});
  db.doc('config/settings').onSnapshot(snap => { S.cfg = snap.exists ? snap.data() : null; S.loaded.cfg = true; scheduleRender(); }, onErr('settings'));
  db.doc(`data/users/${me.id}/prefs`).get().then(snap => { if (snap.exists) { S.prefs = snap.data() || {}; if (S.prefs.lang && S.prefs.lang !== S.lang) setLang(S.prefs.lang); } }).catch(() => {});
}
boot();
