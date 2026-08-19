const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
const axios = require('axios');

/**
 * Cloud storage for backups and patient uploads.
 *
 * One place for reading, writing and listing files on Google Drive and
 * OneDrive, so the backup, accounts, inventory and medical-record routes do
 * not each carry their own copy of the token-refresh and upload logic. The
 * medical-record copy in particular never refreshed, so uploads there stopped
 * working silently once the stored token expired.
 *
 * Files live in a named folder rather than the provider's hidden app-data
 * area. That keeps a backup retrievable by hand during a disaster: app-data
 * files are bound to the OAuth client id, so rotating the app registration
 * would strand every backup, including from the provider's own UI. Access is
 * still app-scoped on Google — the drive.file scope only ever grants the app
 * the files it created itself.
 */

const BACKUP_FOLDER_NAME = 'AureonCare Backups';
const UPLOADS_FOLDER_NAME = 'AureonCare Uploads';

const PROVIDERS = {
  google_drive: {
    label: 'Google Drive',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    envClientId: 'REACT_APP_GG_CID',
    envClientSecret: 'AC_GD_CSK',
  },
  onedrive: {
    label: 'OneDrive',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    envClientId: 'REACT_APP_MS_CID',
    envClientSecret: 'AC_OD_CSK',
  },
};

const isSupported = (provider) => Object.prototype.hasOwnProperty.call(PROVIDERS, provider);

const providerLabel = (provider) => PROVIDERS[provider]?.label || provider;

/** Parse the JSONB settings column, which may arrive as text or object. */
function parseSettings(row) {
  if (!row) return {};
  const s = row.settings;
  if (!s) return {};
  return typeof s === 'string' ? JSON.parse(s) : s;
}

/**
 * Which cloud providers are connected (have an access token stored).
 * Returns [{ provider, label }] so callers can offer a choice.
 */
async function getConfiguredProviders(pool) {
  try {
    const result = await pool.query(
      `SELECT provider_type
         FROM backup_provider_settings
        WHERE provider_type IN ('google_drive', 'onedrive')
          AND settings->>'access_token' IS NOT NULL
          AND settings->>'access_token' <> ''`
    );
    return result.rows
      .map(r => r.provider_type)
      .filter(isSupported)
      .map(provider => ({ provider, label: providerLabel(provider) }));
  } catch (err) {
    // Table may not exist yet — treat as nothing connected rather than failing
    // the caller, which is usually just asking whether to show a choice.
    console.warn('Could not read backup_provider_settings:', err.message);
    return [];
  }
}

/**
 * Return a usable access token for a provider, refreshing and persisting it
 * when the stored one has expired. Throws with a message suitable for showing
 * to an admin.
 */
async function getAccessToken(pool, provider) {
  if (!isSupported(provider)) {
    throw new Error(`Unknown backup provider: ${provider}`);
  }
  const cfg = PROVIDERS[provider];
  const label = cfg.label;

  const result = await pool.query(
    `SELECT client_id, client_secret, settings
       FROM backup_provider_settings
      WHERE provider_type = $1`,
    [provider]
  );
  const row = result.rows[0];
  const settings = parseSettings(row);

  const accessToken = settings.access_token;
  const refreshToken = settings.refresh_token;
  const expiresAt = settings.expires_at;

  if (!accessToken) {
    throw new Error(`${label} is not connected. Connect it in Admin Settings first.`);
  }

  // Still valid (60s buffer)
  if (!expiresAt || Date.now() < expiresAt - 60000) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error(`${label} session expired. Please reconnect it in Admin Settings.`);
  }

  const clientId = row?.client_id || process.env[cfg.envClientId];
  const clientSecret = row?.client_secret || process.env[cfg.envClientSecret];
  if (!clientId || !clientSecret) {
    throw new Error(
      `${label} session expired and client credentials are missing. Please reconnect it in Admin Settings.`
    );
  }

  let tokens;
  try {
    const response = await axios.post(
      cfg.tokenUrl,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    tokens = response.data;
  } catch (err) {
    console.error(`${label} token refresh failed:`, err.response?.data || err.message);
    throw new Error(`${label} session expired. Please reconnect it in Admin Settings.`);
  }

  const newExpiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
  await pool.query(
    `UPDATE backup_provider_settings
        SET settings = $1, updated_at = CURRENT_TIMESTAMP
      WHERE provider_type = $2`,
    [
      JSON.stringify({
        ...settings,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken,
        expires_at: newExpiresAt,
      }),
      provider,
    ]
  );
  console.log(`${label} access token refreshed.`);
  return tokens.access_token;
}

// ── Google Drive ────────────────────────────────────────────────────────────

function driveClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * Find the backup folder, creating it if absent. Under the drive.file scope a
 * list only returns files this app created, so this cannot collide with an
 * unrelated folder of the same name in the user's Drive.
 */
async function ensureDriveFolder(drive, folderName = BACKUP_FOLDER_NAME) {
  const existing = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });
  if (existing.data.files?.length) return existing.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  return created.data.id;
}

async function uploadToDrive(accessToken, fileName, json) {
  const drive = driveClient(accessToken);
  const folderId = await ensureDriveFolder(drive);

  const file = await drive.files.create({
    requestBody: { name: fileName, mimeType: 'application/json', parents: [folderId] },
    media: { mimeType: 'application/json', body: json },
    fields: 'id, name, size, webViewLink, createdTime',
  });
  return {
    fileId: file.data.id,
    fileName: file.data.name,
    link: file.data.webViewLink,
    createdAt: file.data.createdTime,
  };
}

async function listFromDrive(accessToken) {
  const drive = driveClient(accessToken);
  const folderId = await ensureDriveFolder(drive);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size, createdTime, modifiedTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });
  return (res.data.files || []).map(f => ({
    fileId: f.id,
    fileName: f.name,
    sizeBytes: f.size ? Number(f.size) : null,
    createdAt: f.createdTime || f.modifiedTime,
  }));
}

