// Provider adapters for the AI gateway.
//
// Each adapter exposes two calls:
//   complete({ apiKey, baseUrl, apiVersion, model, system, prompt, maxTokens })
//       -> { text, inputTokens, outputTokens, stopReason, servedModel }
//   test({ apiKey, baseUrl, apiVersion })
//       -> { ok, message }   (lists models; sends no prompt, costs nothing)
//
// The prompt reaching an adapter is already anonymized by the gateway. Adapters never log
// the prompt or the response.

const Anthropic = require('@anthropic-ai/sdk');
const { assertSafeExternalUrl } = require('../../utils/safeUrl');

const REQUEST_TIMEOUT_MS = 120000;

class ProviderError extends Error {
  constructor(message, { status = 502, code = 'ProviderError', refused = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.refused = refused;
  }
}

// ── URL checks ──────────────────────────────────────────────────────────────────────

/** Cloud endpoints must be public https hosts (SSRF guard shared with other vendors). */
async function cloudUrl(baseUrl, fallback) {
  const url = (baseUrl && baseUrl.trim()) || fallback;
  if (!url) throw new ProviderError('A base URL is required for this provider', { status: 400, code: 'BaseUrlRequired' });
  if (url !== fallback) await assertSafeExternalUrl(url);
  return url.replace(/\/+$/, '');
}

/**
 * Offline servers live inside the practice network, so private addresses are expected.
 * Still refuse the cloud metadata range and embedded credentials.
 */
function offlineUrl(baseUrl) {
  let u;
  try {
    u = new URL(String(baseUrl || '').trim());
  } catch {
    throw new ProviderError('Enter the URL of your model server, e.g. http://ollama:11434/v1', { status: 400, code: 'BaseUrlInvalid' });
  }
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new ProviderError('Model server URL must start with http:// or https://', { status: 400, code: 'BaseUrlInvalid' });
  }
  if (u.username || u.password) {
    throw new ProviderError('Do not put credentials in the URL; use the API key field', { status: 400, code: 'BaseUrlInvalid' });
  }
  const host = u.hostname.toLowerCase();
  if (host.startsWith('169.254.') || host === 'metadata.google.internal' || host === 'metadata') {
    throw new ProviderError('That address is not allowed', { status: 400, code: 'BaseUrlBlocked' });
  }
  return u.toString().replace(/\/+$/, '');
}

async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const msg = (json && (json.error?.message || json.message || json.error)) || `HTTP ${res.status}`;
      throw new ProviderError(typeof msg === 'string' ? msg : `HTTP ${res.status}`, {
        status: res.status === 401 || res.status === 403 ? 400 : 502,
        code: res.status === 401 || res.status === 403 ? 'ProviderAuthFailed' : 'ProviderError',
      });
    }
    return json;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err.name === 'AbortError') throw new ProviderError('The AI provider did not respond in time', { code: 'ProviderTimeout' });
    throw new ProviderError(`Could not reach the AI provider: ${err.message}`, { code: 'ProviderUnreachable' });
  } finally {
    clearTimeout(timer);
  }
}

// ── Anthropic (official SDK) ────────────────────────────────────────────────────────

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
// Claude Haiku 5.5 has no server-side fallback.
const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

async function anthropicClient({ apiKey, baseUrl }) {
  const opts = { apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 };
  if (baseUrl && baseUrl.trim()) {
    await assertSafeExternalUrl(baseUrl.trim());
    opts.baseURL = baseUrl.trim();
  }
  return new Anthropic(opts);
}

function mapAnthropicError(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError('The Anthropic API key was rejected', { status: 400, code: 'ProviderAuthFailed' });
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new ProviderError('Unknown model or endpoint at Anthropic', { status: 400, code: 'ProviderModelNotFound' });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ProviderError('Anthropic rate limit reached; try again shortly', { status: 429, code: 'ProviderRateLimited' });
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ProviderError(`Anthropic rejected the request: ${err.message}`, { status: 400, code: 'ProviderBadRequest' });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ProviderError('Could not reach Anthropic', { code: 'ProviderUnreachable' });
  }
  if (err instanceof Anthropic.APIError) {
    return new ProviderError(`Anthropic error: ${err.message}`, { code: 'ProviderError' });
  }
  return err;
}

const anthropic = {
  async complete({ apiKey, baseUrl, model, system, prompt, maxTokens }) {
    const client = await anthropicClient({ apiKey, baseUrl });
    const params = {
      model,
      max_tokens: maxTokens || 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
    };
    let response;
    try {
      if (ANTHROPIC_FALLBACK_MODELS.has(model)) {
        // A declined request is re-run on Anthropic's recommended fallback model server-side.
        response = await client.beta.messages.create({
          ...params,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        });
      } else {
        response = await client.messages.create(params);
      }
    } catch (err) {
      throw mapAnthropicError(err);
    }

    if (response.stop_reason === 'refusal') {
      throw new ProviderError('The AI model declined this request', { status: 422, code: 'ProviderRefused', refused: true });
    }
    const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return {
      text,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      stopReason: response.stop_reason,
      servedModel: response.model || model,
    };
  },

  async test({ apiKey, baseUrl }) {
    const client = await anthropicClient({ apiKey, baseUrl });
    try {
      const page = await client.models.list({ limit: 5 });
      const count = (page.data || []).length;
      return { ok: true, message: `Connected. ${count} model(s) visible to this key.` };
    } catch (err) {
      throw mapAnthropicError(err);
    }
  },
};

