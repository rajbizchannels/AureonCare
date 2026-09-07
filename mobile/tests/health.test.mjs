import test from 'node:test';
import assert from 'node:assert/strict';
import { checkServer } from '../src/lib/health.ts';

/** Records which paths were tried so the fallback can be asserted. */
const stubFetch = (handler) => {
  const tried = [];
  global.fetch = async (url) => {
    tried.push(new URL(url).pathname);
    return handler(new URL(url).pathname);
  };
  return tried;
};

const json = (status, body = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('accepts a server answering at the root /health', async () => {
  // server.js mounts health at the root, not under /api — this is the path
  // that actually exists, and the one the first version got wrong.
  const tried = stubFetch((p) => (p === '/health' ? json(200, { status: 'ok' }) : json(404)));
  const result = await checkServer('https://app.aureoncare.tech');
  assert.equal(result.ok, true);
  assert.deepEqual(tried, ['/health']);
});

test('reads the version when the server reports one', async () => {
  stubFetch(() => json(200, { status: 'ok', version: '2.4.1' }));
  const result = await checkServer('https://app.aureoncare.tech');
  assert.equal(result.ok && result.version, '2.4.1');
});

test('falls back to /api/health for a proxy that only forwards /api', async () => {
  const tried = stubFetch((p) => (p === '/api/health' ? json(200) : json(404)));
  const result = await checkServer('https://ehr.clinic.org');
  assert.equal(result.ok, true);
  assert.deepEqual(tried, ['/health', '/api/health']);
});

test('a 401 counts as reachable — something is listening and enforcing auth', async () => {
  stubFetch(() => json(401, { error: 'Authentication required' }));
  assert.equal((await checkServer('https://app.aureoncare.tech')).ok, true);
});

test('a 500 fails without trying the other path', async () => {
  const tried = stubFetch(() => json(500));
  const result = await checkServer('https://app.aureoncare.tech');
  assert.equal(result.ok, false);
  assert.match(result.reason, /500/);
  assert.deepEqual(tried, ['/health'], 'only a 404 is worth retrying elsewhere');
});

test('404 on both paths is not an AureonCare server', async () => {
  const tried = stubFetch(() => json(404));
  const result = await checkServer('https://example.com');
  assert.equal(result.ok, false);
  assert.deepEqual(tried, ['/health', '/api/health']);
});

test('a transport failure reports the host, not the path', async () => {
  const tried = stubFetch(() => { throw new TypeError('Network request failed'); });
  const result = await checkServer('https://nope.invalid');
  assert.equal(result.ok, false);
  assert.match(result.reason, /Could not reach/);
  assert.equal(tried.length, 1, 'a dead host should not be probed twice');
});

test('a timeout says so specifically', async () => {
  stubFetch(() => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
  const result = await checkServer('https://slow.example.org', 10);
  assert.equal(result.ok, false);
  assert.match(result.reason, /did not respond/);
});