async function downloadFromDrive(accessToken, fileId) {
  const drive = driveClient(accessToken);
  const res = await drive.files.get({ fileId, alt: 'media' });
  // googleapis parses JSON responses automatically; tolerate either form.
  return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
}

// ── OneDrive ────────────────────────────────────────────────────────────────

function graphClient(accessToken) {
  return Client.init({ authProvider: (done) => done(null, accessToken) });
}

/** Create the backup folder if it is not already there. */
async function ensureOneDriveFolder(client, folderName = BACKUP_FOLDER_NAME) {
  try {
    await client.api(`/me/drive/root:/${folderName}`).get();
    return;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
  await client.api('/me/drive/root/children').post({
    name: folderName,
    folder: {},
    // Do not clobber a folder created concurrently by another request.
    '@microsoft.graph.conflictBehavior': 'fail',
  });
}

async function uploadToOneDrive(accessToken, fileName, json) {
  const client = graphClient(accessToken);
  await ensureOneDriveFolder(client);

  const uploaded = await client
    .api(`/me/drive/root:/${BACKUP_FOLDER_NAME}/${fileName}:/content`)
    .put(json);

  return {
    fileId: uploaded.id,
    fileName: uploaded.name,
    link: uploaded.webUrl,
    createdAt: uploaded.createdDateTime,
  };
}

async function listFromOneDrive(accessToken) {
  const client = graphClient(accessToken);
  await ensureOneDriveFolder(client);

  const res = await client.api(`/me/drive/root:/${BACKUP_FOLDER_NAME}:/children`).get();
  return (res.value || []).map(f => ({
    fileId: f.id,
    fileName: f.name,
    sizeBytes: typeof f.size === 'number' ? f.size : null,
    createdAt: f.createdDateTime || f.lastModifiedDateTime,
  }));
}

async function downloadFromOneDrive(accessToken, fileId) {
  const client = graphClient(accessToken);
  const content = await client.api(`/me/drive/items/${fileId}/content`).get();
  if (typeof content === 'string') return JSON.parse(content);
  // The Graph SDK hands back a stream for binary content in some versions.
  if (content && typeof content.text === 'function') return JSON.parse(await content.text());
  return content;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a backup payload. `data` is serialised here so every caller stores
 * the same shape and indentation.
 */
async function uploadBackup(pool, provider, fileName, data) {
  const accessToken = await getAccessToken(pool, provider);
  const json = JSON.stringify(data, null, 2);

  const result = provider === 'google_drive'
    ? await uploadToDrive(accessToken, fileName, json)
    : await uploadToOneDrive(accessToken, fileName, json);

  console.log(`Backup uploaded to ${providerLabel(provider)}:`, result.fileName);
  return { provider, label: providerLabel(provider), ...result };
}

/**
 * Upload an arbitrary file (a patient document, not a JSON backup) into a
 * named folder. `body` may be a Buffer or a readable stream.
 *
 * Kept separate from uploadBackup because that one owns serialising the
 * payload; here the caller already has bytes and a real mime type.
 */
async function uploadFile(pool, provider, { folder = UPLOADS_FOLDER_NAME, fileName, mimeType, body }) {
  const accessToken = await getAccessToken(pool, provider);

  if (provider === 'google_drive') {
    const drive = driveClient(accessToken);
    const folderId = await ensureDriveFolder(drive, folder);
    const file = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: mimeType || 'application/octet-stream', body },
      fields: 'id, name, size, webViewLink, createdTime',
    });
    return {
      provider,
      label: providerLabel(provider),
      folder,
      fileId: file.data.id,
      fileName: file.data.name,
      link: file.data.webViewLink,
      createdAt: file.data.createdTime,
    };
  }

  const client = graphClient(accessToken);
  await ensureOneDriveFolder(client, folder);
  const uploaded = await client
    .api(`/me/drive/root:/${folder}/${fileName}:/content`)
    .put(body);
  return {
    provider,
    label: providerLabel(provider),
    folder,
    fileId: uploaded.id,
    fileName: uploaded.name,
    link: uploaded.webUrl,
    createdAt: uploaded.createdDateTime,
  };
}

/**
 * Stream a stored file back. Used to serve a patient document that lives in
 * the cloud rather than on local disk — on a serverless deploy the local copy
 * does not survive, so the cloud copy is the only one there is.
 */
async function downloadFileStream(pool, provider, fileId) {
  const accessToken = await getAccessToken(pool, provider);

  if (provider === 'google_drive') {
    const drive = driveClient(accessToken);
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return res.data;
  }

  const client = graphClient(accessToken);
  return client.api(`/me/drive/items/${fileId}/content`).getStream();
}

/** List backups stored in the folder, newest first. */
async function listBackups(pool, provider) {
  const accessToken = await getAccessToken(pool, provider);
  const files = provider === 'google_drive'
    ? await listFromDrive(accessToken)
    : await listFromOneDrive(accessToken);

  return files
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(f => ({ ...f, provider, label: providerLabel(provider) }));
}

/** Fetch and parse a stored backup. */
async function downloadBackup(pool, provider, fileId) {
  const accessToken = await getAccessToken(pool, provider);
  return provider === 'google_drive'
    ? await downloadFromDrive(accessToken, fileId)
    : await downloadFromOneDrive(accessToken, fileId);
}

module.exports = {
  BACKUP_FOLDER_NAME,
  UPLOADS_FOLDER_NAME,
  isSupported,
  providerLabel,
  getConfiguredProviders,
  uploadBackup,
  listBackups,
  downloadBackup,
  uploadFile,
  downloadFileStream,
};
