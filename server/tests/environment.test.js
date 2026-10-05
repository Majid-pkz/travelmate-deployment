const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const loaderSource = readFileSync(path.join(__dirname, '../config/environment.js'), 'utf8');
const authSource = readFileSync(path.join(__dirname, '../utils/auth.js'), 'utf8');
const connectionSource = readFileSync(path.join(__dirname, '../config/connection.js'), 'utf8');

function fixture(t, envText) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'travelmate-config-'));
  mkdirSync(path.join(root, 'server/config'), { recursive: true });
  mkdirSync(path.join(root, 'server/utils'), { recursive: true });
  writeFileSync(path.join(root, 'server/config/environment.js'), loaderSource);
  writeFileSync(path.join(root, 'server/config/connection.js'), connectionSource);
  writeFileSync(path.join(root, 'server/utils/auth.js'), authSource);
  // Stub external packages so configuration checks need no npm installation.
  for (const [name, source] of Object.entries({
    jsonwebtoken: 'module.exports = {};',
    mongoose: 'module.exports = { connect(uri) { console.log("connected:" + uri); }, connection: {} };',
  })) {
    const dir = path.join(root, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.js'), source);
  }
  if (envText !== undefined) writeFileSync(path.join(root, '.env'), envText);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root, script, values = {}, workingDir = root) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: workingDir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH || '', ...values },
  });
}

const longSecret = 'configuration-test-secret-only-0123456789abcdef';

for (const directory of ['root', 'server']) {
  test(`loads the private root file when launched from ${directory}`, (t) => {
    const root = fixture(t, `MONGODB_URI=mongodb://127.0.0.1:27017/test\nJWT_SECRET=${longSecret}\n`);
    const loader = JSON.stringify(path.join(root, 'server/config/environment.js'));
    const result = run(root, `const {requireEnvironment}=require(${loader}); console.log(requireEnvironment('MONGODB_URI')); requireEnvironment('JWT_SECRET',32);`, {}, directory === 'root' ? root : path.join(root, 'server'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /mongodb:\/\/127\.0\.0\.1:27017\/test/);
  });
}

test('hosting runtime values take precedence over the private file', (t) => {
  const root = fixture(t, 'JWT_SECRET=file-secret-that-is-long-enough-1234567890\n');
  const loader = JSON.stringify(path.join(root, 'server/config/environment.js'));
  const result = run(root, `console.log(require(${loader}).requireEnvironment('JWT_SECRET',32));`, { JWT_SECRET: longSecret });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), longSecret);
});

for (const value of [undefined, '', '   ', 'short']) {
  test(`auth refuses a missing, blank or short signing secret: ${JSON.stringify(value)}`, (t) => {
    const root = fixture(t);
    const auth = JSON.stringify(path.join(root, 'server/utils/auth.js'));
    const result = run(root, `require(${auth});`, value === undefined ? {} : { JWT_SECRET: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET is required and must contain at least 32 characters/);
  });
}

test('auth accepts a configured signing secret without requiring a local file', (t) => {
  const root = fixture(t);
  const auth = JSON.stringify(path.join(root, 'server/utils/auth.js'));
  const result = run(root, `require(${auth});`, { JWT_SECRET: longSecret });
  assert.equal(result.status, 0, result.stderr);
});

test('the legacy MONGO_URI name cannot silently configure the database', (t) => {
  const root = fixture(t);
  const connection = JSON.stringify(path.join(root, 'server/config/connection.js'));
  const result = run(root, `require(${connection});`, { MONGO_URI: 'mongodb://127.0.0.1:27017/legacy' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MONGODB_URI is required/);
  assert.doesNotMatch(result.stdout, /connected:/);
});

test('database configuration rejects invalid schemes without exposing the value', (t) => {
  const root = fixture(t);
  const connection = JSON.stringify(path.join(root, 'server/config/connection.js'));
  const marker = 'invalid-private-value-for-test';
  const result = run(root, `require(${connection});`, { MONGODB_URI: marker });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MONGODB_URI must use/);
  assert.doesNotMatch(result.stderr, new RegExp(marker));
  assert.doesNotMatch(result.stdout, /connected:/);
});

test('database configuration forwards the configured connection string', (t) => {
  const root = fixture(t);
  const connection = JSON.stringify(path.join(root, 'server/config/connection.js'));
  const uri = 'mongodb://127.0.0.1:27017/test';
  const result = run(root, `require(${connection});`, { MONGODB_URI: uri });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'connected:' + uri);
});

