// Who an appointment is booked FOR and BY: defaulted, and still changeable.
//
// The form used to render both fields as read-only text whenever a caller supplied them.
// Booking from a patient's chart you could not correct the patient, the provider was
// pinned to whoever was signed in (a receptionist included), and from the dashboard the
// provider defaulted to whichever provider happened to come first in the list rather than
// to the doctor doing the booking.
//
// Every check below that mentions "changeable" or "signed-in" fails against that version.

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewAppointmentForm from './NewAppointmentForm';

// The audit hook reaches into AppContext for a user and an api client; neither is what is
// under test here, and a provider wrapper would only add a second source of `user`.
jest.mock('../../hooks/useAudit', () => ({
  useAudit: () => ({
    logFormView: jest.fn(),
    logCreate: jest.fn(),
    logError: jest.fn(),
    startAction: jest.fn(),
  }),
}));

const PATIENTS = [
  { id: 1, first_name: 'Ada', last_name: 'Lovelace', mrn: 'MRN-001' },
  { id: 2, first_name: 'Alan', last_name: 'Turing', mrn: 'MRN-002' },
  { id: 3, first_name: 'Grace', last_name: 'Hopper', mrn: 'MRN-003' },
];

const DR_ONE = { id: 'u-doc-1', first_name: 'Asha', last_name: 'Rao', role: 'doctor' };
const DR_TWO = { id: 'u-doc-2', first_name: 'Ben', last_name: 'Cole', role: 'doctor' };
const RECEPTIONIST = { id: 'u-rec-1', first_name: 'Rita', last_name: 'Dove', role: 'staff' };

// Rebuilt per test rather than cleared: clearAllMocks also discards the resolved values,
// and the form renders straight off those responses.
let api;
beforeEach(() => {
  api = {
    getOfferings: jest.fn().mockResolvedValue([]),
    getAppointmentTypes: jest.fn().mockResolvedValue([{ id: 1, name: 'Follow-up', durationMinutes: 20 }]),
    createAppointment: jest.fn().mockResolvedValue({ id: 'appt-1' }),
  };
});

const renderForm = (props = {}) => render(
  <NewAppointmentForm
    theme="light"
    api={api}
    patients={PATIENTS}
    users={[DR_ONE, DR_TWO]}
    onClose={jest.fn()}
    onSuccess={jest.fn()}
    addNotification={jest.fn().mockResolvedValue(undefined)}
    t={{}}
    {...props}
  />,
);

/**
 * The control under a field's label.
 *
 * ThemedSelect draws its own listbox and keeps the real <select> hidden for validation, so
 * the thing a user sees and clicks is the combobox button. Scoped by label rather than by
 * position, so inserting a field does not silently retarget a check.
 */
const fieldCombobox = (labelText) => {
  // Matched on the label's whole textContent: a required field's label is "Patient" plus a
  // separate <span> holding the asterisk, so an exact-string match finds nothing.
  const label = screen.getByText(
    (_content, element) => element?.tagName === 'LABEL'
      && element.textContent.replace(/\s+/g, ' ').trim().startsWith(labelText),
    { selector: 'label' },
  );
  return label.parentElement.querySelector('[role="combobox"]');
};

const openOptions = async (combobox) => {
  await userEvent.click(combobox);
  return within(combobox.parentElement).getByRole('listbox');
};

describe('the patient the appointment is for', () => {
  test('is pre-selected when the form is opened from that patient', async () => {
    renderForm({ patient: PATIENTS[1] });
    await waitFor(() => expect(fieldCombobox('Patient')).toHaveTextContent('Alan Turing'));
  });

  test('is a control the user can change, not fixed text', async () => {
    renderForm({ patient: PATIENTS[1] });
    const patient = fieldCombobox('Patient');
    expect(patient).toBeEnabled();
    const options = await openOptions(patient);
    // Every patient plus the placeholder: a dropdown holding only the patient it arrived
    // with is no more changeable than the read-only text it replaced.
    expect(within(options).getAllByRole('option')).toHaveLength(PATIENTS.length + 1);
  });

  test('can actually be changed to another patient', async () => {
    renderForm({ patient: PATIENTS[1] });
    const patient = fieldCombobox('Patient');
    const options = await openOptions(patient);
    await userEvent.click(within(options).getByText(/Grace Hopper/));
    expect(patient).toHaveTextContent('Grace Hopper');
  });

  test('falls back to the one patient in context when the full list has not loaded', async () => {
    renderForm({ patient: PATIENTS[0], patients: [] });
    await waitFor(() => expect(fieldCombobox('Patient')).toHaveTextContent('Ada Lovelace'));
  });

  test('is left for the user to pick when no patient is in context', async () => {
    renderForm();
    expect(fieldCombobox('Patient')).toHaveTextContent('Select Patient');
  });
});

