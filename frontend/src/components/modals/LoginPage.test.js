// Signing in shows that it is working.
//
// The Sign In button had no busy state of any kind: you clicked it and the page sat there
// until the response arrived. On a slow connection that is indistinguishable from a click
// that missed, so people click again — and this is the first button anyone in the product
// ever presses.
//
// The global activity bar did not cover it either: App returns early for this screen, and
// the bar was mounted after that return, so it did not exist here at all. That is fixed by
// mounting it outside App; this file covers the button itself.

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';

// The real page pulls in Google and Microsoft sign-in. Neither is what is under test, and
// both want network and provider config at module load.
jest.mock('@react-oauth/google', () => ({ useGoogleLogin: () => jest.fn() }));
jest.mock('../../utils/msAuthCode', () => ({ getMicrosoftAuthCode: jest.fn() }));
jest.mock('../../config/oauthConfig', () => ({
  microsoftOAuthConfig: { clientId: 'test' },
  googleOAuthConfig: { clientId: 'test' },
}));

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const renderLogin = (api) => render(
  <LoginPage
    theme="light"
    setTheme={jest.fn()}
    api={api}
    setUser={jest.fn()}
    setIsAuthenticated={jest.fn()}
    addNotification={jest.fn().mockResolvedValue(undefined)}
    setShowForgotPassword={jest.fn()}
    setCurrentModule={jest.fn()}
    setShowRegister={jest.fn()}
    onCreatePractice={jest.fn()}
  />,
);

const signIn = async () => {
  await userEvent.type(screen.getByPlaceholderText(/email|you@/i), 'doc@example.com');
  const password = document.querySelector('input[type="password"]');
  await userEvent.type(password, 'A-Strong-Passphrase!23');
  await userEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));
};

const busyButton = () => screen.queryByRole('button', { name: /Signing in/i });

test('the button shows it is working while the sign-in is in flight', async () => {
  const d = deferred();
  const api = { login: jest.fn(() => d.promise), storeToken: jest.fn() };
  renderLogin(api);

  await signIn();

  await waitFor(() => expect(busyButton()).not.toBeNull());
  expect(busyButton()).toBeDisabled();
  expect(busyButton()).toHaveAttribute('aria-busy', 'true');
  expect(busyButton().querySelector('.animate-spin')).toBeTruthy();

  d.resolve({ token: 't', user: { id: 'u1', role: 'doctor' } });
  await waitFor(() => expect(api.storeToken).toHaveBeenCalled());
});

test('a second click while signing in does not post the credentials twice', async () => {
  // The reason the button is disabled: a duplicate sign-in is a second session and, for
  // an account with lockout rules, a second failed attempt.
  const d = deferred();
  const api = { login: jest.fn(() => d.promise), storeToken: jest.fn() };
  renderLogin(api);

  await signIn();
  await waitFor(() => expect(busyButton()).toBeDisabled());
  await userEvent.click(busyButton());

  expect(api.login).toHaveBeenCalledTimes(1);
  d.resolve({ token: 't', user: { id: 'u1', role: 'doctor' } });
});

test('a rejected sign-in leaves the button usable, and shows why', async () => {
  // Otherwise a mistyped password would need a page reload to try again.
  const api = {
    login: jest.fn().mockRejectedValue(new Error('Invalid email or password')),
    storeToken: jest.fn(),
  };
  renderLogin(api);

  await signIn();

  await waitFor(() => expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument());
  expect(busyButton()).toBeNull();
  expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeEnabled();
});

test('a second-factor prompt is not treated as a failure to retry blindly', async () => {
  const err = new Error('A verification code is required');
  err.mfaRequired = true;
  const api = { login: jest.fn().mockRejectedValue(err), storeToken: jest.fn() };
  renderLogin(api);

  await signIn();

  await waitFor(() => expect(screen.getByText(/verification code is required/i)).toBeInTheDocument());
  // Button usable again so the code can be submitted.
  expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeEnabled();
});
