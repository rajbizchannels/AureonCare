// Never send a stored credential back to the browser.
//
// The integration settings routers returned `SELECT *` / `RETURNING *` rows, so any
// signed-in user — a patient included — could read the practice's vendor API secrets and
// passwords, and the Zoom OAuth access/refresh tokens, which let the holder act as the
// practice's Zoom account. A client only ever needs to know whether a secret is SET, so
// each secret field is replaced by a `has_<field>` boolean.
//
// The matching write rule lives in the routers: a blank secret on save means "keep the
// stored one" (NULLIF(..., '')), because a form that can no longer read the secret will
// submit it empty.

const SECRET_FIELDS = [
  'api_secret', 'client_secret', 'webhook_secret', 'secret_key',
  'access_token', 'refresh_token', 'password',
];

function scrub(obj) {
  const out = { ...obj };
  for (const f of SECRET_FIELDS) {
    if (f in out) {
      out[`has_${f}`] = out[f] !== null && out[f] !== undefined && String(out[f]) !== '';
      delete out[f];
    }
  }
  return out;
}

function redactRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = scrub(row);
  // Tokens are also kept inside the `settings` JSON — the backup providers store the
  // Google Drive / OneDrive OAuth access and refresh tokens there — so scrub it too.
  if (out.settings && typeof out.settings === 'object' && !Array.isArray(out.settings)) {
    out.settings = scrub(out.settings);
  } else if (typeof out.settings === 'string') {
    try {
      const parsed = JSON.parse(out.settings);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) out.settings = scrub(parsed);
    } catch { /* not JSON: leave as is */ }
  }
  return out;
}

const redactRows = (rows) => (Array.isArray(rows) ? rows.map(redactRow) : redactRow(rows));

module.exports = { SECRET_FIELDS, redactRow, redactRows };
