import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiBase, apiUrl } from '../src/utils/api.mjs';

test('the public backend setting rejects credentials, paths and nonlocal plaintext URLs', () => {
  assert.equal(normalizeApiBase(''), '');
  assert.equal(normalizeApiBase(' https://travelmate-api.onrender.com/ '), 'https://travelmate-api.onrender.com');
  assert.equal(normalizeApiBase('http://127.0.0.1:3001'), 'http://127.0.0.1:3001');
  for (const value of ['mongodb+srv://private:password@cluster.example.com', 'https://private:password@example.com', 'http://example.com', 'https://example.com/graphql', 'https://example.com?secret=test', 'https://example.com#test', '//example.com']) {
    assert.throws(() => normalizeApiBase(value), error => /VITE_API_URL/.test(error.message) && !error.message.includes(value));
  }
});
test('separate hosting sends API calls and saved photos to the backend while keeping bundled assets local', () => {
  const base = 'https://travelmate-api.onrender.com';
  for (const path of ['/graphql', '/api/health', '/api/locations?q=syd', '/api/images/trips/123?v=2', '/images/old.png']) assert.equal(apiUrl(path, base), base + path);
  for (const path of ['/assets/photo.jpg', '/graphql-other', 'https://example.com/photo.jpg', 'blob:preview', null]) assert.equal(apiUrl(path, base), path);
  assert.equal(apiUrl('/graphql', ''), '/graphql');
});
