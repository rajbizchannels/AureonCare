import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../api/apiService';
import AIAssistButton, { invalidateAIFeatureCache } from './AIAssistButton';

jest.mock('../../api/apiService', () => ({
  __esModule: true,
  default: {
    getAIFeatures: jest.fn(),
    runAIFeature: jest.fn(),
    reviewAISuggestion: jest.fn(),
    searchMedicalCodes: jest.fn(),
    searchMedications: jest.fn(),
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

const SCRIBE_DRAFT = '## SOAP Note\n### Subjective\nHeadache.\n## Suggested codes\n- ICD-10 `G44.209` — Tension headache\n- CPT `99213` — Office visit\n- ICD-10 `Z99.99` — Made up';
const codeLookup = async (code) => (
  code === 'G44.209' ? [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', type: 'ICD-10' }]
    : code === '99213' ? [{ code: '99213', description: 'Office visit est. patient', type: 'CPT' }] : []
);

test('SOAP dialog shows Update SOAP text and the code list before anything is accepted', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe', { attestationRequired: true }));
  api.searchMedicalCodes.mockImplementation(codeLookup);
  const onApply = jest.fn();
  const onApplyCodes = jest.fn();
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'x'} onApply={onApply} onApplyCodes={onApplyCodes}
    applyLabel="Update SOAP text" applyTransform={(md) => md.split('## Suggested codes')[0].replace(/[#*]/g, '').trim()} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's6', draft: SCRIBE_DRAFT, canReview: true, attestationRequired: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));

  // Both actions are on the draft view itself.
  const update = await screen.findByRole('button', { name: /update soap text/i });
  const add = await screen.findByRole('button', { name: /add selected codes/i });
  expect(screen.getByRole('checkbox', { name: /G44.209/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /99213/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Z99.99/ })).not.toBeChecked(); // not in the code list
  expect(update).toBeDisabled(); // sign-off first
  expect(add).toBeDisabled();
  expect(api.reviewAISuggestion).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('checkbox', { name: /take responsibility/i }));
  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: SCRIBE_DRAFT });

  fireEvent.click(add);
  await waitFor(() => expect(onApplyCodes).toHaveBeenCalledWith({
    icd: [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', type: 'ICD-10' }],
    cpt: [{ code: '99213', description: 'Office visit est. patient', type: 'CPT' }],
  }));
  expect(await screen.findByText(/2 code\(s\) added/i)).toBeInTheDocument();

  // The other action still works after acceptance, without a second review.
  fireEvent.click(screen.getByRole('button', { name: /update soap text/i }));
  await waitFor(() => expect(onApply).toHaveBeenCalledWith('SOAP Note\n Subjective\nHeadache.'));
  expect(api.reviewAISuggestion).toHaveBeenCalledTimes(1);
  expect(api.reviewAISuggestion).toHaveBeenCalledWith('s6', expect.objectContaining({ action: 'accept', attested: true }));
});

test('Suggest codes dialog shows the code list and add button right away', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('coding_suggestions', { attestationRequired: true }));
  api.searchMedicalCodes.mockImplementation(codeLookup);
  const onApplyCodes = jest.fn();
  render(<AIAssistButton featureKey="coding_suggestions" getInput={() => 'x'} onApplyCodes={onApplyCodes} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  const draft = '### ICD-10\n- `G44.209` — Tension headache — "headache"\n### CPT\n- `99213` — Office visit — "seen today"';
  api.runAIFeature.mockResolvedValue({ id: 's7', draft, canReview: true, attestationRequired: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));

  const add = await screen.findByRole('button', { name: /add selected codes/i });
  expect(screen.getByTestId('ai-code-transfer')).toHaveTextContent('G44.209');
  expect(screen.getByTestId('ai-code-transfer')).toHaveTextContent('99213');
  fireEvent.click(screen.getByRole('checkbox', { name: /99213/ })); // untick the CPT code
  fireEvent.click(screen.getByRole('checkbox', { name: /take responsibility/i }));
  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: draft });
  fireEvent.click(add);
  await waitFor(() => expect(onApplyCodes).toHaveBeenCalledWith({
    icd: [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', type: 'ICD-10' }],
    cpt: [],
  }));
});

test('editing the draft refreshes the code list', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('coding_suggestions'));
  api.searchMedicalCodes.mockImplementation(codeLookup);
  render(<AIAssistButton featureKey="coding_suggestions" getInput={() => 'x'} onApplyCodes={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's8', draft: '- ICD-10 `G44.209` — Tension headache', canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));
  await screen.findByRole('checkbox', { name: /G44.209/ });
  fireEvent.click(screen.getByRole('tab', { name: /edit/i }));
  fireEvent.change(screen.getByLabelText(/draft text/i), { target: { value: '- ICD-10 `G44.209` — Tension headache\n- CPT `99213` — Visit' } });
  expect(await screen.findByRole('checkbox', { name: /99213/ })).toBeChecked();
});

test('a failed feature check is retried instead of hiding the button for a minute', async () => {
  api.getAIFeatures.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(enabled('message_drafts'));
  const first = render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} />);
  await waitFor(() => expect(api.getAIFeatures).toHaveBeenCalledTimes(1));
  first.unmount();
  render(<AIAssistButton featureKey="message_drafts" getInput={() => 'x'} />);
  expect(await screen.findByRole('button', { name: /ai assist/i })).toBeInTheDocument();
});

const PLAN_DRAFT = [
  '## SOAP Note', '### Plan', 'Ibuprofen and bloods.',
  '## Medications',
  '- `Ibuprofen` 400 mg — 1 tablet every 8 hours — 5 days',
  '- `Madeupzol` 5 mg — daily',
  '## Lab tests',
  '- Complete blood count — CPT `85025`',
  '- Thyroid panel',
].join('\n');

