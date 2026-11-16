'use strict';
/* FREMYS staff accounts: username + password set by the administrator, changed by the staff member at first sign-in.
   Passwords are never stored: only a salted PBKDF2-SHA256 hash in creds/<staffId>. */

const PBKDF2_ITER = 210000;
const MAX_FAILS = 5, LOCK_MIN = 15;
const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPw(pw, saltB64, iter = PBKDF2_ITER) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return { alg: 'PBKDF2-SHA256', iter, salt: b64(salt), hash: b64(bits) };
}
function pwProblem(pw) { if (String(pw).length < 8) return 'Use at least 8 characters.'; if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.'; return null; }
function genPassword() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'; const d = '23456789'; const r = crypto.getRandomValues(new Uint32Array(10)); let s = ''; for (let i = 0; i < 10; i++) s += (i % 3 === 2 ? d : a)[r[i] % (i % 3 === 2 ? d.length : a.length)]; return s.slice(0, 5) + '-' + s.slice(5); }
const normUser = u => String(u || '').trim().toLowerCase();
const userOk = u => /^[a-z0-9._-]{3,30}$/.test(u);
function staffByUsername(u) { const n = normUser(u); return Object.keys(S.staff).find(id => normUser(S.staff[id].username) === n) || null; }

async function setPassword(staffId, pw, mustChange) {
  if (window.FREMYS_CLOUD) { await FREMYS_CLOUD.setPassword(staffId, pw, mustChange); return; }
  const h = await hashPw(pw); const ref = S.db.doc('creds/' + staffId); const snap = await ref.get();
  const body = { ...h, mustChange: !!mustChange, setAt: nowISO(), setBy: S.me.id || S.me.cid, failed: 0, lockedUntil: null };
  if (snap.exists) await q('creds/' + staffId, () => ref.update(body)); else await q('creds/' + staffId, () => ref.set({ ...body, claudeIds: {} }));
}

/* Session (kept for this browser tab only) */
const SESS_KEY = 'regis.session';
function saveSession() { try { sessionStorage.setItem(SESS_KEY, JSON.stringify({ id: S.me.id, cid: S.me.cid, at: typeof lastActive === 'number' ? lastActive : Date.now() })); } catch (e) {} }
function readSession() { try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null'); } catch (e) { return null; } }
function clearSession() { try { sessionStorage.removeItem(SESS_KEY); } catch (e) {} }

let notifUnsub = null;
function startSession(id, mustChange, fresh) {
  S.me.id = id; S.me.name = S.staff[id]?.fullName || S.staff[id]?.label || S.me.claudeName || '';
  saveSession(); lastActive = Date.now();
  if (notifUnsub) notifUnsub();
  const nref = S.db.doc('notif/' + id); let nInit = false;
  notifUnsub = nref.onSnapshot(snap => {
    if (!snap.exists && !snap.metadata.fromCache && !nInit && !S.readOnly) { nInit = true; nref.set({ items: {} }).catch(() => {}); }
    S.notif = snap.exists ? snap.data() : {};
    const items = entries(S.notif.items); if (items.length > 200 && !snap.metadata.hasPendingWrites) { const keep = items.sort(byAt).slice(0, 150); nref.set({ items: Object.fromEntries(keep.map(({ id: k, ...r }) => [k, r])) }).catch(() => {}); }
    renderWho(); if (S.route.view === 'notifications' || S.route.view === 'dashboard') scheduleRender();
  }, () => {});
  S.status = mustChange ? 'changepw' : 'ready';
  if (fresh && location.hash.slice(1) !== defaultView()) { history.replaceState(null, '', '#' + defaultView()); }
  S.route = parseRoute(); if (!location.hash) S.route = { view: defaultView(), arg: null };
  render();
}
function signOut(reason) {
  if (S.me.id) logA('logout', null, reason || '');
  if (notifUnsub) { notifUnsub(); notifUnsub = null; }
  clearSession(); S.me.id = null; S.me.name = ''; S.notif = {}; S.status = 'login'; S.loginMsg = reason || ''; closeModal(); render();
  if (window.FREMYS_CLOUD) { try { sessionStorage.setItem('fremys.loginMsg', reason || ''); } catch (e) {} setTimeout(() => FREMYS_CLOUD.logout(), 200); }
}
ACT.signOut = () => signOut('');

/* Decide what to show once staff records have loaded */
async function afterStaffLoaded() {
  if (S.me.id || S.status === 'setup' || S.status === 'changepw') return;
  if (window.FREMYS_CLOUD) { // web version: the server decides; staff records only arrive after sign-in
    const st = FREMYS_CLOUD.state;
    if (!st.setup) { S.status = 'setup'; render(); return; }
    if (st.me && S.staff[st.me.staffId]) { startSession(st.me.staffId, st.me.mustChange); return; }
    try { const m = sessionStorage.getItem('fremys.loginMsg'); if (m) { S.loginMsg = m; sessionStorage.removeItem('fremys.loginMsg'); } } catch (e) {}
    if (S.status !== 'login') { S.status = 'login'; render(); } return;
  }
  const hasAccounts = Object.values(S.staff).some(s => s.username && s.passwordSet);
  if (!hasAccounts) { S.status = S.me.isOwner ? 'setup' : 'notsetup'; render(); return; }
  const sess = readSession();
  if (sess && sess.cid === S.me.cid && S.staff[sess.id] && S.staff[sess.id].active !== false && Date.now() - sess.at < cfg().idleMinutes * 60000) {
    try { const c = await S.db.doc('creds/' + sess.id).get(); if (c.exists) { startSession(sess.id, c.data().mustChange); return; } } catch (e) {}
  }
  if (S.status !== 'login') { S.status = 'login'; render(); }
}

function authView() {
  const st = S.status;
  if (st === 'notsetup') return '<div class="card gate"><h2>FREMYS is not set up yet</h2><p class="muted">The owner of this app must open it first and create the System Administrator account.</p></div>';
  if (st === 'setup') return `<div class="card gate"><div class="login-logo" style="max-width:220px"><img src="img/fremys-logo.png" alt="FREMYS"></div><h2>Set up FREMYS</h2><p>Create the first System Administrator account. You will use this username and password to sign in, and to add staff and give them roles.</p>
    <form class="form" data-on="submit:setupAdmin" autocomplete="off" novalidate>
      ${window.FREMYS_CLOUD && FREMYS_CLOUD.state.setupKeyRequired ? '<div class="f full"><label for="su_key" class="req">Setup key</label><input id="su_key" name="setupKey" type="password" autocomplete="off" required><div class="muted small">The SETUP_KEY value from the Vercel project settings.</div></div>' : ''}
      <div class="f full"><label for="su_name" class="req">Full name</label><input id="su_name" name="fullName" value="${esc(S.me.claudeName || '')}" required></div>
      <div class="f full"><label for="su_user" class="req">Username</label><input id="su_user" name="username" placeholder="e.g. admin or yamaany" autocapitalize="off" required></div>
      <div class="f"><label for="su_pw" class="req">Password</label><input id="su_pw" name="pw" type="password" autocomplete="new-password" required></div>
      <div class="f"><label for="su_pw2" class="req">Confirm password</label><input id="su_pw2" name="pw2" type="password" autocomplete="new-password" required></div>
      <div class="f full muted small">At least 8 characters, with letters and numbers.</div><div class="f full" id="authErr" style="color:#b91c1c;font-weight:600"></div>
      <div class="f full"><button class="btn primary" type="submit">Create administrator account</button></div></form></div>`;
  if (st === 'changepw') return `<div class="card gate"><h2>Choose your own password</h2><p>${esc(S.me.name || 'Welcome')}, you signed in with a temporary password from the administrator. Choose a new password that only you know.</p>${changePwForm(false)}</div>`;
  const owner = S.me.isOwner;
  return `<div class="card gate" style="max-width:440px"><div class="login-logo"><img src="img/fremys-logo.png" alt="FREMYS — Complaint Registration Application"></div><h2 style="text-align:center;margin-bottom:12px">Sign in</h2>
    ${S.loginMsg ? `<div class="note" style="margin-bottom:10px">${esc(S.loginMsg)}</div>` : ''}
    <form class="form" data-on="submit:login" autocomplete="on" novalidate>
      <div class="f full"><label for="li_user">Username</label><input id="li_user" name="username" autocomplete="username" autocapitalize="off" required></div>
      <div class="f full"><label for="li_pw">Password</label><input id="li_pw" name="pw" type="password" autocomplete="current-password" required></div>
      <div class="f full" id="authErr" style="color:#b91c1c;font-weight:600"></div>
      <div class="f full"><button class="btn primary" type="submit" style="justify-content:center">Sign in</button></div></form>
    <p class="small muted" style="margin-bottom:0">Forgot your password? Ask the System Administrator to reset it.${owner ? ' <button class="btn link small" data-act="ownerRecovery">Owner: reset an administrator password</button>' : ''}</p></div>`;
}
function changePwForm(withCancel) {
  return `<form class="form" data-on="submit:changePw" autocomplete="off" novalidate>
    <div class="f full"><label for="cp_old" class="req">Current password</label><input id="cp_old" name="old" type="password" autocomplete="current-password" required></div>
    <div class="f"><label for="cp_new" class="req">New password</label><input id="cp_new" name="pw" type="password" autocomplete="new-password" required></div>
    <div class="f"><label for="cp_new2" class="req">Confirm new password</label><input id="cp_new2" name="pw2" type="password" autocomplete="new-password" required></div>
    <div class="f full muted small">At least 8 characters, with letters and numbers.</div><div class="f full" id="authErr" style="color:#b91c1c;font-weight:600"></div>
    <div class="f full row">${withCancel ? '<button type="button" class="btn" data-act="closeModal">Cancel</button>' : '<button type="button" class="btn" data-act="signOut">Sign out</button>'}<button class="btn primary" type="submit">Change password</button></div></form>`;
}
function authErr(msg) { const e = $('#authErr'); if (e) e.textContent = msg; else toast(msg, 'error'); }
async function busy(form, fn) { const b = form.querySelector('button[type=submit]'); const t0 = b.textContent; b.disabled = true; b.textContent = 'Please wait…'; try { await fn(); } catch (e) { console.error(e); authErr(errText(e)); } finally { if (b.isConnected) { b.disabled = false; b.textContent = t0; } } }

ON.login = form => busy(form, async () => {
  authErr(''); const u = normUser(form.username.value); const pw = form.pw.value;
  if (window.FREMYS_CLOUD) {
    if (!u || !pw) return authErr('Enter your username and password.');
    try { const r = await FREMYS_CLOUD.login(u, pw); await new Promise(res => setTimeout(res, 50)); S.loginMsg = ''; startSession(r.staffId, r.mustChange, true); logA('login.success', null, u); } catch (e) { return authErr(e.message); }
    return;
  }
  const id = staffByUsername(u); const generic = 'The username or password is incorrect.';
  if (!id || !S.staff[id].passwordSet) { logA('login.failed', null, `unknown username "${u}"`); return authErr(generic); }
  const ref = S.db.doc('creds/' + id); const snap = await ref.get(); if (!snap.exists) return authErr(generic);
  const c = snap.data();
  if (c.lockedUntil && c.lockedUntil > nowISO()) return authErr(`Too many failed attempts. Try again after ${fmtDT(c.lockedUntil).split(', ')[1]}, or ask the administrator to reset your password.`);
  const h = await hashPw(pw, c.salt, c.iter || PBKDF2_ITER);
  if (h.hash !== c.hash) {
    const failed = (c.failed || 0) + 1; const lock = failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : null;
    await ref.update({ failed: lock ? 0 : failed, lastFailedAt: nowISO(), lockedUntil: lock }).catch(() => {});
    logA('login.failed', null, `${u}${lock ? ' — locked for ' + LOCK_MIN + ' min' : ''}`);
    return authErr(lock ? `Too many failed attempts. The account is locked for ${LOCK_MIN} minutes.` : `${generic} ${MAX_FAILS - failed} attempt(s) left before the account is locked.`);
  }
  if (S.staff[id].active === false) return authErr('This account is suspended. Contact the System Administrator.');
  if (!(S.staff[id].roles || []).length) return authErr('This account has no role yet. Ask the System Administrator to assign one.');
  await ref.update({ failed: 0, lockedUntil: null, lastLoginAt: nowISO(), claudeIds: { [S.me.cid]: true } }).catch(() => {});
  S.loginMsg = ''; startSession(id, c.mustChange, true); logA('login.success', null, u);
});
ON.changePw = form => busy(form, async () => {
  authErr(''); const o = form.old.value, p1 = form.pw.value, p2 = form.pw2.value;
  if (p1 !== p2) return authErr('The new passwords do not match.');
  const bad = pwProblem(p1); if (bad) return authErr(bad);
  if (p1 === o) return authErr('Choose a password different from the current one.');
  if (window.FREMYS_CLOUD) { try { await FREMYS_CLOUD.changePassword(o, p1); } catch (e) { return authErr(e.message); } logA('password.change', null, ''); toast('Password changed'); closeModal(); if (S.status === 'changepw') { S.status = 'ready'; render(); } return; }
  const snap = await S.db.doc('creds/' + S.me.id).get(); const c = snap.data() || {};
  const h = await hashPw(o, c.salt, c.iter || PBKDF2_ITER); if (h.hash !== c.hash) return authErr('The current password is incorrect.');
  await setPassword(S.me.id, p1, false); logA('password.change', null, '');
  toast('Password changed'); closeModal(); if (S.status === 'changepw') { S.status = 'ready'; render(); }
});
ON.setupAdmin = form => busy(form, async () => {
  authErr(''); const u = normUser(form.username.value); const name = form.fullName.value.trim(); const p1 = form.pw.value;
  if (!name) return authErr('Enter your full name.'); if (!userOk(u)) return authErr('Usernames use 3–30 lowercase letters, numbers, dots, dashes or underscores.');
  if (p1 !== form.pw2.value) return authErr('The passwords do not match.'); const bad = pwProblem(p1); if (bad) return authErr(bad);
  if (window.FREMYS_CLOUD) {
    try { const r = await FREMYS_CLOUD.setup({ fullName: name, username: u, password: p1, key: form.setupKey ? form.setupKey.value.trim() : '' }); await new Promise(res => setTimeout(res, 50)); startSession(r.staffId, false, true); logA('setup.admin', null, u); toast('Administrator account created'); } catch (e) { return authErr(e.message); }
    return;
  }
  const id = S.me.cid; const prev = S.staff[id] || {};
  await setDoc('staff/' + id, { ...prev, fullName: name, username: u, passwordSet: true, roles: [...new Set([...(prev.roles || []), 'sysadmin'])], active: true, title: prev.title || 'System Administrator', addedAt: prev.addedAt || nowISO(), addedBy: prev.addedBy || id, updatedAt: nowISO() });
  await setPassword(id, p1, false); S.staff[id] = { ...prev, fullName: name, username: u, passwordSet: true, roles: [...new Set([...(prev.roles || []), 'sysadmin'])], active: true };
  startSession(id, false, true); logA('setup.admin', null, u); toast('Administrator account created');
});
ACT.ownerRecovery = () => {
  const admins = Object.entries(S.staff).filter(([, s]) => (s.roles || []).includes('sysadmin') && s.username);
  modal({ title: 'Reset an administrator password', body: `<p class="small">As the owner of this app you can set a new password for a System Administrator account.</p><div class="form">${fld('Account', sel('id', admins.map(([id, s]) => [id, `${s.fullName || s.label || 'Administrator'} (${s.username})`]), '', { req: 'an account' }), { req: true, full: true, id: 'f_id' })}${fld('New password', inp('pw', '', { type: 'password', req: 'a password' }), { req: true, id: 'f_pw' })}${fld('Confirm', inp('pw2', '', { type: 'password', req: 'the confirmation' }), { req: true, id: 'f_pw2' })}</div>`,
    submit: 'Reset password', onSubmit: async o => { if (o.pw !== o.pw2) throw new Error('The passwords do not match.'); const bad = pwProblem(o.pw); if (bad) throw new Error(bad); await setPassword(o.id, o.pw, false); logA('password.owner_reset', null, S.staff[o.id].username); toast('Password reset. You can sign in now.'); } });
};
ACT.accountMenu = () => {
  if (!S.me.id) return;
  const s = S.staff[S.me.id] || {};
  modal({ title: 'My account', body: `<dl class="kv" style="margin-bottom:14px"><dt>Name</dt><dd>${esc(S.me.name)}</dd><dt>Username</dt><dd class="mono">${esc(s.username || '—')}</dd><dt>Roles</dt><dd>${(s.roles || []).map(r => pill(ROLES[r])).join(' ')}</dd></dl><h3 style="margin-bottom:8px">Change password</h3>${changePwForm(true)}`, foot: '<button type="button" class="btn danger" data-act="signOut">Sign out</button>' });
};

/* Administrator: create accounts and reset passwords */
function showTempPassword(name, username, pw) {
  modal({ title: 'Give these sign-in details to ' + name, body: `<p>Share them privately (in person or by phone). ${esc(name.split(' ')[0])} will be asked to choose a new password the first time they sign in.</p>
    <dl class="kv" style="font-size:16px"><dt>Username</dt><dd class="mono" style="font-size:16px"><b>${esc(username)}</b></dd><dt>Temporary password</dt><dd class="mono" style="font-size:16px"><b>${esc(pw)}</b></dd></dl>
    <p class="small muted">This password is shown only now; FREMYS stores it in scrambled form and cannot show it again. If it is lost, reset it.</p>`, foot: `<button type="button" class="btn" data-act="copyCreds" data-u="${esc(username)}" data-p="${esc(pw)}">Copy</button>` });
}
ACT.copyCreds = async el => { try { await navigator.clipboard.writeText(`FREMYS username: ${el.dataset.u}\nTemporary password: ${el.dataset.p}`); toast('Copied'); } catch (e) { toast('Copy was blocked; select the text instead.', 'error'); } };
ACT.genPw = () => { const f = $('#f_newpw'); if (f) { f.value = genPassword(); f.type = 'text'; } };
ACT.resetPw = el => {
  const id = el.dataset.id; const s = S.staff[id];
  modal({ title: 'Reset password — ' + (s.fullName || nm(id)), body: `<div class="form">${fld('New temporary password', `<div class="row" style="flex-wrap:nowrap"><input id="f_newpw" name="pw" type="text" value="${esc(genPassword())}" data-required="a password" style="flex:1"><button type="button" class="btn" data-act="genPw">Generate</button></div>`, { req: true, full: true, id: 'f_newpw' })}</div><p class="small muted">The staff member must choose a new password after signing in. Any lock from failed attempts is cleared.</p>`,
    submit: 'Reset password', onSubmit: async o => { const bad = pwProblem(o.pw); if (bad) throw new Error(bad); if (!s.passwordSet) await setDoc('staff/' + id, { ...s, passwordSet: true, updatedAt: nowISO(), updatedBy: S.me.id }); await setPassword(id, o.pw, true); logA('password.reset', null, s.username); notify(id, 'Your FREMYS password was reset by the administrator', null); showTempPassword(s.fullName || nm(id), s.username, o.pw); return false; } });
};
