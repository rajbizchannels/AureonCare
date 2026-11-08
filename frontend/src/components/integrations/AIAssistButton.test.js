import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../api/apiService';
import AIAssistButton, { invalidateAIFeatureCache } from './AIAssistButton';

jest.mock('../../api/apiService', () => ({
  __esModule: true,
  default: {
    getAIFeatures: jest.fn(),
    runAIFeature: jest.fn(),
    reviewAISuggestion: jest.fn(),
    searchMedicalCodes: jest.fn(),
  },
}));

const enabled = (key, extra = {}) => [{ key, is_enabled: true, attestationRequired: false, reviewerRoles: ['doctor'], ...extra }];

beforeEach(() => {
  jest.clearAllMocks();
  invalidateAIFeatureCache();
});

test('stays hidden while the feature is switched off', async () => {
  api.getAIFeatures.mockResolvedValue([{ key: 'message_drafts', is_enabled: false }]);
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'hi'} />);
  await waitFor(() => expect(api.getAIFeatures).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: /ai assist/i })).not.toBeInTheDocument();
});

test('opening the dialog does not call the AI; only Generate does', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('message_drafts'));
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'Patient: my head hurts'} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Patient: my head hurts')).toBeInTheDocument();
  expect(api.runAIFeature).not.toHaveBeenCalled();

  api.runAIFeature.mockResolvedValue({ id: 's1', draft: 'Sorry to hear that.', canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  await screen.findByText('Sorry to hear that.');
  expect(api.runAIFeature).toHaveBeenCalledTimes(1);
});

test('only accepted text reaches the form, and sign-off is enforced', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe', { attestationRequired: true }));
  const onApply = jest.fn();
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'transcript'} onApply={onApply} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));

  api.runAIFeature.mockResolvedValue({ id: 's2', draft: 'S: headache', canReview: true, attestationRequired: true, phiTokensCount: 2 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  const accept = await screen.findByRole('button', { name: /accept & insert/i });
  expect(accept).toBeDisabled();
  expect(onApply).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('checkbox'));
  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: 'S: headache' });
  fireEvent.click(accept);
  await waitFor(() => expect(onApply).toHaveBeenCalledWith('S: headache'));
  expect(api.reviewAISuggestion).toHaveBeenCalledWith('s2', expect.objectContaining({ action: 'accept', attested: true }));
});

test('a rejected draft never reaches the form', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('message_drafts'));
  const onApply = jest.fn();
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} onApply={onApply} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's3', draft: 'draft', canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  const reject = await screen.findByRole('button', { name: /reject/i });
  expect(reject).toBeDisabled(); // needs a reason
  fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'wrong tone' } });
  api.reviewAISuggestion.mockResolvedValue({ status: 'rejected', finalText: null });
  fireEvent.click(reject);
  await screen.findByText(/draft rejected/i);
  expect(onApply).not.toHaveBeenCalled();
});

test('a user who cannot review is told the draft went to the queue', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe'));
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'x'} onApply={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's4', draft: 'draft', canReview: false, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  await screen.findByText(/waiting in the review queue/i);
  expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
});

test('the draft is shown formatted, with an Edit view', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('message_drafts'));
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} onApply={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's5', draft: '## Reply\nPlease **rest** and drink water.', canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  expect(await screen.findByRole('heading', { name: 'Reply' })).toBeInTheDocument();
  expect(screen.getByText('rest').tagName).toBe('STRONG');
  fireEvent.click(screen.getByRole('tab', { name: /edit/i }));
  expect(screen.getByLabelText(/draft text/i)).toHaveValue('## Reply\nPlease **rest** and drink water.');
});

test('accepted SOAP is inserted as plain text and only ticked codes are transferred', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe'));
  api.searchMedicalCodes.mockImplementation(async (code) => (
    code === 'G44.209' ? [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', type: 'ICD-10' }]
      : code === '99213' ? [{ code: '99213', description: 'Office visit est. patient', type: 'CPT' }] : []
  ));
  const onApply = jest.fn();
  const onApplyCodes = jest.fn();
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'x'} onApply={onApply} onApplyCodes={onApplyCodes}
    applyTransform={(md) => md.split('## Suggested codes')[0].replace(/[#*]/g, '').trim()} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  const draft = '## SOAP Note\n### Subjective\nHeadache.\n## Suggested codes\n- ICD-10 `G44.209` — Tension headache\n- CPT `99213` — Office visit\n- ICD-10 `Z99.99` — Made up';
  api.runAIFeature.mockResolvedValue({ id: 's6', draft, canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: draft });
  fireEvent.click(await screen.findByRole('button', { name: /accept & insert/i }));

  await waitFor(() => expect(onApply).toHaveBeenCalledWith('SOAP Note\n Subjective\nHeadache.'));
  const add = await screen.findByRole('button', { name: /add selected codes/i });
  const boxes = screen.getAllByRole('checkbox');
  expect(boxes.map((b) => b.checked)).toEqual([true, false, true]); // ICD first; Z99.99 is not in the code list
  expect(onApplyCodes).not.toHaveBeenCalled();
  fireEvent.click(add);
  expect(onApplyCodes).toHaveBeenCalledWith({
    icd: [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', type: 'ICD-10' }],
    cpt: [{ code: '99213', description: 'Office visit est. patient', type: 'CPT' }],
  });
  expect(screen.getByText(/2 code\(s\) added/i)).toBeInTheDocument();
});

test('a failed feature check is retried instead of hiding the button for a minute', async () => {
  api.getAIFeatures.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(enabled('message_drafts'));
  const first = render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} />);
  await waitFor(() => expect(api.getAIFeatures).toHaveBeenCalledTimes(1));
  first.unmount();
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} />);
  expect(await screen.findByRole('button', { name: /ai assist/i })).toBeInTheDocument();
});
