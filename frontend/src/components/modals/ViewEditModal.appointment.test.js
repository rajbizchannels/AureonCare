// Editing an appointment: the current patient, provider and service are all shown and all
// changeable.
//
// What this modal did before:
//   * The provider dropdown was built from the `users` prop filtered on
//     doctor/physician/provider/admin. That prop is /api/users on the screens that pass
//     it — admin-only — so for a doctor it was empty and the dropdown held nothing. It
//     also offered admins, and dropped every row from the providers table, which carries
//     no role column.
//   * An appointment whose provider was not in that list opened showing an EMPTY provider
//     box, which reads as "this appointment has no provider".
//   * There was no service field at all, so an offering chosen at booking could never be
//     seen or corrected.

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ViewEditModal from './ViewEditModal';

jest.mock('../../hooks/useAudit', () => ({
  useAudit: () => ({
    logModalOpen: jest.fn(), logModalClose: jest.fn(), logError: jest.fn(), startAction: jest.fn(),
  }),
}));
jest.mock('../../context/AppContext', () => ({
  useApp: () => ({ setLanguage: jest.fn() }),
}));

const PATIENTS = [
  { id: 'pat-1', first_name: 'Ada', last_name: 'Lovelace', mrn: 'MRN-001' },
  { id: 'pat-2', first_name: 'Alan', last_name: 'Turing', mrn: 'MRN-002' },
];

const DOC = { id: 'doc-asha', role: 'doctor', first_name: 'Asha', last_name: 'Rao' };

const APPOINTMENT = {
  id: 'appt-1',
  patient_id: 'pat-1',
  patient: 'Ada Lovelace',
  // Deliberately a provider that NO list returns, to stand for one who has left the
  // practice or is simply absent from the prop the host screen passed.
  provider_id: 'doc-gone',
  doctor: 'Gita Gone',
  offering_id: 'off-1',
  date: '2026-12-01',
  time: '09:00',
  type: 'Follow-up',
  duration: 20,
  status: 'Scheduled',
  reason: 'review',
};

let api;
beforeEach(() => {
  api = {
    getAppointmentTypes: jest.fn().mockResolvedValue([{ id: 1, name: 'Follow-up', durationMinutes: 20 }]),
    getBookableProviders: jest.fn().mockResolvedValue([
      { id: DOC.id, firstName: 'Asha', lastName: 'Rao' },
      { id: 'doc-ben', firstName: 'Ben', lastName: 'Cole' },
    ]),
    getOfferings: jest.fn().mockResolvedValue([
      { id: 'off-1', name: 'Standard consult', duration_minutes: 20, available_online: true },
      { id: 'off-2', name: 'In-clinic only procedure', duration_minutes: 45, available_online: false },
    ]),
    updateAppointment: jest.fn().mockResolvedValue({ id: 'appt-1' }),
  };
});

const renderModal = (props = {}) => render(
  <ViewEditModal
    theme="light"
    editingItem={{ type: 'appointment', data: APPOINTMENT }}
    currentView="edit"
    onClose={jest.fn()}
    patients={PATIENTS}
    users={[]}            // as it arrives for any non-admin
    api={api}
    addNotification={jest.fn()}
    setAppointments={jest.fn()}
    user={DOC}
    t={{}}
    {...props}
  />,
);

const fieldCombobox = (labelText) => {
  const label = screen.getByText(
    (_c, el) => el?.tagName === 'LABEL'
      && el.textContent.replace(/\s+/g, ' ').trim().startsWith(labelText),
    { selector: 'label' },
  );
  return label.parentElement.querySelector('[role="combobox"]');
};

const openOptions = async (combobox) => {
  await userEvent.click(combobox);
  return within(combobox.parentElement).getByRole('listbox');
};

describe('the provider on an existing appointment', () => {
  test('is shown even when no provider list contains them', async () => {
    renderModal();
    await waitFor(() => expect(fieldCombobox('Provider')).toHaveTextContent('Gita Gone'));
  });

  test('can be changed to a colleague fetched for booking', async () => {
    const { container } = renderModal();
    const provider = fieldCombobox('Provider');
    await waitFor(() => expect(container.querySelector('option[value="doc-ben"]')).toBeTruthy());
    const options = await openOptions(provider);
    await userEvent.click(within(options).getByText(/Ben Cole/));
    expect(provider).toHaveTextContent('Ben Cole');
  });

  test('does not offer an admin as a provider', async () => {
    const { container } = renderModal({
      users: [{ id: 'adm-1', role: 'admin', first_name: 'Amy', last_name: 'Admin' }],
    });
    await waitFor(() => expect(container.querySelector('option[value="doc-ben"]')).toBeTruthy());
    const options = await openOptions(fieldCombobox('Provider'));
    expect(within(options).queryByText(/Amy Admin/)).toBeNull();
  });
});

