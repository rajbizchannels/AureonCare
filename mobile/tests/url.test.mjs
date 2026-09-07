import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseServerUrl, isLocalHost, isServerUrlAllowed } from '../src/lib/url.ts';

test('accepts a bare hostname and assumes https', () => {
  assert.equal(normaliseServerUrl('app.aureoncare.tech'), 'https://app.aureoncare.tech');
});

test('tolerates whitespace, trailing slashes and stray paths', () => {
  for (const input of ['  app.aureoncare.tech  ', 'app.aureoncare.tech/', 'https://app.aureoncare.tech/api/']) {
    assert.equal(normaliseServerUrl(input), 'https://app.aureoncare.tech', input);
  }
});

test('keeps an explicit port', () => {
  assert.equal(normaliseServerUrl('ehr.clinic.org:8443'), 'https://ehr.clinic.org:8443');
});

test('preserves an explicit http scheme rather than silently upgrading it', () => {
  // Silently rewriting http to https would hide a misconfiguration; the
  // allow-list below is what refuses it.
  assert.equal(normaliseServerUrl('http://192.168.1.10:3001'), 'http://192.168.1.10:3001');
});

test('rejects input that is not a host', () => {
  for (const bad of ['', '   ', 'not a host', 'aureoncare']) {
    assert.equal(normaliseServerUrl(bad), null, JSON.stringify(bad));
  }
});

test('localhost is allowed without a dot', () => {
  assert.equal(normaliseServerUrl('localhost:3001'), 'https://localhost:3001');
});

test('recognises private and loopback ranges as local', () => {
  for (const origin of [
    'http://localhost:3001', 'http://127.0.0.1:3001', 'http://10.0.0.5',
    'http://192.168.1.10', 'http://172.16.0.9', 'http://ehr.clinic.local',
  ]) {
    assert.equal(isLocalHost(origin), true, origin);
  }
});

test('public hosts are not local', () => {
  for (const origin of ['https://app.aureoncare.tech', 'http://172.15.0.1', 'http://11.0.0.1']) {
    assert.equal(isLocalHost(origin), false, origin);
  }
});

test('https is always allowed', () => {
  assert.equal(isServerUrlAllowed('https://app.aureoncare.tech'), true);
});

test('plain http is refused on a public host — PHI must not go over the wire in clear', () => {
  assert.equal(isServerUrlAllowed('http://app.aureoncare.tech'), false);
});

test('plain http is allowed on a LAN deployment', () => {
  assert.equal(isServerUrlAllowed('http://192.168.1.10:3001'), true);
  assert.equal(isServerUrlAllowed('http://localhost:3001'), true);
});
