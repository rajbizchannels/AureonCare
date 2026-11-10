// What a prescriber sees when a medication search finds nothing.
//
// The empty state used to carry a "Troubleshooting" panel: open the browser console with
// F12, check that migration 015 had run on the database, confirm the backend was up on
// port 3001. That is a developer's checklist on a clinician's screen. None of it is
// something a prescriber can act on, and naming the internals makes "this drug is not in
// the list" read as "the software is broken".
//
// Checked here rather than left to code review because it is static JSX: nothing else
// would notice it being pasted back in.

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EPrescribeModal from './ePrescribeModal';

jest.mock('../../hooks/useAudit', () => ({
  useAudit: () => ({
    logModalOpen: jest.fn(), logModalClose: jest.fn(), logError: jest.fn(), startAction: jest.fn(),
  }),
}));

let api;
beforeEach(() => {
  api = {
    searchMedications: jest.fn().mockResolvedValue([]),
    getPharmacies: jest.fn().mockResolvedValue([]),
    getPatientPreferredPharmacies: jest.fn().mockResolvedValue([]),
    checkPrescriptionSafety: jest.fn().mockResolvedValue({ warnings: [] }),
    createPrescription: jest.fn().mockResolvedValue({ id: 'rx-1' }),
    updatePrescription: jest.fn().mockResolvedValue({ id: 'rx-1' }),
    sendErx: jest.fn().mockResolvedValue({ ok: true }),
  };
});

const renderModal = (props = {}) => render(
  <EPrescribeModal
    theme="light"
    patient={{ id: 'pat-1', first_name: 'Ada', last_name: 'Lovelace', mrn: 'MRN-1' }}
    provider={{ id: 'doc-1', first_name: 'Asha', last_name: 'Rao' }}
    api={api}
    onClose={jest.fn()}
    onSuccess={jest.fn()}
    addNotification={jest.fn()}
    {...props}
  />,
);

/** Type into the medication search and wait for the empty state. */
const searchForNothing = async (term = 'zzzznotadrug') => {
  const box = screen.getByPlaceholderText(/search|medication/i);
  await userEvent.type(box, term);
  await waitFor(() => expect(api.searchMedications).toHaveBeenCalled(), { timeout: 3000 });
  await waitFor(() => expect(screen.getByText(/No medications found/i)).toBeInTheDocument(),
    { timeout: 3000 });
};

test('an empty result says the drug was not found, and offers advice a prescriber can use', async () => {
  renderModal();
  await searchForNothing();
  expect(screen.getByText(/No medications found/i)).toBeInTheDocument();
  expect(screen.getByText(/Try a different search term or NDC code/i)).toBeInTheDocument();
});

test('and carries NO developer troubleshooting checklist', async () => {
  renderModal();
  await searchForNothing();

  // Each of these was on screen, in a box headed "Troubleshooting".
  expect(screen.queryByText(/Troubleshooting/i)).toBeNull();
  expect(screen.queryByText(/F12/)).toBeNull();
  expect(screen.queryByText(/migration 015/i)).toBeNull();
  expect(screen.queryByText(/port 3001/)).toBeNull();
  expect(screen.queryByText(/browser console/i)).toBeNull();
});

test('nothing in the empty state mentions the database, a port or the console', async () => {
  // Broader than the strings above, so a reworded version of the same panel is caught too.
  const { container } = renderModal();
  await searchForNothing();
  const text = container.textContent || '';
  for (const leak of ['migration', 'console', 'port ', 'localhost', 'F12', 'backend server']) {
    expect(text.toLowerCase()).not.toContain(leak.toLowerCase());
  }
});
