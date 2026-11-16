'use strict';
/*
  FREMYS web API: framework-independent request handling. api/[route].js adapts it to Vercel.
  Security model
  - Nothing except /state, /login, /setup and /recover answers without a valid session cookie.
  - Passwords are checked here (PBKDF2-SHA256); password hashes live in their own table and are never sent to browsers.
  - Staff accounts and settings can only be changed by a System Administrator; the audit trail can only be read by one.
  - Sessions are HMAC-signed cookies (HttpOnly, SameSite=Strict). A password reset ends that person's sessions.
*/
const crypto = require('crypto');

const PBKDF2_ITER = 210000, MAX_FAILS = 5, LOCK_MIN = 15, SESSION_HOURS = 12, SYNC_LIMIT = 250, MAX_FILE = 4 * 1024 * 1024, MAX_DOC = 900 * 1024;
const COOKIE = 'fremys_session';
const err = (status, code, message) => Object.assign(new Error(message), { status, code });
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) { const out = isObj(a) ? { ...a } : {}; for (const k of Object.keys(b)) { const v = b[k]; out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v; } return out; }
const validPath = p => typeof p === 'string' && p.length < 400 && /^[A-Za-z0-9_.\-]+(\/[A-Za-z0-9_.\-]+)*$/.test(p) && p.split('/').length % 2 === 0 && !p.split('/').some(s => s === '.' || s === '..');
const normUser = u => String(u || '').trim().toLowerCase();
function pwProblem(pw) { pw = String(pw || ''); if (pw.length < 8) return 'Use at least 8 characters.'; if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.'; if (pw.length > 200) return 'The password is too long.'; return null; }
const hashPw = (pw, salt, iter = PBKDF2_ITER) => new Promise((res, rej) => crypto.pbkdf2(String(pw), Buffer.from(salt, 'base64'), iter, 32, 'sha256', (e, k) => (e ? rej(e) : res(k.toString('base64')))));
async function newHash(pw) { const salt = crypto.randomBytes(16).toString('base64'); return { alg: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt, hash: await hashPw(pw, salt) }; }
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* ---------- schema ---------- */
const SCHEMA = [
  `CREATE SEQUENCE IF NOT EXISTS fremys_rev`,
  `CREATE TABLE IF NOT EXISTS fremys_docs (path text PRIMARY KEY, data jsonb, rev bigint NOT NULL, deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS fremys_docs_rev ON fremys_docs (rev)`,
  `CREATE TABLE IF NOT EXISTS fremys_creds (staff_id text PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fremys_leases (path text PRIMARY KEY, holder text NOT NULL, until timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fremys_files (id text PRIMARY KEY, type text NOT NULL, size integer NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by text)`,
];

function createApi({ db, secret, env = {} }) {
  if (!secret || String(secret).length < 24) throw err(500, 'config', 'SESSION_SECRET is missing or too short (use at least 24 random characters). Add it in Vercel → Settings → Environment Variables and redeploy.');
  let ready = null;
  const init = () => (ready = ready || (async () => { for (const s of SCHEMA) await db.query(s); })().catch(e => { ready = null; throw e; }));
  const one = async (sql, p) => (await db.query(sql, p)).rows[0] || null;

  /* ---------- sessions ---------- */
  const sign = payload => { const b = Buffer.from(JSON.stringify(payload)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', secret).update(b).digest('base64url'); };
  function unsign(tok) {
    if (!tok || !tok.includes('.')) return null; const [b, s] = tok.split('.');
    const want = crypto.createHmac('sha256', secret).update(b).digest('base64url'); if (!safeEq(s, want)) return null;
    try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
  }
  const cookieFor = (tok, secure) => `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${tok ? '' : '; Max-Age=0'}`;
  async function sessionOf(cookies) {
    const p = unsign(cookies[COOKIE]); if (!p) return null;
    const r = await one(`SELECT (SELECT data FROM fremys_docs WHERE path = $1 AND NOT deleted) AS staff, (SELECT data FROM fremys_creds WHERE staff_id = $2) AS cred`, ['staff/' + p.sid, p.sid]);
    if (!r || !r.staff || !r.cred || (r.cred.tokenVersion || 0) !== p.v || r.staff.active === false) return null;
    return { sid: p.sid, staff: r.staff, cred: r.cred, roles: r.staff.roles || [], admin: (r.staff.roles || []).includes('sysadmin') };
  }
  const issue = (sid, cred) => sign({ sid, v: cred.tokenVersion || 0, exp: Date.now() + SESSION_HOURS * 3600e3 });

  /* ---------- documents ---------- */
  const synced = p => !p.startsWith('audit/');
  async function write(sess, op, path, data) {
    if (!validPath(path)) throw err(400, 'invalid_argument', 'Invalid record path.');
    const top = path.split('/')[0];
    if (top === 'creds') throw err(403, 'permission_denied', 'Passwords are changed through the password functions.');
    if ((top === 'staff' || top === 'config') && !sess.admin) throw err(403, 'permission_denied', 'Only a System Administrator can change staff accounts and settings.');
    if (top === 'audit' && op === 'delete') throw err(403, 'permission_denied', 'The audit trail cannot be deleted.');
    if (top === 'staff' && op === 'delete' && path === 'staff/' + sess.sid) throw err(400, 'invalid_argument', 'You cannot remove your own account.');
    if (op !== 'delete') { if (!isObj(data)) throw err(400, 'invalid_argument', 'Data must be an object.'); if (Buffer.byteLength(JSON.stringify(data)) > MAX_DOC) throw err(413, 'too_large', 'This record is too large.'); }
    if (op === 'set' && top !== 'audit') {
      const r = await one(`INSERT INTO fremys_docs (path, data, rev, deleted, updated_at) VALUES ($1, $2, nextval('fremys_rev'), false, now())
        ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, rev = EXCLUDED.rev, deleted = false, updated_at = now() RETURNING rev`, [path, JSON.stringify(data)]);
      return { path, rev: Number(r.rev), data };
    }
    if (op === 'update' || op === 'set') {           // audit 'set' is treated as a merge, so two first entries of a month never overwrite each other
      for (let i = 0; i < 8; i++) {
        const cur = await one(`SELECT data, rev FROM fremys_docs WHERE path = $1 AND NOT deleted`, [path]);
        if (!cur) {
          if (op === 'update') throw err(404, 'not_found', 'The record does not exist.');
          const r = await one(`INSERT INTO fremys_docs (path, data, rev) VALUES ($1, $2, nextval('fremys_rev')) ON CONFLICT (path) DO NOTHING RETURNING rev`, [path, JSON.stringify(data)]);
          if (r) return { path, rev: Number(r.rev), data }; continue;
        }
        const next = merge(cur.data, data);
        const r = await one(`UPDATE fremys_docs SET data = $2, rev = nextval('fremys_rev'), updated_at = now() WHERE path = $1 AND rev = $3 RETURNING rev`, [path, JSON.stringify(next), cur.rev]);
        if (r) return { path, rev: Number(r.rev), data: next };
      }
      throw err(409, 'aborted', 'The record was being changed by someone else. Try again.');
    }
    if (op === 'delete') {
      const r = await one(`UPDATE fremys_docs SET data = NULL, deleted = true, rev = nextval('fremys_rev'), updated_at = now() WHERE path = $1 AND NOT deleted RETURNING rev`, [path]);
      if (top === 'staff') await db.query(`DELETE FROM fremys_creds WHERE staff_id = $1`, [path.slice(6)]);
      return { path, rev: r ? Number(r.rev) : 0, data: null };
    }
    throw err(400, 'invalid_argument', 'Unknown operation.');
  }

  /* ---------- password helpers ---------- */
  async function storePw(sid, pw, mustChange, by, bump) {
    const cur = await one(`SELECT data FROM fremys_creds WHERE staff_id = $1`, [sid]);
    const data = { ...(cur ? cur.data : {}), ...(await newHash(pw)), mustChange: !!mustChange, setAt: new Date().toISOString(), setBy: by, failed: 0, lockedUntil: null, tokenVersion: ((cur && cur.data.tokenVersion) || 0) + (bump ? 1 : 0) };
    await db.query(`INSERT INTO fremys_creds (staff_id, data) VALUES ($1, $2) ON CONFLICT (staff_id) DO UPDATE SET data = EXCLUDED.data`, [sid, JSON.stringify(data)]);
    return data;
  }
  const staffByUser = async u => one(`SELECT path, data FROM fremys_docs WHERE path LIKE 'staff/%' AND NOT deleted AND lower(data->>'username') = $1 LIMIT 1`, [normUser(u)]);
  const anyAccounts = async () => !!(await one(`SELECT 1 AS x FROM fremys_creds LIMIT 1`));

  /* ---------- request handler ---------- */
  return async function handle(req) {
    // req: { route, method, query, cookies, body (object or Buffer), headers, secure }
    const json = (status, body, headers = {}) => ({ status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) });
    try {
      await init();
      const { route, method } = req; const body = isObj(req.body) ? req.body : {};
      if (method === 'POST' && req.headers['x-fremys'] !== '1' && route !== 'upload') throw err(403, 'permission_denied', 'Missing request header.'); // blocks cross-site form posts
      const sess = await sessionOf(req.cookies || {});
      const need = () => { if (!sess) throw err(401, 'unauthenticated', 'Your session has ended. Sign in again.'); return sess; };

      if (route === 'state' && method === 'GET') {
        return json(200, { setup: await anyAccounts(), setupKeyRequired: !!env.SETUP_KEY, ai: !!env.ANTHROPIC_API_KEY, me: sess ? { staffId: sess.sid, mustChange: !!sess.cred.mustChange } : null });
      }
      if (route === 'setup' && method === 'POST') {
        if (env.SETUP_KEY && !safeEq(body.key || '', env.SETUP_KEY)) throw err(403, 'permission_denied', 'The setup key is not correct.');
        const u = normUser(body.username); const name = String(body.fullName || '').trim().slice(0, 120);
        if (!name) throw err(400, 'invalid_argument', 'Enter your full name.'); if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw err(400, 'invalid_argument', 'Usernames use 3–30 lowercase letters, numbers, dots, dashes or underscores.');
        const bad = pwProblem(body.password); if (bad) throw err(400, 'invalid_argument', bad);
        const lock = await one(`INSERT INTO fremys_leases (path, holder, until) VALUES ('setup', 'setup', now() + interval '1 minute') ON CONFLICT (path) DO UPDATE SET until = EXCLUDED.until WHERE fremys_leases.until < now() RETURNING path`, []);
        if (!lock || await anyAccounts()) throw err(409, 'already_exists', 'FREMYS has already been set up. Sign in instead.');
        const sid = 's' + crypto.randomBytes(8).toString('hex'); const now = new Date().toISOString();
        await write({ admin: true, sid }, 'set', 'staff/' + sid, { fullName: name, username: u, passwordSet: true, roles: ['sysadmin'], active: true, title: 'System Administrator', addedAt: now, addedBy: sid, updatedAt: now });
        const cred = await storePw(sid, body.password, false, sid, false);
        return json(200, { staffId: sid, mustChange: false }, { 'Set-Cookie': cookieFor(issue(sid, cred), req.secure) });
      }
      if (route === 'login' && method === 'POST') {
        const generic = 'The username or password is incorrect.';
        const st = await staffByUser(body.username); if (!st || !st.data.passwordSet) throw err(401, 'login_failed', generic);
        const sid = st.path.slice(6); const c = (await one(`SELECT data FROM fremys_creds WHERE staff_id = $1`, [sid]))?.data; if (!c) throw err(401, 'login_failed', generic);
        if (c.lockedUntil && c.lockedUntil > new Date().toISOString()) throw err(423, 'locked', `Too many failed attempts. Try again after ${new Date(c.lockedUntil).toISOString().slice(11, 16)} UTC, or ask the administrator to reset your password.`);
        const ok = safeEq(await hashPw(body.password || '', c.salt, c.iter || PBKDF2_ITER), c.hash);
        if (!ok) {
          const failed = (c.failed || 0) + 1; const lock = failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : null;
          await db.query(`UPDATE fremys_creds SET data = $2 WHERE staff_id = $1`, [sid, JSON.stringify({ ...c, failed: lock ? 0 : failed, lastFailedAt: new Date().toISOString(), lockedUntil: lock })]);
          throw err(401, 'login_failed', lock ? `Too many failed attempts. The account is locked for ${LOCK_MIN} minutes.` : `${generic} ${MAX_FAILS - failed} attempt(s) left before the account is locked.`);
        }
        if (st.data.active === false) throw err(403, 'suspended', 'This account is suspended. Contact the System Administrator.');
        if (!(st.data.roles || []).length) throw err(403, 'no_role', 'This account has no role yet. Ask the System Administrator to assign one.');
        const c2 = { ...c, failed: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() };
        await db.query(`UPDATE fremys_creds SET data = $2 WHERE staff_id = $1`, [sid, JSON.stringify(c2)]);
        return json(200, { staffId: sid, mustChange: !!c.mustChange }, { 'Set-Cookie': cookieFor(issue(sid, c2), req.secure) });
      }
      if (route === 'logout' && method === 'POST') return json(200, { ok: true }, { 'Set-Cookie': cookieFor('', req.secure) });
      if (route === 'recover' && method === 'POST') {
        if (!env.RECOVERY_KEY || String(env.RECOVERY_KEY).length < 16 || !safeEq(body.key || '', env.RECOVERY_KEY)) throw err(403, 'permission_denied', 'Recovery is not enabled or the key is wrong.');
        const st = await staffByUser(body.username); if (!st) throw err(404, 'not_found', 'No account with that username.');
        const bad = pwProblem(body.password); if (bad) throw err(400, 'invalid_argument', bad);
        await storePw(st.path.slice(6), body.password, true, 'recovery', true);
        return json(200, { ok: true, message: 'Password reset. Sign in with it; you will be asked to choose a new one.' });
      }
      if (route === 'password' && method === 'POST') {
        const s = need(); const target = body.staffId || s.sid; const bad = pwProblem(body.password); if (bad) throw err(400, 'invalid_argument', bad);
        if (target === s.sid && !body.staffId) {
          if (!safeEq(await hashPw(body.old || '', s.cred.salt, s.cred.iter || PBKDF2_ITER), s.cred.hash)) throw err(400, 'invalid_argument', 'The current password is incorrect.');
          if (body.old === body.password) throw err(400, 'invalid_argument', 'Choose a password different from the current one.');
          const cred = await storePw(s.sid, body.password, false, s.sid, true);
          return json(200, { ok: true }, { 'Set-Cookie': cookieFor(issue(s.sid, cred), req.secure) });
        }
        if (!s.admin) throw err(403, 'permission_denied', 'Only a System Administrator can set another person\'s password.');
        const st = await one(`SELECT data FROM fremys_docs WHERE path = $1 AND NOT deleted`, ['staff/' + target]); if (!st) throw err(404, 'not_found', 'Staff member not found.');
        const cred = await storePw(target, body.password, body.mustChange !== false, s.sid, true);
        return json(200, { ok: true }, target === s.sid ? { 'Set-Cookie': cookieFor(issue(s.sid, cred), req.secure) } : {});
      }
      if (route === 'sync' && method === 'GET') {
        need(); const since = Math.max(0, parseInt(req.query.since, 10) || 0);
        const rows = (await db.query(`SELECT path, data, rev, deleted FROM fremys_docs WHERE rev > $1 AND path NOT LIKE 'audit/%' AND ($1 > 0 OR NOT deleted) ORDER BY rev LIMIT ${SYNC_LIMIT}`, [since])).rows;
        const top = await one(`SELECT last_value AS v, is_called FROM fremys_rev`, []);
        return json(200, { changes: rows.map(r => ({ path: r.path, rev: Number(r.rev), data: r.deleted ? null : r.data })), more: rows.length === SYNC_LIMIT, head: top && top.is_called ? Number(top.v) : 0 });
      }
      if (route === 'get' && method === 'GET') {
        const s = need(); const p = String(req.query.path || ''); if (!validPath(p)) throw err(400, 'invalid_argument', 'Invalid record path.');
        if (p.startsWith('creds/')) throw err(403, 'permission_denied', 'Not available.');
        const r = await one(`SELECT data, rev FROM fremys_docs WHERE path = $1 AND NOT deleted`, [p]);
        return json(200, { exists: !!r, data: r ? (p.startsWith('audit/') && !s.admin ? {} : r.data) : null, rev: r ? Number(r.rev) : 0 });
      }
      if (route === 'write' && method === 'POST') return json(200, await write(need(), body.op, body.path, body.data));
      if (route === 'acquire' && method === 'POST') {
        need(); const ttl = Math.min(60000, Math.max(1000, parseInt(body.ttlMs, 10) || 8000));
        const r = await one(`INSERT INTO fremys_leases (path, holder, until) VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval)
          ON CONFLICT (path) DO UPDATE SET holder = EXCLUDED.holder, until = EXCLUDED.until WHERE fremys_leases.until < now() OR fremys_leases.holder = EXCLUDED.holder RETURNING holder`, ['lease:' + body.path, String(body.holder || 'x'), String(ttl)]);
        return json(200, { acquired: !!r });
      }
      if (route === 'upload' && method === 'POST') {
        const s = need(); if (req.headers['x-fremys'] !== '1') throw err(403, 'permission_denied', 'Missing request header.');
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
        if (!buf.length) throw err(400, 'invalid_argument', 'The file is empty.'); if (buf.length > MAX_FILE) throw err(413, 'too_large', 'Files must be 4 MB or smaller on the web version.');
        const type = String(req.headers['x-file-type'] || 'application/octet-stream').slice(0, 100); const id = 'f' + crypto.randomBytes(12).toString('hex');
        await db.query(`INSERT INTO fremys_files (id, type, size, data, created_by) VALUES ($1, $2, $3, $4, $5)`, [id, type, buf.length, buf, s.sid]);
        return json(200, { id, url: `/api/file?id=${id}`, sizeBytes: buf.length, contentType: type });
      }
      if (route === 'file' && method === 'GET') {
        need(); const r = await one(`SELECT type, data FROM fremys_files WHERE id = $1`, [String(req.query.id || '')]); if (!r) throw err(404, 'not_found', 'File not found.');
        const inline = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/.test(r.type);
        return { status: 200, headers: { 'Content-Type': inline ? r.type : 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", ...(inline ? {} : { 'Content-Disposition': 'attachment' }) }, body: Buffer.from(r.data) };
      }
      if (route === 'sample' && method === 'POST') {
        need(); if (!env.ANTHROPIC_API_KEY) throw err(503, 'sampling_disabled', 'AI suggestions are off.');
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 2000, system: String(body.system || '') + (body.json ? '\nReply with a single JSON object only, no other text.' : ''), messages: [{ role: 'user', content: String(body.prompt || '').slice(0, 60000) }] }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw err(502, r.status === 429 ? 'rate_limited' : 'sampling_failed', j.error?.message || `The AI service answered ${r.status}.`);
        return json(200, { text: (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('') });
      }
      throw err(404, 'not_found', 'Unknown API route.');
    } catch (e) {
      if (!e.status) console.error(e);
      return json(e.status || 500, { code: e.code || 'internal', message: e.status ? e.message : 'Server error. Check the Vercel function logs.' });
    }
  };
}
module.exports = { createApi, merge, COOKIE };
