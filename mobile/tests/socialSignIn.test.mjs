import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import {
  base64ToBase64Url, verifierFromBytes, startUrl, parseReturnUrl, returnErrorMessage, landingFor,
} from '../src/lib/socialSignIn.ts';

test('a PKCE verifier is 43-128 unreserved characters', () => {
  for (const n of [43, 64, 96, 200]) {
    const v = verifierFromBytes(randomBytes(n));
    assert.match(v, /^[A-Za-z0-9\-._~]{43,128}$/);
  }
  assert.throws(() => verifierFromBytes(randomBytes(10)));
});

test('the S256 challenge matches what the server computes', () => {
  const v = verifierFromBytes(randomBytes(64));
  const app = base64ToBase64Url(createHash('sha256').update(v).digest('base64'));
  const server = createHash('sha256').update(v).digest('base64url');
  assert.equal(app, server);
  assert.match(app, /^[A-Za-z0-9_-]{43}$/);
});

test('the start URL carries the app link, the challenge and S256, and trims the server URL', () => {
  const u = new URL(startUrl('https://app.example.test/', 'microsoft', 'aureoncare://auth', 'abc'));
  assert.equal(u.origin + u.pathname, 'https://app.example.test/api/auth/mobile/oauth/microsoft/start');
  assert.equal(u.searchParams.get('redirect_uri'), 'aureoncare://auth');
  assert.equal(u.searchParams.get('code_challenge'), 'abc');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
});

test('the return link: a code, or an error with its reason', () => {
  assert.deepEqual(parseReturnUrl('aureoncare://auth?code=xyz'), { kind: 'code', code: 'xyz' });
  assert.deepEqual(parseReturnUrl('exp://192.168.1.2:8081/--/auth?code=abc#'), { kind: 'code', code: 'abc' });
  assert.deepEqual(parseReturnUrl('aureoncare://auth?error=provider_error&reason=invalid_client'),
    { kind: 'error', error: 'provider_error', reason: 'invalid_client' });
  assert.equal(parseReturnUrl('aureoncare://auth').kind, 'error');
});

test('error wording: cancelling is silent, configuration faults name the provider', () => {
  assert.equal(returnErrorMessage('google', { error: 'cancelled' }), '');
  assert.match(returnErrorMessage('google', { error: 'expired' }), /too long/);
  assert.match(returnErrorMessage('microsoft', { error: 'provider_error', reason: 'AADSTS50011' }), /Microsoft.*AADSTS50011/);
  assert.match(returnErrorMessage('google', { error: 'weird' }), /Google/);
});

test('the answer opens the right shell', () => {
  assert.deepEqual(landingFor({ token: 't', user: { id: 'u' } }), { kind: 'staff', token: 't', user: { id: 'u' } });
  const p = landingFor({ portal: true, sessionToken: 's', patient: { id: 'p1' } });
  assert.equal(p.kind, 'portal');
  assert.throws(() => landingFor({ portal: true }));
  assert.throws(() => landingFor({}));
});
