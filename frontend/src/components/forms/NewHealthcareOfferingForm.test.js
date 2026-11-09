// Creating a service shows that it is working.
//
// This is the button the user reported as giving no feedback, and the cause was systemic
// rather than local to this form.
//
// Most forms in the app submit in two steps: the form's own button opens a
// ConfirmationModal, and the dialog's Confirm button does the work. The dialog was changed
// to stay open with a spinner while that work runs — but FOURTEEN forms called
// `setShowConfirmation(false)` as the first line of their own submit handler, which closed
// the dialog immediately and took the spinner away again. So the sequence a user saw was:
// click Create, click Confirm, dialog vanishes, nothing happens for a second or two.
//
// The check below fails against that: it holds the API call open and asserts the dialog is
// still up, spinning.

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewHealthcareOfferingForm from './NewHealthcareOfferingForm';

jest.mock('../../hooks/useAudit', () => ({
  useAudit: () => ({
    logFormView: jest.fn(), logCreate: jest.fn(), logError: jest.fn(), startAction: jest.fn(),
  }),
}));

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let api;
beforeEach(() => {
  api = {
    getServiceCategories: jest.fn().mockResolvedValue([{ id: 1, name: 'Consultations' }]),
    getFormTemplates: jest.fn().mockResolvedValue([]),
    getMedicalCodeByCode: jest.fn().mockResolvedValue(null),
    createOffering: jest.fn().mockResolvedValue({ id: 'off-1' }),
    updateOffering: jest.fn().mockResolvedValue({ id: 'off-1' }),
  };
});

const renderForm = (props = {}) => render(
  <NewHealthcareOfferingForm
    theme="light"
    api={api}
    onClose={jest.fn()}
    onSuccess={jest.fn()}
    addNotification={jest.fn()}
    t={{}}
    {...props}
  />,
);

/** The confirm dialog, located by its own heading rather than by position. */
const dialog = () => {
  const heading = screen.queryByText(/Confirm|Are you sure|Create Offering\?/i);
  return heading ? heading.closest('div.fixed') : null;
};

const startCreate = async (name = 'Initial consultation') => {
  const nameInput = document.querySelector('input[type="text"]');
  await userEvent.type(nameInput, name);
  // The form's own submit button opens the dialog; it does no work itself.
  await userEvent.click(screen.getByRole('button', { name: /Create Offering|Add Offering/i }));
};

test('the form button opens a confirmation rather than saving straight away', async () => {
  renderForm();
  await startCreate();
  await waitFor(() => expect(dialog()).not.toBeNull());
  expect(api.createOffering).not.toHaveBeenCalled();
});

test('the dialog STAYS OPEN, spinning, while the service is being created', async () => {
  const d = deferred();
  api.createOffering = jest.fn(() => d.promise);
  renderForm();
  await startCreate();
  await waitFor(() => expect(dialog()).not.toBeNull());

  const confirm = within(dialog()).getByRole('button', { name: /Create|Confirm|Yes/i });
  await userEvent.click(confirm);

  // The old behaviour: the dialog closed here and the work ran behind a screen showing
  // nothing at all.
  await waitFor(() => expect(api.createOffering).toHaveBeenCalledTimes(1));
  expect(dialog()).not.toBeNull();
  const stillThere = within(dialog()).getByRole('button', { name: /Create|Confirm|Yes|Saving|Creating/i });
  expect(stillThere).toBeDisabled();
  expect(stillThere.querySelector('.animate-spin')).toBeTruthy();

  d.resolve({ id: 'off-1' });
  await waitFor(() => expect(dialog()).toBeNull());
});

test('the dialog closes once the service has been created', async () => {
  renderForm();
  await startCreate();
  await waitFor(() => expect(dialog()).not.toBeNull());
  await userEvent.click(within(dialog()).getByRole('button', { name: /Create|Confirm|Yes/i }));
  await waitFor(() => expect(dialog()).toBeNull());
});

test('and closes when the create FAILS, rather than leaving a stuck dialog', async () => {
  api.createOffering = jest.fn().mockRejectedValue(new Error('nope'));
  renderForm();
  await startCreate();
  await waitFor(() => expect(dialog()).not.toBeNull());
  await userEvent.click(within(dialog()).getByRole('button', { name: /Create|Confirm|Yes/i }));
  await waitFor(() => expect(dialog()).toBeNull());
});