test('medications and lab tests can be sent to the form from the SOAP dialog', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe'));
  api.searchMedications.mockImplementation(async (q) => (q === 'Ibuprofen'
    ? [{ id: 'm1', drug_name: 'Ibuprofen', strength: '200 mg' }, { id: 'm2', drug_name: 'Ibuprofen', strength: '400 mg' }] : []));
  api.searchMedicalCodes.mockImplementation(async (q) => (
    q === '85025' ? [{ code: '85025', description: 'CBC with differential' }]
      : q === 'Thyroid panel' ? [{ code: '99213', description: 'not a lab' }, { code: '84443', description: 'TSH' }] : []));
  const onApplyMedications = jest.fn();
  const onApplyLabTests = jest.fn();
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'x'} onApply={jest.fn()}
    onApplyMedications={onApplyMedications} onApplyLabTests={onApplyLabTests} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's9', draft: PLAN_DRAFT, canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));

  // Medications: found ones ticked (matched to the right strength), unknown ones not.
  expect(await screen.findByRole('checkbox', { name: 'Ibuprofen' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Madeupzol' })).not.toBeChecked();
  // Lab tests: matched by CPT code ticked, by name only not ticked; non-lab codes ignored.
  expect(screen.getByRole('checkbox', { name: 'Complete blood count' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Thyroid panel' })).not.toBeChecked();
  expect(screen.getByTestId('ai-lab-transfer')).toHaveTextContent('84443');
  expect(api.reviewAISuggestion).not.toHaveBeenCalled();

  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: PLAN_DRAFT });
  fireEvent.click(screen.getByRole('button', { name: /send selected to prescriptions/i }));
  await waitFor(() => expect(onApplyMedications).toHaveBeenCalledWith([
    { name: 'Ibuprofen', strength: '400 mg', instructions: '1 tablet every 8 hours — 5 days', match: { id: 'm2', drug_name: 'Ibuprofen', strength: '400 mg' }, matchType: 'name' },
  ]));

  fireEvent.click(screen.getByRole('checkbox', { name: 'Thyroid panel' })); // reviewer opts in
  fireEvent.click(screen.getByRole('button', { name: /add selected tests to lab orders/i }));
  await waitFor(() => expect(onApplyLabTests).toHaveBeenCalledWith([
    { name: 'Complete blood count', cpt: '85025', match: { code: '85025', description: 'CBC with differential' } },
    { name: 'Thyroid panel', cpt: null, match: { code: '84443', description: 'TSH' } },
  ]));
  expect(api.reviewAISuggestion).toHaveBeenCalledTimes(1); // one acceptance for all actions
});

test('a medication not in the drug list is matched by generic, or offers similar ones to pick', async () => {
  api.getAIFeatures.mockResolvedValue(enabled('ambient_scribe'));
  const lipitor = { id: 'a1', drug_name: 'Atorvastatin 20mg', strength: '20mg', drug_class: 'Statin' };
  const simva = { id: 'a2', drug_name: 'Simvastatin 20mg', strength: '20mg', drug_class: 'Statin' };
  const amox = { id: 'b1', drug_name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', strength: '500mg' };
  api.searchMedications.mockImplementation(async (q, drugClass) => {
    if (drugClass === 'Statin') return [lipitor, simva];
    if (q === 'Amoxicillin') return [amox];
    return [];
  });
  api.searchMedicalCodes.mockResolvedValue([]);
  const draft = [
    '## Medications',
    '- `Crestor` 10 mg — once daily [generic: Rosuvastatin; class: Statin]',
    '- `Amoxil` 500 mg — three times daily [generic: Amoxicillin; class: Penicillin Antibiotic]',
    '- `Unknownex` 1 mg — daily',
  ].join('\n');
  const onApplyMedications = jest.fn();
  render(<AIAssistButton featureKey="ambient_scribe" getInput={() => 'x'} onApplyMedications={onApplyMedications} />);
  fireEvent.click(await screen.findByRole('button', { name: /ai assist/i }));
  api.runAIFeature.mockResolvedValue({ id: 's10', draft, canReview: true, phiTokensCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));

  // Amoxil -> same generic in stock: ticked.
  expect(await screen.findByRole('checkbox', { name: 'Amoxil' })).toBeChecked();
  expect(screen.getByText(/same medicine \(generic\)/i)).toBeInTheDocument();
  // Crestor -> not stocked: unticked, with similar statins offered, nothing chosen for the user.
  expect(screen.getByRole('checkbox', { name: 'Crestor' })).not.toBeChecked();
  const group = screen.getByRole('radiogroup', { name: /similar medications for crestor/i });
  expect(group).toHaveTextContent('Atorvastatin 20mg');
  expect(group).toHaveTextContent('Simvastatin 20mg');
  // Unknownex -> nothing similar.
  expect(screen.getByRole('checkbox', { name: 'Unknownex' })).not.toBeChecked();

  fireEvent.click(within(group).getByRole('radio', { name: /atorvastatin/i }));
  expect(screen.getByRole('checkbox', { name: 'Crestor' })).toBeChecked();
  expect(screen.getByText(/alternative chosen: atorvastatin 20mg/i)).toBeInTheDocument();

  api.reviewAISuggestion.mockResolvedValue({ status: 'accepted', finalText: draft });
  fireEvent.click(screen.getByRole('button', { name: /send selected to prescriptions/i }));
  await waitFor(() => expect(onApplyMedications).toHaveBeenCalledWith([
    expect.objectContaining({ name: 'Crestor', match: lipitor, matchType: 'alternative' }),
    expect.objectContaining({ name: 'Amoxil', match: amox, matchType: 'generic' }),
  ]));
});