describe('the patient on an existing appointment', () => {
  test('is pre-selected', async () => {
    renderModal();
    await waitFor(() => expect(fieldCombobox('Patient')).toHaveTextContent('Ada Lovelace'));
  });

  test('is shown even when the patient list does not contain them', async () => {
    renderModal({ patients: [] });
    await waitFor(() => expect(fieldCombobox('Patient')).toHaveTextContent('Ada Lovelace'));
  });

  test('can be changed', async () => {
    renderModal();
    const patient = fieldCombobox('Patient');
    const options = await openOptions(patient);
    await userEvent.click(within(options).getByText(/Alan Turing/));
    expect(patient).toHaveTextContent('Alan Turing');
  });
});

describe('the service on an existing appointment', () => {
  test('is shown, where there was no field for it at all before', async () => {
    renderModal();
    await waitFor(() => expect(fieldCombobox('Service')).toHaveTextContent('Standard consult'));
  });

  test('offers a service that is not bookable online', async () => {
    const { container } = renderModal();
    await waitFor(() => expect(container.querySelector('option[value="off-2"]')).toBeTruthy());
    const options = await openOptions(fieldCombobox('Service'));
    expect(within(options).getByText(/In-clinic only procedure/)).toBeInTheDocument();
  });

  test('asks for active services rather than online-bookable ones', async () => {
    renderModal();
    await waitFor(() => expect(api.getOfferings).toHaveBeenCalled());
    expect(api.getOfferings).toHaveBeenCalledWith({ is_active: true });
  });

  test('carries the duration of the service it is changed to', async () => {
    const { container } = renderModal();
    await waitFor(() => expect(container.querySelector('option[value="off-2"]')).toBeTruthy());
    const options = await openOptions(fieldCombobox('Service'));
    await userEvent.click(within(options).getByText(/In-clinic only procedure/));
    expect(container.querySelector('input[type="number"]')).toHaveValue(45);
  });
});

describe('what the save sends', () => {
  const save = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    // A confirmation step sits in front of the write, and its confirm button carries the
    // SAME label as the one just clicked. Scoped to the dialog, because the dialog renders
    // before the form in the DOM — so picking by position re-clicks the form's own button
    // and the save never happens.
    const dialog = (await screen.findByText(/Confirm Save Changes/i)).closest('div.fixed');
    await userEvent.click(within(dialog).getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => expect(api.updateAppointment).toHaveBeenCalled());
    return api.updateAppointment.mock.calls[0][1];
  };

  test('the changed provider and service', async () => {
    const { container } = renderModal();
    await waitFor(() => expect(container.querySelector('option[value="doc-ben"]')).toBeTruthy());

    const provOptions = await openOptions(fieldCombobox('Provider'));
    await userEvent.click(within(provOptions).getByText(/Ben Cole/));
    const svcOptions = await openOptions(fieldCombobox('Service'));
    await userEvent.click(within(svcOptions).getByText(/In-clinic only procedure/));

    const sent = await save();
    expect(sent.provider_id).toBe('doc-ben');
    expect(sent.offering_id).toBe('off-2');
  });

  test('null when the service is cleared, so the column is emptied rather than left', async () => {
    const { container } = renderModal();
    await waitFor(() => expect(container.querySelector('option[value="off-2"]')).toBeTruthy());
    const svcOptions = await openOptions(fieldCombobox('Service'));
    await userEvent.click(within(svcOptions).getByText(/Select a service/));

    const sent = await save();
    expect(sent.offering_id).toBeNull();
  });

  test('the untouched provider and service when nothing is changed', async () => {
    const { container } = renderModal();
    await waitFor(() => expect(container.querySelector('option[value="doc-ben"]')).toBeTruthy());
    const sent = await save();
    expect(sent.provider_id).toBe('doc-gone');
    expect(sent.offering_id).toBe('off-1');
  });
});
