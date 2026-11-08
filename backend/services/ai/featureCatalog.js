// AI feature catalog, provider list and price book.
//
// One place that answers: which AI features exist, who may review each one, what a
// typical call costs, and which providers/models a practice can point them at. The
// Integrations page renders straight from this, so a new feature is added here once.
//
// Every feature is human-in-the-loop: the gateway only ever produces a *draft*
// (ai_suggestions, status 'pending'); a person in `reviewerRoles` must accept, edit or
// reject it before anything leaves the AI layer. `attestationRequired` features also
// make the reviewer tick "I reviewed this and take responsibility".

// List prices per 1M tokens (USD). Cost guidance only — the provider's invoice is the
// source of truth. Keep `asOf` current when prices are refreshed.
const PRICE_BOOK = {
  asOf: '2026-11-07',
  models: {
    // Anthropic (first-party API rates)
    'claude-opus-5-5':   { provider: 'anthropic', input: 4.00, output: 20.00, tier: 'high' },
    'claude-sonnet-5-5': { provider: 'anthropic', input: 2.00, output: 10.00, tier: 'balanced' },
    'claude-haiku-5-5':  { provider: 'anthropic', input: 0.10, output: 0.50,  tier: 'economy' },
    // OpenAI (also used for Azure OpenAI deployments of the same model)
    'gpt-5':             { provider: 'openai', input: 1.25, output: 10.00, tier: 'balanced' },
    // Google Gemini
    'gemini-3.1-pro':        { provider: 'google_gemini', input: 2.00, output: 12.00, tier: 'high' },
    'gemini-3-flash':        { provider: 'google_gemini', input: 0.50, output: 3.00,  tier: 'balanced' },
    'gemini-3.1-flash-lite': { provider: 'google_gemini', input: 0.25, output: 1.50,  tier: 'economy' },
    // Mistral (EU)
    'mistral-medium-latest': { provider: 'mistral', input: 1.50, output: 7.50, tier: 'balanced' },
    'mistral-small-latest':  { provider: 'mistral', input: 0.20, output: 0.60, tier: 'economy' },
  },
};

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    fields: ['api_key', 'base_url'],
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    defaultModel: 'claude-opus-5-5',
    requiresBaa: true,
  },
  openai: {
    label: 'OpenAI',
    fields: ['api_key', 'base_url'],
    models: ['gpt-5'],
    defaultModel: 'gpt-5',
    requiresBaa: true,
  },
  azure_openai: {
    label: 'Azure OpenAI',
    // base_url = https://<resource>.openai.azure.com ; model = the deployment name
    fields: ['api_key', 'base_url', 'api_version'],
    models: ['gpt-5'],
    defaultModel: 'gpt-5',
    defaultApiVersion: '2024-10-21',
    requiresBaa: true,
  },
  google_gemini: {
    label: 'Google Gemini',
    fields: ['api_key'],
    models: ['gemini-3.1-pro', 'gemini-3-flash', 'gemini-3.1-flash-lite'],
    defaultModel: 'gemini-3-flash',
    requiresBaa: true,
  },
  mistral: {
    label: 'Mistral AI (EU)',
    fields: ['api_key'],
    models: ['mistral-medium-latest', 'mistral-small-latest'],
    defaultModel: 'mistral-medium-latest',
    requiresBaa: true,
  },
  offline: {
    // Any OpenAI-compatible server inside the practice network: Ollama, vLLM, llama.cpp.
    label: 'Offline / self-hosted (OpenAI-compatible)',
    fields: ['base_url', 'api_key'],
    models: [],
    defaultModel: 'qwen3:14b',
    requiresBaa: false,
  },
};

const ALL_STAFF = ['admin', 'doctor', 'provider', 'nurse', 'receptionist', 'billing_manager', 'staff'];