describe('the provider the appointment is with', () => {
  test('defaults to the signed-in doctor, not to the first provider listed', async () => {
    // DR_TWO is second in the list on purpose: a check against DR_ONE would pass just as
    // happily with the old "first provider wins" rule.
    renderForm({ user: DR_TWO });
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('Ben Cole'));
  });

  test('marks the signed-in doctor so it is clear why they are selected', async () => {
    renderForm({ user: DR_TWO });
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('(you)'));
  });

  test('is still changeable, so a doctor can book for a colleague', async () => {
    renderForm({ user: DR_TWO });
    const provider = fieldCombobox('Provider');
    await waitFor(() => expect(provider).toHaveTextContent('Ben Cole'));
    expect(provider).toBeEnabled();
    const options = await openOptions(provider);
    await userEvent.click(within(options).getByText(/Asha Rao/));
    expect(provider).toHaveTextContent('Asha Rao');
  });

  test('offers the signed-in doctor even when the provider list omits them', async () => {
    // Otherwise the field would show a name its own dropdown cannot produce, and changing
    // away from it would be a one-way door.
    renderForm({ user: DR_TWO, users: [DR_ONE] });
    const provider = fieldCombobox('Provider');
    await waitFor(() => expect(provider).toHaveTextContent('Ben Cole'));
    const options = await openOptions(provider);
    expect(within(options).getByText(/Ben Cole/)).toBeInTheDocument();
  });

  test('does NOT default to the signed-in user when they are not a provider', async () => {
    // A receptionist booking from a chart used to have the appointment pinned to
    // themselves, because the caller passed the signed-in user and the field locked to it.
    renderForm({ user: RECEPTIONIST });
    const provider = fieldCombobox('Provider');
    await waitFor(() => expect(provider).toHaveTextContent('Asha Rao'));
    expect(provider).not.toHaveTextContent('Rita Dove');
  });

  test('never offers a non-provider as the provider', async () => {
    renderForm({ user: RECEPTIONIST, users: [DR_ONE, RECEPTIONIST] });
    const options = await openOptions(fieldCombobox('Provider'));
    expect(within(options).queryByText(/Rita Dove/)).toBeNull();
  });

  test('does not default a signed-in user who has no role at all', async () => {
    // A row with no role counts as a provider — the providers table has no role column.
    // The signed-in user is judged strictly instead: applying the same leniency to them
    // would default whoever is booking into the provider field on nothing more than a
    // missing field.
    const roleless = { id: 'u-x', first_name: 'Role', last_name: 'Less' };
    renderForm({ user: roleless, users: [DR_ONE] });
    const provider = fieldCombobox('Provider');
    await waitFor(() => expect(provider).toHaveTextContent('Asha Rao'));
    const options = await openOptions(provider);
    expect(within(options).queryByText(/Role Less/)).toBeNull();
  });

  test('treats a row with no role as a provider, since the providers table has none', async () => {
    const fromProvidersTable = { id: 'p-1', first_name: 'Nia', last_name: 'Shah' };
    renderForm({ users: [fromProvidersTable] });
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('Nia Shah'));
  });
});

describe('what is submitted', () => {
  /** Fill the fields this file is not about, and go through the confirm step. */
  const submit = async (container) => {
    // Appointment types arrive from their own async effect. ThemedSelect only renders its
    // listbox while open, so wait for the option to exist in the hidden native select
    // first rather than opening a list that is still just the placeholder.
    await waitFor(() => expect(container.querySelector('option[value="Follow-up"]')).toBeTruthy());
    const typeOptions = await openOptions(fieldCombobox('Appointment Type'));
    await userEvent.click(within(typeOptions).getByText('Follow-up'));
    await userEvent.type(container.querySelector('input[type="date"]'), '2026-12-01');
    await userEvent.type(container.querySelector('input[type="time"]'), '09:30');
    await userEvent.type(container.querySelector('input[type="text"]'), 'Follow-up on treatment');

    await userEvent.click(screen.getByRole('button', { name: /Schedule Appointment/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^Schedule$/ }));
    await waitFor(() => expect(api.createAppointment).toHaveBeenCalled());
    return api.createAppointment.mock.calls[0][0];
  };

  test('is the patient and provider on screen, after both have been changed', async () => {
    // The point of the whole exercise: a correction made in the form has to reach the API,
    // not merely repaint the control.
    const { container } = renderForm({ user: DR_TWO, patient: PATIENTS[1] });
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('Ben Cole'));

    const patientOptions = await openOptions(fieldCombobox('Patient'));
    await userEvent.click(within(patientOptions).getByText(/Grace Hopper/));
    const providerOptions = await openOptions(fieldCombobox('Provider'));
    await userEvent.click(within(providerOptions).getByText(/Asha Rao/));

    const sent = await submit(container);
    expect(String(sent.patient_id)).toBe('3');
    expect(sent.provider_id).toBe('u-doc-1');
  });

  test('sends the defaults unchanged when the user changes nothing', async () => {
    const { container } = renderForm({ user: DR_TWO, patient: PATIENTS[1] });
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('Ben Cole'));

    const sent = await submit(container);
    expect(String(sent.patient_id)).toBe('2');
    expect(sent.provider_id).toBe('u-doc-2');
  });

  test('names the booked-for patient in the notification, even from a chart', async () => {
    // `patients` holds only the patient in context, as a chart-side booking used to pass
    // it. The lookup used to search that list with a number against strings, miss, and
    // announce "New appointment scheduled with patient".
    const addNotification = jest.fn().mockResolvedValue(undefined);
    const { container } = renderForm({
      user: DR_TWO, patient: PATIENTS[1], patients: [], addNotification,
    });
    await waitFor(() => expect(fieldCombobox('Patient')).toHaveTextContent('Alan Turing'));

    await submit(container);
    await waitFor(() => expect(addNotification).toHaveBeenCalledWith(
      'appointment', expect.stringContaining('Alan Turing'),
    ));
  });
});
