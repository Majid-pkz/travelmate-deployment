
const jwt = require('jsonwebtoken');
const { requireEnvironment } = require('../config/environment');

// set token secret and expiration date
const secret = requireEnvironment('JWT_SECRET', 32);
const expiration = '2h';

module.exports = {
  authMiddleware({ req }) {
    delete req.user;
    const header = req.headers?.authorization;
    const match = typeof header === 'string' && header.trim().match(/^Bearer\s+(\S+)$/i);
    if (!match) return req;
    try {
      const decoded = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        maxAge: expiration,
      });
      const { data, exp } = decoded;
      if (!data || typeof exp !== 'number' || typeof data._id !== 'string' || !/^[a-f\d]{24}$/i.test(data._id)) return req;
      const tokenVersion = data.tokenVersion ?? 0;
      if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) return req;
      req.user = { _id: data._id.toLowerCase(), tokenVersion };
    } catch {
      // Invalid, expired and unsigned tokens all leave the request anonymous.
    }
    return req;
  },
  signToken({ _id, tokenVersion = 0 }) {
    return jwt.sign({ data: { _id: String(_id), tokenVersion } }, secret, {
      algorithm: 'HS256',
      expiresIn: expiration,
    });
  },
};
