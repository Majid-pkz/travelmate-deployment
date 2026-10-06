const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const jwt = require('jsonwebtoken');
const { authMiddleware, signToken } = require('../utils/auth');
const { buildSchema, parse, validate } = require('graphql');
const typeDefs = require('../schemas/typeDefs');
const account = { _id: '0123456789abcdef01234567', tokenVersion: 2 };

test('accepts a signed, unexpired HS256 bearer token without exposing contact details in its payload', () => {
  const token = signToken(account);
  const req = authMiddleware({ req: { headers: { authorization: 'Bearer ' + token } } });
  assert.deepEqual(req.user, account);
  assert.equal(jwt.decode(token).data.email, undefined);
});

const invalid = {
  malformed: 'bad-token',
  expired: jwt.sign({ data: account }, process.env.JWT_SECRET, { expiresIn: -1 }),
  'wrong signing secret': jwt.sign({ data: account }, randomBytes(32).toString('hex'), { expiresIn: '2h' }),
  'different algorithm': jwt.sign({ data: account }, process.env.JWT_SECRET, { algorithm: 'HS384', expiresIn: '2h' }),
  'missing expiry': jwt.sign({ data: account }, process.env.JWT_SECRET),
  'invalid account ID': jwt.sign({ data: { _id: 'other' } }, process.env.JWT_SECRET, { expiresIn: '2h' }),
  'invalid token version': jwt.sign({ data: { ...account, tokenVersion: -1 } }, process.env.JWT_SECRET, { expiresIn: '2h' }),
};
for (const [name, token] of Object.entries(invalid)) {
  test('rejects ' + name + ' and clears any preexisting request identity', () => {
    const req = authMiddleware({ req: { headers: { authorization: 'Bearer ' + token }, user: account } });
    assert.equal(req.user, undefined);
  });
}
test('does not authenticate credentials supplied in a body or query parameter', () => {
  const token = signToken(account);
  const req = authMiddleware({ req: { headers: {}, body: { token }, query: { token } } });
  assert.equal(req.user, undefined);
});

const schema = buildSchema(typeDefs);
test('password hashes and server-owned flags are absent from the public GraphQL contract', () => {
  assert.equal(schema.getType('User').getFields().password, undefined);
  assert.equal(schema.getType('Profile').getFields().imageData, undefined);
  for (const name of ['createUser', 'createProfile', 'updateProfile', 'createTrip']) {
    const args = schema.getMutationType().getFields()[name].args.map(arg => arg.name);
    for (const field of ['isAdmin', 'verified', 'subscribed', 'approvedTrip', 'published']) assert.equal(args.includes(field), false);
  }
});
test('every frontend GraphQL document remains compatible with the backend schema', () => {
  let count = 0;
  for (const name of ['queries.js', 'mutations.js']) {
    const source = readFileSync(path.join(__dirname, '../../client/src/utils', name), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const match of source.matchAll(/gql[\x60]([\s\S]*?)[\x60]/g)) {
      assert.deepEqual(validate(schema, parse(match[1])).map(error => error.message), []);
      count += 1;
    }
  }
  assert.ok(count >= 10);
});