// tokensIn / tokensOut: a typical single use. monthlyUses: a 10-provider clinic.
const FEATURES = [
  {
    key: 'ambient_scribe', module: 'ehr', risk: 'high', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider'], attestationRequired: true,
    tokensIn: 7000, tokensOut: 1000, monthlyUses: 4400, extraCostKey: 'speechToText',
    promptVersion: 'scribe-v1',
    system: 'You draft a SOAP note (Subjective, Objective, Assessment, Plan) from a visit transcript. '
      + 'Only use facts stated in the transcript. Mark anything uncertain with "[verify]". '
      + 'Do not invent vitals, doses or diagnoses.',
  },
  {
    key: 'coding_suggestions', module: 'ehr', risk: 'high', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider', 'billing_manager'], attestationRequired: true,
    tokensIn: 4000, tokensOut: 300, monthlyUses: 4400,
    promptVersion: 'coding-v1',
    system: 'Suggest ICD-10 and CPT codes for the signed note. For each code give the code, '
      + 'its description and the exact sentence from the note that supports it. '
      + 'If the note does not support a code, do not suggest it.',
  },
  {
    key: 'claim_scrubbing', module: 'rcm', risk: 'medium', sendsPhi: true,
    reviewerRoles: ['billing_manager', 'admin'], attestationRequired: false,
    tokensIn: 3000, tokensOut: 500, monthlyUses: 2000,
    promptVersion: 'claims-v1',
    system: 'Review the claim for likely denial reasons (missing modifiers, code mismatches, '
      + 'eligibility gaps, missing fields). List each issue with a suggested fix. '
      + 'For a denied claim, draft an appeal letter.',
  },
  {
    key: 'prior_auth', module: 'rcm', risk: 'medium', sendsPhi: true,
    reviewerRoles: ['billing_manager', 'doctor', 'provider', 'admin'], attestationRequired: true,
    tokensIn: 3500, tokensOut: 1200, monthlyUses: 300,
    promptVersion: 'priorauth-v1',
    system: 'Draft a prior-authorization request letter using only the clinical facts provided. '
      + 'State the requested service, the diagnosis, and the medical-necessity rationale.',
  },
  {
    key: 'document_extraction', module: 'ehr', risk: 'medium', sendsPhi: true,
    reviewerRoles: ['receptionist', 'nurse', 'doctor', 'provider', 'admin'], attestationRequired: false,
    tokensIn: 3000, tokensOut: 800, monthlyUses: 1000,
    promptVersion: 'extract-v1',
    system: 'Extract the structured fields from this document text as "field: value" lines. '
      + 'Write "unknown" for any field that is not clearly present. Never guess.',
  },
  {
    key: 'message_drafts', module: 'messaging', risk: 'high', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider', 'nurse', 'receptionist'], attestationRequired: false,
    tokensIn: 2000, tokensOut: 300, monthlyUses: 3000,
    promptVersion: 'reply-v1',
    system: 'Draft a short, kind reply to the patient message in the same language the patient used. '
      + 'Do not give a diagnosis or change treatment; suggest booking a visit when clinical judgement is needed.',
  },
  {
    key: 'chart_copilot', module: 'ehr', risk: 'high', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider', 'nurse'], attestationRequired: false,
    tokensIn: 6000, tokensOut: 600, monthlyUses: 2000,
    promptVersion: 'copilot-v1',
    system: 'Answer the clinician\'s question using only the chart excerpt provided. '
      + 'Quote the chart entry you relied on. If the chart does not answer it, say so.',
  },
  {
    key: 'lab_explanations', module: 'ehr', risk: 'high', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider'], attestationRequired: true,
    tokensIn: 1500, tokensOut: 400, monthlyUses: 800,
    promptVersion: 'labs-v1',
    system: 'Explain these lab results to a patient in plain language at a reading age of about 12. '
      + 'Do not diagnose. Encourage the patient to discuss results with their clinician.',
  },
  {
    key: 'no_show_prediction', module: 'appointments', risk: 'low', sendsPhi: true,
    reviewerRoles: ['receptionist', 'admin'], attestationRequired: false,
    tokensIn: 800, tokensOut: 100, monthlyUses: 3000,
    promptVersion: 'noshow-v1',
    system: 'Given the appointment history, rate the no-show risk as low, medium or high with a one-line reason, '
      + 'and suggest whether to send an extra reminder or offer the slot to the waitlist.',
  },
  {
    key: 'inventory_forecast', module: 'inventory', risk: 'low', sendsPhi: false,
    reviewerRoles: ['admin'], attestationRequired: false,
    tokensIn: 2500, tokensOut: 500, monthlyUses: 30,
    promptVersion: 'inventory-v1',
    system: 'Forecast next month\'s usage for each item from the stock history and suggest reorder quantities. '
      + 'Show the reasoning per item in one line.',
  },
  {
    key: 'help_assistant', module: 'help', risk: 'low', sendsPhi: false,
    reviewerRoles: ALL_STAFF, attestationRequired: false,
    tokensIn: 3000, tokensOut: 400, monthlyUses: 1000,
    promptVersion: 'help-v1',
    system: 'Answer questions about using AureonCare from the help articles provided. '
      + 'If the articles do not cover it, say so. Never ask for or repeat patient information.',
  },
  {
    key: 'camp_summaries', module: 'camps', risk: 'medium', sendsPhi: true,
    reviewerRoles: ['doctor', 'provider', 'nurse'], attestationRequired: true,
    tokensIn: 2500, tokensOut: 500, monthlyUses: 500,
    promptVersion: 'camps-v1',
    system: 'Summarise the camp triage notes for the lead clinician: key findings, referrals needed, '
      + 'and follow-ups. Keep it factual.',
  },
];

