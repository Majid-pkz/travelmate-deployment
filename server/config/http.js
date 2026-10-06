function readHttpConfig(env = process.env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (origins.length > 10) throw new Error('ALLOWED_ORIGINS accepts at most ten frontend origins.');
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.origin !== origin) throw new Error();
    } catch {
      throw new Error('ALLOWED_ORIGINS must contain exact public HTTPS origins, or local HTTP origins.');
    }
  }
  const hops = env.TRUST_PROXY_HOPS?.trim() || '0';
  if (!/^[0-5]$/.test(hops)) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 5.');
  const serve = env.SERVE_CLIENT?.trim() || 'true';
  if (!['true', 'false'].includes(serve)) throw new Error('SERVE_CLIENT must be true or false.');
  return { origins: new Set(origins), trustProxyHops: Number(hops), serveClient: serve === 'true' };
}

function frontendCors(origins) {
  return (req, res, next) => {
    if (!origins.size) return next();
    res.vary('Origin');
    const origin = req.get('Origin');
    if (!origin) return next();
    if (!origins.has(origin)) return res.status(403).json({ error: 'This frontend is not allowed.' });
    res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '600');
      return res.sendStatus(204);
    }
    next();
  };
}

module.exports = { readHttpConfig, frontendCors };
