// SEC-15: the patient-portal session must not sit in JS-readable storage.
//
// The server now delivers it as an HttpOnly cookie (ac_portal). In the normal, same-origin
// deployment the browser keeps only a marker that a portal session exists — never the
// token — so an XSS on the page has nothing to steal. (The cross-origin deployment keeps
// the token as a fallback, the same exception the staff JWT has; tests run same-origin.)
import api, { PORTAL_MARKER } from './apiService';

beforeEach(() => sessionStorage.clear());

test('a portal login stores a marker, not the session token', () => {
  api.storePortalSession('secret-portal-token');
  expect(sessionStorage.getItem(PORTAL_MARKER)).toBe('1');
  expect(sessionStorage.getItem('portalSessionToken')).toBeNull();
  expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret-portal-token');
});

test('the main login\'s portal token is handled the same way', () => {
  const data = { token: 'jwt', portalSessionToken: 'secret-portal-token' };
  expect(api._storePortalSessionToken(data)).toBe(data);
  expect(sessionStorage.getItem('portalSessionToken')).toBeNull();
  expect(sessionStorage.getItem(PORTAL_MARKER)).toBe('1');
});

test('the marker is enough to know a portal session exists', () => {
  expect(api._hasPortalSession()).toBe(false);
  api.storePortalSession('t');
  expect(api._hasPortalSession()).toBe(true);
});

test('portal requests carry no bearer token in the same-origin deployment (the cookie does it)', () => {
  api.storePortalSession('t');
  expect(api._getPortalAuthHeader()).toEqual({});
});

test('signing out clears the marker', () => {
  api.storePortalSession('t');
  api.clearToken();
  expect(sessionStorage.getItem(PORTAL_MARKER)).toBeNull();
  expect(api._hasPortalSession()).toBe(false);
});

// SEC-30: the public booking page names its practice with the booking slug.
test('public booking calls send the slug once the config has been looked up', async () => {
  const calls = [];
  global.fetch = jest.fn(async (url, opts) => {
    calls.push({ url, headers: (opts && opts.headers) || {} });
    return { ok: true, json: async () => ({ provider_id: 'p1' }) };
  });
  await api.getPublicBookingConfig('dr-lee');
  await api.getPublicAppointmentTypes('p1');
  await api.getPublicAvailableSlots('p1', { date: '2026-12-01', appointmentTypeId: 'x' });
  await api.bookPublicAppointment({ providerId: 'p1' });
  for (const c of calls.slice(1)) expect(c.headers['X-Booking-Slug']).toBe('dr-lee');
});
