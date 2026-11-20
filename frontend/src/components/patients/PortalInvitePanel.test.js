// The staff side: status of a patient's portal access, and inviting them.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalInvitePanel from './PortalInvitePanel';

const mkApi = (status, extra = {}) => ({
  getPortalInviteStatus: jest.fn().mockResolvedValue(status),
  sendPortalInvite: jest.fn().mockResolvedValue({ emailed: true, email: 'rosa@example.com' }),
  revokePortalInvite: jest.fn().mockResolvedValue({ revoked: 1 }),
  ...extra,
});

test('a patient not yet invited can be invited, and staff are told it was sent', async () => {
  const api = mkApi({ portalEnabled: false, hasEmail: true, invite: null });
  const addNotification = jest.fn();
  render(<PortalInvitePanel patientId="p1" api={api} addNotification={addNotification} />);
  expect(await screen.findByText('Not invited yet')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Invite to portal/ }));
  expect(api.sendPortalInvite).toHaveBeenCalledWith('p1');
  await waitFor(() => expect(addNotification).toHaveBeenCalledWith('success', expect.stringMatching(/rosa@example.com/)));
});

test('a pending invite shows when it expires and can be re-sent or withdrawn', async () => {
  const api = mkApi({ portalEnabled: false, hasEmail: true,
    invite: { status: 'pending', sentAt: '2026-11-19T10:00:00Z', expiresAt: '2026-12-03T10:00:00Z' } });
  render(<PortalInvitePanel patientId="p1" api={api} />);
  expect(await screen.findByText(/link expires/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Re-send invitation/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Withdraw/ }));
  expect(api.revokePortalInvite).toHaveBeenCalledWith('p1');
});

test('an active portal says so', async () => {
  render(<PortalInvitePanel patientId="p1" api={mkApi({ portalEnabled: true, hasEmail: true, invite: { status: 'accepted' } })} />);
  expect(await screen.findByText('Portal active')).toBeInTheDocument();
});

test('without an email address there is nothing to send, and staff are told why', async () => {
  render(<PortalInvitePanel patientId="p1" api={mkApi({ portalEnabled: false, hasEmail: false, invite: null })} />);
  expect(await screen.findByText(/Add an email address/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Invite to portal/ })).toBeNull();
});

test('when the email cannot be sent, the link is shown so it can be passed on', async () => {
  const api = mkApi({ portalEnabled: false, hasEmail: true, invite: null }, {
    sendPortalInvite: jest.fn().mockResolvedValue({ emailed: false, inviteUrl: 'https://app/portal/activate?token=abc' }),
  });
  render(<PortalInvitePanel patientId="p1" api={api} addNotification={jest.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: /Invite to portal/ }));
  expect(await screen.findByText('https://app/portal/activate?token=abc')).toBeInTheDocument();
});
