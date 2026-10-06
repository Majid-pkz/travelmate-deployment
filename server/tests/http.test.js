const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { readHttpConfig, frontendCors } = require('../config/http');

test('hosting settings default to local/cohosted behavior and reject unsafe or malformed configuration', () => {
  const defaults = readHttpConfig({});
  assert.equal(defaults.serveClient, true);
  assert.equal(defaults.trustProxyHops, 0);
  assert.equal(defaults.origins.size, 0);
  const hosted = readHttpConfig({ ALLOWED_ORIGINS: 'https://travelmate.onrender.com,http://localhost:3000', TRUST_PROXY_HOPS: '1', SERVE_CLIENT: 'false' });
  assert.equal(hosted.origins.size, 2);
  assert.equal(hosted.serveClient, false);
  for (const origin of ['*', 'https://example.com/', 'https://user:private@example.com', 'https://example.com/path', 'http://example.com', 'null']) assert.throws(() => readHttpConfig({ ALLOWED_ORIGINS: origin }), /ALLOWED_ORIGINS/);
  for (const hops of ['true', '-1', '6', '1.5']) assert.throws(() => readHttpConfig({ TRUST_PROXY_HOPS: hops }), /TRUST_PROXY_HOPS/);
  assert.throws(() => readHttpConfig({ SERVE_CLIENT: 'yes' }), /SERVE_CLIENT/);
});

async function serve(t, hops) {
  const app = express();
  app.set('trust proxy', hops);
  app.use('/api', frontendCors(new Set(['https://travelmate.onrender.com'])));
  app.get('/api/ip', (req, res) => res.json({ ip: req.ip }));
  app.use('/api/limited', rateLimit({ windowMs: 60_000, limit: 1, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.get('/api/limited', (req, res) => res.json({ ok: true }));
  app.post('/api/private', (req, res) => res.status(401).json({ error: 'Log in first.' }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}
test('allowed frontend preflights accept JSON and bearer headers; other origins are denied and auth still applies', async t => {
  const base = await serve(t, 0);
  const allowed = 'https://travelmate.onrender.com';
  const response = await fetch(base + '/api/private', { method: 'OPTIONS', headers: { Origin: allowed, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), allowed);
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
  assert.match(response.headers.get('vary'), /Origin/);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  const denied = await fetch(base + '/api/private', { method: 'POST', headers: { Origin: 'https://other.example.com' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  for (const headers of [{ Origin: allowed }, {}]) {
    const unauthenticated = await fetch(base + '/api/private', { method: 'POST', headers });
    assert.equal(unauthenticated.status, 401);
  }
});
test('local servers ignore forwarded identity; one trusted proxy keeps spoofed prefixes out of rate-limit identity', async t => {
  const direct = await serve(t, 0);
  assert.equal((await (await fetch(direct + '/api/ip', { headers: { 'X-Forwarded-For': '203.0.113.99' } })).json()).ip, '127.0.0.1');
  const hosted = await serve(t, 1);
  const headers = { 'X-Forwarded-For': '203.0.113.99, 198.51.100.10' };
  assert.equal((await (await fetch(hosted + '/api/ip', { headers })).json()).ip, '198.51.100.10');
  assert.equal((await fetch(hosted + '/api/limited', { headers })).status, 200);
  assert.equal((await fetch(hosted + '/api/limited', { headers: { 'X-Forwarded-For': '203.0.113.100, 198.51.100.10' } })).status, 429);
  assert.equal((await fetch(hosted + '/api/limited', { headers: { 'X-Forwarded-For': '203.0.113.99, 198.51.100.11' } })).status, 200);
});
