// The patient's side of a portal invitation: open the link, choose a password (or a
// provider), land in the portal. And a dead link says so plainly.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalActivatePage from './PortalActivatePage';

jest.mock('@react-oauth/google', () => ({ useGoogleLogin: () => jest.fn() }));
jest.mock('../../utils/msAuthCode', () => ({ getMicrosoftAuthCode: jest.fn() }));
jest.mock('../../config/oauthConfig', () => ({ microsoftOAuthConfig: { auth: { clientId: 'test' } } }));
const { getMicrosoftAuthCode } = require('../../utils/msAuthCode');
// CRA resets mock implementations before every test, so set this one each time.
beforeEach(() => { getMicrosoftAuthCode.mockResolvedValue({ code: 'c', redirectUri: 'r', codeVerifier: 'v' }); });

const INVITE = { firstName: 'Rosa', practiceName: 'Alpha Clinic', email: 'r****@example.com', expiresAt: '2026-12-01T00:00:00Z' };
const PATIENT = { id: 'p1', first_name: 'Rosa', role: 'patient' };

const setup = (overrides = {}) => {
  const api = {
    lookupPortalInvite: jest.fn().mockResolvedValue(INVITE),
    acceptPortalInvite: jest.fn().mockResolvedValue({ patient: PATIENT, sessionToken: 's' }),
    acceptPortalInviteWithOAuth: jest.fn().mockResolvedValue({ patient: PATIENT, sessionToken: 's' }),
    ...overrides,
  };
  const onActivated = jest.fn();
  const onSignIn = jest.fn();
  render(<PortalActivatePage token="tok" api={api} onActivated={onActivated} onSignIn={onSignIn} />);
  return { api, onActivated, onSignIn };
};

test('greets the patient by first name and names the practice', async () => {
  setup();
  expect(await screen.findByText(/Welcome, Rosa/)).toBeInTheDocument();
  expect(screen.getByText('Alpha Clinic')).toBeInTheDocument();
  expect(screen.getByText(/r\*\*\*\*@example\.com/)).toBeInTheDocument();
});

test('setting a password activates the portal and enters it', async () => {
  const { api, onActivated } = setup();
  await screen.findByText(/Welcome, Rosa/);
  await userEvent.type(screen.getByPlaceholderText('At least 12 characters'), 'A-Strong-Passphrase!23');
  await userEvent.type(screen.getByPlaceholderText('Type it again'), 'A-Strong-Passphrase!23');
  await userEvent.click(screen.getByRole('button', { name: /Set up my portal/ }));
  expect(api.acceptPortalInvite).toHaveBeenCalledWith('tok', 'A-Strong-Passphrase!23');
  expect(await screen.findByText(/You're all set/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onActivated).toHaveBeenCalledWith(PATIENT);
});

test('mismatched passwords are caught before anything is sent', async () => {
  const { api } = setup();
  await screen.findByText(/Welcome, Rosa/);
  await userEvent.type(screen.getByPlaceholderText('At least 12 characters'), 'A-Strong-Passphrase!23');
  await userEvent.type(screen.getByPlaceholderText('Type it again'), 'A-Strong-Passphrase!24');
  await userEvent.click(screen.getByRole('button', { name: /Set up my portal/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/);
  expect(api.acceptPortalInvite).not.toHaveBeenCalled();
});

test('a server refusal (e.g. a breached password) is shown, not swallowed', async () => {
  setup({ acceptPortalInvite: jest.fn().mockRejectedValue(new Error('This password has appeared in a known data breach')) });
  await screen.findByText(/Welcome, Rosa/);
  await userEvent.type(screen.getByPlaceholderText('At least 12 characters'), 'Summer2024!Password');
  await userEvent.type(screen.getByPlaceholderText('Type it again'), 'Summer2024!Password');
  await userEvent.click(screen.getByRole('button', { name: /Set up my portal/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/breach/);
});

test('continue with Microsoft uses the code flow, not a token', async () => {
  const { api } = setup();
  await screen.findByText(/Welcome, Rosa/);
  await userEvent.click(screen.getByRole('button', { name: /Continue with Microsoft/ }));
  await waitFor(() => expect(api.acceptPortalInviteWithOAuth).toHaveBeenCalledWith('microsoft', 'tok', 'c', 'r', 'v'));
  expect(await screen.findByText(/You're all set/)).toBeInTheDocument();
});

test('a used or expired link says so and offers sign-in instead', async () => {
  const { onSignIn } = setup({ lookupPortalInvite: jest.fn().mockRejectedValue(new Error('This invitation is no longer valid.')) });
  expect(await screen.findByText(/This link can't be used/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /I already have an account/ }));
  expect(onSignIn).toHaveBeenCalled();
});