// ── OpenAI-compatible (OpenAI, Mistral, offline servers) ────────────────────────────

function openAiCompatible({ defaultBase, tokenField }) {
  return {
    async complete({ apiKey, baseUrl, model, system, prompt, maxTokens, offline }) {
      const base = offline ? offlineUrl(baseUrl) : await cloudUrl(baseUrl, defaultBase);
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
      const json = await httpJson(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: {
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          [tokenField]: maxTokens || 4000,
        },
      });
      const choice = json?.choices?.[0];
      if (choice?.finish_reason === 'content_filter') {
        throw new ProviderError('The AI model declined this request', { status: 422, code: 'ProviderRefused', refused: true });
      }
      return {
        text: String(choice?.message?.content || '').trim(),
        inputTokens: json?.usage?.prompt_tokens ?? null,
        outputTokens: json?.usage?.completion_tokens ?? null,
        stopReason: choice?.finish_reason || null,
        servedModel: json?.model || model,
      };
    },
    async test({ apiKey, baseUrl, offline }) {
      const base = offline ? offlineUrl(baseUrl) : await cloudUrl(baseUrl, defaultBase);
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
      const json = await httpJson(`${base}/models`, { headers });
      const count = Array.isArray(json?.data) ? json.data.length : 0;
      return { ok: true, message: `Connected. ${count} model(s) available.` };
    },
  };
}

const openai = openAiCompatible({ defaultBase: 'https://api.openai.com/v1', tokenField: 'max_completion_tokens' });
const mistral = openAiCompatible({ defaultBase: 'https://api.mistral.ai/v1', tokenField: 'max_tokens' });
const offlineCompat = openAiCompatible({ defaultBase: null, tokenField: 'max_tokens' });
const offline = {
  complete: (args) => offlineCompat.complete({ ...args, offline: true }),
  test: (args) => offlineCompat.test({ ...args, offline: true }),
};

// ── Azure OpenAI ────────────────────────────────────────────────────────────────────

const azure_openai = {
  async complete({ apiKey, baseUrl, apiVersion, model, system, prompt, maxTokens }) {
    const base = await cloudUrl(baseUrl, null);
    const json = await httpJson(
      `${base}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion || '2024-10-21')}`,
      {
        method: 'POST',
        headers: { 'api-key': apiKey },
        body: {
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          max_completion_tokens: maxTokens || 4000,
        },
      }
    );
    const choice = json?.choices?.[0];
    if (choice?.finish_reason === 'content_filter') {
      throw new ProviderError('The AI model declined this request', { status: 422, code: 'ProviderRefused', refused: true });
    }
    return {
      text: String(choice?.message?.content || '').trim(),
      inputTokens: json?.usage?.prompt_tokens ?? null,
      outputTokens: json?.usage?.completion_tokens ?? null,
      stopReason: choice?.finish_reason || null,
      servedModel: json?.model || model,
    };
  },
  async test({ apiKey, baseUrl, apiVersion }) {
    const base = await cloudUrl(baseUrl, null);
    await httpJson(`${base}/openai/models?api-version=${encodeURIComponent(apiVersion || '2024-10-21')}`, {
      headers: { 'api-key': apiKey },
    });
    return { ok: true, message: 'Connected to Azure OpenAI.' };
  },
};

// ── Google Gemini ───────────────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const google_gemini = {
  async complete({ apiKey, model, system, prompt, maxTokens }) {
    const json = await httpJson(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens || 4000 },
      },
    });
    const cand = json?.candidates?.[0];
    if (!cand || cand.finishReason === 'SAFETY' || json?.promptFeedback?.blockReason) {
      throw new ProviderError('The AI model declined this request', { status: 422, code: 'ProviderRefused', refused: true });
    }
    return {
      text: (cand.content?.parts || []).map((p) => p.text || '').join('').trim(),
      inputTokens: json?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: json?.usageMetadata?.candidatesTokenCount ?? null,
      stopReason: cand.finishReason || null,
      servedModel: model,
    };
  },
  async test({ apiKey }) {
    const json = await httpJson(`${GEMINI_BASE}/models?pageSize=5`, { headers: { 'x-goog-api-key': apiKey } });
    const count = Array.isArray(json?.models) ? json.models.length : 0;
    return { ok: true, message: `Connected. ${count} model(s) visible to this key.` };
  },
};

const ADAPTERS = { anthropic, openai, azure_openai, google_gemini, mistral, offline };

function getAdapter(provider) {
  const a = ADAPTERS[provider];
  if (!a) throw new ProviderError(`Unsupported AI provider: ${provider}`, { status: 400, code: 'ProviderUnsupported' });
  return a;
}

module.exports = { getAdapter, ProviderError, offlineUrl };
