'use strict';
/* FREMYS web runtime: provides the window.claude.use(...) services the app expects, backed by the FREMYS API (/api/*)
   on Vercel. Records are kept in memory after sign-in and refreshed every few seconds; nothing is stored in the browser.
   window.FREMYS_CLOUD exposes sign-in, setup and password functions used by js/auth.js. */
(() => {
  const clone = v => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));
  const parent = p => p.split('/').slice(0, -1).join('/');
  const err = (code, message) => Object.assign(new Error(message), { code });
  const cache = new Map();                      // path -> { data, rev }
  const docL = new Map(), colL = new Map();
  let state = { setup: false, me: null, ai: false }, lastRev = 0, prevRev = 0, signedIn = false, polling = null;
  const POLL_MS = 5000;

  async function call(route, { body, query, raw, headers, signal } = {}) {
    let r;
    const url = '/api/' + route + (query ? '?' + new URLSearchParams(query) : '');
    try { r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal, headers: { 'X-Fremys': '1', ...(raw ? headers : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) }); }
    catch (e) { if (e.name === 'AbortError') throw err('cancelled', 'Cancelled.'); throw err('unavailable', 'FREMYS cannot reach the server. Check the internet connection.'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && signedIn && route !== 'login') { signedIn = false; setTimeout(() => location.reload(), 1500); }
    if (!r.ok) throw err(j.code || 'internal', j.message || `Server error ${r.status}`);
    return j;
  }

  /* ---- change handling ---- */
  const pendD = new Set(), pendC = new Set(); let flushT = null;
  function apply(ch) {
    const cur = cache.get(ch.path); if (cur && cur.rev >= ch.rev) return;
    if (ch.data === null) cache.delete(ch.path); else cache.set(ch.path, { data: ch.data, rev: ch.rev });
    pendD.add(ch.path); pendC.add(parent(ch.path)); if (!flushT) flushT = setTimeout(flush, 15);
  }
  function flush() { flushT = null; const ds = [...pendD], cs = [...pendC]; pendD.clear(); pendC.clear(); ds.forEach(p => (docL.get(p) || []).forEach(fn => fn(snapDoc(p)))); cs.forEach(cp => (colL.get(cp) || []).forEach(l => l.fn(qsnap(cp, l.filters)))); }
  // Ask again from one poll back, so a change saved a moment late by a slower request is never missed (duplicates are ignored).
  async function sync() {
    if (!signedIn) return; const from = prevRev; let since = from, more = true, top = lastRev;
    while (more) { const r = await call('sync', { query: { since } }); r.changes.forEach(apply); r.changes.forEach(c => { top = Math.max(top, c.rev); }); since = r.changes.length ? r.changes[r.changes.length - 1].rev : since; more = r.more; }
    prevRev = lastRev; lastRev = top; if (!from) prevRev = top;
  }
  function startPolling() {
    if (polling) return;
    const tick = async () => { if (document.visibilityState === 'visible' && signedIn) { try { await sync(); if (window.__fremysOffline) { window.__fremysOffline = false; window.toast && toast('Connection restored.'); } } catch (e) { if (e.code === 'unavailable' && !window.__fremysOffline) { window.__fremysOffline = true; window.toast && toast('Connection lost. Changes will appear again when it is back.', 'error'); } } } polling = setTimeout(tick, POLL_MS); };
    polling = setTimeout(tick, POLL_MS); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && signedIn) sync().catch(() => {}); });
  }
  async function loadAll() { signedIn = true; prevRev = 0; lastRev = 0; await sync(); startPolling(); }

  /* ---- writes: at most 6 at a time ---- */
  let inflight = 0; const waiting = [];
  const slot = () => new Promise(res => { if (inflight < 6) { inflight++; res(); } else waiting.push(res); });
  const release = () => { const n = waiting.shift(); if (n) n(); else inflight--; };
  const pending = new Set();
  async function write(op, p, data) {
    if (p.startsWith('data/users/')) { localPut(p, op === 'delete' ? null : op === 'update' ? { ...(localGet(p) || {}), ...data } : data); return; }
    await slot(); const pr = call('write', { body: { op, path: p, data } }).finally(release); pending.add(pr); pr.finally(() => pending.delete(pr));
    const ch = await pr; if (ch.path && !p.startsWith('audit/')) apply(ch);
  }
  const localGet = p => { try { return JSON.parse(localStorage.getItem('fremys:' + p) || 'null'); } catch { return null; } };
  const localPut = (p, d) => { try { d === null ? localStorage.removeItem('fremys:' + p) : localStorage.setItem('fremys:' + p, JSON.stringify(d)); } catch {} };

  /* ---- Firestore-like API used by the app ---- */
  const meta = { fromCache: false, hasPendingWrites: false };
  const mk = (p, exists, data) => ({ id: p.split('/').pop(), ref: docRef(p), exists, data: () => clone(data === null ? undefined : data), metadata: meta });
  const snapDoc = p => { const d = cache.get(p); return mk(p, !!d, d ? d.data : undefined); };
  const match = (data, [f, op, v]) => { const x = data?.[f]; switch (op) { case '==': return x === v; case '!=': return x !== v; case '<': return x < v; case '<=': return x <= v; case '>': return x > v; case '>=': return x >= v; case 'in': return Array.isArray(v) && v.includes(x); case 'array-contains': return Array.isArray(x) && x.includes(v); default: return true; } };
  function qsnap(cp, filters) { let docs = [...cache.keys()].filter(k => parent(k) === cp).sort().map(snapDoc); filters.forEach(f => { docs = docs.filter(d => match(d.data(), f)); }); return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn), docChanges: () => [], metadata: meta }; }
  let ready = null;
  function docRef(p) {
    return { id: p.split('/').pop(), path: p,
      get: async () => {
        await ready;
        if (p.startsWith('data/users/')) { const d = localGet(p); return mk(p, !!d, d); }
        if (p.startsWith('audit/') || p.startsWith('creds/')) { if (!signedIn) throw err('permission_denied', 'Sign in first.'); const r = await call('get', { query: { path: p } }); return mk(p, r.exists, r.data); }
        return snapDoc(p);
      },
      set: d => write('set', p, d), update: d => write('update', p, d), delete: () => write('delete', p),
      acquire: o => call('acquire', { body: { path: p, holder: o?.holder, ttlMs: o?.ttlMs } }),
      onSnapshot: (fn, onError) => { (docL.get(p) || docL.set(p, []).get(p)).push(fn); ready.then(() => fn(snapDoc(p))).catch(e => onError && onError(e)); return () => { const a = docL.get(p); a.splice(a.indexOf(fn), 1); }; },
      collection: c => colRef(p + '/' + c) };
  }
  const rid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function colRef(cp, filters = []) {
    return { path: cp, id: cp.split('/').pop(), doc: id => docRef(cp + '/' + (id || rid())), add: async d => { const r = docRef(cp + '/' + rid()); await r.set(d); return r; },
      where: (f, op, v) => colRef(cp, [...filters, [f, op, v]]), orderBy: () => colRef(cp, filters), limit: () => colRef(cp, filters),
      get: async () => { await ready; return qsnap(cp, filters); },
      onSnapshot: (fn, onError) => { const l = { fn, filters }; (colL.get(cp) || colL.set(cp, []).get(cp)).push(l); ready.then(() => fn(qsnap(cp, filters))).catch(e => onError && onError(e)); return () => { const a = colL.get(cp); a.splice(a.indexOf(l), 1); }; } };
  }
  const db = { doc: docRef, collection: colRef };

  const avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="16" fill="#0284c7"/></svg>');
  const user = { me: async () => ({ id: 'web', name: '', avatarUrl: avatar, color: '#0284c7', email: null, isOwner: false, canEdit: true }), id: async () => 'web', isOwner: async () => false, canEdit: async () => true, can: async () => true, profiles: async () => ({}), search: async () => [] };
  const assets = { upload: async blob => call('upload', { body: blob, raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Type': blob.type || 'application/octet-stream' } }) };
  const downloads = { save: async r => { const data = r.data instanceof Blob ? r.data : new Blob([r.data], { type: r.mimeType || 'application/octet-stream' }); const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = r.filename || 'download'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return { status: 'saved' }; } };
  const sample = async (prompt, o = {}) => call('sample', { body: { prompt, system: o.system }, signal: o.signal });
  sample.json = async (prompt, o = {}) => { const r = await call('sample', { body: { prompt, system: o.system, json: true }, signal: o.signal }); const t = String(r.text || '').replace(/^```(json)?\s*|\s*```$/g, ''); const m = t.match(/\{[\s\S]*\}/); try { return JSON.parse(m ? m[0] : t); } catch { throw err('invalid_json', 'The AI answer was not valid JSON.'); } };

  async function boot() {
    try { state = await call('state'); } catch (e) { state = { setup: true, me: null, ai: false, error: e.message }; }
    if (state.me) { try { await loadAll(); } catch (e) { state.me = null; signedIn = false; } }
  }
  window.FREMYS_CLOUD = {
    get state() { return state; },
    async login(username, password) { const r = await call('login', { body: { username, password } }); await loadAll(); return r; },
    async setup(o) { const r = await call('setup', { body: o }); await loadAll(); state.setup = true; return r; },
    changePassword: (old, password) => call('password', { body: { old, password } }),
    setPassword: (staffId, password, mustChange) => call('password', { body: { staffId, password, mustChange } }),
    async logout() { await Promise.allSettled([...pending]); signedIn = false; await call('logout', { body: {} }).catch(() => {}); location.reload(); },
  };
  const services = { db: () => db, user: () => user, assets: () => assets, downloads: () => downloads, sample: async () => (state.ai ? sample : null) };
  window.claude = { use: async name => { if (!ready) ready = boot(); await ready; return services[name] ? services[name]() : null; } };
})();
