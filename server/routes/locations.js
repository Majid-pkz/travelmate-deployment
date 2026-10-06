const express = require('express');

function createLocationsRouter({ fetchImpl = fetch } = {}) {
  const router = express.Router();
  const cache = new Map();
  const pending = new Map();
  router.get('/', async (req, res) => {
    const term = req.query.q ?? '';
    if (typeof term !== 'string' || term.length > 120 || /[\u0000-\u001f]/u.test(term)) {
      return res.status(400).json({ error: 'Enter a valid city name.' });
    }
    const name = term.trim();
    if (name.length < 3) return res.json({ locations: [] });
    const key = name.toLocaleLowerCase('en');
    try {
      let entry = cache.get(key);
      if (!entry || entry.expires < Date.now()) {
        if (!pending.has(key)) {
          const request = (async () => {
            const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
            url.search = new URLSearchParams({ name, count: '8', language: 'en', format: 'json' }).toString();
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
            if (!response.ok) throw new Error('Location service unavailable');
            const body = await response.json();
            if (body.error || (body.results !== undefined && !Array.isArray(body.results))) throw new Error('Invalid locations');
            const locations = (body.results ?? []).slice(0, 8)
              .filter(place => Number.isSafeInteger(place.id) && typeof place.name === 'string' && place.name.trim())
              .map(place => ({ id: String(place.id), name: place.name.trim().slice(0, 120),
                region: typeof place.admin1 === 'string' ? place.admin1.slice(0, 120) : '',
                country: typeof place.country === 'string' ? place.country.slice(0, 120) : '',
              }));
            const value = { locations, expires: Date.now() + 86_400_000 };
            if (cache.size >= 256) cache.delete(cache.keys().next().value);
            cache.set(key, value);
            return value;
          })();
          pending.set(key, request);
          request.finally(() => pending.delete(key)).catch(() => {});
        }
        entry = await pending.get(key);
      }
      res.set('Cache-Control', 'public, max-age=3600').json({ locations: entry.locations });
    } catch {
      res.status(503).json({ locations: [], error: 'City suggestions are unavailable. You can still enter a location.' });
    }
  });
  return router;
}

module.exports = { createLocationsRouter };
