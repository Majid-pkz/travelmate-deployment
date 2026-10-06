const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { createLocationsRouter } = require('../routes/locations');

async function serve(t, fetchImpl) {
  const app = express();
  app.use('/api/locations', createLocationsRouter({ fetchImpl }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port + '/api/locations';
}

test('short and invalid location queries never call the provider', async t => {
  const base = await serve(t, () => { throw new Error('Must not call provider'); });
  for (const q of ['', 's', 'sy']) assert.deepEqual(await (await fetch(base + '?q=' + q)).json(), { locations: [] });
  for (const query of ['q[]=Sydney', 'q=' + 's'.repeat(121), 'q=Syd%00']) assert.equal((await fetch(base + '?' + query)).status, 400);
});
test('global suggestions return only display data, use a fixed upstream, and cache repeated queries', async t => {
  let calls = 0;
  const base = await serve(t, async (url, options) => {
    calls += 1;
    assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
    assert.equal(url.pathname, '/v1/search');
    assert.equal(url.searchParams.get('name'), 'syd');
    assert.equal(url.searchParams.get('count'), '8');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ results: [
      { id: 2147714, name: 'Sydney', admin1: 'New South Wales', country: 'Australia', latitude: -33.87, secret: 'omit' },
      { id: 9, name: 'Sydney', country: 'Canada' }, { id: 0, name: null },
    ] }) };
  });
  const first = await fetch(base + '?q=syd');
  assert.match(first.headers.get('cache-control'), /max-age=3600/);
  assert.deepEqual(await first.json(), { locations: [
    { id: '2147714', name: 'Sydney', region: 'New South Wales', country: 'Australia' },
    { id: '9', name: 'Sydney', region: '', country: 'Canada' },
  ] });
  await fetch(base + '?q=%20SYD%20');
  assert.equal(calls, 1);
});
test('simultaneous queries share one upstream request', async t => {
  let calls = 0;
  const base = await serve(t, async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 25));
    return { ok: true, json: async () => ({ results: [{ id: 1, name: 'Tehran', country: 'Iran' }] }) };
  });
  const responses = await Promise.all(Array.from({ length: 5 }, () => fetch(base + '?q=teh')));
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(calls, 1);
});
test('provider failures remain recoverable and do not expose provider details', async t => {
  let calls = 0;
  const base = await serve(t, async () => {
    calls += 1;
    if (calls === 1) throw new Error('private upstream details');
    return { ok: true, json: async () => ({}) };
  });
  const failed = await fetch(base + '?q=unknown');
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { locations: [], error: 'City suggestions are unavailable. You can still enter a location.' });
  assert.deepEqual(await (await fetch(base + '?q=unknown')).json(), { locations: [] });
  assert.equal(calls, 2);
});