// Added to every system prompt. The anonymizer replaces PHI with tokens; the model must
// leave them untouched so they can be swapped back.
const TOKEN_INSTRUCTION =
  'Some details were replaced with placeholders such as [[PATIENT_NAME_1]] or [[DATE_2]] to protect privacy. '
  + 'Copy placeholders exactly as written wherever you refer to them. Never guess or invent the real value. '
  + 'Your output is a draft that a qualified person will review before it is used.';

const EXTRA_COSTS = {
  // Speech-to-text for the ambient scribe is billed by the audio vendor, not per token.
  speechToText: { perUseLowUsd: 0.10, perUseHighUsd: 1.00 },
};

const FEATURE_KEYS = FEATURES.map((f) => f.key);

function getFeature(key) {
  return FEATURES.find((f) => f.key === key) || null;
}

function modelPrice(model) {
  return PRICE_BOOK.models[model] || null;
}

/** Estimated USD for one call; null when the model is not in the price book. */
function estimateCost(model, inputTokens, outputTokens) {
  const price = modelPrice(model);
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1e6;
}

/** Cost guidance for a feature on a model: per use and for a typical month. */
function costGuidance(feature, model, provider) {
  if (provider === 'offline') {
    return { perUseUsd: 0, monthlyUsd: 0, monthlyUses: feature.monthlyUses, offline: true };
  }
  const perUse = estimateCost(model, feature.tokensIn, feature.tokensOut);
  const extra = feature.extraCostKey ? EXTRA_COSTS[feature.extraCostKey] : null;
  return {
    perUseUsd: perUse,
    monthlyUsd: perUse == null ? null : perUse * feature.monthlyUses,
    monthlyUses: feature.monthlyUses,
    tokensIn: feature.tokensIn,
    tokensOut: feature.tokensOut,
    extra: extra ? { key: feature.extraCostKey, ...extra } : null,
    offline: false,
  };
}

/** The catalog as the Integrations page needs it (no prompts — those stay server-side). */
function publicCatalog() {
  return {
    priceBook: PRICE_BOOK,
    providers: Object.entries(PROVIDERS).map(([key, p]) => ({ key, ...p })),
    features: FEATURES.map((f) => ({
      key: f.key,
      module: f.module,
      risk: f.risk,
      sendsPhi: f.sendsPhi,
      reviewerRoles: f.reviewerRoles,
      attestationRequired: f.attestationRequired,
      tokensIn: f.tokensIn,
      tokensOut: f.tokensOut,
      monthlyUses: f.monthlyUses,
      extraCost: f.extraCostKey ? { key: f.extraCostKey, ...EXTRA_COSTS[f.extraCostKey] } : null,
    })),
  };
}

module.exports = {
  PRICE_BOOK,
  PROVIDERS,
  FEATURES,
  FEATURE_KEYS,
  TOKEN_INSTRUCTION,
  getFeature,
  modelPrice,
  estimateCost,
  costGuidance,
  publicCatalog,
};
