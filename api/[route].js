'use strict';
// Vercel serverless function: every /api/<route> request is handled by lib/core.js.
const { Pool } = require('pg');
const { createApi } = require('../lib/core');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let api = null;
function getApi() {
  if (api) return api;
  if (!url) throw Object.assign(new Error('No database is connected. In Vercel open Storage, add a Neon Postgres database to this project, then redeploy.'), { status: 500, code: 'config' });
  const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10000, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  api = createApi({ db: pool, secret: process.env.SESSION_SECRET, env: process.env });
  return api;
}
async function rawBody(req) { if (req.body !== undefined && req.body !== null && (Buffer.isBuffer(req.body) || typeof req.body === 'object')) return req.body; const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }

module.exports = async (req, res) => {
  try {
    const route = String(req.query.route || '');
    const body = req.method === 'POST' ? await rawBody(req) : undefined;
    const out = await getApi()({ route, method: req.method, query: req.query || {}, cookies: req.cookies || {}, headers: req.headers, body, secure: (req.headers['x-forwarded-proto'] || 'https') === 'https' });
    res.statusCode = out.status; for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v); res.end(out.body);
  } catch (e) {
    res.statusCode = e.status || 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: e.code || 'internal', message: e.message }));
  }
};
