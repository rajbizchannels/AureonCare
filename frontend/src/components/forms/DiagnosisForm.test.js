import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import DiagnosisForm from './DiagnosisForm';
import apiService from '../../api/apiService';
import { invalidateAIFeatureCache } from '../integrations/AIAssistButton';

jest.mock('../../hooks/useAudit', () => ({
  useAudit: () => ({
    logFormView: jest.fn(), logFormSubmit: jest.fn(), logCreate: jest.fn(), logUpdate: jest.fn(),
    logError: jest.fn(), startAction: jest.fn(), logViewAccess: jest.fn(),
  }),
}));
jest.mock('../../api/apiService', () => ({
  __esModule: true,
  default: { getAIFeatures: jest.fn(), runAIFeature: jest.fn(), reviewAISuggestion: jest.fn(), searchMedicalCodes: jest.fn(), searchMedications: jest.fn() },
}));

// CRA resets mocks before each test, so implementations are set in beforeEach.
const api = { getLaboratories: jest.fn(), getLabOrders: jest.fn(), searchMedicalCodes: jest.fn() };

/** Index of the first element whose text matches, in document order. */
const orderOf = (container, matchers) => {
  const all = [...container.querySelectorAll('label, h3, button, span')];
  return matchers.map((m) => all.findIndex((el) => m.test(el.textContent.trim())));
};

beforeEach(() => {
  api.getLaboratories.mockResolvedValue([]);
  api.getLabOrders.mockResolvedValue([]);
  api.searchMedicalCodes.mockResolvedValue([]);
  invalidateAIFeatureCache();
  apiService.getAIFeatures.mockResolvedValue([
    { key: 'ambient_scribe', is_enabled: true },
    { key: 'coding_suggestions', is_enabled: true },
  ]);
});

test('the form follows the visit: details, diagnosis, SOAP, suggest codes, codes, orders', async () => {
  const { container } = render(
    <DiagnosisForm theme="light" api={api} patient={{ id: 'p1', first_name: 'Ana', last_name: 'Lee' }}
      patients={[]} providers={[]} user={{ id: 'u1', role: 'doctor' }} onClose={jest.fn()} onSuccess={jest.fn()}
      addNotification={jest.fn()} />
  );
  await screen.findByRole('button', { name: /suggest codes/i });

  const idx = orderOf(container, [
    /^Visit details$/, /^Diagnosis & notes$/, /^Diagnosis Name/, /^SOAP Notes$/, /^Suggest codes$/,
    /^Codes & status$/, /^ICD-10 Diagnosis Codes/, /^CPT Procedure Codes/, /^Orders$/,
  ]);
  idx.forEach((i) => expect(i).toBeGreaterThanOrEqual(0));
  expect([...idx].sort((a, b) => a - b)).toEqual(idx);
});

test('suggest codes is hidden when that AI feature is off, the form still works', async () => {
  apiService.getAIFeatures.mockResolvedValue([]);
  render(
    <DiagnosisForm theme="light" api={api} patient={{ id: 'p1' }} patients={[]} providers={[]}
      user={{ id: 'u1', role: 'doctor' }} onClose={jest.fn()} onSuccess={jest.fn()} addNotification={jest.fn()} />
  );
  await waitFor(() => expect(apiService.getAIFeatures).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: /suggest codes/i })).not.toBeInTheDocument();
  expect(screen.getByText('SOAP Notes')).toBeInTheDocument();
});

test('accepted AI medications wait for the prescriber and tests become lab order rows', async () => {
  const draft = '## SOAP Note\n### Plan\nRest.\n## Medications\n- `Ibuprofen` 400 mg — every 8 hours\n## Lab tests\n- Complete blood count — CPT `85025`';
  apiService.searchMedications.mockResolvedValue([{ id: 'm2', drug_name: 'Ibuprofen', strength: '400 mg' }]);
  apiService.searchMedicalCodes.mockResolvedValue([{ code: '85025', description: 'CBC' }]);
  apiService.runAIFeature.mockResolvedValue({ id: 'd1', draft, canReview: true, attestationRequired: false, phiTokensCount: 0 });
  apiService.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: draft });
  api.getLaboratories.mockResolvedValue([{ id: 'lab1', name: 'City Lab' }]);
  render(
    <DiagnosisForm theme="light" api={api} patient={{ id: 'p1' }} patients={[]} providers={[]}
      user={{ id: 'u1', role: 'doctor' }} onClose={jest.fn()} onSuccess={jest.fn()} addNotification={jest.fn()} />
  );
  fireEvent.click(await screen.findByRole('button', { name: /^ai assist$/i }));
  fireEvent.change(screen.getByLabelText(/text for the ai/i), { target: { value: 'visit transcript' } });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  await screen.findByRole('checkbox', { name: 'Ibuprofen' });
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Complete blood count' })).toBeChecked());
  fireEvent.click(screen.getByRole('button', { name: /send selected to prescriptions/i }));
  await screen.findByText(/sent to prescriptions/i);
  fireEvent.click(screen.getByRole('button', { name: /add selected tests to lab orders/i }));
  await screen.findByText(/lab order\(s\) added/i);
  fireEvent.click(screen.getByRole('button', { name: /^done$/i }));

  const suggestions = await screen.findByTestId('ai-med-suggestions');
  expect(within(suggestions).getByText('Ibuprofen')).toBeInTheDocument();
  expect(within(suggestions).getByRole('button', { name: /prescribe/i })).toBeInTheDocument();
  expect(screen.getByDisplayValue(/AI-suggested test: Complete blood count/)).toBeInTheDocument();
});
